// src/app/dashboard/page.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import {
  Button, Card, Title, Text, Stack, Group, Container,
  Grid, SimpleGrid, Avatar, ThemeIcon, Center
} from '@mantine/core';
import {
  Calendar, Users, Clock, Settings, LogOut, BarChart3,
  ArrowRight, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

// Bento Grid에 들어갈, 재사용 가능한 카드 컴포넌트 정의
interface BentoCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'admin';
}

function BentoCard({ title, description, icon, onClick, variant = 'default' }: BentoCardProps) {
  const isAdmin = variant === 'admin';

  return (
    <Card
      withBorder
      shadow="sm"
      p="lg"
      radius="md"
      style={{
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        borderColor: isAdmin ? 'var(--mantine-color-red-3)' : undefined
      }}
      onClick={onClick}
      __vars={{
        '--card-hover-transform': 'translateY(-2px)',
        '--card-hover-shadow': 'var(--mantine-shadow-md)'
      }}
      styles={{
        root: {
          '&:hover': {
            transform: 'var(--card-hover-transform)',
            boxShadow: 'var(--card-hover-shadow)',
          },
        },
      }}
    >
      <Group justify="space-between" align="flex-start">
        <Group align="flex-start">
          <ThemeIcon
            variant="light"
            size="lg"
            color={isAdmin ? 'red' : 'blue'}
          >
            {icon}
          </ThemeIcon>
          <Stack gap="xs">
            <Text fw={600} c={isAdmin ? 'red' : undefined}>
              {title}
            </Text>
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          </Stack>
        </Group>
        <ArrowRight size={18} color="var(--mantine-color-gray-5)" />
      </Group>
    </Card>
  );
}

/**
 * 로그인한 사용자를 위한 개인화된 메인 허브 - Bento Grid 스타일
 */
export default function DashboardPage() {
  const router = useRouter();
  const { signOut, userProfile, authStatus } = useAuth();

  // 로딩 상태 처리
  if (authStatus === 'loading') {
    return (
      <Container my="xl" size="lg">
        <Center mih="50vh">
          <Stack align="center" gap="md">
            <Text size="lg" c="dimmed">로딩 중...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  // 인증되지 않은 사용자는 접근할 수 없음 (middleware에서 처리)
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
    router.push(path);
  };

  return (
    <Container my="xl" size="lg">
      {/* --- 환영 섹션 --- */}
      <Group justify="space-between" mb="xl">
        <Stack gap="xs">
          <Text size="lg" c="dimmed">안녕하세요,</Text>
          <Title order={1} size="2.5rem" fw={700}>
            {userProfile.name}님!
          </Title>
          <Text c="dimmed">
            EasyRoom에서 편리하게 회의실을 예약하세요.
          </Text>
        </Stack>
        <Group gap="md">
          <Stack gap={0} align="flex-end" visibleFrom="sm">
            <Text fw={600}>{userProfile.name}</Text>
            <Text size="sm" c="dimmed">{userProfile.department}</Text>
          </Stack>
          <Group gap="sm">
            <Avatar color="blue" radius="xl" size="lg">
              {userProfile.name.charAt(0)}
            </Avatar>
            <Button variant="outline" onClick={handleLogout} leftSection={<LogOut size={16} />}>
              <Text hiddenFrom="sm" visibleFrom="xs">로그아웃</Text>
              <Text visibleFrom="sm">로그아웃</Text>
            </Button>
          </Group>
        </Group>
      </Group>

      {/* --- Bento Grid 레이아웃 --- */}
      <SimpleGrid
        cols={{ base: 1, sm: 2 }} // 모바일에서는 1열, sm 이상에서는 2열
        spacing="md"
        mb="xl"
      >
        {/* --- 그리드 아이템들 --- */}
        <BentoCard
          title="새 예약하기"
          description="가장 빠르게 예약을 생성합니다."
          icon={<Calendar size={20} />}
          onClick={() => navigateToPage('/reservations/new')}
        />

        <BentoCard
          title="내 예약 보기"
          description="나의 모든 예약 내역을 관리합니다."
          icon={<Users size={20} />}
          onClick={() => navigateToPage('/reservations/my')}
        />

        <BentoCard
          title="예약 현황"
          description="실시간 예약 현황을 확인합니다."
          icon={<Clock size={20} />}
          onClick={() => navigateToPage('/reservations/status')}
        />

        <BentoCard
          title="전체 대시보드"
          description="모든 회의실의 종합 현황을 확인합니다."
          icon={<BarChart3 size={20} />}
          onClick={() => navigateToPage('/kiosk/room-display')}
        />
      </SimpleGrid>

      {/* 관리자 메뉴 (관리자인 경우에만 표시) */}
      {userProfile?.role === 'admin' && (
        <Stack gap="md" mb="xl">
          <Title order={2} size="h3" c="red">관리자 메뉴</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <BentoCard
              title="시스템 관리"
              description="관리자 패널에서 시스템을 설정하고 관리합니다."
              icon={<Settings size={20} />}
              onClick={() => navigateToPage('/admin', true)}
              variant="admin"
            />
          </SimpleGrid>
        </Stack>
      )}

      {/* 이용 안내 */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="xs">
            <Building2 size={20} />
            <Title order={3} size="h4">이용 안내</Title>
          </Group>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="xs">
                <Text fw={600} size="sm">예약 시간</Text>
                <Text c="dimmed" size="sm">
                  오전 8시부터 오후 7시까지 30분 단위로 예약 가능합니다.
                </Text>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="xs">
                <Text fw={600} size="sm">예약 규칙</Text>
                <Text c="dimmed" size="sm">
                  사용이 끝난 회의실은 깨끗하게 정리해주세요. 미사용 예약은 다른 사람을 위해 미리 취소해주세요.
                </Text>
              </Stack>
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>
    </Container>
  );
}