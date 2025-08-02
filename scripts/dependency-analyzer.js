#!/usr/bin/env node

/**
 * 파일 의존성 분석 도구
 * 코드 아키텍처 정리를 위한 안전성 검증
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DependencyAnalyzer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcPath = path.join(this.projectRoot, 'src');
    this.dependencies = new Map();
    this.reverseDependencies = new Map();
    this.circularDependencies = [];
  }

  /**
   * 전체 의존성 분석 실행
   */
  async analyze() {
    console.log('🔍 파일 의존성 분석 시작...');
    
    try {
      // 1. 모든 TypeScript/JavaScript 파일 수집
      const files = this.collectSourceFiles();
      console.log(`📁 분석 대상 파일: ${files.length}개`);

      // 2. 각 파일의 import 관계 분석
      for (const file of files) {
        await this.analyzeFile(file);
      }

      // 3. 역방향 의존성 맵 생성
      this.buildReverseDependencyMap();

      // 4. 순환 의존성 검사
      this.detectCircularDependencies();

      // 5. 분석 결과 출력
      this.generateReport();

      return {
        dependencies: this.dependencies,
        reverseDependencies: this.reverseDependencies,
        circularDependencies: this.circularDependencies,
        totalFiles: files.length
      };

    } catch (error) {
      console.error('❌ 의존성 분석 중 오류 발생:', error.message);
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
          // node_modules, .next 등 제외
          if (!['node_modules', '.next', '.git', 'coverage', 'test-reports'].includes(item)) {
            walkDir(fullPath);
          }
        } else if (stat.isFile()) {
          // TypeScript, JavaScript 파일만 포함
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
  async analyzeFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const imports = this.extractImports(content);
      const resolvedImports = [];

      for (const importPath of imports) {
        const resolved = this.resolveImportPath(filePath, importPath);
        if (resolved && fs.existsSync(resolved)) {
          resolvedImports.push(resolved);
        }
      }

      this.dependencies.set(filePath, resolvedImports);
      
    } catch (error) {
      console.warn(`⚠️  파일 분석 실패: ${filePath} - ${error.message}`);
      this.dependencies.set(filePath, []);
    }
  }

  /**
   * import 구문 추출
   */
  extractImports(content) {
    const imports = [];
    
    // import 구문 정규식
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // 외부 라이브러리 제외 (상대경로나 @/로 시작하는 것만)
      if (importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('@/')) {
        imports.push(importPath);
      }
    }

    // require 구문도 확인
    const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('@/')) {
        imports.push(importPath);
      }
    }

    return imports;
  }

  /**
   * import 경로를 실제 파일 경로로 변환
   */
  resolveImportPath(fromFile, importPath) {
    try {
      // @/ 경로 처리
      if (importPath.startsWith('@/')) {
        const relativePath = importPath.substring(2);
        const fullPath = path.join(this.srcPath, relativePath);
        return this.resolveFileExtension(fullPath);
      }

      // 상대 경로 처리
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const fromDir = path.dirname(fromFile);
        const fullPath = path.resolve(fromDir, importPath);
        return this.resolveFileExtension(fullPath);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 파일 확장자 해결
   */
  resolveFileExtension(basePath) {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    
    // 정확한 파일이 있는지 확인
    if (fs.existsSync(basePath)) {
      return basePath;
    }

    // 확장자 추가해서 확인
    for (const ext of extensions) {
      const withExt = basePath + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }

    // index 파일 확인
    for (const ext of extensions) {
      const indexFile = path.join(basePath, `index${ext}`);
      if (fs.existsSync(indexFile)) {
        return indexFile;
      }
    }

    return null;
  }

  /**
   * 역방향 의존성 맵 생성
   */
  buildReverseDependencyMap() {
    for (const [file, deps] of this.dependencies) {
      for (const dep of deps) {
        if (!this.reverseDependencies.has(dep)) {
          this.reverseDependencies.set(dep, []);
        }
        this.reverseDependencies.get(dep).push(file);
      }
    }
  }

  /**
   * 순환 의존성 검사
   */
  detectCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (node, path) => {
      if (recursionStack.has(node)) {
        // 순환 발견
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat([node]);
        cycles.push(cycle);
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const deps = this.dependencies.get(node) || [];
      for (const dep of deps) {
        dfs(dep, [...path]);
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const file of this.dependencies.keys()) {
      if (!visited.has(file)) {
        dfs(file, []);
      }
    }

    this.circularDependencies = cycles;
  }

  /**
   * 특정 파일이 다른 곳에서 참조되는지 확인
   */
  isFileReferenced(filePath) {
    const references = this.reverseDependencies.get(filePath) || [];
    return {
      isReferenced: references.length > 0,
      referencedBy: references,
      canSafelyRemove: references.length === 0
    };
  }

  /**
   * 분석 결과 보고서 생성
   */
  generateReport() {
    console.log('\n📊 의존성 분석 결과:');
    console.log(`총 파일 수: ${this.dependencies.size}`);
    console.log(`순환 의존성: ${this.circularDependencies.length}개`);
    
    // 참조되지 않는 파일 찾기
    const unreferencedFiles = [];
    for (const file of this.dependencies.keys()) {
      const { isReferenced } = this.isFileReferenced(file);
      if (!isReferenced && !this.isEntryPoint(file)) {
        unreferencedFiles.push(file);
      }
    }
    
    console.log(`참조되지 않는 파일: ${unreferencedFiles.length}개`);
    
    if (this.circularDependencies.length > 0) {
      console.log('\n🔄 순환 의존성 발견:');
      this.circularDependencies.forEach((cycle, index) => {
        console.log(`${index + 1}. ${cycle.map(f => path.relative(this.projectRoot, f)).join(' → ')}`);
      });
    }

    if (unreferencedFiles.length > 0) {
      console.log('\n🗑️  참조되지 않는 파일:');
      unreferencedFiles.slice(0, 10).forEach(file => {
        console.log(`- ${path.relative(this.projectRoot, file)}`);
      });
      if (unreferencedFiles.length > 10) {
        console.log(`... 및 ${unreferencedFiles.length - 10}개 더`);
      }
    }
  }

  /**
   * 엔트리 포인트 파일인지 확인
   */
  isEntryPoint(filePath) {
    const relativePath = path.relative(this.projectRoot, filePath);
    const entryPatterns = [
      /^src\/app\/.*\/page\.(ts|tsx)$/,
      /^src\/app\/.*\/layout\.(ts|tsx)$/,
      /^src\/app\/.*\/route\.(ts|tsx)$/,
      /^middleware\.(ts|tsx)$/,
      /^next\.config\.(ts|tsx)$/
    ];
    
    return entryPatterns.some(pattern => pattern.test(relativePath));
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  saveResults(outputPath = 'dependency-analysis.json') {
    const results = {
      timestamp: new Date().toISOString(),
      totalFiles: this.dependencies.size,
      dependencies: Object.fromEntries(
        Array.from(this.dependencies.entries()).map(([file, deps]) => [
          path.relative(this.projectRoot, file),
          deps.map(dep => path.relative(this.projectRoot, dep))
        ])
      ),
      reverseDependencies: Object.fromEntries(
        Array.from(this.reverseDependencies.entries()).map(([file, refs]) => [
          path.relative(this.projectRoot, file),
          refs.map(ref => path.relative(this.projectRoot, ref))
        ])
      ),
      circularDependencies: this.circularDependencies.map(cycle =>
        cycle.map(file => path.relative(this.projectRoot, file))
      )
    };

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 분석 결과 저장: ${outputPath}`);
  }
}

// CLI 실행
if (require.main === module) {
  const analyzer = new DependencyAnalyzer();
  
  analyzer.analyze()
    .then((results) => {
      analyzer.saveResults();
      console.log('\n✅ 의존성 분석 완료');
    })
    .catch((error) => {
      console.error('❌ 분석 실패:', error);
      process.exit(1);
    });
}

module.exports = DependencyAnalyzer;