// Next.js 캐시 클리어 스크립트 (Windows/Mac/Linux 호환)
const fs = require('fs');
const path = require('path');

function deleteFolder(folderPath) {
  if (fs.existsSync(folderPath)) {
    console.log(`삭제 중: ${folderPath}`);
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log(`✅ 삭제 완료: ${folderPath}`);
  } else {
    console.log(`⚠️  폴더가 존재하지 않음: ${folderPath}`);
  }
}

console.log('=== Next.js 캐시 클리어 ===\n');

// 삭제할 폴더들
const foldersToDelete = [
  '.next',
  'node_modules/.cache',
  '.swc'
];

foldersToDelete.forEach(folder => {
  const fullPath = path.join(process.cwd(), folder);
  deleteFolder(fullPath);
});

console.log('\n=== 캐시 클리어 완료 ===');
console.log('이제 다음 명령어를 실행하세요:');
console.log('npm run dev');
