// src/app/dashboard/page.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import {
  Title, Text, Stack, Container, SimpleGrid, ThemeIcon,
  Group, Button, Badge, Paper, ActionIcon, Drawer, Switch,
  Divider, useMantineColorScheme, useComputedColorScheme
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
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });

  const getCardStyle = () => {
    const isDark = computed === 'dark';

    switch (variant) {
      case 'admin':
        return {
          background: 'var(--mantine-color-body)',
          color: 'var(--mantine-color-text)',
          border: isDark ? '2px solid rgba(156, 163, 175, 0.6)' : '2px solid #dc2626'
        };
      default:
        return {
          background: 'var(--mantine-color-body)',
          color: 'var(--mantine-color-text)',
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
        height: '120px' // 헤더와 비슷한 높이로 설정
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
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const [settingsOpened, setSettingsOpened] = useState(false);

  // AuthGatekeeper에서 모든 인증 및 리디렉션을 처리하므로
  // 여기서는 단순히 userProfile 존재 여부만 확인
  if (!userProfile) {
    return null;
  }

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

  const navigateToPage = (path: string, requiresAdmin = false) => {
    if (requiresAdmin && userProfile?.role !== 'admin') {
      toast.error('권한이 없습니다', {
        description: '관리자만 접근할 수 있습니다.',
      });
      return;
    }
    window.location.href = path;
  };

  // 현재 시간 기반 인사말
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '좋은 아침입니다';
    if (hour < 18) return '좋은 오후입니다';
    return '좋은 저녁입니다';
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
            title="새 예약하기"
            icon={<Plus size={24} />}
            onClick={() => navigateToPage('/reservations/new')}
            variant="primary"
            badge="인기"
            stats="평균 30초 소요"
          />

          <ActionCard
            title="예약 현황"
            icon={<Activity size={24} />}
            onClick={() => navigateToPage('/reservations/status')}
            variant="primary"
            stats="실시간 업데이트"
          />

          <ActionCard
            title="새로운 기능"
            icon={<Wrench size={24} />}
            onClick={() => toast.info('개발 중인 기능입니다')}
            variant="primary"
            badge="개발중"
            stats="Coming Soon"
          />

          {userProfile?.role === 'admin' && (
            <ActionCard
              title="전체 대시보드"
              icon={<BarChart3 size={24} />}
              onClick={() => navigateToPage('/kiosk/room-display', true)}
              variant="admin"
              badge="관리자"
              stats="12개 회의실 모니터링"
            />
          )}
        </SimpleGrid>

        {/* 관리자 전용 섹션 */}
        {userProfile?.role === 'admin' && (
          <Paper
            p="xl"
            radius="xl"
            mb="xl"
            style={{
              border: colorScheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--mantine-color-gray-3)'
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
                  title="시스템 관리"
                  icon={<Settings size={20} />}
                  onClick={() => navigateToPage('/admin', true)}
                  variant="primary"
                  stats="전체 시스템 제어"
                />

                <ActionCard
                  title="분석 리포트"
                  icon={<BarChart3 size={20} />}
                  onClick={() => toast.info('분석 리포트 기능 준비중입니다')}
                  variant="primary"
                  stats="월간/주간 리포트"
                />
              </SimpleGrid>
            </Stack>
          </Paper>
        )}

        {/* 설정 Drawer */}
        <Drawer
          opened={settingsOpened}
          onClose={() => setSettingsOpened(false)}
          title={
            <Group align="center" gap="sm">
              <ThemeIcon variant="light" color="blue" size="sm">
                <Settings size={16} />
              </ThemeIcon>
              <Title order={4}>설정</Title>
            </Group>
          }
          position="bottom"
          size="md"
          radius="xl"
          styles={{
            header: {
              paddingBottom: 0,
            },
            body: {
              paddingTop: 'var(--mantine-spacing-md)',
            },
          }}
        >
          <Stack gap="lg">
            {/* 테마 설정 */}
            <Paper
              p="md"
              radius="lg"
              style={{
                border: colorScheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--mantine-color-gray-3)'
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
                  <Text fw={500}>테마 설정</Text>
                </Group>

                <Group justify="space-between" align="center">
                  <Stack gap={4}>
                    <Text size="sm">다크 모드</Text>
                    <Text size="xs" c="dimmed">
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
                border: colorScheme === 'dark' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--mantine-color-gray-3)'
              }}
            >
              <Stack gap="md">
                <Group align="center" gap="sm">
                  <ThemeIcon variant="light" color="gray" size="sm">
                    <Settings size={16} />
                  </ThemeIcon>
                  <Text fw={500}>계정 정보</Text>
                </Group>

                <Stack gap="xs">
                  <Text size="sm" c="dimmed">사용자명</Text>
                  <Text size="sm" fw={500}>
                    {userProfile?.name || userProfile?.email || '사용자'}
                  </Text>
                </Stack>

                {userProfile?.email && (
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">이메일</Text>
                    <Text size="sm" fw={500}>{userProfile.email}</Text>
                  </Stack>
                )}

                {userProfile?.role && (
                  <Stack gap="xs">
                    <Text size="sm" c="dimmed">권한</Text>
                    <Badge
                      variant="light"
                      color={userProfile.role === 'admin' ? 'red' : 'blue'}
                      size="sm"
                    >
                      {userProfile.role === 'admin' ? '관리자' : '사용자'}
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
              radius="lg"
              leftSection={<LogOut size={18} />}
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