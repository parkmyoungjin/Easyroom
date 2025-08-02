#!/usr/bin/env node

/**
 * 임시 파일 정리 스크립트
 * 백업 생성 후 안전하게 임시 파일 삭제
 */

const BackupManager = require('./backup-manager');
const fs = require('fs');
const path = require('path');

async function cleanupTempFiles() {
  const backupManager = new BackupManager();
  
  // 삭제 대상 파일 목록
  const tempFiles = [
    'src/app/page-content.tsx.tmp.888.1753678093568'
  ];

  console.log('🧹 임시 파일 정리 시작...');
  console.log(`삭제 대상: ${tempFiles.length}개 파일`);

  try {
    // 1. 백업 생성
    console.log('\n📦 백업 생성 중...');
    const existingFiles = tempFiles.filter(file => fs.existsSync(file));
    
    if (existingFiles.length === 0) {
      console.log('⚠️  삭제할 임시 파일이 없습니다.');
      return;
    }

    const backup = await backupManager.createBackup(
      existingFiles,
      'Temporary files cleanup backup'
    );

    // 2. 파일 삭제 실행
    console.log('\n🗑️  임시 파일 삭제 중...');
    const deletedFiles = [];
    const errors = [];

    for (const filePath of existingFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedFiles.push(filePath);
          console.log(`✅ 삭제 완료: ${filePath}`);
        }
      } catch (error) {
        errors.push({ file: filePath, error: error.message });
        console.error(`❌ 삭제 실패: ${filePath} - ${error.message}`);
      }
    }

    // 3. 결과 보고
    console.log('\n📊 정리 결과:');
    console.log(`✅ 성공적으로 삭제된 파일: ${deletedFiles.length}개`);
    console.log(`❌ 삭제 실패한 파일: ${errors.length}개`);
    console.log(`💾 백업 ID: ${backup.id}`);

    if (deletedFiles.length > 0) {
      console.log('\n삭제된 파일 목록:');
      deletedFiles.forEach(file => console.log(`- ${file}`));
    }

    if (errors.length > 0) {
      console.log('\n실패한 파일 목록:');
      errors.forEach(({ file, error }) => console.log(`- ${file}: ${error}`));
    }

    console.log('\n🔄 복원 방법:');
    console.log(`문제가 발생하면 다음 명령어로 복원할 수 있습니다:`);
    console.log(`node scripts/backup-manager.js restore ${backup.id}`);

    return {
      success: errors.length === 0,
      deletedFiles,
      errors,
      backupId: backup.id
    };

  } catch (error) {
    console.error('❌ 임시 파일 정리 실패:', error.message);
    throw error;
  }
}

// 실행
if (require.main === module) {
  cleanupTempFiles()
    .then((result) => {
      if (result && result.success) {
        console.log('\n✅ 임시 파일 정리 완료!');
        process.exit(0);
      } else {
        console.log('\n⚠️  일부 파일 정리 실패');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('정리 실패:', error);
      process.exit(1);
    });
}

module.exports = cleanupTempFiles;