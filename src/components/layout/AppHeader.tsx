'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
  Group,
  Button,
  Text,
  Menu,
  UnstyledButton,
  Box,
  Title,
  Stack,
  ThemeIcon,
  useMantineColorScheme,
  Paper,
  ActionIcon
} from '@mantine/core';
import {
  ArrowLeft,
  Home,
  LogOut,
  Calendar,
  LogIn,
  UserPlus,
  User,
  Shield,
  Settings
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import TabNavigation from './TabNavigation';

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
  variant?: 'default' | 'minimal' | 'kiosk' | 'admin';
  showLogo?: boolean;
}

export default function AppHeader({
  title,
  subtitle,
  showBackButton,
  showHomeButton = false,
  onBack,
  rightContent,
  variant = 'default',
  showLogo = false,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { authStatus, userProfile } = useAuthContext();
  const { signOut } = useAuth();

  // 🎯 스마트 뒤로 가기 시스템: 경로 기반 자동 판단
  const shouldShowBackButton = () => {
    // showBackButton이 명시적으로 설정된 경우 그것을 우선 사용
    if (showBackButton !== undefined) {
      return showBackButton;
    }

    // minimal 변형에서는 뒤로 가기 버튼 표시하지 않음
    if (variant === 'minimal') {
      return false;
    }

    // 메인 페이지들 (뒤로 가기 버튼 불필요)
    const mainPages = [
      '/',
      '/dashboard',
      '/welcome'
    ];

    if (mainPages.includes(pathname)) {
      return false;
    }

    // 서브 페이지들 (뒤로 가기 버튼 필요)
    const subPagePatterns = [
      '/reservations/new',
      '/reservations/edit/',
      '/reservations/my',
      '/reservations/status',
      '/reservations/browse',
      '/kiosk/',
      '/admin'
    ];

    return subPagePatterns.some(pattern => pathname.startsWith(pattern));
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleHome = () => {
    router.push('/dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('로그아웃 완료', {
        description: '안전하게 로그아웃되었습니다.',
      });
    } catch (error) {
      toast.error('로그아웃 오류', {
        description: '로그아웃 중 오류가 발생했습니다.',
      });
    }
  };

  const navigateToLogin = () => {
    router.push('/login');
  };

  const navigateToSignup = () => {
    router.push('/signup');
  };

  const navigateToMyReservations = () => {
    router.push('/reservations/my');
  };

  const navigateToAdmin = () => {
    if (userProfile?.role === 'admin') {
      router.push('/admin');
    } else {
      toast.error('권한이 없습니다', {
        description: '관리자만 접근할 수 있습니다.',
      });
    }
  };

  const navigateToProfile = () => {
    router.push('/profile');
  };

  const { colorScheme } = useMantineColorScheme();

  // Minimal 변형: 현대적인 로고 표시
  if (variant === 'minimal') {
    return (
      <Box
        h={100}
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Title order={1} size="2rem" fw={700} c="white">
          EasyRoom
        </Title>
      </Box>
    );
  }

  // Dashboard 페이지 확인
  const isDashboardPage = () => {
    return pathname === '/' || pathname === '/dashboard';
  };

  // 제목 메시지 생성
  const getWelcomeMessage = () => {
    return title;
  };

  // 현대적인 사용자 메뉴 렌더링 (dashboard 스타일)
  const renderUserMenu = () => {
    if (authStatus !== 'authenticated' || !userProfile) return null;

    return (
      <Menu shadow="xl" width={280} radius="xl">
        <Menu.Target>
          <UnstyledButton>
            <Paper
              p="sm"
              radius="xl"
              style={{
                border: colorScheme === 'dark' ? '2px solid rgba(255, 255, 255, 0.2)' : '2px solid #e5e7eb',
                transition: 'all 0.3s ease'
              }}
              styles={{
                root: {
                  '&:hover': {
                    borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : '#4f46e5',
                    transform: 'translateY(-1px)',
                  },
                },
              }}
            >
              <Group gap="sm">
                <Stack gap={0} align="flex-end">
                  <Text fw={600} size="sm">{userProfile.name}</Text>
                  <Text size="xs" c="dimmed">{userProfile.department}</Text>
                </Stack>
                <ThemeIcon size="lg" radius="xl" color="blue" variant="light">
                  <User size={20} />
                </ThemeIcon>
              </Group>
            </Paper>
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          <Paper p="sm" radius="lg" mb="sm" style={{ background: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc' }}>
            <Group align="center" gap="md">
              <ThemeIcon size="xl" radius="xl" color="blue" variant="light">
                <User size={24} />
              </ThemeIcon>
              <Stack gap={2}>
                <Text fw={600} size="md">{userProfile.name}</Text>
                <Text size="xs" c="dimmed">{userProfile.department}</Text>
                <Text size="xs" c="blue" fw={500}>
                  {userProfile.role === 'admin' ? '관리자' : '사용자'}
                </Text>
              </Stack>
            </Group>
          </Paper>

          <Menu.Label>내 계정</Menu.Label>
          <Menu.Item
            leftSection={<Settings size={16} />}
            onClick={navigateToProfile}
            style={{ borderRadius: '8px', margin: '2px' }}
          >
            내 정보 관리
          </Menu.Item>
          <Menu.Item
            leftSection={<Calendar size={16} />}
            onClick={navigateToMyReservations}
            style={{ borderRadius: '8px', margin: '2px' }}
          >
            내 예약 관리
          </Menu.Item>

          {userProfile.role === 'admin' && (
            <>
              <Menu.Divider />
              <Menu.Label>관리자</Menu.Label>
              <Menu.Item
                leftSection={<Shield size={16} />}
                onClick={navigateToAdmin}
                c="red"
                style={{ borderRadius: '8px', margin: '2px' }}
              >
                관리자 패널
              </Menu.Item>
            </>
          )}

          <Menu.Divider />
          <Menu.Item
            leftSection={<LogOut size={16} />}
            onClick={handleLogout}
            c="red"
            style={{ borderRadius: '8px', margin: '2px' }}
          >
            로그아웃
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  };

  // 현대적인 인증 버튼들 렌더링 (dashboard 스타일)
  const renderAuthButtons = () => {
    if (authStatus === 'authenticated') return null;

    return (
      <Group gap="sm">
        <Button
          variant="light"
          color="gray"
          size="sm"
          radius="xl"
          leftSection={<LogIn size={16} />}
          onClick={navigateToLogin}
        >
          로그인
        </Button>
        <Button
          size="sm"
          radius="xl"
          leftSection={<UserPlus size={16} />}
          onClick={navigateToSignup}
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            border: 'none'
          }}
        >
          회원가입
        </Button>
      </Group>
    );
  };

  // Dashboard 페이지인 경우 기존 헤더 렌더링
  if (isDashboardPage()) {
    return (
      <Box
        px="xl"
        py="md"
        h={100}
        style={{
          background: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          borderBottom: colorScheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <Group justify="space-between" align="center" w="100%">
          {/* 왼쪽 영역: 로고 + 제목 */}
          <Group align="center" gap="lg">
            {showLogo && (
              <Title order={2} size="1.8rem" fw={700} c={colorScheme === 'dark' ? 'white' : 'dark'}>
                EasyRoom
              </Title>
            )}

            {/* 제목 영역 */}
            {(getWelcomeMessage() || subtitle) && (
              <Stack gap={4}>
                <Text fw={600} size="xl" c={colorScheme === 'dark' ? 'white' : 'dark'}>
                  {getWelcomeMessage()}
                </Text>
                {subtitle && (
                  <Text size="sm" c="dimmed">
                    {subtitle}
                  </Text>
                )}
              </Stack>
            )}
          </Group>

          {/* 오른쪽 영역: 사용자 메뉴 또는 인증 버튼 */}
          <Group gap="lg">
            {rightContent && <Box>{rightContent}</Box>}
            {(variant === 'kiosk' || variant === 'default') && (
              <>
                {authStatus === 'authenticated' ? renderUserMenu() : renderAuthButtons()}
              </>
            )}
          </Group>
        </Group>
      </Box>
    );
  }

  // 다른 페이지들은 탭 네비게이션 렌더링
  return (
    <Box
      px="md"
      py="md"
      h={100}
      style={{
        background: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: colorScheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <TabNavigation />
    </Box>
  );


}