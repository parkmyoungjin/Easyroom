#!/usr/bin/env node

/**
 * Spec 파일 분석 도구
 * 기존 spec 파일들과 현재 코드베이스의 일치성 검증
 */

const fs = require('fs');
const path = require('path');

class SpecAnalyzer {
  constructor() {
    this.projectRoot = process.cwd();
    this.specsPath = path.join(this.projectRoot, '.kiro/specs');
    this.srcPath = path.join(this.projectRoot, 'src');
    this.specDirectories = [];
    this.analysisResults = [];
  }

  /**
   * Spec 파일 분석 실행
   */
  async analyze() {
    console.log('🔍 Spec 파일 분석 시작...');
    
    try {
      // 1. 모든 spec 디렉토리 수집
      this.specDirectories = this.collectSpecDirectories();
      console.log(`📁 분석 대상 spec: ${this.specDirectories.length}개`);

      // 2. 각 spec 분석
      for (const specDir of this.specDirectories) {
        const analysis = await this.analyzeSpec(specDir);
        this.analysisResults.push(analysis);
      }

      // 3. 현재 코드베이스와 비교
      await this.compareWithCurrentCodebase();

      // 4. 정리 계획 수립
      const cleanupPlan = this.createCleanupPlan();

      // 5. 분석 결과 출력
      this.generateReport();

      return {
        specDirectories: this.specDirectories,
        analysisResults: this.analysisResults,
        cleanupPlan
      };

    } catch (error) {
      console.error('❌ Spec 분석 중 오류 발생:', error.message);
      throw error;
    }
  }

  /**
   * Spec 디렉토리 수집
   */
  collectSpecDirectories() {
    const directories = [];
    
    if (!fs.existsSync(this.specsPath)) {
      return directories;
    }

    const items = fs.readdirSync(this.specsPath);
    
    for (const item of items) {
      const fullPath = path.join(this.specsPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        directories.push({
          name: item,
          path: fullPath,
          relativePath: path.relative(this.projectRoot, fullPath)
        });
      }
    }
    
    return directories;
  }

  /**
   * 개별 spec 분석
   */
  async analyzeSpec(specDir) {
    const analysis = {
      name: specDir.name,
      path: specDir.path,
      relativePath: specDir.relativePath,
      files: {},
      completeness: 0,
      lastModified: null,
      relevanceScore: 0,
      implementationStatus: 'unknown',
      issues: []
    };

    try {
      // spec 파일들 확인
      const specFiles = ['requirements.md', 'design.md', 'tasks.md'];
      let existingFiles = 0;
      let latestModified = 0;

      for (const fileName of specFiles) {
        const filePath = path.join(specDir.path, fileName);
        
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, 'utf8');
          
          analysis.files[fileName] = {
            exists: true,
            size: stats.size,
            lastModified: stats.mtime,
            contentLength: content.length,
            hasContent: content.trim().length > 100 // 최소 내용 확인
          };
          
          existingFiles++;
          latestModified = Math.max(latestModified, stats.mtime.getTime());
        } else {
          analysis.files[fileName] = { exists: false };
        }
      }

      analysis.completeness = (existingFiles / specFiles.length) * 100;
      analysis.lastModified = latestModified ? new Date(latestModified) : null;

      // 관련성 점수 계산
      analysis.relevanceScore = this.calculateRelevanceScore(specDir.name, analysis);

      // 구현 상태 추정
      analysis.implementationStatus = this.estimateImplementationStatus(specDir.name, analysis);

    } catch (error) {
      analysis.issues.push(`분석 오류: ${error.message}`);
    }

    return analysis;
  }

  /**
   * 관련성 점수 계산
   */
  calculateRelevanceScore(specName, analysis) {
    let score = 0;

    // 완성도 점수 (0-40점)
    score += (analysis.completeness / 100) * 40;

    // 최신성 점수 (0-30점)
    if (analysis.lastModified) {
      const daysSinceModified = (Date.now() - analysis.lastModified.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 7) score += 30;
      else if (daysSinceModified < 30) score += 20;
      else if (daysSinceModified < 90) score += 10;
    }

    // 이름 기반 관련성 (0-30점)
    const relevantKeywords = [
      'auth', 'authentication', 'login', 'signup',
      'reservation', 'room', 'booking',
      'security', 'monitoring', 'performance',
      'pagination', 'optimization', 'refactoring'
    ];

    const nameWords = specName.toLowerCase().split('-');
    const matchingKeywords = nameWords.filter(word => 
      relevantKeywords.some(keyword => keyword.includes(word) || word.includes(keyword))
    );
    
    score += (matchingKeywords.length / nameWords.length) * 30;

    return Math.min(score, 100);
  }

  /**
   * 구현 상태 추정
   */
  estimateImplementationStatus(specName, analysis) {
    // 현재 코드베이스에서 관련 파일들 확인
    const relatedFiles = this.findRelatedFiles(specName);
    
    if (relatedFiles.length === 0) {
      return 'not_implemented';
    } else if (relatedFiles.length < 3) {
      return 'partially_implemented';
    } else {
      return 'likely_implemented';
    }
  }

  /**
   * 관련 파일 찾기
   */
  findRelatedFiles(specName) {
    const relatedFiles = [];
    const keywords = specName.toLowerCase().split('-');
    
    try {
      const searchPatterns = keywords.map(keyword => new RegExp(keyword, 'i'));
      
      const walkDir = (dir) => {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            if (!['node_modules', '.next', '.git', 'coverage'].includes(item)) {
              walkDir(fullPath);
            }
          } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(item)) {
            const relativePath = path.relative(this.srcPath, fullPath);
            
            // 파일명이나 경로에 키워드가 포함되어 있는지 확인
            if (searchPatterns.some(pattern => pattern.test(relativePath))) {
              relatedFiles.push(relativePath);
            }
          }
        }
      };

      walkDir(this.srcPath);
    } catch (error) {
      // 오류 무시하고 계속 진행
    }

    return relatedFiles.slice(0, 10); // 최대 10개만 반환
  }

  /**
   * 현재 코드베이스와 비교
   */
  async compareWithCurrentCodebase() {
    console.log('\n🔍 현재 코드베이스와 비교 중...');

    for (const analysis of this.analysisResults) {
      // 관련 파일들의 존재 여부 확인
      const relatedFiles = this.findRelatedFiles(analysis.name);
      analysis.relatedFiles = relatedFiles;

      // tasks.md가 있는 경우 작업 완료 상태 확인
      if (analysis.files['tasks.md'] && analysis.files['tasks.md'].exists) {
        const tasksPath = path.join(analysis.path, 'tasks.md');
        const tasksContent = fs.readFileSync(tasksPath, 'utf8');
        
        // 완료된 작업 수 계산
        const completedTasks = (tasksContent.match(/- \[x\]/gi) || []).length;
        const totalTasks = (tasksContent.match(/- \[[x\s]\]/gi) || []).length;
        
        analysis.taskCompletion = {
          completed: completedTasks,
          total: totalTasks,
          percentage: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        };
      }
    }
  }

  /**
   * 정리 계획 수립
   */
  createCleanupPlan() {
    const plan = {
      toKeep: [],
      toArchive: [],
      toDelete: [],
      toUpdate: [],
      statistics: {
        total: this.analysisResults.length,
        highRelevance: 0,
        mediumRelevance: 0,
        lowRelevance: 0
      }
    };

    for (const analysis of this.analysisResults) {
      const score = analysis.relevanceScore;
      
      if (score >= 70) {
        plan.statistics.highRelevance++;
        plan.toKeep.push({
          name: analysis.name,
          reason: `높은 관련성 (${score.toFixed(1)}점)`,
          recommendation: 'keep_active'
        });
      } else if (score >= 40) {
        plan.statistics.mediumRelevance++;
        
        if (analysis.implementationStatus === 'likely_implemented') {
          plan.toArchive.push({
            name: analysis.name,
            reason: `구현 완료로 추정, 중간 관련성 (${score.toFixed(1)}점)`,
            recommendation: 'archive'
          });
        } else {
          plan.toUpdate.push({
            name: analysis.name,
            reason: `업데이트 필요, 중간 관련성 (${score.toFixed(1)}점)`,
            recommendation: 'update'
          });
        }
      } else {
        plan.statistics.lowRelevance++;
        plan.toDelete.push({
          name: analysis.name,
          reason: `낮은 관련성 (${score.toFixed(1)}점), 오래된 spec`,
          recommendation: 'delete'
        });
      }
    }

    return plan;
  }

  /**
   * 분석 결과 보고서 생성
   */
  generateReport() {
    console.log('\n📊 Spec 파일 분석 결과:');
    console.log(`총 spec 디렉토리: ${this.analysisResults.length}개`);
    
    // 완성도별 분포
    const completenessDistribution = {
      complete: 0,    // 100%
      partial: 0,     // 50-99%
      incomplete: 0   // 0-49%
    };

    // 관련성별 분포
    const relevanceDistribution = {
      high: 0,    // 70점 이상
      medium: 0,  // 40-69점
      low: 0      // 40점 미만
    };

    for (const analysis of this.analysisResults) {
      // 완성도 분류
      if (analysis.completeness === 100) {
        completenessDistribution.complete++;
      } else if (analysis.completeness >= 50) {
        completenessDistribution.partial++;
      } else {
        completenessDistribution.incomplete++;
      }

      // 관련성 분류
      if (analysis.relevanceScore >= 70) {
        relevanceDistribution.high++;
      } else if (analysis.relevanceScore >= 40) {
        relevanceDistribution.medium++;
      } else {
        relevanceDistribution.low++;
      }
    }

    console.log('\n📈 완성도 분포:');
    console.log(`완전한 spec (3개 파일): ${completenessDistribution.complete}개`);
    console.log(`부분적 spec (1-2개 파일): ${completenessDistribution.partial}개`);
    console.log(`불완전한 spec (0개 파일): ${completenessDistribution.incomplete}개`);

    console.log('\n🎯 관련성 분포:');
    console.log(`높은 관련성 (70점+): ${relevanceDistribution.high}개`);
    console.log(`중간 관련성 (40-69점): ${relevanceDistribution.medium}개`);
    console.log(`낮은 관련성 (40점-): ${relevanceDistribution.low}개`);

    // 상위 5개 spec 표시
    const topSpecs = this.analysisResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);

    console.log('\n🏆 관련성 상위 5개 spec:');
    topSpecs.forEach((spec, index) => {
      console.log(`${index + 1}. ${spec.name}`);
      console.log(`   관련성: ${spec.relevanceScore.toFixed(1)}점`);
      console.log(`   완성도: ${spec.completeness.toFixed(0)}%`);
      console.log(`   구현 상태: ${spec.implementationStatus}`);
      if (spec.relatedFiles && spec.relatedFiles.length > 0) {
        console.log(`   관련 파일: ${spec.relatedFiles.length}개`);
      }
    });

    // 하위 5개 spec 표시
    const bottomSpecs = this.analysisResults
      .sort((a, b) => a.relevanceScore - b.relevanceScore)
      .slice(0, 5);

    console.log('\n⚠️  관련성 하위 5개 spec:');
    bottomSpecs.forEach((spec, index) => {
      console.log(`${index + 1}. ${spec.name}`);
      console.log(`   관련성: ${spec.relevanceScore.toFixed(1)}점`);
      console.log(`   완성도: ${spec.completeness.toFixed(0)}%`);
      console.log(`   마지막 수정: ${spec.lastModified ? spec.lastModified.toLocaleDateString() : '알 수 없음'}`);
    });
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  saveResults(outputPath = 'spec-analysis.json') {
    const results = {
      timestamp: new Date().toISOString(),
      statistics: {
        totalSpecs: this.analysisResults.length,
        averageRelevance: this.analysisResults.reduce((sum, spec) => sum + spec.relevanceScore, 0) / this.analysisResults.length,
        averageCompleteness: this.analysisResults.reduce((sum, spec) => sum + spec.completeness, 0) / this.analysisResults.length
      },
      analysisResults: this.analysisResults,
      cleanupPlan: this.createCleanupPlan()
    };

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 분석 결과 저장: ${outputPath}`);
  }
}

// CLI 실행
if (require.main === module) {
  const analyzer = new SpecAnalyzer();
  
  analyzer.analyze()
    .then((results) => {
      analyzer.saveResults();
      console.log('\n✅ Spec 파일 분석 완료');
    })
    .catch((error) => {
      console.error('❌ 분석 실패:', error);
      process.exit(1);
    });
}

module.exports = SpecAnalyzer;