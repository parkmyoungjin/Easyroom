'use client';

import { AppShell } from '@mantine/core';
import AppHeader from './AppHeader';
import GlobalClickEffect from '@/components/effects/GlobalClickEffect';

interface AppLayoutProps {
  children: React.ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
  showBackButton?: boolean; // undefined일 때 AppHeader의 자동 판단 로직 실행
  showHomeButton?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
  variant?: 'default' | 'minimal' | 'kiosk' | 'admin';
  showLogo?: boolean;
  withFooter?: boolean;
  globalClickEffect?: boolean;
  clickEffectType?: 'ripple' | 'particles' | 'both';
}

export default function AppLayout({
  children,
  headerTitle,
  headerSubtitle,
  showBackButton,
  showHomeButton = false,
  onBack,
  rightContent,
  variant = 'default',
  showLogo = false,
  withFooter = false,
  globalClickEffect = true,
  clickEffectType = 'both',
}: AppLayoutProps) {
  return (
    <>
      <AppShell
        header={{ height: 100 }}
        footer={withFooter ? { height: 60 } : undefined}
        padding={0}
      >
        <AppShell.Header>
          <AppHeader
            title={headerTitle}
            subtitle={headerSubtitle}
            showBackButton={showBackButton}
            showHomeButton={showHomeButton}
            onBack={onBack}
            rightContent={rightContent}
            variant={variant}
            showLogo={showLogo}
          />
        </AppShell.Header>

        <AppShell.Main>
          {children}
        </AppShell.Main>

        {withFooter && (
          <AppShell.Footer>
            {/* 필요시 푸터 콘텐츠 추가 */}
          </AppShell.Footer>
        )}
      </AppShell>

      {/* 전역 클릭 효과 */}
      {globalClickEffect && (
        <GlobalClickEffect
          effect={clickEffectType}
          colors={[
            '#4f46e5', // 블루
            '#7c3aed', // 퍼플  
            '#06b6d4', // 시안
            '#10b981', // 그린
            '#f59e0b', // 앰버
            '#ef4444', // 레드
            '#8b5cf6', // 바이올렛
            '#14b8a6', // 틸
          ]}
          particleCount={8}
          duration={1000}
        />
      )}
    </>
  );
}