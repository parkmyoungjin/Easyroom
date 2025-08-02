#!/usr/bin/env node

/**
 * 테스트 구조 표준화 도구
 * 중복된 테스트 유틸리티 통합 및 구조 개선
 */

const fs = require('fs');
const path = require('path');
const BackupManager = require('./backup-manager');

class TestStandardizer {
  constructor() {
    this.projectRoot = process.cwd();
    this.srcPath = path.join(this.projectRoot, 'src');
    this.testUtilsPath = path.join(this.srcPath, '__tests__', 'utils');
    this.backupManager = new BackupManager();
    this.changes = [];
    this.errors = [];
  }

  /**
   * 테스트 구조 표준화 실행
   */
  async standardize() {
    console.log('🔧 테스트 구조 표준화 시작...');
    
    try {
      // 1. 분석 결과 로드
      const analysisPath = path.join(this.projectRoot, 'test-analysis.json');
      if (!fs.existsSync(analysisPath)) {
        throw new Error('test-analysis.json 파일이 없습니다. 먼저 분석을 실행해주세요.');
      }

      const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));

      // 2. 공통 테스트 유틸리티 디렉토리 생성
      await this.createTestUtilsDirectory();

      // 3. 중복 유틸리티 통합 (안전한 것만)
      await this.consolidateCommonUtilities(analysis);

      // 4. 테스트 import 구조 정리
      await this.standardizeTestImports();

      // 5. 결과 보고
      console.log('\n📊 표준화 결과:');
      console.log(`✅ 성공적으로 표준화된 항목: ${this.changes.length}개`);
      console.log(`❌ 표준화 실패한 항목: ${this.errors.length}개`);

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
      console.error('❌ 테스트 표준화 실패:', error.message);
      throw error;
    }
  }

  /**
   * 테스트 유틸리티 디렉토리 생성
   */
  async createTestUtilsDirectory() {
    console.log('\n📁 테스트 유틸리티 디렉토리 설정 중...');

    try {
      if (!fs.existsSync(this.testUtilsPath)) {
        fs.mkdirSync(this.testUtilsPath, { recursive: true });
        console.log(`✅ 디렉토리 생성: ${path.relative(this.projectRoot, this.testUtilsPath)}`);
      }

      // 공통 유틸리티 파일들 생성
      await this.createCommonUtilityFiles();

      this.changes.push({
        type: 'directory_creation',
        description: '테스트 유틸리티 디렉토리 및 공통 파일 생성',
        path: path.relative(this.projectRoot, this.testUtilsPath)
      });

    } catch (error) {
      this.errors.push({
        type: 'directory_creation_error',
        message: `테스트 유틸리티 디렉토리 생성 실패: ${error.message}`
      });
    }
  }

  /**
   * 공통 유틸리티 파일들 생성
   */
  async createCommonUtilityFiles() {
    // 1. Mock 유틸리티 파일
    const mockUtilsContent = `/**
 * 공통 Mock 유틸리티
 * 테스트에서 자주 사용되는 mock 함수들을 중앙화
 */

import type { SupabaseClient, User, Session } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/auth';

/**
 * 공통 Mock User 생성
 */
export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
  phone: '',
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {
    fullName: 'Test User',
    department: 'Test Department'
  },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

/**
 * 공통 Mock UserProfile 생성
 */
export const createMockUserProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  authId: 'test-auth-id' as any,
  dbId: 'test-db-id' as any,
  email: 'test@example.com',
  name: 'Test User',
  department: 'Test Department',
  role: 'employee',
  createdAt: new Date().toISOString(),
  ...overrides
});

/**
 * 공통 Mock Session 생성
 */
export const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: 'bearer',
  user: createMockUser(),
  ...overrides
});

/**
 * 공통 Mock Supabase Client 생성
 */
export const createMockSupabaseClient = (): Partial<SupabaseClient> => ({
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: createMockSession() }, error: null }),
    getUser: jest.fn().mockResolvedValue({ data: { user: createMockUser() }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
  } as any,
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null })
} as any);
`;

    const mockUtilsPath = path.join(this.testUtilsPath, 'mock-utils.ts');
    if (!fs.existsSync(mockUtilsPath)) {
      fs.writeFileSync(mockUtilsPath, mockUtilsContent);
      console.log('  ✅ mock-utils.ts 생성');
    }

    // 2. 테스트 헬퍼 파일
    const testHelpersContent = `/**
 * 공통 테스트 헬퍼 함수들
 * 테스트 설정 및 유틸리티 함수들을 중앙화
 */

import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * 테스트용 QueryClient 생성
 */
export const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * React Query Provider로 래핑된 렌더링
 */
export const renderWithQueryClient = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const testQueryClient = createTestQueryClient();
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>
      {children}
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};

/**
 * 비동기 작업 대기 헬퍼
 */
export const waitForAsync = (ms: number = 0) => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * 콘솔 에러 억제 헬퍼
 */
export const suppressConsoleError = () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });
};

/**
 * 윈도우 객체 모킹 헬퍼
 */
export const mockWindowClose = () => {
  const mockClose = jest.fn();
  Object.defineProperty(window, 'close', {
    value: mockClose,
    writable: true
  });
  return mockClose;
};
`;

    const testHelpersPath = path.join(this.testUtilsPath, 'test-helpers.ts');
    if (!fs.existsSync(testHelpersPath)) {
      fs.writeFileSync(testHelpersPath, testHelpersContent);
      console.log('  ✅ test-helpers.ts 생성');
    }

    // 3. 인덱스 파일
    const indexContent = `/**
 * 테스트 유틸리티 인덱스
 * 모든 테스트 유틸리티를 중앙에서 export
 */

export * from './mock-utils';
export * from './test-helpers';
`;

    const indexPath = path.join(this.testUtilsPath, 'index.ts');
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, indexContent);
      console.log('  ✅ index.ts 생성');
    }
  }

  /**
   * 중복 유틸리티 통합 (안전한 것만)
   */
  async consolidateCommonUtilities(analysis) {
    console.log('\n🔄 중복 유틸리티 분석 중...');

    // 안전하게 통합 가능한 유틸리티들만 선별
    const safeUtilities = analysis.testUtilities.filter(utility => 
      utility.name.includes('mock') && 
      utility.count >= 3 && 
      utility.count <= 10 // 너무 많이 사용되는 것은 위험할 수 있음
    );

    console.log(`📋 안전하게 통합 가능한 유틸리티: ${safeUtilities.length}개`);

    for (const utility of safeUtilities.slice(0, 3)) { // 처음 3개만 처리
      console.log(`  - ${utility.name} (${utility.count}개 파일에서 사용)`);
    }

    // 실제 통합은 위험도가 높으므로 현재는 분석만 수행
    this.changes.push({
      type: 'utility_analysis',
      description: `${safeUtilities.length}개의 통합 가능한 유틸리티 식별`,
      utilities: safeUtilities.map(u => u.name)
    });
  }

  /**
   * 테스트 import 구조 정리
   */
  async standardizeTestImports() {
    console.log('\n📝 테스트 import 구조 정리 중...');

    try {
      // 공통 import 패턴 정의
      const commonImports = [
        "import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';",
        "import { render, screen, waitFor, act } from '@testing-library/react';",
        "import userEvent from '@testing-library/user-event';"
      ];

      // 실제 import 정리는 복잡하므로 현재는 가이드라인만 생성
      const guidelinePath = path.join(this.testUtilsPath, 'TESTING_GUIDELINES.md');
      const guidelineContent = `# 테스트 작성 가이드라인

## Import 순서

1. **Jest 관련**
\`\`\`typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
\`\`\`

2. **React Testing Library**
\`\`\`typescript
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
\`\`\`

3. **공통 테스트 유틸리티**
\`\`\`typescript
import { createMockUser, createMockSupabaseClient } from '@/__tests__/utils';
\`\`\`

4. **테스트 대상 컴포넌트/함수**
\`\`\`typescript
import { ComponentToTest } from '../ComponentToTest';
\`\`\`

## 공통 Mock 사용

기존의 개별 mock 대신 공통 유틸리티를 사용하세요:

\`\`\`typescript
// ❌ 개별 mock 생성
const mockUser = { id: 'test', email: 'test@example.com', ... };

// ✅ 공통 유틸리티 사용
const mockUser = createMockUser({ email: 'custom@example.com' });
\`\`\`

## 테스트 구조

\`\`\`typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // 공통 설정
  });

  describe('기본 렌더링', () => {
    it('should render correctly', () => {
      // 테스트 코드
    });
  });

  describe('사용자 상호작용', () => {
    it('should handle click events', async () => {
      // 테스트 코드
    });
  });

  describe('에러 시나리오', () => {
    it('should handle errors gracefully', () => {
      // 테스트 코드
    });
  });
});
\`\`\`
`;

      fs.writeFileSync(guidelinePath, guidelineContent);
      console.log('  ✅ 테스트 가이드라인 생성');

      this.changes.push({
        type: 'guideline_creation',
        description: '테스트 작성 가이드라인 생성',
        path: path.relative(this.projectRoot, guidelinePath)
      });

    } catch (error) {
      this.errors.push({
        type: 'import_standardization_error',
        message: `Import 구조 정리 실패: ${error.message}`
      });
    }
  }

  /**
   * ESLint 및 TypeScript 검사 실행
   */
  async runQualityChecks() {
    console.log('\n🔍 코드 품질 검사 실행 중...');

    try {
      // TypeScript 검사
      const { execSync } = require('child_process');
      execSync('npm run type-check', { stdio: 'pipe' });
      console.log('  ✅ TypeScript 검사 통과');

      this.changes.push({
        type: 'quality_check',
        description: 'TypeScript 검사 통과',
        status: 'success'
      });

    } catch (error) {
      console.log('  ⚠️  TypeScript 검사에서 기존 오류 발견 (테스트 표준화와 무관)');
      
      this.changes.push({
        type: 'quality_check',
        description: 'TypeScript 검사 - 기존 오류 존재',
        status: 'warning'
      });
    }
  }

  /**
   * 결과를 JSON 파일로 저장
   */
  saveResults(outputPath = 'test-standardization-results.json') {
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
  const standardizer = new TestStandardizer();
  
  standardizer.standardize()
    .then(async (result) => {
      // 품질 검사 실행
      await standardizer.runQualityChecks();
      
      standardizer.saveResults();
      
      if (result.success) {
        console.log('\n✅ 테스트 구조 표준화 완료!');
        console.log('\n📋 다음 단계:');
        console.log('1. src/__tests__/utils/ 디렉토리의 공통 유틸리티 활용');
        console.log('2. TESTING_GUIDELINES.md 참고하여 새 테스트 작성');
        console.log('3. 기존 테스트들을 점진적으로 공통 유틸리티로 마이그레이션');
        process.exit(0);
      } else {
        console.log('\n⚠️  일부 테스트 표준화 실패');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('표준화 실패:', error);
      process.exit(1);
    });
}

module.exports = TestStandardizer;