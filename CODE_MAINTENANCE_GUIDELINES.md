# 코드 유지보수 가이드라인

**프로젝트**: RoomBook (회의실 예약 시스템)  
**최종 업데이트**: 2025년 7월 29일  
**버전**: 1.0

---

## 📋 개요

이 문서는 RoomBook 프로젝트의 코드 품질을 지속적으로 유지하기 위한 가이드라인을 제공합니다. 코드 아키텍처 정리 작업 완료 후, 향후 개발 과정에서 코드 품질이 저하되지 않도록 하는 것이 목표입니다.

---

## 🛠️ 정기적 유지보수 작업

### 월간 작업 (매월 첫째 주)

#### 1. 의존성 분석
```bash
node scripts/dependency-analyzer.js
```
- **목적**: 참조되지 않는 파일 및 순환 의존성 확인
- **확인사항**: 
  - 새로 생성된 불필요한 파일
  - 순환 의존성 발생 여부
  - 파일 구조 변화
- **조치**: 불필요한 파일 제거 및 구조 개선

#### 2. Import 구조 점검
```bash
node scripts/import-analyzer.js
```
- **목적**: Import 패턴 일관성 유지
- **확인사항**:
  - 새로 추가된 일관성 없는 import
  - 상대/절대 경로 혼용 여부
- **조치**: 필요시 `import-standardizer.js` 실행

#### 3. 백업 정리
```bash
node scripts/backup-manager.js cleanup 30
```
- **목적**: 30일 이상 된 백업 파일 정리
- **확인사항**: 디스크 공간 최적화
- **조치**: 오래된 백업 자동 삭제

### 분기별 작업 (3개월마다)

#### 1. 타입 정의 최적화
```bash
node scripts/type-analyzer.js
```
- **목적**: 중복 타입 정의 및 일관성 점검
- **확인사항**:
  - 새로 생성된 중복 타입
  - 브랜드 타입 사용 패턴
  - 타입 파일 구조
- **조치**: 필요시 `type-optimizer.js` 실행

#### 2. 테스트 구조 점검
```bash
node scripts/test-analyzer.js
```
- **목적**: 테스트 파일 구조 및 중복 유틸리티 확인
- **확인사항**:
  - 새로 생성된 중복 테스트 유틸리티
  - 테스트 패턴 일관성
  - 공통 유틸리티 사용률
- **조치**: 중복 유틸리티를 공통 유틸리티로 통합

#### 3. Spec 파일 관리
```bash
node scripts/spec-analyzer.js
```
- **목적**: Spec 파일 상태 및 관련성 점검
- **확인사항**:
  - 새로 생성된 spec의 완성도
  - 구현 완료된 spec 식별
  - 아카이브 대상 spec
- **조치**: 필요시 `spec-cleaner.js` 실행

### 반기별 작업 (6개월마다)

#### 1. 전체 품질 검사
```bash
node scripts/final-quality-check.js
```
- **목적**: 전체 코드베이스 품질 종합 점검
- **확인사항**:
  - TypeScript 타입 안전성
  - 빌드 성능
  - 프로젝트 구조 상태
- **조치**: 발견된 문제점 해결

#### 2. 의존성 최적화
```bash
node scripts/dependency-cleaner.js
```
- **목적**: 사용되지 않는 npm 패키지 정리
- **확인사항**:
  - 실제 사용되지 않는 패키지
  - 버전 업데이트 필요한 패키지
- **조치**: 불필요한 의존성 제거

---

## 📝 개발 시 준수사항

### Import 작성 규칙

#### 테스트 파일
```typescript
// ✅ 올바른 패턴 (상대 경로 사용)
import { ComponentToTest } from '../ComponentToTest';
import { mockUser } from '../utils/mock-utils';

// ❌ 잘못된 패턴 (절대 경로 사용)
import { ComponentToTest } from '@/components/ComponentToTest';
```

#### 일반 소스 파일
```typescript
// ✅ 올바른 패턴 (절대 경로 사용)
import { UserProfile } from '@/types/auth';
import { createClient } from '@/lib/supabase/client';

// ❌ 잘못된 패턴 (상대 경로 사용)
import { UserProfile } from '../../types/auth';
```

#### Import 순서
```typescript
// 1. React 관련
import React from 'react';
import { useState, useEffect } from 'react';

// 2. Next.js 관련
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 3. 외부 라이브러리
import { z } from 'zod';
import { clsx } from 'clsx';

// 4. 내부 절대 경로 (@/)
import { UserProfile } from '@/types/auth';
import { createClient } from '@/lib/supabase/client';

// 5. 내부 상대 경로 (./, ../)
import { LocalComponent } from './LocalComponent';
```

### 타입 정의 규칙

#### 새 타입 정의 전 확인사항
1. **기존 타입 검색**: 유사한 타입이 이미 존재하는지 확인
2. **위치 결정**: 적절한 타입 파일에 배치
3. **브랜드 타입 고려**: ID 관련 타입은 브랜드 타입 사용 검토

#### 타입 파일별 용도
- `src/types/auth.ts`: 인증 관련 타입
- `src/types/database.ts`: 데이터베이스 및 API 관련 타입
- `src/types/enhanced-types.ts`: 브랜드 타입 및 고급 타입
- `src/types/pagination.ts`: 페이지네이션 관련 타입
- `src/types/routes.ts`: 라우팅 관련 타입

#### 타입 정의 예시
```typescript
// ✅ 올바른 패턴
export interface UserReservation {
  id: string;
  userId: DatabaseUserId; // 브랜드 타입 사용
  roomId: string;
  title: string;
  startTime: Date;
  endTime: Date;
}

// ❌ 잘못된 패턴 (중복 가능성)
export interface ReservationData {
  id: string;
  user_id: string; // 브랜드 타입 미사용
  room_id: string;
  title: string;
  start_time: Date;
  end_time: Date;
}
```

### 테스트 작성 규칙

#### 공통 유틸리티 사용
```typescript
// ✅ 올바른 패턴 (공통 유틸리티 사용)
import { createMockUser, createMockSupabaseClient } from '@/__tests__/utils';

const mockUser = createMockUser({ email: 'test@example.com' });
const mockClient = createMockSupabaseClient();

// ❌ 잘못된 패턴 (개별 mock 생성)
const mockUser = {
  id: 'test-id',
  email: 'test@example.com',
  // ... 많은 속성들
};
```

#### 테스트 구조
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

### Spec 파일 관리

#### 새 Spec 생성 시
1. **완전한 구조**: requirements.md, design.md, tasks.md 모두 생성
2. **명확한 제목**: 기능을 명확히 나타내는 디렉토리명 사용
3. **관련성 유지**: 현재 코드베이스와 관련성 높은 내용 작성

#### Spec 완료 후
1. **구현 상태 업데이트**: tasks.md의 체크박스 업데이트
2. **아카이브 고려**: 구현 완료된 spec은 아카이브 검토
3. **문서 정리**: 불필요한 내용 제거 및 정리

---

## 🔍 코드 리뷰 체크리스트

### 일반 코드 리뷰

#### Import 관련
- [ ] Import 순서가 가이드라인을 따르는가?
- [ ] 테스트 파일에서 상대 경로를 사용하는가?
- [ ] 일반 파일에서 절대 경로를 사용하는가?
- [ ] 사용되지 않는 import가 있는가?

#### 타입 관련
- [ ] 새로운 타입이 기존 타입과 중복되지 않는가?
- [ ] ID 관련 타입에서 브랜드 타입을 사용하는가?
- [ ] 타입이 적절한 파일에 정의되어 있는가?
- [ ] 타입 정의가 명확하고 일관성 있는가?

#### 테스트 관련
- [ ] 공통 테스트 유틸리티를 사용하는가?
- [ ] 테스트 구조가 가이드라인을 따르는가?
- [ ] 중복된 mock 생성을 피하고 있는가?
- [ ] 테스트 케이스가 명확하고 의미 있는가?

### 아키텍처 리뷰

#### 파일 구조
- [ ] 새 파일이 적절한 디렉토리에 위치하는가?
- [ ] 파일명이 명확하고 일관성 있는가?
- [ ] 임시 파일이나 백업 파일이 커밋되지 않았는가?

#### 의존성 관리
- [ ] 새로운 의존성이 정말 필요한가?
- [ ] 기존 의존성으로 해결 가능한가?
- [ ] 의존성 버전이 적절한가?

---

## 🚨 문제 발생 시 대응 방안

### 빌드 실패 시
1. **TypeScript 오류**: `npm run type-check`로 타입 오류 확인
2. **Import 오류**: `import-analyzer.js`로 import 구조 점검
3. **의존성 오류**: `package.json` 및 `node_modules` 상태 확인

### 성능 저하 시
1. **번들 크기 확인**: `npm run build` 후 번들 크기 분석
2. **불필요한 의존성**: `dependency-cleaner.js`로 의존성 점검
3. **코드 분할**: 큰 컴포넌트나 유틸리티 분할 검토

### 테스트 실패 시
1. **테스트 구조**: `test-analyzer.js`로 테스트 구조 점검
2. **Mock 문제**: 공통 유틸리티 사용 여부 확인
3. **의존성 문제**: 테스트 관련 의존성 상태 확인

### 백업 복원이 필요한 경우
```bash
# 백업 목록 확인
node scripts/backup-manager.js list

# 특정 백업 복원
node scripts/backup-manager.js restore [backup-id]

# 백업 무결성 검증
node scripts/backup-manager.js verify [backup-id]
```

---

## 📊 품질 지표 모니터링

### 주요 지표

#### 코드 품질
- **TypeScript 오류 수**: 0개 유지
- **빌드 시간**: 10초 이내 유지
- **번들 크기**: 350KB 이내 유지

#### 구조 품질
- **Import 일관성**: 95% 이상 유지
- **중복 타입 수**: 5개 이하 유지
- **테스트 커버리지**: 80% 이상 유지

#### 유지보수성
- **순환 의존성**: 0개 유지
- **참조되지 않는 파일**: 10개 이하 유지
- **중복 테스트 유틸리티**: 20개 이하 유지

### 지표 측정 방법
```bash
# 전체 품질 지표 확인
node scripts/final-quality-check.js

# 개별 지표 확인
node scripts/dependency-analyzer.js    # 파일 구조
node scripts/import-analyzer.js        # Import 구조
node scripts/type-analyzer.js          # 타입 구조
node scripts/test-analyzer.js          # 테스트 구조
```

---

## 🎯 장기적 개선 계획

### 단기 목표 (1-3개월)
1. **테스트 유틸리티 마이그레이션**: 기존 테스트의 50% 이상을 공통 유틸리티로 전환
2. **타입 안전성 강화**: 모든 ID 관련 타입을 브랜드 타입으로 전환
3. **Import 완전 표준화**: 모든 파일의 import 패턴 통일

### 중기 목표 (3-6개월)
1. **자동화 도구 개선**: 정리 스크립트들의 기능 확장 및 최적화
2. **성능 최적화**: 번들 크기 20% 감소 및 빌드 시간 단축
3. **테스트 커버리지 향상**: 90% 이상 달성

### 장기 목표 (6개월 이상)
1. **CI/CD 통합**: 정리 스크립트들을 CI/CD 파이프라인에 통합
2. **자동 리팩토링**: 코드 품질 문제 자동 감지 및 수정
3. **문서 자동화**: 코드 변경에 따른 문서 자동 업데이트

---

## 📚 참고 자료

### 생성된 도구 문서
- `scripts/README.md`: 모든 스크립트 사용법
- `src/__tests__/utils/TESTING_GUIDELINES.md`: 테스트 작성 가이드
- `.kiro/specs/archived/README.md`: 아카이브된 spec 관리

### 외부 참고 자료
- [TypeScript 공식 문서](https://www.typescriptlang.org/docs/)
- [Next.js 공식 문서](https://nextjs.org/docs)
- [Jest 테스팅 가이드](https://jestjs.io/docs/getting-started)
- [React Testing Library 가이드](https://testing-library.com/docs/react-testing-library/intro/)

---

**마지막 업데이트**: 2025년 7월 29일  
**다음 검토 예정일**: 2025년 8월 29일  
**담당자**: 개발팀 전체

이 가이드라인을 준수하여 RoomBook 프로젝트의 코드 품질을 지속적으로 유지해 나가시기 바랍니다.