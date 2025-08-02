#!/usr/bin/env node

/**
 * 타입 정의 최적화 도구
 * 중복된 타입 통합 및 타입 구조 개선
 */

const fs = require('fs');
const path = require('path');
const BackupManager = require('./backup-manager');

class TypeOptimizer {
  constructor() {
    this.projectRoot = process.cwd();
    this.backupManager = new BackupManager();
    this.changes = [];
    this.errors = [];
  }

  /**
   * 타입 최적화 실행
   */
  async optimize() {
    console.log('🔧 타입 정의 최적화 시작...');
    
    try {
      // 1. 분석 결과 로드
      const analysisPath = path.join(this.projectRoot, 'type-analysis.json');
      if (!fs.existsSync(analysisPath)) {
        throw new Error('type-analysis.json 파일이 없습니다. 먼저 분석을 실행해주세요.');
      }

      const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

      // 2. ValidatedReservationData 통합 작업
      await this.consolidateValidatedReservationData();

      // 3. 타입 파일 구조 정리
      await this.optimizeTypeStructure();

      // 4. 결과 보고
      console.log('\n📊 최적화 결과:');
      console.log(`✅ 성공적으로 최적화된 타입: ${this.changes.length}개`);
      console.log(`❌ 최적화 실패: ${this.errors.length}개`);

      if (this.errors.length > 0) {
        console.log('\n❌ 실패 내역:');
        this.errors.forEach(error => {
          console.log(`- ${error.type}: ${error.message}`);
        });
      }

      return {
        success: this.errors.length === 0,
        changes: this.changes,
        errors: this.errors
      };

    } catch (error) {
      console.error('❌ 타입 최적화 실패:', error.message);
      throw error;
    }
  }

  /**
   * ValidatedReservationData 타입 통합
   */
  async consolidateValidatedReservationData() {
    console.log('\n🔄 ValidatedReservationData 타입 통합 중...');

    const files = [
      'src/lib/security/user-id-guards.ts',
      'src/lib/security/enhanced-user-id-guards.ts'
    ];

    try {
      // 백업 생성
      const backup = await this.backupManager.createBackup(
        files.map(f => path.join(this.projectRoot, f)),
        'ValidatedReservationData type consolidation'
      );

      console.log(`📦 백업 생성 완료: ${backup.id}`);

      // 1. enhanced-user-id-guards.ts에서 ValidatedReservationData를 types/database.ts로 이동
      await this.moveValidatedReservationDataToTypes();

      // 2. user-id-guards.ts에서 중복 정의 제거 및 import 추가
      await this.updateUserIdGuards();

      // 3. enhanced-user-id-guards.ts에서 중복 정의 제거 및 import 추가
      await this.updateEnhancedUserIdGuards();

      console.log('✅ ValidatedReservationData 타입 통합 완료');

      this.changes.push({
        type: 'type_consolidation',
        typeName: 'ValidatedReservationData',
        action: 'moved_to_types_database',
        affectedFiles: files
      });

    } catch (error) {
      this.errors.push({
        type: 'consolidation_error',
        message: `ValidatedReservationData 통합 실패: ${error.message}`
      });
    }
  }

  /**
   * ValidatedReservationData를 types/database.ts로 이동
   */
  async moveValidatedReservationDataToTypes() {
    const typesPath = path.join(this.projectRoot, 'src/types/database.ts');
    let content = fs.readFileSync(typesPath, 'utf8');

    // Enhanced 버전의 ValidatedReservationData 정의 추가
    const typeDefinition = `
/**
 * Validated reservation data with enhanced type safety
 * Used for reservation creation and validation
 */
export interface ValidatedReservationData {
  room_id: string;
  user_id: DatabaseUserId;
  title: string;
  purpose?: string;
  start_time: string;
  end_time: string;
  status?: 'confirmed' | 'cancelled';
}`;

    // DatabaseUserId import 확인 및 추가
    if (!content.includes("import type { AuthId, DatabaseUserId }")) {
      // enhanced-types import 추가
      const importLine = "import type { AuthId, DatabaseUserId } from './enhanced-types';\n";
      
      // 다른 import 문 다음에 추가
      const importRegex = /^import.*from.*['"];$/gm;
      const imports = content.match(importRegex) || [];
      
      if (imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.indexOf(lastImport) + lastImport.length;
        content = content.slice(0, lastImportIndex) + '\n' + importLine + content.slice(lastImportIndex);
      } else {
        content = importLine + '\n' + content;
      }
    }

    // 타입 정의를 파일 끝에 추가
    content += typeDefinition;

    fs.writeFileSync(typesPath, content);
    console.log('  ✅ ValidatedReservationData를 types/database.ts에 추가');
  }

  /**
   * user-id-guards.ts 업데이트
   */
  async updateUserIdGuards() {
    const filePath = path.join(this.projectRoot, 'src/lib/security/user-id-guards.ts');
    let content = fs.readFileSync(filePath, 'utf8');

    // 기존 ValidatedReservationData 정의 제거
    const typeDefRegex = /\/\*\*\s*\n\s*\* Type guard for reservation creation data\s*\n\s*\*\/\s*\nexport interface ValidatedReservationData \{[^}]*\}/s;
    content = content.replace(typeDefRegex, '');

    // import 추가
    if (!content.includes('ValidatedReservationData')) {
      // database types import에 ValidatedReservationData 추가
      const dbImportRegex = /import type \{([^}]+)\} from '@\/types\/database'/;
      const match = content.match(dbImportRegex);
      
      if (match) {
        const imports = match[1];
        if (!imports.includes('ValidatedReservationData')) {
          const newImports = imports.trim() + ', ValidatedReservationData';
          content = content.replace(dbImportRegex, `import type { ${newImports} } from '@/types/database'`);
        }
      } else {
        // 새로운 import 추가
        const importLine = "import type { ValidatedReservationData } from '@/types/database';\n";
        const firstImportIndex = content.indexOf('import');
        if (firstImportIndex !== -1) {
          content = content.slice(0, firstImportIndex) + importLine + content.slice(firstImportIndex);
        }
      }
    }

    fs.writeFileSync(filePath, content);
    console.log('  ✅ user-id-guards.ts 업데이트 완료');
  }

  /**
   * enhanced-user-id-guards.ts 업데이트
   */
  async updateEnhancedUserIdGuards() {
    const filePath = path.join(this.projectRoot, 'src/lib/security/enhanced-user-id-guards.ts');
    let content = fs.readFileSync(filePath, 'utf8');

    // 기존 ValidatedReservationData 정의 제거
    const typeDefRegex = /\/\*\*\s*\n\s*\* Enhanced validation for reservation data with branded types\s*\n\s*\*\/\s*\nexport interface ValidatedReservationData \{[^}]*\}/s;
    content = content.replace(typeDefRegex, '');

    // import 추가
    if (!content.includes('ValidatedReservationData')) {
      // database types import에 ValidatedReservationData 추가
      const dbImportRegex = /import type \{([^}]+)\} from '@\/types\/database'/;
      const match = content.match(dbImportRegex);
      
      if (match) {
        const imports = match[1];
        if (!imports.includes('ValidatedReservationData')) {
          const newImports = imports.trim() + ', ValidatedReservationData';
          content = content.replace(dbImportRegex, `import type { ${newImports} } from '@/types/database'`);
        }
      } else {
        // enhanced-types import 다음에 추가
        const enhancedImportIndex = content.indexOf("} from '@/types/enhanced-types';");
        if (enhancedImportIndex !== -1) {
          const insertIndex = content.indexOf('\n', enhancedImportIndex) + 1;
          const importLine = "import type { ValidatedReservationData } from '@/types/database';\n";
          content = content.slice(0, insertIndex) + importLine + content.slice(insertIndex);
        }
      }
    }

    fs.writeFileSync(filePath, content);
    console.log('  ✅ enhanced-user-id-guards.ts 업데이트 완료');
  }

  /**
   * 타입 파일 구조 최적화
   */
  async optimizeTypeStructure() {
    console.log('\n📝 타입 파일 구조 최적화 중...');

    try {
      // 타입 파일들의 import/export 정리
      await this.optimizeTypeImports();
      
      console.log('✅ 타입 파일 구조 최적화 완료');

      this.changes.push({
        type: 'structure_optimization',
        action: 'optimized_type_imports',
        description: '타입 파일 import/export 구조 정리'
      });

    } catch (error) {
      this.errors.push({
        type: 'structure_error',
        message: `타입 구조 최적화 실패: ${error.message}`
      });
    }
  }

  /**
   * 타입 import 최적화
   */
  async optimizeTypeImports() {
    const typeFiles = [
      'src/types/auth.ts',
      'src/types/database.ts',
      'src/types/enhanced-types.ts',
      'src/types/pagination.ts',
      'src/types/routes.ts'
    ];

    for (const file of typeFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // 중복된 import 제거
        content = this.removeDuplicateImports(content);
        
        // import 순서 정리
        content = this.sortImports(content);
        
        fs.writeFileSync(filePath, content);
      }
    }
  }

  /**
   * 중복 import 제거
   */
  removeDuplicateImports(content) {
    const lines = content.split('\n');
    const imports = new Set();
    const filteredLines = [];

    for (const line of lines) {
      if (line.trim().startsWith('import ')) {
        if (!imports.has(line.trim())) {
          imports.add(line.trim());
          filteredLines.push(line);
        }
      } else {
        filteredLines.push(line);
      }
    }

    return filteredLines.join('\n');
  }

  /**
   * import 순서 정리
   */
  sortImports(content) {
    const lines = content.split('\n');
    const imports = [];
    const otherLines = [];
    let inImportSection = true;

    for (const line of lines) {
      if (line.trim().startsWith('import ')) {
        imports.push(line);
      } else if (line.trim() === '' && inImportSection) {
        // 빈 줄은 import 섹션 끝을 의미할 수 있음
        continue;
      } else {
        inImportSection = false;
        otherLines.push(line);
      }
    }

    // import 정렬 (외부 라이브러리 먼저, 그 다음 내부 모듈)
    imports.sort((a, b) => {
      const aIsExternal = !a.includes('@/');
      const bIsExternal = !b.includes('@/');
      
      if (aIsExternal && !bIsExternal) return -1;
      if (!aIsExternal && bIsExternal) return 1;
      return a.localeCompare(b);
    });

    return [...imports, '', ...otherLines].join('\n');
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  saveResults(outputPath = 'type-optimization-results.json') {
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChanges: this.changes.length,
        totalErrors: this.errors.length,
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
  const optimizer = new TypeOptimizer();
  
  optimizer.optimize()
    .then((result) => {
      optimizer.saveResults();
      
      if (result.success) {
        console.log('\n✅ 타입 정의 최적화 완료!');
        process.exit(0);
      } else {
        console.log('\n⚠️  일부 타입 최적화 실패');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('최적화 실패:', error);
      process.exit(1);
    });
}

module.exports = TypeOptimizer;