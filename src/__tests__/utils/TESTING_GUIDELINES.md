# 테스트 작성 가이드라인

## Import 순서

1. **Jest 관련**
```typescript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
```

2. **React Testing Library**
```typescript
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
```

3. **공통 테스트 유틸리티**
```typescript
import { createMockUser, createMockSupabaseClient } from '@/__tests__/utils';
```

4. **테스트 대상 컴포넌트/함수**
```typescript
import { ComponentToTest } from '../ComponentToTest';
```

## 공통 Mock 사용

기존의 개별 mock 대신 공통 유틸리티를 사용하세요:

```typescript
// ❌ 개별 mock 생성
const mockUser = { id: 'test', email: 'test@example.com', ... };

// ✅ 공통 유틸리티 사용
const mockUser = createMockUser({ email: 'custom@example.com' });
```

## 테스트 구조

```typescript
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
```
