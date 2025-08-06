// src/app/welcome/page.tsx
'use client';

import Link from 'next/link';
import { 
  Button, Title, Text, Stack, Group, Container, 
  Center, Anchor
} from '@mantine/core';
import { 
  Clock, LogIn, UserPlus, ArrowRight
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

/**
 * 비로그인 사용자를 위한 환영 페이지
 */
export default function WelcomePage() {
  return (
    <AppLayout variant="minimal">
      <Center mih="calc(100vh - 60px)">
        <Container size="sm" p="md">
          <Stack gap="xl" align="center" maw={400} mx="auto">
            {/* 브랜드 섹션 */}
            <Stack gap="lg" align="center">
              <Stack gap="xs" align="center">
                <Text size="lg" c="dimmed" ta="center">
                  간편한 회의실 예약, 이제 스트레스 받지 마세요.
                </Text>
              </Stack>
            
            {/* 기능 소개 */}
            <Stack gap="xs" align="center">
              <Text size="sm" c="dimmed">✓ 실시간 예약 현황 확인</Text>
              <Text size="sm" c="dimmed">✓ 간편한 원클릭 예약</Text>
              <Text size="sm" c="dimmed">✓ 스마트한 알림 시스템</Text>
            </Stack>
          </Stack>

          {/* 액션 버튼들 */}
          <Stack gap="sm" w="100%">
            <Button 
              component={Link} 
              href="/login" 
              size="lg" 
              fullWidth
              leftSection={<LogIn size={16} />}
            >
              로그인
            </Button>
            
            <Button 
              component={Link} 
              href="/signup" 
              variant="outline" 
              size="lg" 
              fullWidth
              leftSection={<UserPlus size={16} />}
            >
              계정 만들기
            </Button>
          </Stack>

          {/* 둘러보기 링크 */}
          <Stack gap="sm" align="center" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Text size="xs" c="dimmed" ta="center">
              로그인 없이도 전체 현황을 확인할 수 있습니다
            </Text>
            <Anchor 
              component={Link} 
              href="/reservations/status" 
              c="blue" 
              size="sm"
              fw={500}
            >
              <Group gap="xs" justify="center">
                <Clock size={14} />
                <Text>전체 예약 현황 둘러보기</Text>
                <ArrowRight size={14} />
              </Group>
            </Anchor>
          </Stack>
        </Stack>
      </Container>
    </Center>
    </AppLayout>
  );
}