#!/usr/bin/env node

/**
 * Import 구조 표준화 도구
 * 분석 결과를 바탕으로 import 구문을 자동으로 수정
 */

const fs = require('fs');
const path = require('path');
const BackupManager = require('./backup-manager');

class ImportStandardizer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcPath = path.join(this.projectRoot, 'src');
    this.backupManager = new BackupManager();
    this.changes = [];
    this.errors = [];
  }

  /**
   * Import 표준화 실행
   */
  async standardize() {
    console.log('🔧 Import 구조 표준화 시작...');
    
    try {
      // 1. 분석 결과 로드
      const analysisPath = path.join(this.projectRoot, 'import-analysis.json');
      if (!fs.existsSync(analysisPath)) {
        throw new Error('import-analysis.json 파일이 없습니다. 먼저 분석을 실행해주세요.');
      }

      const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
      const plan = analysis.standardizationPlan;

      console.log(`📋 변경 대상: ${plan.changes.length}개 import`);

      if (plan.changes.length === 0) {
        console.log('✅ 변경할 import가 없습니다.');
        return { success: true, changes: [], errors: [] };
      }

      // 2. 백업 생성
      const filesToBackup = [...new Set(plan.changes.map(change => 
        path.join(this.projectRoot, change.file)
      ))];

      console.log(`📦 백업 생성 중... (${filesToBackup.length}개 파일)`);
      const backup = await this.backupManager.createBackup(
        filesToBackup,
        'Import standardization backup'
      );

      // 3. 파일별로 변경 적용
      const fileChanges = this.groupChangesByFile(plan.changes);
      
      for (const [filePath, changes] of fileChanges) {
        try {
          await this.applyChangesToFile(filePath, changes);
        } catch (error) {
          this.errors.push({
            file: filePath,
            error: error.message
          });
        }
      }

      // 4. 결과 보고
      console.log('\n📊 표준화 결과:');
      console.log(`✅ 성공적으로 변경된 파일: ${fileChanges.size - this.errors.length}개`);
      console.log(`❌ 변경 실패한 파일: ${this.errors.length}개`);
      console.log(`🔄 총 변경된 import: ${this.changes.length}개`);
      console.log(`💾 백업 ID: ${backup.id}`);

      if (this.errors.length > 0) {
        console.log('\n❌ 실패한 파일:');
        this.errors.forEach(({ file, error }) => {
          console.log(`- ${file}: ${error}`);
        });
      }

      console.log('\n🔄 복원 방법:');
      console.log(`문제가 발생하면 다음 명령어로 복원할 수 있습니다:`);
      console.log(`node scripts/backup-manager.js restore ${backup.id}`);

      return {
        success: this.errors.length === 0,
        changes: this.changes,
        errors: this.errors,
        backupId: backup.id
      };

    } catch (error) {
      console.error('❌ Import 표준화 실패:', error.message);
      throw error;
    }
  }

  /**
   * 파일별로 변경사항 그룹화
   */
  groupChangesByFile(changes) {
    const fileChanges = new Map();
    
    for (const change of changes) {
      const fullPath = path.join(this.projectRoot, change.file);
      
      if (!fileChanges.has(fullPath)) {
        fileChanges.set(fullPath, []);
      }
      
      fileChanges.get(fullPath).push(change);
    }

    // 라인 번호 역순으로 정렬 (뒤에서부터 수정하여 라인 번호 변경 방지)
    for (const [filePath, changes] of fileChanges) {
      changes.sort((a, b) => b.lineNumber - a.lineNumber);
    }

    return fileChanges;
  }

  /**
   * 개별 파일에 변경사항 적용
   */
  async applyChangesToFile(filePath, changes) {
    const relativePath = path.relative(this.projectRoot, filePath);
    console.log(`🔧 수정 중: ${relativePath} (${changes.length}개 변경)`);

    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      let appliedChanges = 0;

      for (const change of changes) {
        const lineIndex = change.lineNumber - 1;
        
        if (lineIndex >= 0 && lineIndex < lines.length) {
          const originalLine = lines[lineIndex];
          
          // import 구문에서 경로 부분만 교체
          const newLine = originalLine.replace(
            new RegExp(`(['"\`])${this.escapeRegex(change.from)}\\1`, 'g'),
            `$1${change.to}$1`
          );

          if (newLine !== originalLine) {
            lines[lineIndex] = newLine;
            appliedChanges++;
            
            this.changes.push({
              file: relativePath,
              lineNumber: change.lineNumber,
              from: change.from,
              to: change.to,
              type: change.type,
              originalLine: originalLine.trim(),
              newLine: newLine.trim()
            });
          }
        }
      }

      // 파일 저장
      if (appliedChanges > 0) {
        fs.writeFileSync(filePath, lines.join('\n'));
        console.log(`  ✅ ${appliedChanges}개 import 수정 완료`);
      } else {
        console.log(`  ⚠️  변경사항 없음`);
      }

    } catch (error) {
      console.error(`  ❌ 파일 수정 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 정규식 특수문자 이스케이프
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 사용되지 않는 import 제거
   */
  async removeUnusedImports() {
    console.log('\n🧹 사용되지 않는 import 제거 중...');
    
    // 이 기능은 복잡하므로 별도 구현 필요
    // 현재는 기본적인 표준화에 집중
    console.log('⚠️  사용되지 않는 import 제거는 별도 도구가 필요합니다.');
    console.log('ESLint의 unused-imports 규칙을 사용하는 것을 권장합니다.');
  }

  /**
   * Import 순서 표준화
   */
  async standardizeImportOrder() {
    console.log('\n📝 Import 순서 표준화 중...');
    
    // 표준 순서:
    // 1. React 관련
    // 2. Next.js 관련  
    // 3. 외부 라이브러리
    // 4. 내부 절대 경로 (@/)
    // 5. 내부 상대 경로 (./, ../)
    
    console.log('⚠️  Import 순서 표준화는 복잡한 작업으로 별도 구현이 필요합니다.');
    console.log('Prettier나 ESLint의 import/order 규칙 사용을 권장합니다.');
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  saveResults(outputPath = 'import-standardization-results.json') {
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChanges: this.changes.length,
        successfulFiles: new Set(this.changes.map(c => c.file)).size,
        failedFiles: this.errors.length,
        success: this.errors.length === 0
      },
      changes: this.changes,
      errors: this.errors
    };

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 결과 저장: ${outputPath}`);
  }
}

// CLI 실행
if (require.main === module) {
  const standardizer = new ImportStandardizer();
  
  standardizer.standardize()
    .then((result) => {
      standardizer.saveResults();
      
      if (result.success) {
        console.log('\n✅ Import 구조 표준화 완료!');
        process.exit(0);
      } else {
        console.log('\n⚠️  일부 파일 표준화 실패');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('표준화 실패:', error);
      process.exit(1);
    });
}

module.exports = ImportStandardizer;