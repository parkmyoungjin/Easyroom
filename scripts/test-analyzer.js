#!/usr/bin/env node

/**
 * 테스트 파일 구조 분석 도구
 * 테스트 파일들의 일관성 검사 및 표준화 계획 수립
 */

const fs = require('fs');
const path = require('path');

class TestAnalyzer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcPath = path.join(this.projectRoot, 'src');
    this.testFiles = [];
    this.testPatterns = [];
    this.duplicateTests = [];
    this.inconsistentStructures = [];
    this.testUtilities = [];
  }

  /**
   * 테스트 파일 분석 실행
   */
  async analyze() {
    console.log('🔍 테스트 파일 구조 분석 시작...');
    
    try {
      // 1. 모든 테스트 파일 수집
      this.testFiles = this.collectTestFiles();
      console.log(`📁 분석 대상 테스트 파일: ${this.testFiles.length}개`);

      // 2. 테스트 패턴 분석
      await this.analyzeTestPatterns();

      // 3. 테스트 유틸리티 분석
      await this.analyzeTestUtilities();

      // 4. 중복 테스트 로직 검사
      await this.findDuplicateTestLogic();

      // 5. 구조 일관성 검사
      await this.checkStructureConsistency();

      // 6. 표준화 계획 수립
      const standardizationPlan = this.createStandardizationPlan();

      // 7. 분석 결과 출력
      this.generateReport();

      return {
        testFiles: this.testFiles,
        testPatterns: this.testPatterns,
        duplicateTests: this.duplicateTests,
        inconsistentStructures: this.inconsistentStructures,
        testUtilities: this.testUtilities,
        standardizationPlan
      };

    } catch (error) {
      console.error('❌ 테스트 분석 중 오류 발생:', error.message);
      throw error;
    }
  }

  /**
   * 테스트 파일 수집
   */
  collectTestFiles() {
    const testFiles = [];
    
    const walkDir = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!['node_modules', '.next', '.git', 'coverage'].includes(item)) {
            walkDir(fullPath);
          }
        } else if (stat.isFile()) {
          // 테스트 파일 패턴 확인
          if (this.isTestFile(item, fullPath)) {
            testFiles.push({
              name: item,
              path: fullPath,
              relativePath: path.relative(this.projectRoot, fullPath),
              directory: path.dirname(fullPath),
              size: stat.size,
              lastModified: stat.mtime
            });
          }
        }
      }
    };

    walkDir(this.srcPath);
    
    return testFiles;
  }

  /**
   * 테스트 파일 여부 확인
   */
  isTestFile(fileName, fullPath) {
    const testPatterns = [
      /\.test\.(ts|tsx|js|jsx)$/,
      /\.spec\.(ts|tsx|js|jsx)$/,
      /__tests__.*\.(ts|tsx|js|jsx)$/
    ];

    return testPatterns.some(pattern => pattern.test(fileName)) ||
           fullPath.includes('__tests__');
  }

  /**
   * 테스트 패턴 분석
   */
  async analyzeTestPatterns() {
    const patterns = {
      byNaming: {
        test: 0,      // .test.
        spec: 0,      // .spec.
        testsDir: 0   // __tests__/
      },
      byLocation: {
        colocated: 0,    // 소스 파일과 같은 디렉토리
        testsDirectory: 0, // __tests__ 디렉토리
        separate: 0      // 별도 테스트 디렉토리
      },
      byFramework: {
        jest: 0,
        react_testing_library: 0,
        unknown: 0
      }
    };

    for (const testFile of this.testFiles) {
      // 네이밍 패턴 분석
      if (testFile.name.includes('.test.')) {
        patterns.byNaming.test++;
      } else if (testFile.name.includes('.spec.')) {
        patterns.byNaming.spec++;
      } else if (testFile.path.includes('__tests__')) {
        patterns.byNaming.testsDir++;
      }

      // 위치 패턴 분석
      if (testFile.path.includes('__tests__')) {
        patterns.byLocation.testsDirectory++;
      } else {
        // 같은 디렉토리에 소스 파일이 있는지 확인
        const sourceFile = this.findCorrespondingSourceFile(testFile);
        if (sourceFile) {
          patterns.byLocation.colocated++;
        } else {
          patterns.byLocation.separate++;
        }
      }

      // 프레임워크 분석
      try {
        const content = fs.readFileSync(testFile.path, 'utf8');
        if (content.includes('jest') || content.includes('describe') || content.includes('it(')) {
          patterns.byFramework.jest++;
        }
        if (content.includes('@testing-library/react') || content.includes('render')) {
          patterns.byFramework.react_testing_library++;
        }
        if (!content.includes('jest') && !content.includes('describe')) {
          patterns.byFramework.unknown++;
        }
      } catch (error) {
        patterns.byFramework.unknown++;
      }
    }

    this.testPatterns = patterns;
  }

  /**
   * 대응하는 소스 파일 찾기
   */
  findCorrespondingSourceFile(testFile) {
    const testDir = path.dirname(testFile.path);
    const testName = testFile.name;
    
    // .test. 또는 .spec. 제거하여 원본 파일명 추정
    const sourceFileName = testName
      .replace(/\.test\./, '.')
      .replace(/\.spec\./, '.');
    
    const possibleSourcePath = path.join(testDir, sourceFileName);
    
    return fs.existsSync(possibleSourcePath) ? possibleSourcePath : null;
  }

  /**
   * 테스트 유틸리티 분석
   */
  async analyzeTestUtilities() {
    const utilities = new Map();
    
    for (const testFile of this.testFiles) {
      try {
        const content = fs.readFileSync(testFile.path, 'utf8');
        
        // 공통 유틸리티 함수 패턴 찾기
        const utilityPatterns = [
          /function\s+(\w*[Mm]ock\w*)/g,
          /const\s+(\w*[Mm]ock\w*)\s*=/g,
          /function\s+(\w*[Tt]est\w*)/g,
          /const\s+(\w*[Hh]elper\w*)\s*=/g,
          /function\s+(\w*[Ss]etup\w*)/g,
          /const\s+(\w*[Ss]etup\w*)\s*=/g
        ];

        for (const pattern of utilityPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const utilityName = match[1];
            
            if (!utilities.has(utilityName)) {
              utilities.set(utilityName, []);
            }
            
            utilities.get(utilityName).push({
              file: testFile.relativePath,
              name: utilityName
            });
          }
        }
      } catch (error) {
        // 파일 읽기 실패 시 무시
      }
    }

    // 중복된 유틸리티 찾기
    this.testUtilities = Array.from(utilities.entries())
      .filter(([name, occurrences]) => occurrences.length > 1)
      .map(([name, occurrences]) => ({
        name,
        occurrences,
        count: occurrences.length
      }));
  }

  /**
   * 중복 테스트 로직 검사
   */
  async findDuplicateTestLogic() {
    const testDescriptions = new Map();
    
    for (const testFile of this.testFiles) {
      try {
        const content = fs.readFileSync(testFile.path, 'utf8');
        
        // describe와 it 블록 찾기
        const describeMatches = content.match(/describe\(['"`]([^'"`]+)['"`]/g) || [];
        const itMatches = content.match(/it\(['"`]([^'"`]+)['"`]/g) || [];
        
        const descriptions = [
          ...describeMatches.map(match => match.replace(/describe\(['"`]([^'"`]+)['"`]/, '$1')),
          ...itMatches.map(match => match.replace(/it\(['"`]([^'"`]+)['"`]/, '$1'))
        ];

        for (const description of descriptions) {
          if (!testDescriptions.has(description)) {
            testDescriptions.set(description, []);
          }
          
          testDescriptions.get(description).push({
            file: testFile.relativePath,
            description
          });
        }
      } catch (error) {
        // 파일 읽기 실패 시 무시
      }
    }

    // 중복된 테스트 설명 찾기
    this.duplicateTests = Array.from(testDescriptions.entries())
      .filter(([description, occurrences]) => occurrences.length > 1)
      .map(([description, occurrences]) => ({
        description,
        occurrences,
        count: occurrences.length
      }));
  }

  /**
   * 구조 일관성 검사
   */
  async checkStructureConsistency() {
    const structureIssues = [];

    // 1. 네이밍 일관성 검사
    const namingPatterns = new Set();
    for (const testFile of this.testFiles) {
      if (testFile.name.includes('.test.')) {
        namingPatterns.add('test');
      } else if (testFile.name.includes('.spec.')) {
        namingPatterns.add('spec');
      } else {
        namingPatterns.add('directory');
      }
    }

    if (namingPatterns.size > 1) {
      structureIssues.push({
        type: 'naming_inconsistency',
        description: '테스트 파일 네이밍 패턴이 일관되지 않음',
        patterns: Array.from(namingPatterns),
        severity: 'medium'
      });
    }

    // 2. 디렉토리 구조 일관성 검사
    const directoryStructures = new Set();
    for (const testFile of this.testFiles) {
      if (testFile.path.includes('__tests__')) {
        directoryStructures.add('tests_directory');
      } else {
        directoryStructures.add('colocated');
      }
    }

    if (directoryStructures.size > 1) {
      structureIssues.push({
        type: 'directory_inconsistency',
        description: '테스트 파일 위치가 일관되지 않음',
        structures: Array.from(directoryStructures),
        severity: 'low'
      });
    }

    // 3. Import 패턴 일관성 검사
    const importPatterns = new Map();
    for (const testFile of this.testFiles) {
      try {
        const content = fs.readFileSync(testFile.path, 'utf8');
        
        // 테스팅 라이브러리 import 패턴 확인
        const testingLibraryImports = [
          /@testing-library\/react/,
          /@testing-library\/jest-dom/,
          /@testing-library\/user-event/
        ];

        for (const pattern of testingLibraryImports) {
          if (pattern.test(content)) {
            const patternName = pattern.source;
            if (!importPatterns.has(patternName)) {
              importPatterns.set(patternName, []);
            }
            importPatterns.get(patternName).push(testFile.relativePath);
          }
        }
      } catch (error) {
        // 파일 읽기 실패 시 무시
      }
    }

    this.inconsistentStructures = structureIssues;
  }

  /**
   * 표준화 계획 수립
   */
  createStandardizationPlan() {
    const plan = {
      namingStandardization: {
        recommended: 'test', // .test. 패턴 권장
        changes: [],
        reason: '.test. 패턴이 가장 널리 사용됨'
      },
      directoryStandardization: {
        recommended: 'tests_directory', // __tests__ 디렉토리 권장
        changes: [],
        reason: '테스트 파일들을 별도 디렉토리로 분리하여 구조 명확화'
      },
      utilityConsolidation: {
        duplicateUtilities: this.testUtilities,
        recommendations: []
      },
      testDeduplication: {
        duplicateTests: this.duplicateTests,
        recommendations: []
      },
      statistics: {
        totalTestFiles: this.testFiles.length,
        duplicateUtilities: this.testUtilities.length,
        duplicateTests: this.duplicateTests.length,
        structureIssues: this.inconsistentStructures.length
      }
    };

    // 네이밍 표준화 변경사항
    for (const testFile of this.testFiles) {
      if (testFile.name.includes('.spec.')) {
        const newName = testFile.name.replace('.spec.', '.test.');
        plan.namingStandardization.changes.push({
          file: testFile.relativePath,
          from: testFile.name,
          to: newName,
          reason: 'spec → test 네이밍 통일'
        });
      }
    }

    // 유틸리티 통합 권장사항
    for (const utility of this.testUtilities) {
      if (utility.count > 2) {
        plan.utilityConsolidation.recommendations.push({
          utilityName: utility.name,
          occurrences: utility.occurrences,
          recommendation: `공통 테스트 유틸리티 파일로 추출 권장`,
          suggestedLocation: 'src/__tests__/utils/'
        });
      }
    }

    // 중복 테스트 정리 권장사항
    for (const duplicate of this.duplicateTests) {
      if (duplicate.count > 2) {
        plan.testDeduplication.recommendations.push({
          description: duplicate.description,
          occurrences: duplicate.occurrences,
          recommendation: '중복된 테스트 케이스 통합 또는 차별화 필요'
        });
      }
    }

    return plan;
  }

  /**
   * 분석 결과 보고서 생성
   */
  generateReport() {
    console.log('\n📊 테스트 파일 구조 분석 결과:');
    console.log(`총 테스트 파일: ${this.testFiles.length}개`);
    
    // 네이밍 패턴 분포
    console.log('\n📝 네이밍 패턴 분포:');
    console.log(`  .test. 패턴: ${this.testPatterns.byNaming.test}개`);
    console.log(`  .spec. 패턴: ${this.testPatterns.byNaming.spec}개`);
    console.log(`  __tests__ 디렉토리: ${this.testPatterns.byNaming.testsDir}개`);

    // 위치 패턴 분포
    console.log('\n📁 위치 패턴 분포:');
    console.log(`  __tests__ 디렉토리: ${this.testPatterns.byLocation.testsDirectory}개`);
    console.log(`  소스 파일과 동일 위치: ${this.testPatterns.byLocation.colocated}개`);
    console.log(`  별도 위치: ${this.testPatterns.byLocation.separate}개`);

    // 프레임워크 사용 현황
    console.log('\n🧪 테스트 프레임워크:');
    console.log(`  Jest: ${this.testPatterns.byFramework.jest}개`);
    console.log(`  React Testing Library: ${this.testPatterns.byFramework.react_testing_library}개`);
    console.log(`  알 수 없음: ${this.testPatterns.byFramework.unknown}개`);

    // 중복 유틸리티
    if (this.testUtilities.length > 0) {
      console.log('\n🔄 중복된 테스트 유틸리티:');
      this.testUtilities.slice(0, 5).forEach(utility => {
        console.log(`  - ${utility.name}: ${utility.count}개 파일에서 사용`);
      });
      if (this.testUtilities.length > 5) {
        console.log(`  ... 및 ${this.testUtilities.length - 5}개 더`);
      }
    }

    // 중복 테스트
    if (this.duplicateTests.length > 0) {
      console.log('\n🔄 중복된 테스트 케이스:');
      this.duplicateTests.slice(0, 5).forEach(test => {
        console.log(`  - "${test.description}": ${test.count}개 파일에서 사용`);
      });
      if (this.duplicateTests.length > 5) {
        console.log(`  ... 및 ${this.duplicateTests.length - 5}개 더`);
      }
    }

    // 구조 일관성 이슈
    if (this.inconsistentStructures.length > 0) {
      console.log('\n⚠️  구조 일관성 이슈:');
      this.inconsistentStructures.forEach(issue => {
        console.log(`  - ${issue.description} (${issue.severity})`);
      });
    }
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  saveResults(outputPath = 'test-analysis.json') {
    const results = {
      timestamp: new Date().toISOString(),
      statistics: {
        totalTestFiles: this.testFiles.length,
        duplicateUtilities: this.testUtilities.length,
        duplicateTests: this.duplicateTests.length,
        structureIssues: this.inconsistentStructures.length
      },
      testPatterns: this.testPatterns,
      testUtilities: this.testUtilities,
      duplicateTests: this.duplicateTests,
      inconsistentStructures: this.inconsistentStructures,
      standardizationPlan: this.createStandardizationPlan(),
      testFiles: this.testFiles.map(file => ({
        name: file.name,
        relativePath: file.relativePath,
        size: file.size,
        lastModified: file.lastModified
      }))
    };

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 분석 결과 저장: ${outputPath}`);
  }
}

// CLI 실행
if (require.main === module) {
  const analyzer = new TestAnalyzer();
  
  analyzer.analyze()
    .then((results) => {
      analyzer.saveResults();
      console.log('\n✅ 테스트 파일 구조 분석 완료');
    })
    .catch((error) => {
      console.error('❌ 분석 실패:', error);
      process.exit(1);
    });
}

module.exports = TestAnalyzer;