'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
  Group,
  Button,
  Text,
  Avatar,
  Menu,
  UnstyledButton,
  Box,
  Title,
  Stack
} from '@mantine/core';
import {
  ArrowLeft,
  Home,
  LogOut,
  Calendar,
  Settings,
  LogIn,
  UserPlus
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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

  // Minimal 변형: 로고만 표시
  if (variant === 'minimal') {
    return (
      <Group justify="center" h="100%" px="md">
        <Title order={1} size="1.8rem" fw={700} c="blue">
          EasyRoom
        </Title>
      </Group>
    );
  }

  // 인증된 사용자의 환영 메시지 생성
  const getWelcomeMessage = () => {
    if (authStatus === 'authenticated' && userProfile) {
      return `안녕하세요, ${userProfile.name}님!`;
    }
    return title;
  };

  // 사용자 메뉴 렌더링 (인증된 사용자용)
  const renderUserMenu = () => {
    if (authStatus !== 'authenticated' || !userProfile) return null;

    return (
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <UnstyledButton>
            <Group gap="sm">
              <Stack gap={0} align="flex-end" visibleFrom="sm">
                <Text fw={600} size="sm">{userProfile.name}</Text>
                <Text size="xs" c="dimmed">{userProfile.department}</Text>
              </Stack>
              <Avatar color="blue" radius="xl" size="md">
                {userProfile.name.charAt(0)}
              </Avatar>
            </Group>
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>내 계정</Menu.Label>
          <Menu.Item
            leftSection={<Calendar size={14} />}
            onClick={navigateToMyReservations}
          >
            내 예약 관리
          </Menu.Item>

          {userProfile.role === 'admin' && (
            <>
              <Menu.Divider />
              <Menu.Label>관리자</Menu.Label>
              <Menu.Item
                leftSection={<Settings size={14} />}
                onClick={navigateToAdmin}
                c="red"
              >
                관리자 페널
              </Menu.Item>
            </>
          )}

          <Menu.Divider />
          <Menu.Item
            leftSection={<LogOut size={14} />}
            onClick={handleLogout}
            c="red"
          >
            로그아웃
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  };

  // 인증 버튼들 렌더링 (비인증 사용자용)
  const renderAuthButtons = () => {
    if (authStatus === 'authenticated') return null;

    return (
      <Group gap="sm">
        <Button
          variant="outline"
          size="sm"
          leftSection={<LogIn size={16} />}
          onClick={navigateToLogin}
        >
          로그인
        </Button>
        <Button
          size="sm"
          leftSection={<UserPlus size={16} />}
          onClick={navigateToSignup}
        >
          회원가입
        </Button>
      </Group>
    );
  };

  return (
    <Group justify="space-between" h="100%" px="md">
      {/* 왼쪽 영역: 네비게이션 + 제목 */}
      <Group gap="md">
        {/* 네비게이션 버튼들 */}
        <Group gap="xs">
          {shouldShowBackButton() && (
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={handleBack}
              leftSection={<ArrowLeft size={16} />}
            >
              뒤로
            </Button>
          )}
          {showHomeButton && (
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={handleHome}
              leftSection={<Home size={16} />}
            >
              홈
            </Button>
          )}
        </Group>

        {/* 로고 또는 제목 */}
        <Box>
          {showLogo && (
            <Title order={2} size="1.5rem" fw={700} c="blue" mb={2}>
              EasyRoom
            </Title>
          )}

          {/* 제목 영역 */}
          {(getWelcomeMessage() || subtitle) && (
            <Stack gap={2}>
              <Text fw={600} size="md">
                {getWelcomeMessage()}
              </Text>
              {subtitle && (
                <Text size="sm" c="dimmed">
                  {subtitle}
                </Text>
              )}
            </Stack>
          )}
        </Box>
      </Group>

      {/* 오른쪽 영역: 사용자 메뉴 또는 인증 버튼 또는 커스텀 콘텐츠 */}
      <Group gap="md">
        {rightContent && <Box>{rightContent}</Box>}

        {/* 키오스크 모드이거나 기본 모드에서 인증 상태에 따른 UI */}
        {(variant === 'kiosk' || variant === 'default') && (
          <>
            {authStatus === 'authenticated' ? renderUserMenu() : renderAuthButtons()}
          </>
        )}
      </Group>
    </Group>
  );
}