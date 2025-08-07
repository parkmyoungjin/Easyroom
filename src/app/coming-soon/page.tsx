'use client';

import AppLayout from '@/components/layout/AppLayout';
import {
  Container,
  Stack,
  Paper,
  Group,
  ThemeIcon,
  Title,
  Text,
  Button,
  Progress,
  Badge
} from '@mantine/core';
import { Wrench, ArrowLeft, Sparkles, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ComingSoonPage() {
  const router = useRouter();

  const features = [
    { name: '고급 분석 대시보드', progress: 75, status: '개발중' },
    { name: '실시간 알림 시스템', progress: 60, status: '설계중' },
    { name: '모바일 앱 연동', progress: 30, status: '계획중' },
    { name: 'AI 추천 시스템', progress: 15, status: '연구중' },
  ];

  return (
    <AppLayout>
      <Container my="xl" size="md">
        <Stack gap="xl">
          {/* 헤더 섹션 */}
          <Paper
            p="xl"
            radius="xl"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white'
            }}
          >
            <Group align="center" gap="md">
              <ThemeIcon size="lg" radius="xl" color="white" variant="light" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Wrench size={24} />
              </ThemeIcon>
              <Stack gap={4}>
                <Title order={2} c="white">
                  새로운 기능 개발중
                </Title>
                <Text c="rgba(255,255,255,0.8)" size="sm">
                  더 나은 서비스를 위해 열심히 개발하고 있습니다
                </Text>
              </Stack>
            </Group>
          </Paper>

          {/* 메인 콘텐츠 */}
          <Paper p="xl" radius="lg" withBorder>
            <Stack gap="lg" align="center">
              <ThemeIcon size={80} radius="xl" color="orange" variant="light">
                <Sparkles size={40} />
              </ThemeIcon>
              
              <Stack gap="md" align="center">
                <Title order={3} ta="center">
                  곧 만나보실 수 있습니다!
                </Title>
                <Text ta="center" c="dimmed" size="lg">
                  사용자 경험을 향상시킬 새로운 기능들을 준비하고 있습니다.
                  조금만 기다려주세요!
                </Text>
              </Stack>

              {/* 개발 진행 상황 */}
              <Stack gap="md" w="100%" mt="lg">
                <Group align="center" gap="sm">
                  <Clock size={18} />
                  <Title order={4}>개발 진행 상황</Title>
                </Group>
                
                {features.map((feature, index) => (
                  <Paper key={index} p="md" radius="md" withBorder>
                    <Stack gap="xs">
                      <Group justify="space-between" align="center">
                        <Text fw={500}>{feature.name}</Text>
                        <Badge 
                          color={
                            feature.status === '개발중' ? 'blue' :
                            feature.status === '설계중' ? 'green' :
                            feature.status === '계획중' ? 'orange' : 'gray'
                          }
                          variant="light"
                          size="sm"
                        >
                          {feature.status}
                        </Badge>
                      </Group>
                      <Progress 
                        value={feature.progress} 
                        color={
                          feature.progress >= 70 ? 'blue' :
                          feature.progress >= 40 ? 'green' :
                          feature.progress >= 20 ? 'orange' : 'gray'
                        }
                        size="sm"
                        radius="xl"
                      />
                      <Text size="xs" c="dimmed">
                        {feature.progress}% 완료
                      </Text>
                    </Stack>
                  </Paper>
                ))}
              </Stack>

              {/* 뒤로가기 버튼 */}
              <Button
                leftSection={<ArrowLeft size={16} />}
                variant="light"
                color="orange"
                size="md"
                radius="xl"
                onClick={() => router.back()}
                mt="lg"
              >
                이전 페이지로 돌아가기
              </Button>
            </Stack>
          </Paper>

          {/* 추가 정보 */}
          <Paper p="lg" radius="lg" style={{ background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)' }}>
            <Stack gap="sm" align="center">
              <Text size="sm" c="dimmed" ta="center">
                💡 새로운 기능에 대한 아이디어나 제안이 있으시면 언제든 알려주세요!
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                더 나은 EasyRoom을 만들어가겠습니다.
              </Text>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </AppLayout>
  );
}