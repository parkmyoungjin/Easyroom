#!/usr/bin/env node

/**
 * 안전한 백업 시스템
 * 코드 아키텍처 정리를 위한 백업 및 롤백 관리
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class BackupManager {
  constructor() {
    this.projectRoot = process.cwd();
    this.backupDir = path.join(this.projectRoot, '.cleanup-backups');
    this.metadataFile = path.join(this.backupDir, 'backup-metadata.json');
    this.metadata = this.loadMetadata();
  }

  /**
   * 메타데이터 로드
   */
  loadMetadata() {
    try {
      if (fs.existsSync(this.metadataFile)) {
        return JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
      }
    } catch (error) {
      console.warn('⚠️  백업 메타데이터 로드 실패:', error.message);
    }
    
    return {
      backups: [],
      version: '1.0.0',
      created: new Date().toISOString()
    };
  }

  /**
   * 메타데이터 저장
   */
  saveMetadata() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
      fs.writeFileSync(this.metadataFile, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      console.error('❌ 백업 메타데이터 저장 실패:', error.message);
      throw error;
    }
  }

  /**
   * 백업 생성
   */
  async createBackup(files, description = 'Code cleanup backup') {
    const backupId = this.generateBackupId();
    const timestamp = new Date().toISOString();
    const backupPath = path.join(this.backupDir, backupId);

    console.log(`📦 백업 생성 중... (ID: ${backupId})`);

    try {
      // 백업 디렉토리 생성
      fs.mkdirSync(backupPath, { recursive: true });

      const backupInfo = {
        id: backupId,
        timestamp,
        description,
        files: [],
        totalSize: 0,
        checksums: {},
        canRestore: true
      };

      // 파일별 백업 생성
      for (const filePath of files) {
        if (fs.existsSync(filePath)) {
          const backupResult = await this.backupFile(filePath, backupPath);
          backupInfo.files.push(backupResult);
          backupInfo.totalSize += backupResult.size;
          backupInfo.checksums[backupResult.relativePath] = backupResult.checksum;
        }
      }

      // 백업 정보 저장
      const backupInfoPath = path.join(backupPath, 'backup-info.json');
      fs.writeFileSync(backupInfoPath, JSON.stringify(backupInfo, null, 2));

      // 메타데이터 업데이트
      this.metadata.backups.push(backupInfo);
      this.saveMetadata();

      console.log(`✅ 백업 완료: ${backupInfo.files.length}개 파일, ${this.formatSize(backupInfo.totalSize)}`);
      
      return backupInfo;

    } catch (error) {
      console.error(`❌ 백업 생성 실패: ${error.message}`);
      // 실패한 백업 디렉토리 정리
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
      throw error;
    }
  }

  /**
   * 개별 파일 백업
   */
  async backupFile(filePath, backupPath) {
    const relativePath = path.relative(this.projectRoot, filePath);
    const backupFilePath = path.join(backupPath, relativePath);
    const backupFileDir = path.dirname(backupFilePath);

    // 백업 파일 디렉토리 생성
    if (!fs.existsSync(backupFileDir)) {
      fs.mkdirSync(backupFileDir, { recursive: true });
    }

    // 파일 복사
    fs.copyFileSync(filePath, backupFilePath);

    // 파일 정보 수집
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath);
    const checksum = crypto.createHash('sha256').update(content).digest('hex');

    return {
      originalPath: filePath,
      relativePath,
      backupPath: backupFilePath,
      size: stats.size,
      checksum,
      lastModified: stats.mtime.toISOString()
    };
  }

  /**
   * 백업에서 복원
   */
  async restoreBackup(backupId) {
    const backup = this.metadata.backups.find(b => b.id === backupId);
    
    if (!backup) {
      throw new Error(`백업을 찾을 수 없습니다: ${backupId}`);
    }

    if (!backup.canRestore) {
      throw new Error(`복원할 수 없는 백업입니다: ${backupId}`);
    }

    const backupPath = path.join(this.backupDir, backupId);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`백업 디렉토리가 존재하지 않습니다: ${backupPath}`);
    }

    console.log(`🔄 백업 복원 중... (ID: ${backupId})`);

    try {
      let restoredCount = 0;
      const errors = [];

      for (const fileInfo of backup.files) {
        try {
          await this.restoreFile(fileInfo, backupPath);
          restoredCount++;
        } catch (error) {
          errors.push({
            file: fileInfo.relativePath,
            error: error.message
          });
        }
      }

      if (errors.length > 0) {
        console.warn(`⚠️  일부 파일 복원 실패: ${errors.length}개`);
        errors.forEach(({ file, error }) => {
          console.warn(`  - ${file}: ${error}`);
        });
      }

      console.log(`✅ 백업 복원 완료: ${restoredCount}개 파일`);
      
      return {
        success: true,
        restoredCount,
        errors
      };

    } catch (error) {
      console.error(`❌ 백업 복원 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 개별 파일 복원
   */
  async restoreFile(fileInfo, backupPath) {
    const backupFilePath = path.join(backupPath, fileInfo.relativePath);
    
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`백업 파일이 존재하지 않습니다: ${backupFilePath}`);
    }

    // 백업 파일 무결성 검증
    const backupContent = fs.readFileSync(backupFilePath);
    const backupChecksum = crypto.createHash('sha256').update(backupContent).digest('hex');
    
    if (backupChecksum !== fileInfo.checksum) {
      throw new Error(`백업 파일 무결성 검증 실패: ${fileInfo.relativePath}`);
    }

    // 원본 파일 디렉토리 생성
    const originalDir = path.dirname(fileInfo.originalPath);
    if (!fs.existsSync(originalDir)) {
      fs.mkdirSync(originalDir, { recursive: true });
    }

    // 파일 복원
    fs.copyFileSync(backupFilePath, fileInfo.originalPath);
  }

  /**
   * 백업 목록 조회
   */
  listBackups() {
    return this.metadata.backups.map(backup => ({
      id: backup.id,
      timestamp: backup.timestamp,
      description: backup.description,
      fileCount: backup.files.length,
      totalSize: this.formatSize(backup.totalSize),
      canRestore: backup.canRestore
    }));
  }

  /**
   * 백업 삭제
   */
  deleteBackup(backupId) {
    const backupIndex = this.metadata.backups.findIndex(b => b.id === backupId);
    
    if (backupIndex === -1) {
      throw new Error(`백업을 찾을 수 없습니다: ${backupId}`);
    }

    const backupPath = path.join(this.backupDir, backupId);
    
    try {
      // 백업 디렉토리 삭제
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }

      // 메타데이터에서 제거
      this.metadata.backups.splice(backupIndex, 1);
      this.saveMetadata();

      console.log(`🗑️  백업 삭제 완료: ${backupId}`);
      
    } catch (error) {
      console.error(`❌ 백업 삭제 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 백업 무결성 검증
   */
  async verifyBackup(backupId) {
    const backup = this.metadata.backups.find(b => b.id === backupId);
    
    if (!backup) {
      throw new Error(`백업을 찾을 수 없습니다: ${backupId}`);
    }

    const backupPath = path.join(this.backupDir, backupId);
    const results = {
      valid: true,
      errors: [],
      checkedFiles: 0
    };

    console.log(`🔍 백업 무결성 검증 중... (ID: ${backupId})`);

    for (const fileInfo of backup.files) {
      try {
        const backupFilePath = path.join(backupPath, fileInfo.relativePath);
        
        if (!fs.existsSync(backupFilePath)) {
          results.errors.push(`백업 파일 누락: ${fileInfo.relativePath}`);
          results.valid = false;
          continue;
        }

        const content = fs.readFileSync(backupFilePath);
        const checksum = crypto.createHash('sha256').update(content).digest('hex');
        
        if (checksum !== fileInfo.checksum) {
          results.errors.push(`체크섬 불일치: ${fileInfo.relativePath}`);
          results.valid = false;
        }

        results.checkedFiles++;
        
      } catch (error) {
        results.errors.push(`검증 오류 (${fileInfo.relativePath}): ${error.message}`);
        results.valid = false;
      }
    }

    if (results.valid) {
      console.log(`✅ 백업 무결성 검증 완료: ${results.checkedFiles}개 파일`);
    } else {
      console.error(`❌ 백업 무결성 검증 실패: ${results.errors.length}개 오류`);
    }

    return results;
  }

  /**
   * 백업 ID 생성
   */
  generateBackupId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `cleanup-${timestamp}-${random}`;
  }

  /**
   * 파일 크기 포맷팅
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 오래된 백업 정리
   */
  cleanupOldBackups(maxAge = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    const toDelete = this.metadata.backups.filter(backup => 
      new Date(backup.timestamp) < cutoffDate
    );

    console.log(`🧹 ${maxAge}일 이상 된 백업 정리: ${toDelete.length}개`);

    for (const backup of toDelete) {
      try {
        this.deleteBackup(backup.id);
      } catch (error) {
        console.warn(`⚠️  백업 삭제 실패: ${backup.id} - ${error.message}`);
      }
    }
  }
}

// CLI 명령어 처리
if (require.main === module) {
  const manager = new BackupManager();
  const command = process.argv[2];

  switch (command) {
    case 'list':
      console.log('📋 백업 목록:');
      const backups = manager.listBackups();
      if (backups.length === 0) {
        console.log('백업이 없습니다.');
      } else {
        backups.forEach(backup => {
          console.log(`- ${backup.id} (${backup.timestamp})`);
          console.log(`  설명: ${backup.description}`);
          console.log(`  파일: ${backup.fileCount}개, 크기: ${backup.totalSize}`);
          console.log(`  복원 가능: ${backup.canRestore ? '예' : '아니오'}`);
          console.log('');
        });
      }
      break;

    case 'verify':
      const backupId = process.argv[3];
      if (!backupId) {
        console.error('백업 ID를 지정해주세요.');
        process.exit(1);
      }
      manager.verifyBackup(backupId)
        .then(result => {
          if (!result.valid) {
            process.exit(1);
          }
        })
        .catch(error => {
          console.error('검증 실패:', error.message);
          process.exit(1);
        });
      break;

    case 'restore':
      const restoreId = process.argv[3];
      if (!restoreId) {
        console.error('백업 ID를 지정해주세요.');
        process.exit(1);
      }
      manager.restoreBackup(restoreId)
        .then(result => {
          if (result.errors.length > 0) {
            process.exit(1);
          }
        })
        .catch(error => {
          console.error('복원 실패:', error.message);
          process.exit(1);
        });
      break;

    case 'cleanup':
      const maxAge = parseInt(process.argv[3]) || 30;
      manager.cleanupOldBackups(maxAge);
      break;

    default:
      console.log('사용법:');
      console.log('  node backup-manager.js list          - 백업 목록 조회');
      console.log('  node backup-manager.js verify <id>   - 백업 무결성 검증');
      console.log('  node backup-manager.js restore <id>  - 백업 복원');
      console.log('  node backup-manager.js cleanup [days] - 오래된 백업 정리');
  }
}

module.exports = BackupManager;