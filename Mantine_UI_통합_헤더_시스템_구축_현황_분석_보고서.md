# Mantine UI 기반 "통합 헤더 시스템" 구축을 위한 현황 분석 보고서

**TO:** 대표님  
**RE:** 프로젝트 전체에 사용되는 헤더 컴포넌트를 `Mantine UI` 기반의 단일 통합 컴포넌트로 재구축하기 위한 아키텍처 분석 보고서  
**작성일:** 2025년 8월 6일

---

## 📋 목표

현재 프로젝트 내에 여러 형태로 흩어져 있는 헤더(Header) 컴포넌트들을 분석하여, **모든 페이지에서 일관된 디자인과 경험을 제공**하는, **`Mantine UI` 기반의 재사용 가능한 단일 `Header` 컴포넌트**를 설계하고 구현한다.

---

## 1. 현재 사용 중인 모든 '헤더' 식별

### 1-1. 현재 헤더 컴포넌트 현황

#### ✅ **주요 헤더 컴포넌트: `MobileHeader` (in MobileAppLayout.tsx)**

**파일 위치:** `src/components/layout/MobileAppLayout.tsx`

**현재 구현 상태:**
```typescript
function MobileHeader({
  title,
  subtitle,
  showBackButton,
  showHomeButton,
  onBack,
  rightContent,
}: {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
})
```

**주요 기능:**
- ✅ 페이지 제목 (`title`) 표시
- ✅ 부제목 (`subtitle`) 표시  
- ✅ 뒤로 가기 버튼 (`showBackButton`)
- ✅ 홈 버튼 (`showHomeButton`)
- ✅ 우측 커스텀 콘텐츠 (`rightContent`)
- ✅ Mantine UI 컴포넌트 사용 (`Group`, `Button`, `Text`)

### 1-2. 헤더 사용 패턴 분석

#### **패턴 A: MobileAppLayout 사용 페이지들**

**사용 페이지:**
1. `src/app/reservations/new/page.tsx` - "새 예약"
2. `src/app/reservations/status/page.tsx` - "전체 예약 현황"  
3. `src/app/reservations/browse/page.tsx` - "예약 둘러보기"
4. `src/app/reservations/edit/[id]/page.tsx` - "예약 수정"
5. `src/app/reservations/my/page.tsx` - "내 예약 관리"
6. `src/app/kiosk/room-display/page.tsx` - "살아있는 현황판"

**사용 예시:**
```typescript
<MobileAppLayout 
  headerTitle="새 예약" 
  showBackButton
>
  {/* 페이지 콘텐츠 */}
</MobileAppLayout>
```

#### **패턴 B: 헤더 없는 페이지들**

**해당 페이지:**
1. `src/app/dashboard/page.tsx` - 대시보드 (자체 헤더 구현)
2. `src/app/welcome/page.tsx` - 웰컴 페이지 (헤더 없음)
3. `src/app/login/page.tsx` - 로그인 페이지 (헤더 없음)
4. `src/app/signup/page.tsx` - 회원가입 페이지 (헤더 없음)

**대시보드 자체 헤더 구현:**
```typescript
// dashboard/page.tsx에서 자체적으로 구현한 헤더 영역
<Group justify="space-between" mb="xl">
  <Stack gap="xs">
    <Text size="lg" c="dimmed">안녕하세요,</Text>
    <Title order={1} size="2.5rem" fw={700}>
      {userProfile.name}님!
    </Title>
  </Stack>
  <Group gap="md">
    <Avatar color="blue" radius="xl" size="lg">
      {userProfile.name.charAt(0)}
    </Avatar>
    <Button variant="outline" onClick={handleLogout}>
      로그아웃
    </Button>
  </Group>
</Group>
```

---

## 2. '통합 헤더'의 기능적 요구사항 정의

### 2-1. 현재 기능 분석 및 새로운 요구사항

#### ✅ **현재 구현된 기능들**
- [x] **페이지 제목 (`title`) 표시 기능** ✅ 구현됨
- [x] **부제목 (`subtitle`) 표시 기능** ✅ 구현됨  
- [x] **'뒤로 가기' 버튼 (`showBackButton`)** ✅ 구현됨
- [x] **홈 버튼 (`showHomeButton`)** ✅ 구현됨
- [x] **우측 커스텀 콘텐츠 (`rightContent`)** ✅ 구현됨

#### ❌ **누락된 핵심 기능들**
- [ ] **사용자 메뉴 (Avatar/Dropdown):** 로그인 시 사용자 프로필 이미지와 함께 '내 정보', '로그아웃' 등의 메뉴
- [ ] **로그인/회원가입 버튼:** 비로그인 시 표시되는 버튼
- [ ] **로고 (`Logo`) 표시 기능**
- [ ] **반응형 디자인:** 화면 크기가 작아지면(모바일), 메뉴가 햄버거 버튼 안으로 들어가는 기능
- [ ] **통합된 인증 상태 관리:** 로그인/비로그인 상태에 따른 헤더 콘텐츠 자동 변경

### 2-2. 추가 필요 기능 (분석 결과)

#### **🔍 대시보드 분석을 통한 추가 요구사항**
- [ ] **개인화된 환영 메시지:** "안녕하세요, {사용자명}님!" 형태의 개인화 메시지
- [ ] **사용자 아바타:** 사용자 이름의 첫 글자를 표시하는 원형 아바타
- [ ] **부서 정보 표시:** 사용자의 부서명 표시 (선택적)
- [ ] **관리자 표시:** 관리자 권한이 있는 경우 시각적 구분

#### **🔍 현재 페이지별 특수 요구사항**
- [ ] **키오스크 모드:** 공용 디스플레이용 헤더 (로그인/회원가입 버튼 표시)
- [ ] **인증 페이지:** 로고만 표시하는 미니멀 헤더
- [ ] **관리자 페이지:** 관리자 전용 스타일링

---

## 3. 현재 아키텍처의 문제점

### 3-1. 일관성 부족
- **대시보드**: 자체 헤더 구현으로 다른 페이지와 스타일 불일치
- **인증 페이지들**: 헤더 없음으로 브랜드 일관성 부족
- **키오스크 페이지**: MobileAppLayout 사용하지만 인증 버튼 별도 구현

### 3-2. 코드 중복
- 대시보드의 사용자 정보 표시 로직이 별도로 구현됨
- 로그아웃 기능이 여러 곳에 중복 구현됨

### 3-3. 확장성 부족
- 새로운 페이지 타입 추가 시 헤더 구현을 매번 고민해야 함
- 브랜딩 변경 시 여러 파일을 수정해야 함

---

## 4. 제안하는 통합 헤더 시스템 설계

### 4-1. 새로운 컴포넌트 구조

```
src/components/layout/
├── AppHeader.tsx          # 🆕 통합 헤더 컴포넌트
├── AppLayout.tsx          # 🆕 전체 레이아웃 래퍼
└── MobileAppLayout.tsx    # 🗑️ 삭제 예정
```

### 4-2. AppHeader 컴포넌트 주요 기능

#### **Props 인터페이스 (예상)**
```typescript
interface AppHeaderProps {
  // 기본 정보
  title?: string;
  subtitle?: string;
  
  // 네비게이션
  showBackButton?: boolean;
  showHomeButton?: boolean;
  onBack?: () => void;
  
  // 브랜딩
  showLogo?: boolean;
  
  // 사용자 관련
  showUserMenu?: boolean;
  showAuthButtons?: boolean;
  
  // 커스터마이징
  rightContent?: React.ReactNode;
  variant?: 'default' | 'minimal' | 'kiosk' | 'admin';
  
  // 반응형
  mobileBreakpoint?: 'sm' | 'md' | 'lg';
}
```

#### **헤더 변형 (Variants)**
1. **`default`**: 일반 앱 페이지용 (현재 MobileHeader와 유사)
2. **`minimal`**: 인증 페이지용 (로고만 표시)
3. **`kiosk`**: 공용 디스플레이용 (로그인/회원가입 버튼)
4. **`admin`**: 관리자 페이지용 (관리자 표시 포함)

### 4-3. 사용 예시

```typescript
// 일반 페이지
<AppHeader 
  title="새 예약" 
  showBackButton 
  showUserMenu 
/>

// 대시보드
<AppHeader 
  title={`안녕하세요, ${userProfile.name}님!`}
  showUserMenu
  showLogo
/>

// 인증 페이지  
<AppHeader 
  variant="minimal" 
  showLogo 
/>

// 키오스크
<AppHeader 
  variant="kiosk"
  title="실시간 예약 현황"
  showAuthButtons
/>
```

---

## 5. 마이그레이션 계획

### 5-1. 1단계: 새로운 AppHeader 컴포넌트 개발
- [ ] `src/components/layout/AppHeader.tsx` 생성
- [ ] 모든 변형(variants) 구현
- [ ] 사용자 인증 상태 연동
- [ ] 반응형 디자인 구현

### 5-2. 2단계: 기존 페이지 마이그레이션
- [ ] 대시보드 페이지 우선 적용
- [ ] MobileAppLayout 사용 페이지들 순차 적용
- [ ] 인증 페이지들 적용

### 5-3. 3단계: 정리 작업
- [ ] `MobileAppLayout.tsx` 내 `MobileHeader` 제거
- [ ] 중복 코드 정리
- [ ] 테스트 코드 작성

---

## 6. 예상 효과

### 6-1. 사용자 경험 개선
- ✅ 모든 페이지에서 일관된 헤더 디자인
- ✅ 직관적인 네비게이션 경험
- ✅ 브랜드 일관성 확보

### 6-2. 개발 효율성 향상
- ✅ 새 페이지 개발 시 헤더 고민 불필요
- ✅ 헤더 관련 버그 수정 시 한 곳만 수정
- ✅ 디자인 변경 시 일괄 적용 가능

### 6-3. 유지보수성 향상
- ✅ 단일 컴포넌트로 관리되는 헤더 로직
- ✅ 타입 안전성 확보
- ✅ 테스트 코드 작성 용이

---

## 7. 다음 단계

대표님의 승인 후, 다음과 같은 순서로 작업을 진행하겠습니다:

1. **새로운 `AppHeader.tsx` 컴포넌트 완전 구현**
2. **`AppLayout.tsx` 래퍼 컴포넌트 구현**  
3. **대시보드 페이지 우선 적용 및 테스트**
4. **나머지 페이지들 순차 마이그레이션**
5. **기존 코드 정리 및 문서화**

이 작업을 통해 앱의 '얼굴'을 완전히 통일하고, 어떤 페이지를 방문하더라도 사용자에게 일관되고 전문적인 인상을 줄 수 있게 될 것입니다.

---

**보고서 작성:** Kiro AI Assistant  
**검토 요청:** 대표님 승인 후 즉시 구현 착수 가능