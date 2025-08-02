# '전역 수색'을 위한 UI 컴포넌트 분석 보고서

## 1. 루트 레이아웃: `layout.tsx` (재확인)

- **파일 경로:** `src/app/layout.tsx`
- **분석 목표:** 전역적으로 렌더링되는 헤더, 사이드바, 푸터 등의 컴포넌트가 있는지 확인한다.
- **코드 전문:**

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css';
import Providers from '@/app/providers';
import { Toaster } from '@/components/ui/toaster';
import { ClientPolyfillManager } from '@/lib/polyfills/ClientPolyfillManager';
import { SupabaseProvider } from '@/contexts/SupabaseProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthToastManager } from '@/components/auth/AuthErrorToast';
import AuthGatekeeper from '@/components/layout/AuthGatekeeper';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: '회의실 예약 시스템',
  description: '간편한 회의실 예약 시스템',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
      { url: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '회의실 예약',
  },
  applicationName: '회의실 예약 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background antialiased`}>
        <ClientPolyfillManager enableServiceWorker={true} enablePWAComponents={true}>
          {/* ✅ Operation: Structural Integrity - 영구적 생명주기 보장 */}
          {/* 1계층: 영구 공급 계층 - 앱이 종료될 때까지 절대 사라지지 않는다 */}
          <Providers>
            <SupabaseProvider>
              <AuthProvider>
                {/* 2계층: 상태 소비 및 분기 계층 - 인증 상태에 따른 UI 분기만 담당 */}
                <AuthGatekeeper>
                  {children}
                </AuthGatekeeper>
                <AuthToastManager />
                <Toaster />
              </AuthProvider>
            </SupabaseProvider>
          </Providers>
        </ClientPolyfillManager>
      </body>
    </html>
  );
}
```

**🔍 분석 결과:** 
- 전역 헤더나 네비게이션 바는 없음
- `AuthGatekeeper`와 `AuthToastManager`가 전역 컴포넌트로 확인됨

## 2. 전역 상태 소비 컴포넌트

### 2.1 AuthGatekeeper 컴포넌트 (🚨 핵심 용의자)

- **파일 경로:** `src/components/layout/AuthGatekeeper.tsx`
- **분석 목표:** 전역적으로 렌더링되며 `useAuthContext()`를 사용하는 핵심 컴포넌트
- **코드 전문:**

```typescript
// src/components/layout/AuthGatekeeper.tsx
"use client";

import React from 'react';
import { useAuthContext } from '@/contexts/AuthContext';

/**
 * Operation: Structural Integrity - AuthGatekeeper Component
 * 
 * AuthProvider의 직속 자식으로, 인증 상태를 '소비'하는 역할만 수행한다.
 * 인증 상태에 따라 로딩 화면을 보여주거나, 실제 페이지 콘텐츠(children)를 렌더링한다.
 * 
 * 이 컴포넌트는 AuthProvider의 생명주기에 전혀 영향을 주지 않으며,
 * 단순히 인증 상태를 읽어서 UI 분기 처리만 담당한다.
 */

/**
 * 전체 화면 로딩 컴포넌트
 * AuthProvider가 초기 인증 상태를 확인하는 동안 표시됩니다.
 */
const FullScreenLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        {/* 로딩 스피너 */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        
        {/* 로딩 텍스트 */}
        <div className="text-sm text-muted-foreground">
          인증 상태를 확인하고 있습니다...
        </div>
      </div>
    </div>
  );
};

const AuthGatekeeper = ({ children }: { children: React.ReactNode }) => {
  // AuthProvider가 부모이므로, 이 훅은 항상 안전하게 호출된다.
  const { authStatus } = useAuthContext();

  console.log('[AuthGatekeeper] Current auth status:', authStatus);

  // 아직 초기 인증 상태 확인이 완료되지 않았다면, 전체 화면 로더를 보여준다.
  // 이 로직은 이제 AuthProvider 자체의 생명주기에 전혀 영향을 주지 않는다.
  if (authStatus === 'loading') {
    console.log('[AuthGatekeeper] Showing loading screen');
    return <FullScreenLoader />;
  }

  // 인증 확인이 끝나면, 보호받는 자식 컴포넌트(실제 페이지)를 렌더링한다.
  console.log('[AuthGatekeeper] Rendering children - auth status:', authStatus);
  return <>{children}</>;
};

export default AuthGatekeeper;
```

**🔍 분석 결과:**
- ✅ **방탄 상태 확인됨** - `userProfile` 데이터에 직접 접근하지 않음
- ✅ 오직 `authStatus`만 사용하여 UI 분기 처리
- ✅ 안전한 구조로 렌더링 오류 가능성 없음

### 2.2 AuthToastManager 컴포넌트

- **파일 경로:** `src/components/auth/AuthErrorToast.tsx`
- **분석 목표:** 전역 에러 토스트 관리 컴포넌트
- **코드 전문:**

```typescript
'use client';

import { useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';

// Using console for now instead of sonner
const toast = {
  success: (title: string, options?: { description?: string; duration?: number }) => {
    console.log(`✅ ${title}`, options?.description || '');
  },
  error: (title: string, options?: { description?: string; duration?: number }) => {
    console.error(`❌ ${title}`, options?.description || '');
  },
  info: (message: string, options?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) => {
    console.info(`ℹ️ ${message}`, options?.description || '');
  }
};

/**
 * AuthErrorToast Component
 * 
 * Single Gate 아키텍처에서는 에러 처리를 단순화했습니다.
 * 이 컴포넌트는 현재 비활성화되어 있습니다.
 */
export default function AuthErrorToast() {
  // Single Gate 아키텍처에서는 에러 토스트를 사용하지 않습니다.
  return null;
}

/**
 * AuthSuccessToast Component
 * 
 * Shows success messages for authentication events
 */
export function AuthSuccessToast() {
  const { user, authStatus } = useAuthContext();

  useEffect(() => {
    // Show success message when user signs in
    if (authStatus === 'authenticated' && user) {
      toast.success("로그인 성공", {
        description: `${user.email}로 로그인되었습니다.`,
        duration: 3000,
      });
    }
  }, [authStatus, user]);

  useEffect(() => {
    // Show message when user signs out
    if (authStatus === 'unauthenticated' && !user) {
      // Only show if we were previously authenticated
      const wasAuthenticated = sessionStorage.getItem('was_authenticated');
      if (wasAuthenticated) {
        toast.success("로그아웃 완료", {
          description: "안전하게 로그아웃되었습니다.",
          duration: 3000,
        });
        sessionStorage.removeItem('was_authenticated');
      }
    } else if (authStatus === 'authenticated') {
      // Mark as authenticated for logout detection
      sessionStorage.setItem('was_authenticated', 'true');
    }
  }, [authStatus, user]);

  return null;
}

/**
 * AuthNetworkStatusToast Component
 * 
 * Shows network status changes that affect authentication
 */
export function AuthNetworkStatusToast() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      toast.success("연결 복구됨", {
        description: "인터넷 연결이 복구되었습니다. 인증 상태를 확인합니다.",
        duration: 3000,
      });
    };

    const handleOffline = () => {
      toast.error("연결 끊어짐", {
        description: "인터넷 연결이 끊어졌습니다. 일부 기능이 제한될 수 있습니다.",
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return null;
}

/**
 * Combined AuthToastManager Component
 * 
 * Manages all authentication-related toast notifications
 */
export function AuthToastManager() {
  return (
    <>
      <AuthErrorToast />
      <AuthSuccessToast />
      <AuthNetworkStatusToast />
    </>
  );
}
```

**🔍 분석 결과:**
- ✅ **방탄 상태 확인됨** - `AuthErrorToast`는 `return null`로 비활성화
- ⚠️ **잠재적 위험 발견** - `AuthSuccessToast`에서 `user` 객체에 직접 접근
- ⚠️ **잠재적 위험 발견** - `user.email` 접근 시 `user`가 `null`일 가능성

### 2.3 기타 전역 컴포넌트 - MobileHeader

- **파일 경로:** `src/components/ui/mobile-header.tsx`
- **분석 목표:** 모바일 헤더 컴포넌트 (useAuth 사용하지 않음)
- **코드 전문:**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
// ✅ useToast는 더 이상 헤더 자체에서는 필요하지 않습니다.

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

export default function MobileHeader({ 
  title, 
  subtitle,
  showBackButton = true,
  showHomeButton = false,
  onBack,
  rightContent,
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    // onBack prop이 있으면 그것을 우선 실행
    if (onBack) {
      onBack();
    } else {
      // ✅ 뒤로 갈 페이지가 있는지 확인하고, 없으면 홈으로 이동
      if (window.history.length > 1) {
        router.back();
      } else {
        router.replace('/'); // replace를 사용하여 히스토리에 남기지 않음
      }
    }
  };

  const handleHome = () => {
    router.push('/');
  };

  return (
    // ✅ 'sticky top-0'으로 스크롤 시 상단 고정
    // ✅ 'bg-background/95 backdrop-blur'로 반투명 블러 효과 적용
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        
        {/* 왼쪽 영역: 뒤로가기 또는 홈 버튼 */}
        <div className="flex items-center">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon" // ✅ 아이콘 버튼에 최적화된 크기
              onClick={handleBack}
              aria-label="뒤로 가기"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          
          {showHomeButton && !showBackButton && ( // 뒤로가기 버튼이 없을 때만 홈 버튼 표시
            <Button
              variant="ghost"
              size="icon"
              onClick={handleHome}
              aria-label="홈으로 이동"
            >
              <Home className="h-5 w-5" />
            </Button>
          )}
        </div>
        
        {/* 중앙 영역: 제목과 부제목 */}
        {/* ✅ sm:left-1/2 sm:-translate-x-1/2: 모바일에서는 약간 왼쪽에, 태블릿부터는 중앙 정렬 */}
        <div className="absolute left-16 sm:left-1/2 sm:-translate-x-1/2 text-center sm:text-left">
          <h1 className="text-base font-semibold truncate sm:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
        
        {/* 오른쪽 영역: 추가적인 버튼이나 액션 */}
        <div className="flex items-center justify-end">
          {rightContent}
        </div>
      </div>
    </header>
  );
}
```

**🔍 분석 결과:**
- ✅ **완전 안전** - `useAuth` 훅을 사용하지 않음
- ✅ 순수한 UI 컴포넌트로 렌더링 오류 가능성 없음

### 2.4 NavigationFeedback 컴포넌트 (🚨 핵심 용의자 #2)

- **파일 경로:** `src/components/ui/navigation-feedback.tsx`
- **분석 목표:** `useAuth` 훅을 사용하는 네비게이션 피드백 컴포넌트
- **코드 전문:**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Info, ArrowRight } from 'lucide-react';

interface NavigationFeedbackProps {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
  autoHide?: boolean;
  duration?: number;
  className?: string;
}

export default function NavigationFeedback({
  type,
  title,
  description,
  actionLabel,
  actionPath,
  autoHide = false,
  duration = 5000,
  className = ""
}: NavigationFeedbackProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration]);

  const handleAction = () => {
    if (actionPath) {
      router.push(actionPath);
    }
  };

  const getVariantStyles = () => {
    switch (type) {
      case 'success':
        return {
          cardClass: 'border-green-200 bg-green-50',
          iconClass: 'text-green-600',
          titleClass: 'text-green-900',
          descClass: 'text-green-700',
          icon: CheckCircle
        };
      case 'warning':
        return {
          cardClass: 'border-yellow-200 bg-yellow-50',
          iconClass: 'text-yellow-600',
          titleClass: 'text-yellow-900',
          descClass: 'text-yellow-700',
          icon: AlertCircle
        };
      case 'error':
        return {
          cardClass: 'border-red-200 bg-red-50',
          iconClass: 'text-red-600',
          titleClass: 'text-red-900',
          descClass: 'text-red-700',
          icon: AlertCircle
        };
      default:
        return {
          cardClass: 'border-blue-200 bg-blue-50',
          iconClass: 'text-blue-600',
          titleClass: 'text-blue-900',
          descClass: 'text-blue-700',
          icon: Info
        };
    }
  };

  if (!isVisible) return null;

  const { cardClass, iconClass, titleClass, descClass, icon: Icon } = getVariantStyles();

  return (
    <Card className={`${cardClass} ${className} transition-all duration-300`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconClass}`} />
          <CardTitle className={`text-lg ${titleClass}`}>{title}</CardTitle>
        </div>
        {autoHide && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <CardDescription className={`${descClass} mb-4`}>
          {description}
        </CardDescription>
        {actionLabel && actionPath && (
          <Button onClick={handleAction} className="flex items-center gap-2">
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Hook for managing navigation feedback
export function useNavigationFeedback() {
  const { toast } = useToast();
  const { userProfile, authStatus } = useAuth();

  const showAuthRequiredFeedback = (targetPath?: string) => {
    toast({
      title: '로그인이 필요합니다',
      description: '이 기능을 사용하려면 로그인해주세요.',
      variant: 'destructive',
    });
  };

  const showAdminRequiredFeedback = () => {
    toast({
      title: '권한이 없습니다',
      description: '관리자만 접근할 수 있는 페이지입니다.',
      variant: 'destructive',
    });
  };

  const showSuccessFeedback = (message: string) => {
    toast({
      title: '성공',
      description: message,
    });
  };

  const showErrorFeedback = (message: string) => {
    toast({
      title: '오류',
      description: message,
      variant: 'destructive',
    });
  };

  const showNavigationSuccess = (destination: string) => {
    toast({
      title: '페이지 이동',
      description: `${destination}로 이동했습니다.`,
    });
  };

  return {
    showAuthRequiredFeedback,
    showAdminRequiredFeedback,
    showSuccessFeedback,
    showErrorFeedback,
    showNavigationSuccess,
    isAuthenticated: authStatus === 'authenticated',
    isAdmin: userProfile?.role === 'admin'
  };
}
```

**🔍 분석 결과:**
- ⚠️ **잠재적 위험 발견** - `useNavigationFeedback` 훅에서 `userProfile?.role` 접근
- ⚠️ **잠재적 위험 발견** - `userProfile`이 `null`일 때 안전하게 처리되지만, 이 훅을 사용하는 컴포넌트에서 문제 발생 가능

## 3. 🚨 최종 수사 결과 및 범인 식별

### 🎯 주요 용의자 목록:

1. **AuthSuccessToast** (`src/components/auth/AuthErrorToast.tsx`)
   - `user.email` 접근 시 `user`가 `null`일 가능성
   - 전역적으로 렌더링되어 모든 페이지에 영향

2. **useNavigationFeedback 훅** (`src/components/ui/navigation-feedback.tsx`)
   - `userProfile?.role` 접근하는 컴포넌트들에서 사용될 때 문제 발생 가능

### 🔍 추가 조사 필요 영역:

- 페이지 컴포넌트들에서 `useAuth` 훅 사용 패턴
- `userProfile` 데이터에 직접 접근하는 모든 컴포넌트들의 방어 코드 확인

### 💡 권장 조치사항:

1. **AuthSuccessToast 수정**: `user?.email` 형태로 안전한 접근 패턴 적용
2. **전역 컴포넌트 방어 강화**: 모든 전역 컴포넌트에서 `userProfile` 접근 시 null 체크 강화
3. **페이지별 컴포넌트 점검**: 각 페이지에서 사용하는 `useAuth` 패턴 검토

---

**🚨 긴급 수정 권고:** `AuthSuccessToast` 컴포넌트의 `user.email` 접근 부분이 가장 유력한 범인으로 판단됩니다. 이 부분을 즉시 수정하여 프로덕션 환경에서의 안정성을 확보해야 합니다.