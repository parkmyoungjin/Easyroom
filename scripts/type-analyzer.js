#!/usr/bin/env node

/**
 * 타입 정의 분석 도구
 * 중복된 타입 정의 식별 및 최적화 계획 수립
 */

const fs = require('fs');
const path = require('path');

class TypeAnalyzer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcPath = path.join(this.projectRoot, 'src');
    this.typeDefinitions = new Map();
    this.duplicateTypes = [];
    this.unusedTypes = [];
    this.inconsistentTypes = [];
  }

  /**
   * 타입 정의 분석 실행
   */
  async analyze() {
    console.log('🔍 타입 정의 분석 시작...');
    
    try {
      // 1. 모든 TypeScript 파일 수집
      const files = this.collectTypeFiles();
      console.log(`📁 분석 대상 파일: ${files.length}개`);

      // 2. 각 파일의 타입 정의 추출
      for (const file of files) {
        await this.extractTypeDefinitions(file);
      }

      // 3. 중복 타입 분석
      this.analyzeDuplicateTypes();

      // 4. 일관성 검사
      this.analyzeTypeConsistency();

      // 5. 최적화 계획 수립
      const plan = this.createOptimizationPlan();

      // 6. 분석 결과 출력
      this.generateReport();

      return {
        typeDefinitions: this.typeDefinitions,
        duplicateTypes: this.duplicateTypes,
        unusedTypes: this.unusedTypes,
        inconsistentTypes: this.inconsistentTypes,
        optimizationPlan: plan
      };

    } catch (error) {
      console.error('❌ 타입 분석 중 오류 발생:', error.message);
      throw error;
    }
  }

  /**
   * 타입 파일 수집
   */
  collectTypeFiles() {
    const files = [];
    
    const walkDir = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!['node_modules', '.next', '.git', 'coverage', 'test-reports'].includes(item)) {
            walkDir(fullPath);
          }
        } else if (stat.isFile()) {
          // TypeScript 파일만 포함 (.d.ts 포함)
          if (/\.(ts|tsx)$/.test(item)) {
            files.push(fullPath);
          }
        }
      }
    };

    walkDir(this.srcPath);
    
    return files;
  }

  /**
   * 타입 정의 추출
   */
  async extractTypeDefinitions(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const types = this.parseTypeDefinitions(content);
      
      for (const type of types) {
        const key = type.name;
        
        if (!this.typeDefinitions.has(key)) {
          this.typeDefinitions.set(key, []);
        }
        
        this.typeDefinitions.get(key).push({
          ...type,
          file: filePath,
          relativePath: path.relative(this.projectRoot, filePath)
        });
      }
      
    } catch (error) {
      console.warn(`⚠️  파일 분석 실패: ${filePath} - ${error.message}`);
    }
  }

  /**
   * 타입 정의 파싱
   */
  parseTypeDefinitions(content) {
    const types = [];
    
    // interface 정의 추출
    const interfaceRegex = /^export\s+interface\s+(\w+)(?:<[^>]*>)?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gm;
    let match;
    
    while ((match = interfaceRegex.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      
      types.push({
        name,
        type: 'interface',
        definition: match[0],
        body: body.trim(),
        properties: this.extractProperties(body),
        lineNumber: this.getLineNumber(content, match.index),
        isExported: true
      });
    }

    // type 정의 추출
    const typeRegex = /^export\s+type\s+(\w+)(?:<[^>]*>)?\s*=\s*([^;]+);?/gm;
    
    while ((match = typeRegex.exec(content)) !== null) {
      const name = match[1];
      const definition = match[2];
      
      types.push({
        name,
        type: 'type',
        definition: match[0],
        body: definition.trim(),
        properties: this.extractTypeProperties(definition),
        lineNumber: this.getLineNumber(content, match.index),
        isExported: true
      });
    }

    // enum 정의 추출
    const enumRegex = /^export\s+enum\s+(\w+)\s*\{([^}]*)\}/gm;
    
    while ((match = enumRegex.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      
      types.push({
        name,
        type: 'enum',
        definition: match[0],
        body: body.trim(),
        properties: this.extractEnumValues(body),
        lineNumber: this.getLineNumber(content, match.index),
        isExported: true
      });
    }

    return types;
  }

  /**
   * interface 속성 추출
   */
  extractProperties(body) {
    const properties = [];
    const lines = body.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
        const match = trimmed.match(/^(\w+)(\?)?:\s*([^;,]+)/);
        if (match) {
          properties.push({
            name: match[1],
            optional: !!match[2],
            type: match[3].trim()
          });
        }
      }
    }
    
    return properties;
  }

  /**
   * type 속성 추출
   */
  extractTypeProperties(definition) {
    // 간단한 타입 분석 (복잡한 타입은 전체 정의를 저장)
    if (definition.includes('{')) {
      return this.extractProperties(definition);
    }
    
    return [{ name: 'definition', type: definition.trim() }];
  }

  /**
   * enum 값 추출
   */
  extractEnumValues(body) {
    const values = [];
    const lines = body.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim().replace(/,$/, '');
      if (trimmed && !trimmed.startsWith('//')) {
        const match = trimmed.match(/^(\w+)(?:\s*=\s*(.+))?/);
        if (match) {
          values.push({
            name: match[1],
            value: match[2] || match[1]
          });
        }
      }
    }
    
    return values;
  }

  /**
   * 라인 번호 계산
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * 중복 타입 분석
   */
  analyzeDuplicateTypes() {
    for (const [typeName, definitions] of this.typeDefinitions) {
      if (definitions.length > 1) {
        const duplicateInfo = {
          name: typeName,
          count: definitions.length,
          definitions: definitions,
          similarity: this.calculateSimilarity(definitions),
          canMerge: this.canMergeTypes(definitions),
          recommendedAction: this.getRecommendedAction(definitions)
        };
        
        this.duplicateTypes.push(duplicateInfo);
      }
    }
  }

  /**
   * 타입 정의 유사도 계산
   */
  calculateSimilarity(definitions) {
    if (definitions.length < 2) return 1;
    
    const first = definitions[0];
    let totalSimilarity = 0;
    
    for (let i = 1; i < definitions.length; i++) {
      const current = definitions[i];
      const similarity = this.compareTwoTypes(first, current);
      totalSimilarity += similarity;
    }
    
    return totalSimilarity / (definitions.length - 1);
  }

  /**
   * 두 타입 비교
   */
  compareTwoTypes(type1, type2) {
    // 타입이 다르면 유사도 낮음
    if (type1.type !== type2.type) return 0.3;
    
    // 속성 비교
    const props1 = type1.properties || [];
    const props2 = type2.properties || [];
    
    if (props1.length === 0 && props2.length === 0) return 1;
    if (props1.length === 0 || props2.length === 0) return 0.5;
    
    const commonProps = props1.filter(p1 => 
      props2.some(p2 => p1.name === p2.name && p1.type === p2.type)
    );
    
    const maxProps = Math.max(props1.length, props2.length);
    return commonProps.length / maxProps;
  }

  /**
   * 타입 병합 가능성 판단
   */
  canMergeTypes(definitions) {
    // 모든 정의가 같은 타입이어야 함
    const firstType = definitions[0].type;
    if (!definitions.every(def => def.type === firstType)) {
      return false;
    }
    
    // 유사도가 높아야 함
    const similarity = this.calculateSimilarity(definitions);
    return similarity > 0.8;
  }

  /**
   * 권장 액션 결정
   */
  getRecommendedAction(definitions) {
    const similarity = this.calculateSimilarity(definitions);
    
    if (similarity > 0.9) {
      return 'merge'; // 거의 동일하므로 병합
    } else if (similarity > 0.7) {
      return 'consolidate'; // 통합 후 차이점 해결
    } else if (similarity > 0.5) {
      return 'rename'; // 이름 변경으로 구분
    } else {
      return 'keep_separate'; // 별도 유지
    }
  }

  /**
   * 타입 일관성 검사
   */
  analyzeTypeConsistency() {
    // 브랜드 타입 사용 패턴 분석
    const brandedTypes = [];
    const regularTypes = [];
    
    for (const [typeName, definitions] of this.typeDefinitions) {
      const hasBrandedType = definitions.some(def => 
        def.body.includes('__brand') || def.body.includes('& {')
      );
      
      if (hasBrandedType) {
        brandedTypes.push(typeName);
      } else {
        regularTypes.push(typeName);
      }
    }

    // ID 관련 타입 일관성 검사
    const idTypes = [];
    for (const [typeName, definitions] of this.typeDefinitions) {
      if (typeName.toLowerCase().includes('id') || 
          definitions.some(def => def.body.includes('string') && def.name.includes('Id'))) {
        idTypes.push({ name: typeName, definitions });
      }
    }

    this.inconsistentTypes = idTypes.filter(idType => {
      const hasBranded = idType.definitions.some(def => def.body.includes('__brand'));
      const hasRegular = idType.definitions.some(def => !def.body.includes('__brand'));
      return hasBranded && hasRegular;
    });
  }

  /**
   * 최적화 계획 수립
   */
  createOptimizationPlan() {
    const plan = {
      mergeActions: [],
      renameActions: [],
      brandingActions: [],
      cleanupActions: [],
      statistics: {
        totalTypes: this.typeDefinitions.size,
        duplicateTypes: this.duplicateTypes.length,
        inconsistentTypes: this.inconsistentTypes.length
      }
    };

    // 중복 타입 처리 계획
    for (const duplicate of this.duplicateTypes) {
      switch (duplicate.recommendedAction) {
        case 'merge':
          plan.mergeActions.push({
            typeName: duplicate.name,
            primaryFile: duplicate.definitions[0].relativePath,
            filesToUpdate: duplicate.definitions.slice(1).map(def => def.relativePath),
            reason: `유사도 ${(duplicate.similarity * 100).toFixed(1)}%로 병합 가능`
          });
          break;
          
        case 'rename':
          plan.renameActions.push({
            typeName: duplicate.name,
            suggestions: duplicate.definitions.map((def, index) => ({
              file: def.relativePath,
              newName: `${duplicate.name}${index > 0 ? index + 1 : ''}`,
              context: this.getTypeContext(def)
            }))
          });
          break;
      }
    }

    // 브랜드 타입 일관성 개선
    for (const inconsistent of this.inconsistentTypes) {
      plan.brandingActions.push({
        typeName: inconsistent.name,
        action: 'standardize_branding',
        files: inconsistent.definitions.map(def => def.relativePath),
        recommendation: 'ID 관련 타입은 브랜드 타입 사용 권장'
      });
    }

    return plan;
  }

  /**
   * 타입 컨텍스트 추출
   */
  getTypeContext(definition) {
    const filePath = definition.relativePath;
    
    if (filePath.includes('types/')) {
      return 'global_types';
    } else if (filePath.includes('__tests__/')) {
      return 'test_types';
    } else if (filePath.includes('components/')) {
      return 'component_types';
    } else {
      return 'local_types';
    }
  }

  /**
   * 분석 결과 보고서 생성
   */
  generateReport() {
    console.log('\n📊 타입 정의 분석 결과:');
    console.log(`총 타입 정의: ${this.typeDefinitions.size}개`);
    console.log(`중복된 타입: ${this.duplicateTypes.length}개`);
    console.log(`일관성 없는 타입: ${this.inconsistentTypes.length}개`);
    
    if (this.duplicateTypes.length > 0) {
      console.log('\n🔄 중복된 타입 정의:');
      this.duplicateTypes.slice(0, 10).forEach(duplicate => {
        console.log(`- ${duplicate.name} (${duplicate.count}개 정의)`);
        console.log(`  유사도: ${(duplicate.similarity * 100).toFixed(1)}%`);
        console.log(`  권장 액션: ${duplicate.recommendedAction}`);
        console.log(`  파일: ${duplicate.definitions.map(d => d.relativePath).join(', ')}`);
      });
      
      if (this.duplicateTypes.length > 10) {
        console.log(`... 및 ${this.duplicateTypes.length - 10}개 더`);
      }
    }

    if (this.inconsistentTypes.length > 0) {
      console.log('\n⚠️  일관성 없는 ID 타입:');
      this.inconsistentTypes.forEach(inconsistent => {
        console.log(`- ${inconsistent.name}`);
        console.log(`  브랜드 타입과 일반 타입이 혼재`);
      });
    }

    // 타입별 분포
    const typesByCategory = {
      interface: 0,
      type: 0,
      enum: 0
    };

    for (const [, definitions] of this.typeDefinitions) {
      const firstDef = definitions[0];
      typesByCategory[firstDef.type]++;
    }

    console.log('\n📈 타입 카테고리별 분포:');
    console.log(`Interface: ${typesByCategory.interface}개`);
    console.log(`Type: ${typesByCategory.type}개`);
    console.log(`Enum: ${typesByCategory.enum}개`);
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  saveResults(outputPath = 'type-analysis.json') {
    const results = {
      timestamp: new Date().toISOString(),
      statistics: {
        totalTypes: this.typeDefinitions.size,
        duplicateTypes: this.duplicateTypes.length,
        inconsistentTypes: this.inconsistentTypes.length
      },
      duplicateTypes: this.duplicateTypes,
      inconsistentTypes: this.inconsistentTypes,
      optimizationPlan: this.createOptimizationPlan(),
      typeDefinitions: Object.fromEntries(
        Array.from(this.typeDefinitions.entries()).map(([name, defs]) => [
          name,
          defs.map(def => ({
            file: def.relativePath,
            type: def.type,
            lineNumber: def.lineNumber,
            properties: def.properties
          }))
        ])
      )
    };

    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 분석 결과 저장: ${outputPath}`);
  }
}

// CLI 실행
if (require.main === module) {
  const analyzer = new TypeAnalyzer();
  
  analyzer.analyze()
    .then((results) => {
      analyzer.saveResults();
      console.log('\n✅ 타입 정의 분석 완료');
    })
    .catch((error) => {
      console.error('❌ 분석 실패:', error);
      process.exit(1);
    });
}

module.exports = TypeAnalyzer;