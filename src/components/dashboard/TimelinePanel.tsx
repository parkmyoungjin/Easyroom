'use client';

import { useRef, useEffect } from 'react';
import { Card, Text, Timeline, Badge, Group, ScrollArea } from '@mantine/core';
import { Clock, Users, Calendar, CheckCircle, Play, Pause } from 'lucide-react';
import { format, isAfter, isBefore, isWithinInterval } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { PublicReservation } from '@/types/database';

interface TimelinePanelProps {
  upcomingReservations: PublicReservation[];
  now: Date;
}

export default function TimelinePanel({ upcomingReservations, now }: TimelinePanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLDivElement>(null);

  // 현재 진행 중이거나 가장 가까운 예약으로 자동 스크롤
  useEffect(() => {
    if (currentItemRef.current && scrollAreaRef.current) {
      // 부드러운 스크롤로 현재 항목을 중앙에 위치시킴
      currentItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [upcomingReservations, now]);

  // 예약 상태 판단 함수
  const getReservationStatus = (reservation: PublicReservation) => {
    const startTime = new Date(reservation.start_time);
    const endTime = new Date(reservation.end_time);

    if (isWithinInterval(now, { start: startTime, end: endTime })) {
      return 'current'; // 진행 중
    } else if (isAfter(now, endTime)) {
      return 'past'; // 종료됨
    } else {
      return 'upcoming'; // 예정됨
    }
  };

  // 현재 진행 중이거나 가장 가까운 다음 예약 찾기
  const findCurrentOrNextReservation = () => {
    const currentReservation = upcomingReservations.find(r => getReservationStatus(r) === 'current');
    if (currentReservation) return currentReservation;

    const upcomingOnly = upcomingReservations.filter(r => getReservationStatus(r) === 'upcoming');
    return upcomingOnly.length > 0 ? upcomingOnly[0] : null;
  };

  const currentOrNextReservation = findCurrentOrNextReservation();

  if (upcomingReservations.length === 0) {
    return (
      <Card withBorder h="100%">
        <Card.Section withBorder inheritPadding py="sm">
          <Group gap="xs">
            <Calendar size={20} />
            <Text fw={600}>오늘의 일정</Text>
          </Group>
        </Card.Section>
        
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <Text size="lg" fw={600} c="dimmed">오늘은 예약이 없습니다</Text>
            <Text size="sm" c="dimmed">편안한 하루 되세요!</Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card withBorder h="100%">
      <Card.Section withBorder inheritPadding py="sm">
        <Group gap="xs">
          <Calendar size={20} />
          <Text fw={600}>오늘의 일정</Text>
          <Badge variant="light" color="blue" size="sm">
            {upcomingReservations.length}개
          </Badge>
        </Group>
      </Card.Section>

      <Card.Section inheritPadding py="md" style={{ flex: 1 }}>
        <ScrollArea h="100%" ref={scrollAreaRef}>
          <Timeline active={-1} bulletSize={24} lineWidth={2}>
            {upcomingReservations.map((reservation, index) => {
              const status = getReservationStatus(reservation);
              const isCurrentOrNext = reservation.id === currentOrNextReservation?.id;
              
              // 상태별 색상과 아이콘 설정
              let color: string;
              let icon: React.ReactNode;
              
              switch (status) {
                case 'current':
                  color = 'red';
                  icon = <Play size={12} />;
                  break;
                case 'past':
                  color = 'gray';
                  icon = <CheckCircle size={12} />;
                  break;
                default:
                  color = 'blue';
                  icon = <Clock size={12} />;
              }

              return (
                <Timeline.Item
                  key={reservation.id}
                  bullet={icon}
                  color={color}
                  className={isCurrentOrNext ? 'ring-2 ring-blue-200 rounded-lg' : ''}
                >
                  <div 
                    ref={isCurrentOrNext ? currentItemRef : null}
                    className={`p-3 rounded-lg border ${
                      status === 'current' 
                        ? 'bg-red-50 border-red-200' 
                        : status === 'past'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    {/* 상태 배지 */}
                    <Group justify="space-between" mb="xs">
                      <Badge 
                        variant="light" 
                        color={color}
                        size="sm"
                      >
                        {status === 'current' ? '진행 중' : 
                         status === 'past' ? '종료됨' : '예정됨'}
                      </Badge>
                      
                      <Text size="xs" c="dimmed">
                        {format(new Date(reservation.start_time), 'HH:mm', { locale: ko })} - 
                        {format(new Date(reservation.end_time), 'HH:mm', { locale: ko })}
                      </Text>
                    </Group>

                    {/* 회의 제목 */}
                    <Text 
                      size="md" 
                      fw={600} 
                      mb="xs"
                      lineClamp={2}
                      c={status === 'past' ? 'dimmed' : undefined}
                    >
                      {reservation.title}
                    </Text>

                    {/* 회의 정보 */}
                    <Group gap="xs" mb="xs">
                      <Users size={14} />
                      <Text size="sm" c="dimmed">
                        {reservation.department} · {reservation.user_name}
                      </Text>
                    </Group>

                    {/* 회의실 정보 */}
                    {reservation.room_name && (
                      <Badge variant="outline" color={color} size="sm">
                        {reservation.room_name}
                      </Badge>
                    )}

                    {/* 설명 (있는 경우) */}
                    {reservation.purpose && (
                      <Text size="xs" c="dimmed" mt="xs" lineClamp={2}>
                        {reservation.purpose}
                      </Text>
                    )}
                  </div>
                </Timeline.Item>
              );
            })}
          </Timeline>
        </ScrollArea>
      </Card.Section>
    </Card>
  );
}