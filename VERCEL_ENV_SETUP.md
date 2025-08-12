# Vercel 환경 변수 설정 가이드

## 🔑 필수 환경 변수

### 1. Supabase 설정
```
NEXT_PUBLIC_SUPABASE_URL=https://jynolqsukaltetwmjczh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bm9scXN1a2FsdGV0d21qY3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDM0NjYsImV4cCI6MjA2OTg3OTQ2Nn0.I7YTtapX5Po8a0SUgpav6R_cjRFfrtxf7hPqn56uDiY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bm9scXN1a2FsdGV0d21qY3poIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMwMzQ2NywiZXhwIjoyMDY5ODc5NDY3fQ.Sr2TO7pjJKwhysQBAb3TzSL0kkg9B3lo9mR6VOU2rOU
```

### 2. VAPID 키 (푸시 알림용)
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxxdcCe04nsOps4WyeHhXKjDdf5eQ-BZwupqM6C1HY3Rw_b4Xv8RLH06I_WG-uLYSGczIsvrywOpwOD_TQ2VFg
VAPID_PRIVATE_KEY=HISfjORPVkNg0mg4GXhuDUrU9PGa_Phdi5C7c37Uc3w
VAPID_EMAIL=admin@easyroom.com
```

### 3. NextAuth.js 설정
```
NEXTAUTH_SECRET=vzYpWIWfgeD+C1X+HCydszSCYV1RbYe9KBUZcTJkwpk=
NEXTAUTH_URL=https://your-domain.vercel.app
```

### 4. 환경 설정
```
NODE_ENV=production
```

## 📋 Vercel 대시보드 설정 방법

### 1. Vercel 대시보드 접속
1. https://vercel.com 로그인
2. 프로젝트 선택
3. Settings 탭 클릭
4. Environment Variables 메뉴 선택

### 2. 환경 변수 추가
각 환경 변수를 다음과 같이 추가:

**Name**: `NEXT_PUBLIC_SUPABASE_URL`
**Value**: `https://jynolqsukaltetwmjczh.supabase.co`
**Environment**: Production, Preview, Development (모두 체크)

**Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
**Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bm9scXN1a2FsdGV0d21qY3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDM0NjYsImV4cCI6MjA2OTg3OTQ2Nn0.I7YTtapX5Po8a0SUgpav6R_cjRFfrtxf7hPqn56uDiY`
**Environment**: Production, Preview, Development (모두 체크)

**Name**: `SUPABASE_SERVICE_ROLE_KEY`
**Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bm9scXN1a2FsdGV0d21qY3poIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMwMzQ2NywiZXhwIjoyMDY5ODc5NDY3fQ.Sr2TO7pjJKwhysQBAb3TzSL0kkg9B3lo9mR6VOU2rOU`
**Environment**: Production, Preview (Development는 체크 안 함 - 보안상)

**Name**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
**Value**: `BLxxdcCe04nsOps4WyeHhXKjDdf5eQ-BZwupqM6C1HY3Rw_b4Xv8RLH06I_WG-uLYSGczIsvrywOpwOD_TQ2VFg`
**Environment**: Production, Preview, Development (모두 체크)

**Name**: `VAPID_PRIVATE_KEY`
**Value**: `HISfjORPVkNg0mg4GXhuDUrU9PGa_Phdi5C7c37Uc3w`
**Environment**: Production, Preview (Development는 체크 안 함 - 보안상)

**Name**: `VAPID_EMAIL`
**Value**: `admin@easyroom.com`
**Environment**: Production, Preview, Development (모두 체크)

**Name**: `NEXTAUTH_SECRET`
**Value**: `vzYpWIWfgeD+C1X+HCydszSCYV1RbYe9KBUZcTJkwpk=`
**Environment**: Production, Preview (Development는 체크 안 함 - 보안상)

**Name**: `NEXTAUTH_URL`
**Value**: `https://your-actual-domain.vercel.app` (실제 도메인으로 변경)
**Environment**: Production, Preview (모두 체크)

**Name**: `NODE_ENV`
**Value**: `production`
**Environment**: Production (Production만 체크)

## 🔒 보안 주의사항

### 민감한 키들 (Production/Preview만 설정):
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PRIVATE_KEY`
- `NEXTAUTH_SECRET`

### 공개 키들 (모든 환경에 설정):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_EMAIL`

## 🚀 배포 후 확인사항

1. **환경 변수 확인**: Vercel 대시보드에서 모든 변수가 올바르게 설정되었는지 확인
2. **빌드 성공**: 배포 로그에서 빌드가 성공했는지 확인
3. **푸시 알림 테스트**: 프로덕션 환경에서 푸시 알림 구독 및 테스트
4. **Edge Function 연결**: Supabase Edge Function이 Vercel 앱과 연결되는지 확인

## 📝 체크리스트

- [ ] Supabase 환경 변수 3개 설정
- [ ] VAPID 키 3개 설정
- [ ] NextAuth 설정 2개 설정
- [ ] NODE_ENV 설정
- [ ] NEXTAUTH_URL을 실제 도메인으로 변경
- [ ] 민감한 키는 Production/Preview만 설정
- [ ] 배포 후 푸시 알림 테스트