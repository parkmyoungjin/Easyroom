# 🔒 배포 보안 가이드

## ⚠️ 배포 전 필수 체크리스트

### 1. 환경변수 보안
- [ ] `.env.local` 파일이 프로덕션에 포함되지 않았는지 확인
- [ ] 프로덕션 환경변수를 안전한 곳에 설정 (Vercel, Netlify 등의 환경변수 설정)
- [ ] Supabase 키가 코드에 하드코딩되지 않았는지 확인

### 2. 디버깅 코드 제거
- [ ] `console.log` 문이 프로덕션에서 제거되는지 확인
- [ ] 디버깅 파일들 (`debug-*.js`, `create_bulk_users.js`)이 배포에서 제외되었는지 확인
- [ ] 사용자 ID, 이메일 등 민감한 정보가 콘솔에 출력되지 않는지 확인

### 3. 빌드 설정
- [ ] `next.config.ts`에서 프로덕션 빌드 시 console 제거 설정 확인
- [ ] Terser 플러그인으로 디버깅 코드 자동 제거 설정 확인

## 🚀 배포 방법

### Vercel 배포
1. Vercel 대시보드에서 환경변수 설정:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_production_service_key
   NODE_ENV=production
   ```

2. 빌드 명령어 확인:
   ```bash
   npm run build
   npm start
   ```

### 기타 플랫폼 배포
- Netlify, Railway, AWS 등에서도 동일하게 환경변수를 안전하게 설정

## 🔍 배포 후 확인사항

### 1. 브라우저 개발자 도구 확인
- [ ] Console 탭에 민감한 정보가 출력되지 않는지 확인
- [ ] Network 탭에서 API 요청에 민감한 데이터가 노출되지 않는지 확인

### 2. 소스코드 확인
- [ ] 브라우저에서 소스 보기로 환경변수가 노출되지 않는지 확인
- [ ] 빌드된 JavaScript 파일에 디버깅 코드가 포함되지 않았는지 확인

### 3. 보안 테스트
- [ ] 인증되지 않은 사용자가 민감한 API에 접근할 수 없는지 확인
- [ ] RLS(Row Level Security) 정책이 올바르게 작동하는지 확인

## 🛡️ 추가 보안 권장사항

### 1. HTTPS 강제
```javascript
// next.config.ts에 추가
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }
        ]
      }
    ]
  }
}
```

### 2. CSP (Content Security Policy) 설정
```javascript
// next.config.ts에 추가
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
          }
        ]
      }
    ]
  }
}
```

### 3. 정기적인 보안 업데이트
- [ ] 의존성 패키지 정기 업데이트
- [ ] Supabase 키 정기 교체
- [ ] 보안 취약점 스캔 실행

## 🚨 긴급 상황 대응

### 키 노출 시 대응방법
1. 즉시 Supabase 대시보드에서 키 재생성
2. 새로운 키로 환경변수 업데이트
3. 애플리케이션 재배포
4. 사용자들에게 비밀번호 변경 권고

### 모니터링
- 비정상적인 API 호출 패턴 모니터링
- 에러 로그 정기 확인
- 사용자 피드백 모니터링