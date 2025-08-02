#!/usr/bin/env node

/**
 * 의존성 정리 도구
 * 사용되지 않는 npm 패키지 식별 및 정리
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DependencyCleaner {
  constructor() {
    this.projectRoot = process.cwd();
    this.packageJsonPath = path.join(this.projectRoot, 'package.json');
    this.packageJson = null;
    this.unusedDependencies = [];
    this.potentiallyUnused = [];
    this.safeDependencies = [];
  }

  /**
   * 의존성 분석 실행
   */
  async analyze() {
    console.log('🔍 의존성 분석 시작...');
    
    try {
      // 1. package.json 로드
      this.packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      
      const dependencies = {
        ...this.packageJson.dependencies,
        ...this.packageJson.devDependencies
      };

      console.log(`📦 총 의존성: ${Object.keys(dependencies).length}개`);

      // 2. 각 의존성 사용 여부 확인
      await this.analyzeDependencyUsage(dependencies);

      // 3. 분석 결과 분류
      this.classifyDependencies();

      // 4. 분석 결과 출력
      this.generateReport();

      return {
        unusedDependencies: this.unusedDependencies,
        potentiallyUnused: this.potentiallyUnused,
        safeDependencies: this.safeDependencies
      };

    } catch (error) {
      console.error('❌ 의존성 분석 중 오류 발생:', error.message);
      throw error;
    }
  }

  /**
   * 의존성 사용 여부 분석
   */
  async analyzeDependencyUsage(dependencies) {
    console.log('\n🔍 의존성 사용 여부 분석 중...');

    for (const [packageName, version] of Object.entries(dependencies)) {
      const usage = await this.checkPackageUsage(packageName);
      
      const dependencyInfo = {
        name: packageName,
        version,
        usage,
        category: this.categorizeDependency(packageName),
        risk: this.assessRemovalRisk(packageName, usage)
      };

      if (usage.directImports === 0 && usage.indirectReferences === 0) {
        this.unusedDependencies.push(dependencyInfo);
      } else if (usage.directImports === 0 && usage.indirectReferences > 0) {
        this.potentiallyUnused.push(dependencyInfo);
      } else {
        this.safeDependencies.push(dependencyInfo);
      }
    }
  }

  /**
   * 패키지 사용 여부 확인
   */
  async checkPackageUsage(packageName) {
    const usage = {
      directImports: 0,
      indirectReferences: 0,
      configFiles: 0,
      scriptReferences: 0
    };

    try {
      // 1. 직접 import 확인
      const importPatterns = [
        `import.*from.*['"\`]${packageName}['"\`]`,
        `import.*['"\`]${packageName}['"\`]`,
        `require\\(['"\`]${packageName}['"\`]\\)`
      ];

      for (const pattern of importPatterns) {
        try {
          const result = execSync(`grep -r "${pattern}" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true`, 
            { encoding: 'utf8', stdio: 'pipe' });
          
          if (result.trim()) {
            usage.directImports += result.trim().split('\n').length;
          }
        } catch (error) {
          // grep 명령어 실패 시 무시
        }
      }

      // 2. 간접 참조 확인 (설정 파일, 타입 등)
      const indirectPatterns = [
        packageName,
        packageName.replace(/-/g, ''),
        packageName.replace('@', '').replace('/', '-')
      ];

      for (const pattern of indirectPatterns) {
        try {
          const result = execSync(`grep -r "${pattern}" . --include="*.json" --include="*.config.*" --include="*.d.ts" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null || true`, 
            { encoding: 'utf8', stdio: 'pipe' });
          
          if (result.trim()) {
            usage.indirectReferences += result.trim().split('\n').filter(line => 
              !line.includes('package.json') && !line.includes('package-lock.json')
            ).length;
          }
        } catch (error) {
          // grep 명령어 실패 시 무시
        }
      }

      // 3. package.json scripts 확인
      const scripts = this.packageJson.scripts || {};
      for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
        if (scriptCommand.includes(packageName)) {
          usage.scriptReferences++;
        }
      }

    } catch (error) {
      // 분석 실패 시 안전하게 사용 중인 것으로 간주
      usage.directImports = 1;
    }

    return usage;
  }

  /**
   * 의존성 카테고리 분류
   */
  categorizeDependency(packageName) {
    const categories = {
      framework: ['next', 'react', 'react-dom'],
      ui: ['@radix-ui', 'lucide-react', 'tailwind', 'framer-motion'],
      database: ['@supabase', 'supabase'],
      testing: ['jest', '@testing-library', '@jest'],
      build: ['typescript', 'eslint', 'postcss', 'autoprefixer'],
      utility: ['zod', 'clsx', 'date-fns', 'axios'],
      development: ['@types', 'tsx', 'terser-webpack-plugin']
    };

    for (const [category, packages] of Object.entries(categories)) {
      if (packages.some(pkg => packageName.includes(pkg))) {
        return category;
      }
    }

    return 'other';
  }

  /**
   * 제거 위험도 평가
   */
  assessRemovalRisk(packageName, usage) {
    // 핵심 프레임워크는 높은 위험도
    const criticalPackages = [
      'next', 'react', 'react-dom', '@supabase/supabase-js',
      'typescript', 'tailwindcss', '@tanstack/react-query'
    ];

    if (criticalPackages.some(pkg => packageName.includes(pkg))) {
      return 'high';
    }

    // 직접 import가 있으면 중간 위험도
    if (usage.directImports > 0) {
      return 'medium';
    }

    // 간접 참조만 있으면 낮은 위험도
    if (usage.indirectReferences > 0) {
      return 'low';
    }

    // 사용되지 않으면 매우 낮은 위험도
    return 'very_low';
  }

  /**
   * 의존성 분류
   */
  classifyDependencies() {
    // 위험도별로 정렬
    this.unusedDependencies.sort((a, b) => {
      const riskOrder = { 'very_low': 0, 'low': 1, 'medium': 2, 'high': 3 };
      return riskOrder[a.risk] - riskOrder[b.risk];
    });

    this.potentiallyUnused.sort((a, b) => {
      const riskOrder = { 'very_low': 0, 'low': 1, 'medium': 2, 'high': 3 };
      return riskOrder[a.risk] - riskOrder[b.risk];
    });
  }

  /**
   * 분석 결과 보고서 생성
   */
  generateReport() {
    console.log('\n📊 의존성 분석 결과:');
    console.log(`사용되지 않는 의존성: ${this.unusedDependencies.length}개`);
    console.log(`잠재적으로 불필요한 의존성: ${this.potentiallyUnused.length}개`);
    console.log(`안전한 의존성: ${this.safeDependencies.length}개`);

    if (this.unusedDependencies.length > 0) {
      console.log('\n🗑️  사용되지 않는 의존성:');
      this.unusedDependencies.forEach(dep => {
        console.log(`  - ${dep.name} (${dep.category}, 위험도: ${dep.risk})`);
      });
    }

    if (this.potentiallyUnused.length > 0) {
      console.log('\n⚠️  잠재적으로 불필요한 의존성:');
      this.potentiallyUnused.slice(0, 5).forEach(dep => {
        console.log(`  - ${dep.name} (간접 참조: ${dep.usage.indirectReferences}개)`);
      });
      if (this.potentiallyUnused.length > 5) {
        console.log(`  ... 및 ${this.potentiallyUnused.length - 5}개 더`);
      }
    }

    // 카테고리별 분포
    const categoryCount = {};
    [...this.unusedDependencies, ...this.potentiallyUnused].forEach(dep => {
      categoryCount[dep.category] = (categoryCount[dep.category] || 0) + 1;
    });

    if (Object.keys(categoryCount).length > 0) {
      console.log('\n📈 카테고리별 불필요한 의존성:');
      Object.entries(categoryCount).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}개`);
      });
    }
  }

  /**
   * 제거 권장사항 생성
   */
  generateRemovalRecommendations() {
    const recommendations = {
      safeToRemove: [],
      needsReview: [],
      keepForNow: []
    };

    // 매우 낮은 위험도는 안전하게 제거 가능
    const safeToRemove = this.unusedDependencies.filter(dep => 
      dep.risk === 'very_low' && 
      !['framework', 'build'].includes(dep.category)
    );

    // 낮은 위험도는 검토 후 제거
    const needsReview = [
      ...this.unusedDependencies.filter(dep => dep.risk === 'low'),
      ...this.potentiallyUnused.filter(dep => dep.risk === 'very_low')
    ];

    // 나머지는 유지
    const keepForNow = [
      ...this.unusedDependencies.filter(dep => ['medium', 'high'].includes(dep.risk)),
      ...this.potentiallyUnused.filter(dep => dep.risk !== 'very_low')
    ];

    recommendations.safeToRemove = safeToRemove;
    recommendations.needsReview = needsReview;
    recommendations.keepForNow = keepForNow;

    return recommendations;
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  saveResults(outputPath = 'dependency-analysis.json') {
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDependencies: Object.keys({
          ...this.packageJson.dependencies,
          ...this.packageJson.devDependencies
        }).length,
        unusedCount: this.unusedDependencies.length,
        potentiallyUnusedCount: this.potentiallyUnused.length,
        safeCount: this.safeDependencies.length
      },
      unusedDependencies: this.unusedDependencies,
      potentiallyUnused: this.potentiallyUnused,
      safeDependencies: this.safeDependencies,
      recommendations: this.generateRemovalRecommendations()
    };

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 분석 결과 저장: ${outputPath}`);
  }
}

// CLI 실행
if (require.main === module) {
  const cleaner = new DependencyCleaner();
  
  cleaner.analyze()
    .then((results) => {
      cleaner.saveResults();
      console.log('\n✅ 의존성 분석 완료');
    })
    .catch((error) => {
      console.error('❌ 분석 실패:', error);
      process.exit(1);
    });
}

module.exports = DependencyCleaner;