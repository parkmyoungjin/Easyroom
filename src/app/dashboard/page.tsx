// src/app/dashboard/page.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import {
  Card, Title, Text, Stack, Container,
  Grid, SimpleGrid, ThemeIcon, Group, Avatar, Button
} from '@mantine/core';
import {
  Calendar, Users, Clock, Settings, LogOut, BarChart3,
  ArrowRight, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';


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
  const { signOut, userProfile, authStatus } = useAuth();

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

  return (
    <AppLayout 
      variant="default" 
      showLogo={true}
    >
      <Container my="xl" size="lg">

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
    </AppLayout>
  );
}