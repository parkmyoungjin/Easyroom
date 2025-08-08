#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(folderPath);
    }
}

console.log('🧹 Clearing Next.js build cache...');

// Clear .next folder
const nextPath = path.join(process.cwd(), '.next');
if (fs.existsSync(nextPath)) {
    deleteFolderRecursive(nextPath);
    console.log('✅ Cleared .next folder');
}

// Clear .swc folder
const swcPath = path.join(process.cwd(), '.swc');
if (fs.existsSync(swcPath)) {
    deleteFolderRecursive(swcPath);
    console.log('✅ Cleared .swc folder');
}

// Clear tsconfig.tsbuildinfo
const tsBuildInfoPath = path.join(process.cwd(), 'tsconfig.tsbuildinfo');
if (fs.existsSync(tsBuildInfoPath)) {
    fs.unlinkSync(tsBuildInfoPath);
    console.log('✅ Cleared tsconfig.tsbuildinfo');
}

console.log('🎉 Build cache cleared successfully!');
console.log('💡 Now run: npm run build');