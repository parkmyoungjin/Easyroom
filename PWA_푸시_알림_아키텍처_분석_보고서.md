# PWA 푸시 알림 및 Supabase Edge Function을 활용한 '회의 시작 10분 전 알림' 기능 구현 가능성 분석 보고서

**TO:** 대표님  
**RE:** PWA 푸시 알림 기능 구현을 위한 현재 시스템 아키텍처 정밀 분석  
**DATE:** 2025년 8월 6일  

---

## 📋 **분석 목표**

사용자가 예약한 회의가 시작되기 10분 전에, 사용자의 모바일 기기(PWA가 설치된)에 **푸시 알림**을 보내주는 기능을 구현하기 위한 현재 시스템의 준비 상태를 정밀하게 분석합니다.

---

## 🔍 **1. PWA의 '알림 수신기': 서비스 워커 및 PWA 설정**

### ✅ **1-1. 서비스 워커 (`public/sw.js`) 현황**

**현재 상태:** **기본 구조 완료 ✓**

```javascript
// 🔧 푸시 알림 처리 - 이미 구현됨!
self.addEventListener('push', (event) => {
  console.log('푸시 알림 수신:', event);

  const data = event.data ? event.data.json() : {};
  const title = data.title || '회의실 예약 시스템';
  const options = {
    body: data.body || '새로운 알림이 있습니다.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'general',
    renotify: true,
    actions: [
      {
        action: 'open',
        title: '열기',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: '닫기'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 🔧 알림 클릭 처리 - 이미 구현됨!
self.addEventListener('notificationclick', (event) => {
  console.log('알림 클릭:', event);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // 알림 클릭 시 앱 열기
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // 이미 열린 창이 있으면 포커스
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }

      // 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
```

**분석 결과:**
- ✅ **푸시 이벤트 리스너 완료**: `push` 이벤트를 수신하고 알림을 표시하는 로직이 완벽하게 구현되어 있습니다.
- ✅ **알림 클릭 처리 완료**: 사용자가 알림을 클릭했을 때 앱을 여는 로직이 구현되어 있습니다.
- ✅ **알림 옵션 설정**: 아이콘, 배지, 액션 버튼 등이 모두 설정되어 있습니다.

### ✅ **1-2. 서비스 워커 등록 (`ClientPolyfillManager.tsx`) 현황**

**현재 상태:** **완벽하게 구현됨 ✓**

```typescript
async function loadServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered successfully:', registration);
      
      // 업데이트 감지 로직도 완벽하게 구현됨
      registration.addEventListener('updatefound', () => {
        // ... 업데이트 처리 로직
      });
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }
}
```

**분석 결과:**
- ✅ **서비스 워커 등록 완료**: 프로덕션 환경에서 자동으로 서비스 워커가 등록됩니다.
- ✅ **업데이트 감지**: 새 버전 감지 및 처리 로직이 완벽하게 구현되어 있습니다.
- ✅ **개발/프로덕션 분리**: 개발 모드에서는 비활성화되어 개발 효율성을 보장합니다.

### ✅ **1-3. PWA 매니페스트 (`public/manifest.json`) 현황**

**현재 상태:** **완벽하게 설정됨 ✓**

```json
{
  "name": "Easyroom 회의실 예약",
  "short_name": "Easyroom",
  "description": "간편한 회의실 예약 시스템",
  "start_url": "/",
  "display": "standalone",
  "scope": "/",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    // 모든 크기의 아이콘이 완벽하게 설정됨
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
    // ... 기타 아이콘들
  ]
}
```

**분석 결과:**
- ✅ **PWA 설정 완료**: 모든 필수 PWA 설정이 완벽하게 구성되어 있습니다.
- ✅ **아이콘 설정**: 푸시 알림에 사용될 아이콘들이 모두 준비되어 있습니다.

---

## ❌ **2. '알림 발송국': 백엔드 스케줄링 및 함수**

### ❌ **2-1. Supabase Edge Functions 사용 현황**

**현재 상태:** **Edge Functions 폴더 없음 ❌**

```
supabase/
├── .branches/
├── .temp/
├── migrations/
├── .gitignore
├── config.toml
└── schema_from_remote.sql
```

**분석 결과:**
- ❌ **functions 폴더 없음**: `supabase/functions/` 폴더가 존재하지 않습니다.
- ❌ **Edge Functions 미구현**: 푸시 알림을 발송할 백엔드 함수가 없습니다.
- ❌ **스케줄러 없음**: 10분 전 알림을 자동으로 발송할 스케줄링 시스템이 없습니다.

### ❌ **2-2. Supabase 스케줄러 (Cron Jobs) 설정**

**현재 상태:** **스케줄러 미설정 ❌**

`supabase/config.toml` 파일을 확인한 결과, Cron Jobs 관련 설정이 없습니다.

**분석 결과:**
- ❌ **Cron Jobs 미설정**: 정기적으로 회의 시작 시간을 확인하는 스케줄러가 없습니다.
- ❌ **자동화 시스템 없음**: 수동으로 알림을 발송해야 하는 상태입니다.

---

## ❌ **3. '알림 수신 동의': 사용자 권한 획득**

### ❌ **3-1. 알림 동의 요청 UI 및 로직**

**현재 상태:** **기본 알림 코드만 존재 ❌**

검색 결과, 다음과 같은 기본적인 알림 코드만 발견되었습니다:

```typescript
// 기본 브라우저 알림만 있음 (푸시 알림 아님)
const permission = await Notification.requestPermission();
if (permission === 'granted') {
  new Notification(title, options);
}
```

**분석 결과:**
- ❌ **푸시 구독 로직 없음**: `pushManager.subscribe()` 코드가 없습니다.
- ❌ **VAPID 키 설정 없음**: 푸시 알림에 필요한 VAPID 키가 설정되지 않았습니다.
- ❌ **구독 정보 저장 없음**: 사용자의 푸시 구독 정보를 데이터베이스에 저장하는 로직이 없습니다.

### ❌ **3-2. `users` 테이블 구조**

**현재 상태:** **푸시 구독 컬럼 없음 ❌**

```sql
CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "department" "text" DEFAULT 'General'::"text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'employee'::"public"."user_role" NOT NULL,
    "employee_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
```

**분석 결과:**
- ❌ **푸시 구독 컬럼 없음**: `push_subscription JSONB` 컬럼이 없습니다.
- ❌ **알림 설정 컬럼 없음**: 사용자의 알림 선호도를 저장할 컬럼이 없습니다.

---

## 📊 **종합 분석 결과**

### 🟢 **구현 완료된 부분 (30%)**
1. ✅ **PWA 서비스 워커**: 푸시 알림 수신 및 처리 로직 완료
2. ✅ **서비스 워커 등록**: 자동 등록 및 업데이트 감지 완료
3. ✅ **PWA 매니페스트**: 완벽한 PWA 설정 완료

### 🔴 **구현 필요한 부분 (70%)**
1. ❌ **Supabase Edge Functions**: 푸시 알림 발송 함수 구현 필요
2. ❌ **Cron Jobs 스케줄러**: 10분 전 알림 자동 발송 시스템 필요
3. ❌ **사용자 권한 획득**: 푸시 구독 동의 UI 및 로직 필요
4. ❌ **데이터베이스 확장**: users 테이블에 푸시 구독 정보 저장 컬럼 필요
5. ❌ **VAPID 키 설정**: 푸시 알림 인증을 위한 VAPID 키 설정 필요

---

## 🚀 **구현 로드맵**

### **Phase 1: 기반 구축 (1-2일)**
1. **VAPID 키 생성 및 설정**
2. **users 테이블 확장** (push_subscription, notification_preferences 컬럼 추가)
3. **푸시 구독 동의 UI 구현**

### **Phase 2: 백엔드 구축 (2-3일)**
1. **Supabase Edge Functions 생성**
   - `send-push-notification` 함수
   - `check-upcoming-meetings` 함수
2. **Cron Jobs 설정** (매분마다 회의 확인)

### **Phase 3: 통합 및 테스트 (1-2일)**
1. **프론트엔드-백엔드 연동**
2. **실제 푸시 알림 테스트**
3. **사용자 경험 최적화**

---

## 💡 **결론**

현재 우리 EasyRoom 앱은 **PWA 푸시 알림의 '수신기' 부분은 완벽하게 구현**되어 있습니다. 서비스 워커가 푸시 알림을 받아서 사용자에게 표시하는 모든 로직이 준비되어 있어, 이는 매우 긍정적인 출발점입니다.

하지만 **'발송국'과 '수신 동의' 부분이 완전히 비어있는 상태**로, 이 두 영역을 구축해야 진정한 '비서' 기능을 완성할 수 있습니다.

다행히 기반 인프라(PWA, Supabase)가 모두 준비되어 있어, **약 1주일 내에 완전한 푸시 알림 시스템을 구축**할 수 있을 것으로 예상됩니다.

**다음 단계:** Phase 1부터 시작하여 단계별로 구현을 진행하시겠습니까?