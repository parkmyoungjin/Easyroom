#!/usr/bin/env node

/**
 * Import 구조 분석 도구
 * 상대 경로 vs 절대 경로 import 패턴 분석 및 표준화 계획 수립
 */

const fs = require('fs');
const path = require('path');

class ImportAnalyzer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcPath = path.join(this.projectRoot, 'src');
    this.relativeImports = [];
    this.absoluteImports = [];
    this.unusedImports = [];
    this.inconsistentPatterns = [];
  }

  /**
   * Import 구조 분석 실행
   */
  async analyze() {
    console.log('🔍 Import 구조 분석 시작...');
    
    try {
      // 1. 모든 TypeScript/JavaScript 파일 수집
      const files = this.collectSourceFiles();
      console.log(`📁 분석 대상 파일: ${files.length}개`);

      // 2. 각 파일의 import 분석
      for (const file of files) {
        await this.analyzeFileImports(file);
      }

      // 3. 패턴 분석 및 일관성 검사
      this.analyzePatterns();

      // 4. 표준화 계획 수립
      const plan = this.createStandardizationPlan();

      // 5. 분석 결과 출력
      this.generateReport();

      return {
        relativeImports: this.relativeImports,
        absoluteImports: this.absoluteImports,
        unusedImports: this.unusedImports,
        inconsistentPatterns: this.inconsistentPatterns,
        standardizationPlan: plan
      };

    } catch (error) {
      console.error('❌ Import 분석 중 오류 발생:', error.message);
      throw error;
    }
  }

  /**
   * 소스 파일 수집
   */
  collectSourceFiles() {
    const files = [];
    
    const walkDir = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!['node_modules', '.next', '.git', 'coverage', 'test-reports'].includes(item)) {
            walkDir(fullPath);
          }
        } else if (stat.isFile()) {
          if (/\.(ts|tsx|js|jsx)$/.test(item) && !item.endsWith('.d.ts')) {
            files.push(fullPath);
          }
        }
      }
    };

    walkDir(this.srcPath);
    
    // 루트의 중요 파일들도 포함
    const rootFiles = ['middleware.ts', 'next.config.ts'].map(f => 
      path.join(this.projectRoot, f)
    ).filter(f => fs.existsSync(f));
    
    files.push(...rootFiles);
    
    return files;
  }

  /**
   * 개별 파일의 import 분석
   */
  async analyzeFileImports(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const imports = this.extractImports(content);
      
      for (const importInfo of imports) {
        const analysis = {
          file: filePath,
          relativePath: path.relative(this.projectRoot, filePath),
          ...importInfo
        };

        if (importInfo.type === 'relative') {
          this.relativeImports.push(analysis);
        } else if (importInfo.type === 'absolute') {
          this.absoluteImports.push(analysis);
        }
      }
      
    } catch (error) {
      console.warn(`⚠️  파일 분석 실패: ${filePath} - ${error.message}`);
    }
  }

  /**
   * import 구문 추출 및 분류
   */
  extractImports(content) {
    const imports = [];
    
    // import 구문 정규식 (더 정확한 매칭)
    const importRegex = /^import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/gm;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const fullMatch = match[0];
      
      // 외부 라이브러리 제외
      if (!importPath.startsWith('./') && !importPath.startsWith('../') && !importPath.startsWith('@/')) {
        continue;
      }

      const importInfo = {
        statement: fullMatch.trim(),
        path: importPath,
        type: this.classifyImportType(importPath),
        lineNumber: this.getLineNumber(content, match.index)
      };

      imports.push(importInfo);
    }

    // require 구문도 확인
    const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      if (importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('@/')) {
        imports.push({
          statement: match[0],
          path: importPath,
          type: this.classifyImportType(importPath),
          lineNumber: this.getLineNumber(content, match.index),
          isRequire: true
        });
      }
    }

    return imports;
  }

  /**
   * import 타입 분류
   */
  classifyImportType(importPath) {
    if (importPath.startsWith('@/')) {
      return 'absolute';
    } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return 'relative';
    }
    return 'external';
  }

  /**
   * 라인 번호 계산
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * 패턴 분석 및 일관성 검사
   */
  analyzePatterns() {
    // 파일별 import 패턴 분석
    const filePatterns = new Map();
    
    [...this.relativeImports, ...this.absoluteImports].forEach(imp => {
      if (!filePatterns.has(imp.file)) {
        filePatterns.set(imp.file, { relative: 0, absolute: 0 });
      }
      
      const pattern = filePatterns.get(imp.file);
      if (imp.type === 'relative') {
        pattern.relative++;
      } else if (imp.type === 'absolute') {
        pattern.absolute++;
      }
    });

    // 일관성 없는 파일 식별
    for (const [file, pattern] of filePatterns) {
      if (pattern.relative > 0 && pattern.absolute > 0) {
        this.inconsistentPatterns.push({
          file,
          relativePath: path.relative(this.projectRoot, file),
          relativeCount: pattern.relative,
          absoluteCount: pattern.absolute,
          recommendation: this.getRecommendation(file, pattern)
        });
      }
    }
  }

  /**
   * 파일별 권장사항 결정
   */
  getRecommendation(file, pattern) {
    const relativePath = path.relative(this.projectRoot, file);
    
    // 테스트 파일은 상대 경로 권장
    if (relativePath.includes('__tests__') || relativePath.includes('.test.') || relativePath.includes('.spec.')) {
      return 'relative';
    }
    
    // 일반 소스 파일은 절대 경로 권장
    return 'absolute';
  }

  /**
   * 표준화 계획 수립
   */
  createStandardizationPlan() {
    const plan = {
      rules: {
        testFiles: 'relative', // 테스트 파일은 상대 경로
        sourceFiles: 'absolute', // 소스 파일은 절대 경로
        exceptions: []
      },
      changes: [],
      statistics: {
        totalFiles: new Set([...this.relativeImports, ...this.absoluteImports].map(i => i.file)).size,
        inconsistentFiles: this.inconsistentPatterns.length,
        relativeImports: this.relativeImports.length,
        absoluteImports: this.absoluteImports.length
      }
    };

    // 변경이 필요한 import 식별
    for (const inconsistent of this.inconsistentPatterns) {
      const recommendation = inconsistent.recommendation;
      
      if (recommendation === 'absolute') {
        // 상대 경로를 절대 경로로 변경
        const relativeImportsInFile = this.relativeImports.filter(imp => imp.file === inconsistent.file);
        for (const imp of relativeImportsInFile) {
          const absolutePath = this.convertToAbsolutePath(imp.file, imp.path);
          if (absolutePath) {
            plan.changes.push({
              file: inconsistent.relativePath,
              lineNumber: imp.lineNumber,
              from: imp.path,
              to: absolutePath,
              statement: imp.statement,
              type: 'relative_to_absolute'
            });
          }
        }
      } else if (recommendation === 'relative') {
        // 절대 경로를 상대 경로로 변경 (테스트 파일의 경우)
        const absoluteImportsInFile = this.absoluteImports.filter(imp => imp.file === inconsistent.file);
        for (const imp of absoluteImportsInFile) {
          const relativePath = this.convertToRelativePath(imp.file, imp.path);
          if (relativePath) {
            plan.changes.push({
              file: inconsistent.relativePath,
              lineNumber: imp.lineNumber,
              from: imp.path,
              to: relativePath,
              statement: imp.statement,
              type: 'absolute_to_relative'
            });
          }
        }
      }
    }

    return plan;
  }

  /**
   * 상대 경로를 절대 경로로 변환
   */
  convertToAbsolutePath(fromFile, relativePath) {
    try {
      const fromDir = path.dirname(fromFile);
      const resolvedPath = path.resolve(fromDir, relativePath);
      const srcRelativePath = path.relative(this.srcPath, resolvedPath);
      
      // src 디렉토리 내부의 파일만 절대 경로로 변환
      if (!srcRelativePath.startsWith('..')) {
        return '@/' + srcRelativePath.replace(/\\/g, '/');
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 절대 경로를 상대 경로로 변환
   */
  convertToRelativePath(fromFile, absolutePath) {
    try {
      if (!absolutePath.startsWith('@/')) {
        return null;
      }
      
      const targetPath = path.join(this.srcPath, absolutePath.substring(2));
      const fromDir = path.dirname(fromFile);
      const relativePath = path.relative(fromDir, targetPath);
      
      // 상대 경로 정규화
      const normalizedPath = relativePath.replace(/\\/g, '/');
      return normalizedPath.startsWith('.') ? normalizedPath : './' + normalizedPath;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * 분석 결과 보고서 생성
   */
  generateReport() {
    console.log('\n📊 Import 구조 분석 결과:');
    console.log(`총 파일 수: ${new Set([...this.relativeImports, ...this.absoluteImports].map(i => i.file)).size}`);
    console.log(`상대 경로 import: ${this.relativeImports.length}개`);
    console.log(`절대 경로 import: ${this.absoluteImports.length}개`);
    console.log(`일관성 없는 파일: ${this.inconsistentPatterns.length}개`);
    
    if (this.inconsistentPatterns.length > 0) {
      console.log('\n🔄 일관성 없는 파일 (상대/절대 경로 혼용):');
      this.inconsistentPatterns.slice(0, 10).forEach(pattern => {
        console.log(`- ${pattern.relativePath}`);
        console.log(`  상대: ${pattern.relativeCount}개, 절대: ${pattern.absoluteCount}개`);
        console.log(`  권장: ${pattern.recommendation === 'relative' ? '상대 경로' : '절대 경로'}`);
      });
      
      if (this.inconsistentPatterns.length > 10) {
        console.log(`... 및 ${this.inconsistentPatterns.length - 10}개 더`);
      }
    }

    // 파일 타입별 분포
    const testFiles = this.inconsistentPatterns.filter(p => 
      p.relativePath.includes('__tests__') || p.relativePath.includes('.test.') || p.relativePath.includes('.spec.')
    );
    
    console.log('\n📈 파일 타입별 분포:');
    console.log(`테스트 파일: ${testFiles.length}개`);
    console.log(`일반 소스 파일: ${this.inconsistentPatterns.length - testFiles.length}개`);
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  saveResults(outputPath = 'import-analysis.json') {
    const results = {
      timestamp: new Date().toISOString(),
      statistics: {
        totalFiles: new Set([...this.relativeImports, ...this.absoluteImports].map(i => i.file)).size,
        relativeImports: this.relativeImports.length,
        absoluteImports: this.absoluteImports.length,
        inconsistentFiles: this.inconsistentPatterns.length
      },
      relativeImports: this.relativeImports.map(imp => ({
        file: path.relative(this.projectRoot, imp.file),
        path: imp.path,
        statement: imp.statement,
        lineNumber: imp.lineNumber
      })),
      absoluteImports: this.absoluteImports.map(imp => ({
        file: path.relative(this.projectRoot, imp.file),
        path: imp.path,
        statement: imp.statement,
        lineNumber: imp.lineNumber
      })),
      inconsistentPatterns: this.inconsistentPatterns,
      standardizationPlan: this.createStandardizationPlan()
    };

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 분석 결과 저장: ${outputPath}`);
  }
}

// CLI 실행
if (require.main === module) {
  const analyzer = new ImportAnalyzer();
  
  analyzer.analyze()
    .then((results) => {
      analyzer.saveResults();
      console.log('\n✅ Import 구조 분석 완료');
    })
    .catch((error) => {
      console.error('❌ 분석 실패:', error);
      process.exit(1);
    });
}

module.exports = ImportAnalyzer;