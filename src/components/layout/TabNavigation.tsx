'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Group, UnstyledButton, Text, ThemeIcon, useMantineColorScheme } from '@mantine/core';
import { Home, Calendar, User, BarChart3, Wrench } from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  disabled?: boolean;
}

const tabs: TabItem[] = [
  {
    id: 'home',
    label: '홈',
    icon: <Home size={20} />,
    path: '/dashboard'
  },
  {
    id: 'new-reservation',
    label: '예약',
    icon: <Calendar size={20} />,
    path: '/reservations/new'
  },
  {
    id: 'my-reservations',
    label: '내예약',
    icon: <User size={20} />,
    path: '/reservations/my'
  },
  {
    id: 'reservation-status',
    label: '현황',
    icon: <BarChart3 size={20} />,
    path: '/reservations/status'
  },
  {
    id: 'coming-soon',
    label: '더보기',
    icon: <Wrench size={20} />,
    path: '/coming-soon',
    disabled: true
  }
];

export default function TabNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { colorScheme } = useMantineColorScheme();

  const handleTabClick = (tab: TabItem) => {
    if (tab.disabled) return;
    router.push(tab.path);
  };

  const isActiveTab = (tab: TabItem) => {
    if (tab.path === '/dashboard') {
      return pathname === '/' || pathname === '/dashboard';
    }
    return pathname.startsWith(tab.path);
  };

  const getTabStyles = (tab: TabItem, isActive: boolean) => {
    const baseStyles = {
      padding: '12px 8px',
      borderRadius: '20px',
      transition: 'all 0.3s ease',
      cursor: tab.disabled ? 'not-allowed' : 'pointer',
      opacity: tab.disabled ? 0.4 : 1,
      minWidth: '60px',
      minHeight: '60px',
      textAlign: 'center' as const,
      border: '2px solid transparent',
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      // 모바일 터치 최적화
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
    };

    if (isActive && !tab.disabled) {
      return {
        ...baseStyles,
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        color: 'white',
        transform: 'scale(1.02)',
        boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)',
        border: '2px solid rgba(255, 255, 255, 0.2)',
      };
    }

    if (tab.disabled) {
      return {
        ...baseStyles,
        background: colorScheme === 'dark' 
          ? 'rgba(255, 255, 255, 0.02)'
          : 'rgba(0, 0, 0, 0.02)',
        color: colorScheme === 'dark' ? '#6b7280' : '#9ca3af',
        border: '2px solid rgba(156, 163, 175, 0.2)',
      };
    }

    return {
      ...baseStyles,
      background: colorScheme === 'dark' 
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(255, 255, 255, 0.8)',
      color: colorScheme === 'dark' ? '#d1d5db' : '#4b5563',
      border: colorScheme === 'dark' 
        ? '2px solid rgba(255, 255, 255, 0.08)'
        : '2px solid rgba(0, 0, 0, 0.05)',
      // 모바일에서 호버 효과 제거, 터치 피드백만 유지
      '@media (hover: hover)': {
        '&:hover': {
          background: colorScheme === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)'
            : 'rgba(79, 70, 229, 0.08)',
          transform: 'scale(1.02)',
          border: '2px solid rgba(79, 70, 229, 0.2)',
        },
      },
      // 터치 피드백
      '&:active': {
        transform: 'scale(0.98)',
      },
    };
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        gap: '4px',
        padding: '0 8px',
        justifyContent: 'space-between',
      }}
    >
      {tabs.map((tab) => {
        const isActive = isActiveTab(tab);
        
        return (
          <UnstyledButton
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            style={getTabStyles(tab, isActive)}
            disabled={tab.disabled}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <ThemeIcon
                size="md"
                radius="md"
                variant="transparent"
                color={isActive ? 'white' : (colorScheme === 'dark' ? 'gray.4' : 'gray.6')}
              >
                {tab.icon}
              </ThemeIcon>
              <Text
                size="xs"
                fw={isActive ? 600 : 500}
                c={isActive ? 'white' : (colorScheme === 'dark' ? 'gray.3' : 'gray.7')}
                style={{ 
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                  textAlign: 'center'
                }}
              >
                {tab.label}
              </Text>
            </div>
          </UnstyledButton>
        );
      })}
    </div>
  );
}