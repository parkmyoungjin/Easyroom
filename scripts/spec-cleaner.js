#!/usr/bin/env node

/**
 * Spec 파일 정리 도구
 * 불완전한 spec 파일들을 아카이브로 이동
 */

const fs = require('fs');
const path = require('path');
const BackupManager = require('./backup-manager');

class SpecCleaner {
  constructor() {
    this.projectRoot = process.cwd();
    this.specsPath = path.join(this.projectRoot, '.kiro/specs');
    this.archivePath = path.join(this.specsPath, 'archived');
    this.backupManager = new BackupManager();
    this.archivedSpecs = [];
    this.errors = [];
  }

  /**
   * Spec 정리 실행
   */
  async cleanup() {
    console.log('🧹 Spec 파일 정리 시작...');
    
    try {
      // 1. 분석 결과 로드
      const analysisPath = path.join(this.projectRoot, 'spec-analysis.json');
      if (!fs.existsSync(analysisPath)) {
        throw new Error('spec-analysis.json 파일이 없습니다. 먼저 분석을 실행해주세요.');
      }

      const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
      
      // 2. 정리 대상 spec 식별
      const specsToArchive = [
        'magic-link-auth-fix',
        'security-monitoring-fix'
      ];

      console.log(`📋 아카이브 대상: ${specsToArchive.length}개 spec`);

      // 3. 백업 생성
      const backupPaths = specsToArchive.map(specName => 
        path.join(this.specsPath, specName)
      ).filter(specPath => fs.existsSync(specPath));

      let backup = null;
      if (backupPaths.length > 0) {
        console.log(`📦 백업 생성 중... (${backupPaths.length}개 디렉토리)`);
        backup = await this.backupManager.createBackup(
          this.getAllFilesInDirectories(backupPaths),
          'Spec files cleanup - archiving incomplete specs'
        );
        console.log(`✅ 백업 완료: ${backup.id}`);
      }

      // 4. 아카이브 디렉토리 생성
      if (!fs.existsSync(this.archivePath)) {
        fs.mkdirSync(this.archivePath, { recursive: true });
        console.log('📁 아카이브 디렉토리 생성');
      }

      // 5. spec들을 아카이브로 이동
      for (const specName of specsToArchive) {
        try {
          await this.archiveSpec(specName, analysis);
        } catch (error) {
          this.errors.push({
            spec: specName,
            error: error.message
          });
        }
      }

      // 6. 아카이브 README 생성
      await this.createArchiveReadme();

      // 7. 결과 보고
      console.log('\n📊 정리 결과:');
      console.log(`✅ 성공적으로 아카이브된 spec: ${this.archivedSpecs.length}개`);
      console.log(`❌ 아카이브 실패한 spec: ${this.errors.length}개`);

      if (this.archivedSpecs.length > 0) {
        console.log('\n📦 아카이브된 spec:');
        this.archivedSpecs.forEach(spec => {
          console.log(`- ${spec.name}: ${spec.reason}`);
        });
      }

      if (this.errors.length > 0) {
        console.log('\n❌ 실패한 spec:');
        this.errors.forEach(({ spec, error }) => {
          console.log(`- ${spec}: ${error}`);
        });
      }

      console.log(`\n🔄 복원 방법:`);
      console.log(`문제가 발생하면 다음 명령어로 복원할 수 있습니다:`);
      if (backupPaths.length > 0 && backup) {
        console.log(`node scripts/backup-manager.js restore ${backup.id}`);
      }

      let backupId = null;
      if (backupPaths.length > 0 && backup) {
        backupId = backup.id;
      }

      return {
        success: this.errors.length === 0,
        archivedSpecs: this.archivedSpecs,
        errors: this.errors,
        backupId
      };

    } catch (error) {
      console.error('❌ Spec 정리 실패:', error.message);
      throw error;
    }
  }

  /**
   * 디렉토리 내 모든 파일 경로 수집
   */
  getAllFilesInDirectories(directories) {
    const allFiles = [];
    
    for (const dir of directories) {
      if (fs.existsSync(dir)) {
        const walkDir = (currentDir) => {
          const items = fs.readdirSync(currentDir);
          
          for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
              walkDir(fullPath);
            } else {
              allFiles.push(fullPath);
            }
          }
        };
        
        walkDir(dir);
      }
    }
    
    return allFiles;
  }

  /**
   * 개별 spec 아카이브
   */
  async archiveSpec(specName, analysis) {
    const sourcePath = path.join(this.specsPath, specName);
    const targetPath = path.join(this.archivePath, specName);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Spec 디렉토리가 존재하지 않습니다: ${sourcePath}`);
    }

    console.log(`📦 아카이브 중: ${specName}`);

    try {
      // 디렉토리 복사
      this.copyDirectory(sourcePath, targetPath);

      // 아카이브 정보 파일 생성
      const archiveInfo = this.createArchiveInfo(specName, analysis);
      const infoPath = path.join(targetPath, 'ARCHIVE_INFO.md');
      fs.writeFileSync(infoPath, archiveInfo);

      // 원본 디렉토리 삭제
      this.removeDirectory(sourcePath);

      this.archivedSpecs.push({
        name: specName,
        reason: '불완전한 spec (구현 완료로 추정)',
        archivedAt: new Date().toISOString(),
        originalPath: path.relative(this.projectRoot, sourcePath),
        archivePath: path.relative(this.projectRoot, targetPath)
      });

      console.log(`  ✅ ${specName} 아카이브 완료`);

    } catch (error) {
      console.error(`  ❌ ${specName} 아카이브 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 디렉토리 복사
   */
  copyDirectory(source, target) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const items = fs.readdirSync(source);

    for (const item of items) {
      const sourcePath = path.join(source, item);
      const targetPath = path.join(target, item);
      const stat = fs.statSync(sourcePath);

      if (stat.isDirectory()) {
        this.copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  /**
   * 디렉토리 삭제
   */
  removeDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }

  /**
   * 아카이브 정보 생성
   */
  createArchiveInfo(specName, analysis) {
    const specAnalysis = analysis.analysisResults.find(spec => spec.name === specName);
    
    return `# Archive Information

## Spec: ${specName}

### Archive Details
- **Archived Date**: ${new Date().toISOString()}
- **Reason**: Incomplete spec (implementation appears to be completed)
- **Original Location**: \`.kiro/specs/${specName}\`

### Analysis Results
- **Relevance Score**: ${specAnalysis?.relevanceScore?.toFixed(1) || 'N/A'}점
- **Completeness**: ${specAnalysis?.completeness?.toFixed(0) || 'N/A'}%
- **Implementation Status**: ${specAnalysis?.implementationStatus || 'unknown'}
- **Last Modified**: ${specAnalysis?.lastModified ? new Date(specAnalysis.lastModified).toLocaleDateString() : 'Unknown'}

### Files Present
${Object.entries(specAnalysis?.files || {}).map(([fileName, fileInfo]) => 
  `- **${fileName}**: ${fileInfo.exists ? '✅ Present' : '❌ Missing'}`
).join('\n')}

### Related Files in Codebase
${specAnalysis?.relatedFiles?.length > 0 ? 
  specAnalysis.relatedFiles.map(file => `- \`${file}\``).join('\n') : 
  'No related files found'
}

### Restoration
To restore this spec:
1. Copy this directory back to \`.kiro/specs/${specName}\`
2. Remove this ARCHIVE_INFO.md file
3. Complete missing design.md and tasks.md files if needed

### Notes
This spec was archived because:
1. It was incomplete (missing design.md and/or tasks.md)
2. The related functionality appears to be already implemented in the codebase
3. It had lower relevance score compared to other specs

If this spec is still needed, please restore it and complete the missing files.
`;
  }

  /**
   * 아카이브 README 생성
   */
  async createArchiveReadme() {
    const readmePath = path.join(this.archivePath, 'README.md');
    
    const readmeContent = `# Archived Specs

This directory contains spec files that have been archived during code architecture cleanup.

## Archive Date
${new Date().toISOString()}

## Archived Specs

${this.archivedSpecs.map(spec => `
### ${spec.name}
- **Reason**: ${spec.reason}
- **Archived At**: ${spec.archivedAt}
- **Original Path**: ${spec.originalPath}
- **Archive Path**: ${spec.archivePath}
`).join('\n')}

## Restoration Process

To restore an archived spec:

1. **Copy the spec directory back to its original location**:
   \`\`\`bash
   cp -r .kiro/specs/archived/[spec-name] .kiro/specs/[spec-name]
   \`\`\`

2. **Remove the ARCHIVE_INFO.md file**:
   \`\`\`bash
   rm .kiro/specs/[spec-name]/ARCHIVE_INFO.md
   \`\`\`

3. **Complete any missing files** (design.md, tasks.md) if needed

4. **Update the spec content** to match current codebase if necessary

## Archive Criteria

Specs were archived if they met one or more of these criteria:
- Incomplete (missing design.md and/or tasks.md files)
- Low relevance score (< 40 points)
- Implementation appears to be completed
- Outdated or no longer applicable

## Maintenance

This archive should be reviewed periodically:
- Remove specs that are definitely no longer needed (after 6+ months)
- Restore specs that become relevant again
- Update this README when specs are added or removed
`;

    fs.writeFileSync(readmePath, readmeContent);
    console.log('📝 아카이브 README.md 생성 완료');
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  saveResults(outputPath = 'spec-cleanup-results.json') {
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalArchived: this.archivedSpecs.length,
        totalErrors: this.errors.length,
        success: this.errors.length === 0
      },
      archivedSpecs: this.archivedSpecs,
      errors: this.errors
    };

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 결과 저장: ${outputPath}`);
  }
}

// CLI 실행
if (require.main === module) {
  const cleaner = new SpecCleaner();
  
  cleaner.cleanup()
    .then((result) => {
      cleaner.saveResults();
      
      if (result.success) {
        console.log('\n✅ Spec 파일 정리 완료!');
        process.exit(0);
      } else {
        console.log('\n⚠️  일부 spec 정리 실패');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('정리 실패:', error);
      process.exit(1);
    });
}

module.exports = SpecCleaner;