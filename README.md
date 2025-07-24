# 🏢 RoomBook - 회의실 예약 시스템

부산대학교병원 회의실 예약을 위한 웹 애플리케이션입니다.

## ✨ 주요 기능

- 🔐 **Supabase Auth 기반 인증** - 사번과 비밀번호로 로그인
- 📅 **실시간 예약 관리** - 회의실 예약 생성, 수정, 취소
- 📊 **대시보드** - 실시간 예약 현황 및 통계
- 📱 **반응형 디자인** - 모바일과 데스크톱 모두 지원
- 👥 **사용자 권한 관리** - 일반 사용자와 관리자 구분
- 🛡️ **강화된 보안 시스템** - 중앙화된 환경 변수 관리 및 보안 모니터링
- ⚡ **성능 최적화** - RPC 함수 기반 데이터 페칭 및 캐싱 전략
- 🔍 **데이터 무결성 보장** - 자동화된 데이터 검증 및 타입 안전성
- 🚀 **CI/CD 파이프라인** - 자동화된 배포 및 안전성 검사

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
```

`.env.local` 파일에 Supabase 정보를 입력하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. 데이터베이스 설정

```bash
# RPC 함수 설정
npm run setup-rpc

# 연결 테스트
npm run test-auth-flow
```

### 3. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 앱을 확인할 수 있습니다.

## 🔧 주요 스크립트

### 개발 및 빌드
| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run test` | 테스트 실행 |
| `npm run test:coverage` | 테스트 커버리지 확인 |

### 데이터베이스 및 인증
| 명령어 | 설명 |
|--------|------|
| `npm run test-auth-flow` | 인증 플로우 테스트 |
| `npm run setup-rpc` | RPC 함수 설정 |
| `npm run check-env` | 환경 변수 확인 |
| `npm run create-test-users` | 테스트 사용자 생성 |

### 데이터 무결성 및 모니터링
| 명령어 | 설명 |
|--------|------|
| `npm run integrity:pipeline` | 데이터 무결성 파이프라인 실행 |
| `npm run integrity:pre-deploy` | 배포 전 데이터 검증 |
| `npm run integrity:post-deploy` | 배포 후 데이터 검증 |
| `npm run report:generate` | 보안/성능 리포트 생성 |
| `npm run monitor:health` | 시스템 상태 모니터링 |

### CI/CD 및 배포
| 명령어 | 설명 |
|--------|------|
| `npm run migration:validate-syntax` | 마이그레이션 구문 검증 |
| `npm run rollback:check` | 롤백 상태 확인 |
| `npm run rollback:immediate` | 즉시 롤백 실행 |

## 📋 데이터베이스 스키마

### Users 테이블
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id),
  employee_id VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  department VARCHAR NOT NULL,
  role user_role DEFAULT 'employee',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Rooms 테이블
```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR UNIQUE NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 1,
  location VARCHAR,
  amenities JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Reservations 테이블
```sql
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  user_id UUID REFERENCES users(id),
  title VARCHAR NOT NULL,
  purpose TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status reservation_status DEFAULT 'confirmed',
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## 🔐 인증 시스템

### 로그인 방식
- **사번**: 7자리 숫자
- **비밀번호**: `pnuh + 사번` (예: pnuh1234567)

### 사용자 역할
- **employee**: 일반 직원 - 예약 생성/관리
- **admin**: 관리자 - 전체 시스템 관리

## 📱 주요 페이지

| 경로 | 설명 | 권한 |
|------|------|------|
| `/` | 메인 대시보드 | 로그인 필요 |
| `/login` | 로그인 페이지 | 공개 |
| `/signup` | 회원가입 페이지 | 공개 |
| `/reservations/new` | 새 예약 생성 | 로그인 필요 |
| `/reservations/my` | 내 예약 관리 | 로그인 필요 |
| `/reservations/status` | 예약 현황 | 로그인 필요 |
| `/dashboard` | 실시간 대시보드 | 로그인 필요 |
| `/admin` | 관리자 패널 | 관리자만 |

## 🛠️ 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **State Management**: TanStack Query, Zustand
- **Form Handling**: React Hook Form, Zod
- **Date Handling**: date-fns
- **Security**: EnvironmentSecurityManager, SecurityMonitor, UserIdGuards
- **Performance**: PerformanceMonitor, RPC Functions, Optimized Caching
- **Validation**: Zod Schemas, Input Validation Middleware
- **CI/CD**: GitHub Actions, Automated Testing, Data Integrity Pipeline

## 🏗️ 아키텍처 패턴

### 보안 아키텍처
- **중앙화된 환경 변수 관리**: `EnvironmentSecurityManager`를 통한 안전한 환경 변수 접근
- **보안 모니터링**: `SecurityMonitor`를 통한 실시간 보안 이벤트 추적
- **타입 안전성**: Branded Types (`AuthId`, `DatabaseUserId`)를 통한 컴파일 타임 오류 방지
- **입력 검증**: Zod 스키마 기반 API 입력 검증 미들웨어

### 성능 최적화 패턴
- **RPC 함수**: 복잡한 데이터베이스 쿼리를 Supabase RPC로 최적화
- **캐싱 전략**: TanStack Query를 통한 일관된 캐싱 및 재시도 로직
- **페이지네이션**: 모든 리스트 API에 표준화된 페이지네이션 지원
- **성능 모니터링**: `PerformanceMonitor`를 통한 실시간 성능 추적

### 데이터 무결성 패턴
- **타입 가드**: `UserIdGuards`를 통한 런타임 데이터 검증
- **데이터베이스 제약조건**: 외래 키 제약조건 및 트리거를 통한 데이터 일관성 보장
- **자동화된 검증**: CI/CD 파이프라인에 통합된 데이터 무결성 검사

## 🚀 배포 절차

### 자동화된 CI/CD 파이프라인

1. **코드 품질 검증**
   - ESLint 및 TypeScript 타입 검사
   - 보안 취약점 스캔
   - 테스트 커버리지 검증

2. **데이터 무결성 검증**
   ```bash
   # 배포 전 데이터 검증
   npm run integrity:pre-deploy
   ```

3. **데이터베이스 마이그레이션**
   ```bash
   # 마이그레이션 구문 검증
   npm run migration:validate-syntax
   
   # 자동 마이그레이션 적용
   supabase db push
   ```

4. **배포 후 검증**
   ```bash
   # 배포 후 시스템 상태 확인
   npm run integrity:post-deploy
   ```

### 수동 배포 (Vercel)

1. **환경 변수 설정**
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL production
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   ```

2. **배포 실행**
   ```bash
   vercel --prod
   ```

3. **배포 후 검증**
   ```bash
   npm run monitor:health
   npm run report:generate
   ```

### 롤백 절차

1. **롤백 필요성 확인**
   ```bash
   npm run rollback:check
   ```

2. **즉시 롤백 (긴급상황)**
   ```bash
   npm run rollback:immediate
   ```

3. **점진적 롤백 (권장)**
   ```bash
   npm run rollback:graceful
   ```

## 🔄 실시간 기능

- **실시간 예약 현황**: Supabase Realtime으로 예약 변경사항 즉시 반영
- **자동 새로고침**: 예약 데이터 자동 갱신
- **충돌 방지**: 동시 예약 시도 시 충돌 감지
- **실시간 모니터링**: 시스템 상태 및 성능 메트릭 실시간 추적

## 🚨 문제 해결

### 일반적인 문제

1. **"An unexpected error occurred" 에러**
   ```bash
   npm run test-auth-flow
   ```

2. **예약 조회 실패**
   ```bash
   npm run setup-rpc
   ```

3. **로그인 실패**
   ```bash
   npm run check-auth-settings
   ```

### 로그 확인
개발자 도구의 콘솔에서 상세한 에러 정보를 확인할 수 있습니다.

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. 환경 변수 설정 확인
2. Supabase 프로젝트 상태 확인
3. 데이터베이스 스키마 확인
4. RPC 함수 설정 확인

## 📄 라이선스

이 프로젝트는 부산대학교병원 내부 사용을 위한 것입니다.