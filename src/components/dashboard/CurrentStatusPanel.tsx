'use client';

import { Card, Text, Progress, Group, Stack, Badge, ThemeIcon } from '@mantine/core';
import { Clock, Users, Calendar, CheckCircle } from 'lucide-react';
import { format, differenceInMinutes, isAfter, isBefore } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { PublicReservation } from '@/types/database';

interface CurrentStatusPanelProps {
    currentReservation: PublicReservation | null;
    nextReservation: PublicReservation | null;
    now: Date;
}

export default function CurrentStatusPanel({
    currentReservation,
    nextReservation,
    now
}: CurrentStatusPanelProps) {
    // 현재 진행 중인 회의가 있는 경우
    if (currentReservation) {
        const startTime = new Date(currentReservation.start_time);
        const endTime = new Date(currentReservation.end_time);
        const totalDuration = differenceInMinutes(endTime, startTime);
        const elapsed = differenceInMinutes(now, startTime);
        const remaining = differenceInMinutes(endTime, now);
        const progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));

        return (
            <Card withBorder h="100%" className="bg-gradient-to-br from-red-50 to-red-100">
                <Stack gap="lg" h="100%">
                    {/* 상태 헤더 */}
                    <Group gap="sm">
                        <ThemeIcon size="lg" color="red" variant="light">
                            <Users size={20} />
                        </ThemeIcon>
                        <div>
                            <Text size="xl" fw={700} c="red">사용 중</Text>
                            <Text size="sm" c="dimmed">회의가 진행 중입니다</Text>
                        </div>
                    </Group>

                    {/* 회의 정보 */}
                    <Card withBorder className="bg-white/70">
                        <Stack gap="sm">
                            <Text size="lg" fw={600} lineClamp={2}>
                                {currentReservation.title}
                            </Text>

                            <Group gap="xs">
                                <Calendar size={16} />
                                <Text size="sm" c="dimmed">
                                    {format(startTime, 'HH:mm', { locale: ko })} - {format(endTime, 'HH:mm', { locale: ko })}
                                </Text>
                            </Group>

                            <Group gap="xs">
                                <Users size={16} />
                                <Text size="sm" c="dimmed">
                                    {currentReservation.department} · {currentReservation.user_name}
                                </Text>
                            </Group>

                            {currentReservation.room_name && (
                                <Badge variant="light" color="blue">
                                    {currentReservation.room_name}
                                </Badge>
                            )}
                        </Stack>
                    </Card>

                    {/* 진행률 */}
                    <div>
                        <Group justify="space-between" mb="xs">
                            <Text size="sm" fw={500}>진행률</Text>
                            <Text size="sm" c="dimmed">{Math.round(progress)}%</Text>
                        </Group>
                        <Progress value={progress} color="red" size="lg" />
                        <Group justify="space-between" mt="xs">
                            <Text size="xs" c="dimmed">
                                경과: {elapsed}분
                            </Text>
                            <Text size="xs" c="dimmed">
                                남은 시간: {remaining}분
                            </Text>
                        </Group>
                    </div>

                    {/* 다음 예약 미리보기 */}
                    {nextReservation && (
                        <Card withBorder className="bg-blue-50/50">
                            <Text size="sm" fw={500} mb="xs">다음 예약</Text>
                            <Text size="sm" lineClamp={1}>{nextReservation.title}</Text>
                            <Text size="xs" c="dimmed">
                                {format(new Date(nextReservation.start_time), 'HH:mm', { locale: ko })} 시작
                            </Text>
                        </Card>
                    )}
                </Stack>
            </Card>
        );
    }

    // 사용 가능한 상태
    return (
        <Card withBorder h="100%" className="bg-gradient-to-br from-green-50 to-green-100">
            <Stack gap="lg" h="100%" justify="center">
                {/* 상태 헤더 */}
                <Group gap="sm" justify="center">
                    <ThemeIcon size="xl" color="green" variant="light">
                        <CheckCircle size={24} />
                    </ThemeIcon>
                    <div className="text-center">
                        <Text size="xl" fw={700} c="green">사용 가능</Text>
                        <Text size="sm" c="dimmed">현재 진행 중인 회의가 없습니다</Text>
                    </div>
                </Group>

                {/* 현재 시간 */}
                <Card withBorder className="bg-white/70">
                    <div className="text-center">
                        <Text size="lg" fw={600} mb="xs">현재 시간</Text>
                        <Text size="xl" fw={700} c="blue">
                            {format(now, 'HH:mm:ss', { locale: ko })}
                        </Text>
                        <Text size="sm" c="dimmed">
                            {format(now, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
                        </Text>
                    </div>
                </Card>

                {/* 다음 예약 정보 */}
                {nextReservation ? (
                    <Card withBorder className="bg-blue-50/50">
                        <Stack gap="sm">
                            <Group gap="xs">
                                <Clock size={16} />
                                <Text size="sm" fw={500}>다음 예약</Text>
                            </Group>

                            <Text size="md" fw={600} lineClamp={2}>
                                {nextReservation.title}
                            </Text>

                            <Group gap="xs">
                                <Calendar size={14} />
                                <Text size="sm" c="dimmed">
                                    {format(new Date(nextReservation.start_time), 'HH:mm', { locale: ko })} 시작
                                </Text>
                            </Group>

                            <Group gap="xs">
                                <Users size={14} />
                                <Text size="sm" c="dimmed">
                                    {nextReservation.department} · {nextReservation.user_name}
                                </Text>
                            </Group>

                            {nextReservation.room_name && (
                                <Badge variant="light" color="blue" size="sm">
                                    {nextReservation.room_name}
                                </Badge>
                            )}

                            <div className="text-center mt-2">
                                <Text size="lg" fw={700} c="blue">
                                    {differenceInMinutes(new Date(nextReservation.start_time), now)}분 후
                                </Text>
                                <Text size="xs" c="dimmed">시작까지 남은 시간</Text>
                            </div>
                        </Stack>
                    </Card>
                ) : (
                    <Card withBorder className="bg-gray-50/50">
                        <div className="text-center">
                            <Text size="sm" c="dimmed">오늘 더 이상 예약이 없습니다</Text>
                            <Text size="xs" c="dimmed" mt="xs">편안한 하루 되세요!</Text>
                        </div>
                    </Card>
                )}
            </Stack>
        </Card>
    );
}