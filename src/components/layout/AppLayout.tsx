'use client';

import { AppShell } from '@mantine/core';
import AppHeader from './AppHeader';

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
}: AppLayoutProps) {
  return (
    <AppShell
      header={{ height: 60 }}
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
  );
}