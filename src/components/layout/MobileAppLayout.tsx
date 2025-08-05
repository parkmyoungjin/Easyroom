'use client';

import { AppShell, Flex, Text, UnstyledButton, rem } from '@mantine/core';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Calendar, Plus, BarChart3 } from 'lucide-react';
import { Button, Group, Text as MantineText } from '@mantine/core';
import { ArrowLeft, Home as HomeIcon } from 'lucide-react';

// Simple MobileHeader replacement
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
}) {
  return (
    <Group justify="space-between" h="100%" px="md">
      <Group>
        {showBackButton && onBack && (
          <Button variant="subtle" size="compact-sm" onClick={onBack}>
            <ArrowLeft size={16} />
          </Button>
        )}
        {showHomeButton && (
          <Button variant="subtle" size="compact-sm">
            <HomeIcon size={16} />
          </Button>
        )}
        <div>
          <MantineText fw={600} size="sm">{title}</MantineText>
          {subtitle && <MantineText size="xs" c="dimmed">{subtitle}</MantineText>}
        </div>
      </Group>
      {rightContent && <div>{rightContent}</div>}
    </Group>
  );
}

interface MobileAppLayoutProps {
  children: React.ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

interface NavItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: '홈', path: '/dashboard' },
  { icon: Calendar, label: '내 예약', path: '/reservations/my' },
  { icon: Plus, label: '새 예약', path: '/reservations/new' },
  { icon: BarChart3, label: '전체 현황', path: '/reservations/status' },
];

export default function MobileAppLayout({
  children,
  headerTitle = '앱',
  headerSubtitle,
  showBackButton = true,
  showHomeButton = false,
  onBack,
  rightContent,
}: MobileAppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <AppShell
      header={{ height: 56 }}
      footer={{ height: 60 }}
      padding={0}
    >
      <AppShell.Header>
        <MobileHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          showBackButton={showBackButton}
          showHomeButton={showHomeButton}
          onBack={onBack}
          rightContent={rightContent}
        />
      </AppShell.Header>

      <AppShell.Main>
        {children}
      </AppShell.Main>

      <AppShell.Footer hiddenFrom="sm">
        <Flex
          justify="space-around"
          align="center"
          h="100%"
          style={{
            borderTop: '1px solid #e9ecef',
            backgroundColor: 'white',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <UnstyledButton
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: rem(8),
                  minWidth: rem(60),
                  color: active ? '#228be6' : '#868e96',
                  transition: 'color 0.2s ease',
                }}
              >
                <Icon 
                  size={20} 
                  className={active ? 'text-blue-500' : 'text-gray-500'} 
                />
                <Text
                  size="xs"
                  mt={2}
                  style={{
                    color: active ? '#228be6' : '#868e96',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {item.label}
                </Text>
              </UnstyledButton>
            );
          })}
        </Flex>
      </AppShell.Footer>
    </AppShell>
  );
}