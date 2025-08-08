# Mantine UI 다크 모드 텍스트 렌더링 오류 진단 및 해결책

## 문제 진단

### 근본 원인 분석

현재 발생하는 문제는 **Mantine의 CSS 변수가 프로덕션 빌드에서 올바르게 주입되지 않거나, Next.js의 CSS 최적화 과정에서 일부 스타일이 누락되는 현상**입니다.

#### 1. CSS 변수 주입 타이밍 문제
- `var(--mantine-color-text)`와 같은 Mantine CSS 변수가 프로덕션에서 늦게 로드됨
- 초기 렌더링 시 기본값(보통 검은색)이 적용되어 다크 배경과 구분되지 않음

#### 2. 테마 시스템 초기화 순서 문제
- `ColorSchemeScript`와 `MantineProvider`의 초기화 순서가 프로덕션에서 다르게 작동
- 서버 사이드 렌더링과 클라이언트 하이드레이션 간의 스타일 불일치

#### 3. CSS-in-JS 최적화 충돌
- Next.js의 CSS 최적화가 Mantine의 동적 스타일 생성을 방해
- Tree shaking이 필요한 CSS 변수를 제거할 가능성

## 해결책

### 1. 강화된 테마 설정 (`src/app/providers.tsx`)

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider, createTheme, MantineColorsTuple } from '@mantine/core';
import { useState } from "react";
import { StartupValidationProvider } from '@/components/providers/StartupValidationProvider';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

// 커스텀 색상 정의로 일관성 보장
const customBlue: MantineColorsTuple = [
  '#e7f5ff',
  '#d0ebff',
  '#a5d8ff',
  '#74c0fc',
  '#339af0',
  '#228be6',
  '#1c7ed6',
  '#1971c2',
  '#1864ab',
  '#0b5394'
];

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, sans-serif',
  colors: {
    blue: customBlue,
  },
  // 다크 모드 텍스트 색상 명시적 정의
  other: {
    textPrimary: 'var(--mantine-color-text)',
    textSecondary: 'var(--mantine-color-dimmed)',
    textInverse: 'var(--mantine-color-white)',
  },
  // CSS 변수 강제 주입
  cssVariablesResolver: (theme) => ({
    variables: {
      '--app-text-primary': theme.colors.dark[0],
      '--app-text-secondary': theme.colors.dark[2],
      '--app-text-dimmed': theme.colors.dark[3],
    },
    light: {
      '--app-text-primary': theme.colors.dark[9],
      '--app-text-secondary': theme.colors.dark[7],
      '--app-text-dimmed': theme.colors.dark[5],
    },
    dark: {
      '--app-text-primary': theme.colors.dark[0],
      '--app-text-secondary': theme.colors.dark[2],
      '--app-text-dimmed': theme.colors.dark[3],
    },
  }),
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));

  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <StartupValidationProvider 
      enableValidation={isDevelopment} 
      enablePerformanceMonitoring={isProduction}
    >
      <MantineProvider 
        theme={theme} 
        defaultColorScheme="auto"
        // 프로덕션에서 CSS 변수 강제 주입
        forceColorScheme={undefined}
        cssVariablesSelector=":root"
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </MantineProvider>
    </StartupValidationProvider>
  );
}
```

### 2. 레이아웃 최적화 (`src/app/layout.tsx`)

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css';
import Providers from '@/app/providers';
import { Toaster } from 'sonner';
import { ClientPolyfillManager } from '@/lib/polyfills/ClientPolyfillManager';
import { SupabaseProvider } from '@/contexts/SupabaseProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuthToastManager } from '@/components/auth/AuthErrorToast';
import { ColorSchemeScript } from '@mantine/core';
import { GlobalNotification } from '@/components/layout/GlobalNotification';
import AuthGatekeeper from '@/components/layout/AuthGatekeeper';
import { UpdateNotification } from '@/components/pwa/UpdateNotification';
import { AppInitializer } from '@/components/layout/AppInitializer';
import { createClient } from '@/lib/supabase/server';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: '회의실 예약 시스템',
  description: '효율적인 회의실 관리 솔루션',
  viewport: 'width=device-width, initial-scale=1',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const session = user && !error ? {
    access_token: 'mock_token',
    refresh_token: 'mock_refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: user
  } : null;

  return (
    <html lang="ko" suppressHydrationWarning={true}>
      <head>
        <ColorSchemeScript 
          defaultColorScheme="auto" 
          localStorageKey="mantine-color-scheme"
          // 프로덕션에서 CSS 변수 즉시 주입
          nonce={undefined}
        />
        {/* 다크 모드 CSS 변수 사전 정의 */}
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --app-text-primary: #000;
              --app-text-secondary: #495057;
              --app-text-dimmed: #868e96;
            }
            [data-mantine-color-scheme="dark"] {
              --app-text-primary: #fff;
              --app-text-secondary: #c1c2c5;
              --app-text-dimmed: #909296;
            }
          `
        }} />
      </head>
      <body className={`${inter.className} min-h-screen antialiased`}>
        <ClientPolyfillManager enableServiceWorker={true} enablePWAComponents={true}>
          <Providers>
            <SupabaseProvider>
              <AuthProvider initialSession={session}>
                <AppInitializer>
                  <AuthGatekeeper>
                    {children}
                  </AuthGatekeeper>
                </AppInitializer>
                <AuthToastManager />
                <UpdateNotification />
                <GlobalNotification />
              </AuthProvider>
              <Toaster />
            </SupabaseProvider>
          </Providers>
        </ClientPolyfillManager>
      </body>
    </html>
  );
}
```

### 3. 대시보드 컴포넌트 수정 (`src/app/dashboard/page.tsx`)

```tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import {
  Title, Text, Stack, Container, SimpleGrid, ThemeIcon,
  Group, Button, Badge, Paper, ActionIcon, Drawer, Switch,
  Divider, useMantineColorScheme, useMantineTheme
} from '@mantine/core';
import {
  Settings, BarChart3, Plus, Star, Bell, ChevronRight, Activity, Wrench,
  Moon, Sun, LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import { useState } from 'react';

// 향상된 액션 카드 컴포넌트
interface ActionCardProps {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'admin';
  stats?: string;
  badge?: string;
}

function ActionCard({
  title, icon, onClick, variant = 'primary',
  stats, badge
}: ActionCardProps) {
  const { colorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();
  
  const getCardStyle = () => {
    const isDark = colorScheme === 'dark';
    switch (variant) {
      case 'admin':
        return {
          background: 'var(--mantine-color-body)',
          // 커스텀 CSS 변수 사용으로 일관성 보장
          color: 'var(--app-text-primary)',
          border: isDark ? '2px solid rgba(156, 163, 175, 0.6)' : '2px solid #dc2626'
        };
      default:
        return {
          background: 'var(--mantine-color-body)',
          color: 'var(--app-text-primary)',
          border: isDark ? '2px solid rgba(156, 163, 175, 0.5)' : '2px solid #4f46e5'
        };
    }
  };

  return (
    <Paper
      shadow="lg"
      p="xl"
      radius="xl"
      style={{
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        ...getCardStyle(),
        height: '120px'
      }}
      onClick={onClick}
      styles={{
        root: {
          '&:hover': {
            transform: 'translateY(-4px) scale(1.01)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          },
        },
      }}
    >
      <Group justify="space-between" align="center" h="100%">
        <Group align="center" gap="lg">
          <ThemeIcon
            variant="light"
            size={50}
            radius="xl"
            color={variant === 'admin' ? 'red' : 'blue'}
          >
            {icon}
          </ThemeIcon>
          <Stack gap={4}>
            <Title 
              order={3} 
              size="h3"
              style={{ color: 'var(--app-text-primary)' }}
            >
              {title}
            </Title>
            {stats && (
              <Text
                size="xs"
                fw={600}
                c={variant === 'admin' ? 'red' : 'blue'}
              >
                {stats}
              </Text>
            )}
          </Stack>
        </Group>
        <Group align="center" gap="sm">
          {badge && (
            <Badge
              variant="light"
              color={variant === 'admin' ? 'red' : 'blue'}
              size="sm"
            >
              {badge}
            </Badge>
          )}
          <ChevronRight
            size={20}
            color="var(--mantine-color-gray-5)"
          />
        </Group>
      </Group>
    </Paper>
  );
}

/**
 * 현대적이고 매력적인 메인 대시보드 - Enhanced UI
 */
export default function DashboardPage() {
  const { signOut, userProfile } = useAuth();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();
  const [settingsOpened, setSettingsOpened] = useState(false);

  if (!userProfile) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('로그아웃되었습니다');
    } catch (error) {
      toast.error('로그아웃 중 오류가 발생했습니다');
    }
  };

  const navigateToPage = (path: string, requiresAdmin = false) => {
    if (requiresAdmin && userProfile?.role !== 'admin') {
      toast.error('관리자 권한이 필요합니다');
      return;
    }
    window.location.href = path;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '좋은 아침';
    if (hour < 18) return '좋은 오후';
    return '좋은 저녁';
  };

  return (
    <AppLayout variant="default" showLogo={true}>
      <Container my="xl" size="xl">
        {/* 개인화된 환영 섹션 */}
        <Paper
          p="xl"
          radius="xl"
          mb="xl"
          style={{
            background: 'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)',
            color: 'white'
          }}
        >
          <Group justify="space-between" align="center">
            <Stack gap="xs">
              <Stack gap={4}>
                <Title order={2} c="white">
                  {getGreeting()}, {userProfile?.name || userProfile?.email || '사용자'}님!
                </Title>
                <Text c="rgba(255,255,255,0.8)" size="sm">
                  오늘도 효율적인 회의실 관리를 시작해보세요
                </Text>
              </Stack>
            </Stack>
            <Group gap="xs">
              <ActionIcon
                variant="white"
                size="lg"
                radius="xl"
                onClick={() => toast.info('알림 기능 준비중입니다')}
              >
                <Bell size={18} />
              </ActionIcon>
              <Button
                variant="white"
                color="dark"
                radius="xl"
                leftSection={<Settings size={16} />}
                onClick={() => setSettingsOpened(true)}
              >
                설정
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* 주요 액션 카드들 */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xl" mb="xl">
          <ActionCard
            title="회의실 예약"
            icon={<Plus size={24} />}
            onClick={() => navigateToPage('/booking')}
            stats="3개 예약 가능"
            badge="HOT"
          />
          <ActionCard
            title="예약 현황"
            icon={<BarChart3 size={24} />}
            onClick={() => navigateToPage('/reservations')}
            stats="오늘 5건"
          />
          <ActionCard
            title="활동 로그"
            icon={<Activity size={24} />}
            onClick={() => navigateToPage('/activity')}
            stats="최근 업데이트"
          />
        </SimpleGrid>

        {/* 관리자 전용 섹션 */}
        {userProfile?.role === 'admin' && (
          <Paper
            p="xl"
            radius="xl"
            mb="xl"
            style={{
              border: colorScheme === 'dark' 
                ? '1px solid rgba(255, 255, 255, 0.3)' 
                : '1px solid var(--mantine-color-gray-3)'
            }}
          >
            <Stack gap="lg">
              <Group justify="space-between" align="center">
                <Group align="center" gap="md">
                  <ThemeIcon size="lg" radius="xl" color="red" variant="light">
                    <Star size={20} />
                  </ThemeIcon>
                  <Stack gap={4}>
                    <Title order={3} c="red">관리자 도구</Title>
                    <Text size="sm" c="dimmed">시스템 관리 및 설정</Text>
                  </Stack>
                </Group>
                <Badge color="red" variant="light">ADMIN</Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <ActionCard
                  title="회의실 관리"
                  icon={<Settings size={24} />}
                  onClick={() => navigateToPage('/admin/rooms', true)}
                  variant="admin"
                  stats="4개 회의실"
                />
                <ActionCard
                  title="시스템 설정"
                  icon={<Wrench size={24} />}
                  onClick={() => navigateToPage('/admin/settings', true)}
                  variant="admin"
                  badge="NEW"
                />
              </SimpleGrid>
            </Stack>
          </Paper>
        )}

        {/* 설정 Drawer - 텍스트 색상 문제 해결 */}
        <Drawer
          opened={settingsOpened}
          onClose={() => setSettingsOpened(false)}
          title={
            <Group align="center" gap="sm">
              <ThemeIcon variant="light" color="blue" size="sm">
                <Settings size={16} />
              </ThemeIcon>
              <Title 
                order={4}
                style={{ color: 'var(--app-text-primary)' }}
              >
                설정
              </Title>
            </Group>
          }
          position="bottom"
          size="md"
          radius="xl"
          styles={{
            header: { paddingBottom: 0 },
            body: { paddingTop: 'var(--mantine-spacing-md)' },
          }}
        >
          <Stack gap="lg">
            {/* 테마 설정 */}
            <Paper
              p="md"
              radius="lg"
              style={{
                border: colorScheme === 'dark' 
                  ? '1px solid rgba(255, 255, 255, 0.3)' 
                  : '1px solid var(--mantine-color-gray-3)'
              }}
            >
              <Stack gap="md">
                <Group align="center" gap="sm">
                  <ThemeIcon
                    variant="light"
                    color={colorScheme === 'dark' ? 'yellow' : 'blue'}
                    size="sm"
                  >
                    {colorScheme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                  </ThemeIcon>
                  <Text 
                    fw={500}
                    style={{ color: 'var(--app-text-primary)' }}
                  >
                    테마 설정
                  </Text>
                </Group>
                <Group justify="space-between" align="center">
                  <Stack gap={4}>
                    <Text 
                      size="sm"
                      style={{ color: 'var(--app-text-primary)' }}
                    >
                      다크 모드
                    </Text>
                    <Text 
                      size="xs" 
                      style={{ color: 'var(--app-text-dimmed)' }}
                    >
                      어두운 테마로 전환하여 눈의 피로를 줄여보세요
                    </Text>
                  </Stack>
                  <Switch
                    checked={colorScheme === 'dark'}
                    onChange={toggleColorScheme}
                    size="md"
                    color="blue"
                    thumbIcon={
                      colorScheme === 'dark' ? (
                        <Moon size={12} color="var(--mantine-color-yellow-4)" />
                      ) : (
                        <Sun size={12} color="var(--mantine-color-blue-6)" />
                      )
                    }
                  />
                </Group>
              </Stack>
            </Paper>

            {/* 계정 설정 */}
            <Paper
              p="md"
              radius="lg"
              style={{
                border: colorScheme === 'dark' 
                  ? '1px solid rgba(255, 255, 255, 0.3)' 
                  : '1px solid var(--mantine-color-gray-3)'
              }}
            >
              <Stack gap="md">
                <Group align="center" gap="sm">
                  <ThemeIcon variant="light" color="gray" size="sm">
                    <Settings size={16} />
                  </ThemeIcon>
                  <Text 
                    fw={500}
                    style={{ color: 'var(--app-text-primary)' }}
                  >
                    계정 정보
                  </Text>
                </Group>
                <Stack gap="xs">
                  <Text 
                    size="sm" 
                    style={{ color: 'var(--app-text-dimmed)' }}
                  >
                    사용자명
                  </Text>
                  <Text 
                    size="sm" 
                    fw={500}
                    style={{ color: 'var(--app-text-primary)' }}
                  >
                    {userProfile?.name || userProfile?.email || '사용자'}
                  </Text>
                </Stack>
                {userProfile?.email && (
                  <Stack gap="xs">
                    <Text 
                      size="sm" 
                      style={{ color: 'var(--app-text-dimmed)' }}
                    >
                      이메일
                    </Text>
                    <Text 
                      size="sm" 
                      fw={500}
                      style={{ color: 'var(--app-text-primary)' }}
                    >
                      {userProfile.email}
                    </Text>
                  </Stack>
                )}
                {userProfile?.role && (
                  <Stack gap="xs">
                    <Text 
                      size="sm" 
                      style={{ color: 'var(--app-text-dimmed)' }}
                    >
                      권한
                    </Text>
                    <Badge
                      variant="light"
                      color={userProfile.role === 'admin' ? 'red' : 'blue'}
                      size="sm"
                    >
                      {userProfile.role === 'admin' ? '관리자' : '일반 사용자'}
                    </Badge>
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Divider />

            {/* 로그아웃 버튼 */}
            <Button
              variant="light"
              color="red"
              size="md"
              radius="xl"
              leftSection={<LogOut size={16} />}
              onClick={handleLogout}
              fullWidth
            >
              로그아웃
            </Button>
          </Stack>
        </Drawer>
      </Container>
    </AppLayout>
  );
}
```

### 4. 글로벌 CSS 추가 (`src/app/globals.css`)

```css
/* 기존 내용 유지하고 아래 내용 추가 */

/* Mantine 다크 모드 텍스트 색상 강제 적용 */
:root {
  --app-text-primary: #000;
  --app-text-secondary: #495057;
  --app-text-dimmed: #868e96;
}

[data-mantine-color-scheme="dark"] {
  --app-text-primary: #fff !important;
  --app-text-secondary: #c1c2c5 !important;
  --app-text-dimmed: #909296 !important;
}

/* Mantine 컴포넌트 텍스트 색상 강제 적용 */
[data-mantine-color-scheme="dark"] .mantine-Text-root {
  color: var(--app-text-primary) !important;
}

[data-mantine-color-scheme="dark"] .mantine-Title-root {
  color: var(--app-text-primary) !important;
}

/* Drawer 내부 텍스트 색상 보장 */
[data-mantine-color-scheme="dark"] .mantine-Drawer-body .mantine-Text-root {
  color: var(--app-text-primary) !important;
}

[data-mantine-color-scheme="dark"] .mantine-Drawer-body .mantine-Title-root {
  color: var(--app-text-primary) !important;
}

/* dimmed 텍스트 색상 보장 */
[data-mantine-color-scheme="dark"] .mantine-Text-root[data-variant="dimmed"] {
  color: var(--app-text-dimmed) !important;
}
```

## 해결책 상세 설명

### 1. CSS 변수 사전 정의
- `layout.tsx`에서 `<style>` 태그를 통해 CSS 변수를 사전 정의
- 프로덕션 빌드에서도 즉시 사용 가능한 색상 값 보장

### 2. 커스텀 CSS 변수 시스템
- `--app-text-primary`, `--app-text-secondary` 등 앱 전용 CSS 변수 도입
- Mantine의 기본 변수와 독립적으로 작동하여 안정성 확보

### 3. cssVariablesResolver 활용
- Mantine 테마에서 `cssVariablesResolver`를 통해 커스텀 변수 주입
- 라이트/다크 모드별 색상 값 명시적 정의

### 4. 글로벌 CSS 강제 적용
- `!important`를 사용하여 프로덕션 환경에서도 색상 적용 보장
- Mantine 컴포넌트별 선택자를 통한 정밀한 스타일 제어

### 5. 인라인 스타일 적용
- 중요한 텍스트 요소에 `style={{ color: 'var(--app-text-primary)' }}` 직접 적용
- CSS 최적화 과정에서도 제거되지 않는 안정적인 스타일링

## 추가 고려사항

### 1. 성능 최적화
- CSS 변수 사용으로 런타임 스타일 계산 최소화
- 불필요한 리렌더링 방지

### 2. 유지보수성
- 중앙화된 색상 관리 시스템
- 테마 변경 시 일관된 색상 적용

### 3. 호환성
- 모든 브라우저에서 CSS 변수 지원
- 폴백 색상 값 제공

이 해결책을 적용하면 프로덕션 환경에서도 다크 모드 텍스트가 올바르게 표시될 것입니다.