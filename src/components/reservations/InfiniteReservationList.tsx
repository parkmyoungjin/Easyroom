"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { Card, Text, Group, Stack, Button, Badge } from '@mantine/core';
import { Calendar, Clock, MapPin, User, Loader2, AlertCircle } from 'lucide-react';
import { useInfinitePublicReservations, useFlattenedReservations } from '@/hooks/useInfinitePublicReservations';
import { ko } from 'date-fns/locale';
import { logger } from '@/lib/utils/logger';
import { formatDateTime, formatTime } from '@/lib/utils/date';
import type { PublicReservation, PublicReservationAnonymous } from '@/types/database';

interface InfiniteReservationListProps {
  startDate: string;
  endDate: string;
  limit?: number;
  className?: string;
}

export function InfiniteReservationList({
  startDate,
  endDate,
  limit = 20,
  className = ""
}: InfiniteReservationListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data: reservations,
    totalCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    isError,
    error,
    refetch
  } = useFlattenedReservations(startDate, endDate, { limit });

  // Intersection Observer for infinite scrolling with performance optimization
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && !isLoading) {
        logger.debug('Loading more reservations via intersection observer', {
          intersectionRatio: entry.intersectionRatio,
          boundingClientRect: entry.boundingClientRect,
          hasNextPage,
          isFetchingNextPage,
          currentCount: reservations.length,
          totalCount
        });
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, isLoading, reservations.length, totalCount]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '200px', // Start loading 200px before the element comes into view for better UX
      threshold: 0.1,
    });

    const currentRef = loadMoreRef.current;
    if (currentRef && hasNextPage && !isError) {
      observer.observe(currentRef);
      logger.debug('Intersection observer attached', {
        hasNextPage,
        isFetchingNextPage,
        totalCount,
        currentCount: reservations.length
      });
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
        logger.debug('Intersection observer detached');
      }
    };
  }, [handleIntersection, hasNextPage, isError, reservations.length, totalCount, isFetchingNextPage]);

  // Manual load more function (fallback) with error handling
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      logger.debug('Loading more reservations via manual trigger', {
        hasNextPage,
        isFetchingNextPage,
        currentCount: reservations.length,
        totalCount
      });
      fetchNextPage().catch((error) => {
        logger.error('Failed to fetch next page manually', {
          error: error instanceof Error ? error.message : error,
          currentCount: reservations.length,
          totalCount
        });
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, reservations.length, totalCount]);

  // Loading skeleton with dynamic count based on limit
  const LoadingSkeleton = () => {
    const skeletonCount = Math.min(limit, 5); // Show up to 5 skeleton items
    return (
      <Stack gap="md">
        {[...Array(skeletonCount)].map((_, i) => (
          <Card key={i} shadow="sm" padding="lg" radius="md" withBorder style={{ animation: 'pulse 2s infinite' }}>
            <Stack gap="sm">
              <div style={{ height: '16px', backgroundColor: 'var(--mantine-color-gray-3)', borderRadius: '4px', width: '33%' }}></div>
              <div style={{ height: '12px', backgroundColor: 'var(--mantine-color-gray-3)', borderRadius: '4px', width: '50%' }}></div>
            </Stack>
            <Stack gap="xs" mt="md">
              <div style={{ height: '12px', backgroundColor: 'var(--mantine-color-gray-3)', borderRadius: '4px', width: '100%' }}></div>
              <div style={{ height: '12px', backgroundColor: 'var(--mantine-color-gray-3)', borderRadius: '4px', width: '75%' }}></div>
            </Stack>
          </Card>
        ))}
      </Stack>
    );
  };

  // Error state with enhanced error handling
  if (isError) {
    logger.error('Infinite reservation list error', {
      error: error instanceof Error ? error.message : error,
      startDate,
      endDate,
      limit,
      totalCount,
      currentCount: reservations.length
    });
    
    const isNetworkError = error instanceof Error && 
      (error.message.includes('fetch') || error.message.includes('Network'));
    const isServerError = error instanceof Error && 
      error.message.includes('HTTP 5');
    
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder style={{ textAlign: 'center', paddingTop: '2rem', paddingBottom: '2rem' }}>
        <Stack align="center" gap="md">
          <AlertCircle style={{ margin: '0 auto', height: '48px', width: '48px', color: 'var(--mantine-color-red-6)', marginBottom: '16px' }} />
          <Text size="lg" fw={500} c="dark">예약 목록을 불러올 수 없습니다</Text>
          <Text size="sm" c="dimmed">
            {isNetworkError 
              ? '네트워크 연결을 확인해주세요' 
              : isServerError 
                ? '서버에 일시적인 문제가 발생했습니다' 
                : error instanceof Error 
                  ? error.message 
                  : '알 수 없는 오류가 발생했습니다'
            }
          </Text>
          <Group gap="sm">
            <Button onClick={() => refetch()} variant="outline">
              다시 시도
            </Button>
            {reservations.length > 0 && (
              <Button 
                onClick={() => window.location.reload()} 
                variant="subtle"
                size="sm"
              >
                페이지 새로고침
              </Button>
            )}
          </Group>
        </Stack>
      </Card>
    );
  }

  // Initial loading state
  if (isLoading) {
    return (
      <div className={className}>
        <LoadingSkeleton />
      </div>
    );
  }

  // Empty state
  if (reservations.length === 0) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder style={{ textAlign: 'center', paddingTop: '2rem', paddingBottom: '2rem' }}>
        <Stack align="center" gap="md">
          <Calendar style={{ margin: '0 auto', height: '48px', width: '48px', color: 'var(--mantine-color-gray-6)', marginBottom: '16px' }} />
          <Text size="lg" fw={500} c="dark">예약이 없습니다</Text>
          <Text size="sm" c="dimmed">
            선택한 기간에 예약된 회의실이 없습니다.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header with total count */}
      <Group justify="space-between" align="center" mb="md">
        <Text size="xl" fw={600}>예약 목록</Text>
        <Badge variant="light" color="gray">
          총 {totalCount}개 중 {reservations.length}개 표시
        </Badge>
      </Group>

      {/* Reservation list */}
      <Stack gap="md">
        {reservations.map((reservation, index) => (
          <ReservationCard
            key={`${reservation.id}-${index}`}
            reservation={reservation}
          />
        ))}
      </Stack>

      {/* Load more trigger with enhanced UX */}
      <div ref={loadMoreRef} style={{ marginTop: '24px' }}>
        {isFetchingNextPage && (
          <Group justify="center" align="center" py="md">
            <Loader2 style={{ height: '24px', width: '24px', animation: 'spin 1s linear infinite', marginRight: '8px' }} />
            <Text size="sm" c="dimmed">
              더 많은 예약을 불러오는 중... ({reservations.length}/{totalCount})
            </Text>
          </Group>
        )}

        {hasNextPage && !isFetchingNextPage && (
          <Group justify="center" py="md">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              style={{ width: '100%', maxWidth: '300px' }}
              disabled={isFetchingNextPage}
            >
              더 보기 ({totalCount - reservations.length}개 남음)
            </Button>
          </Group>
        )}

        {!hasNextPage && reservations.length > 0 && (
          <Group justify="center" py="md">
            <Group align="center" gap="xs">
              <Calendar style={{ height: '16px', width: '16px' }} />
              <Text size="sm" c="dimmed">모든 예약을 불러왔습니다 (총 {totalCount}개)</Text>
            </Group>
          </Group>
        )}
      </div>
    </div>
  );
}

// Individual reservation card component
const ReservationCard = React.memo(function ReservationCard({
  reservation
}: {
  reservation: PublicReservation | PublicReservationAnonymous;
}) {
  // 렌더링 추적을 위한 로그 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development') {
    console.log(`Rendering ReservationCard: ${reservation.id}`);
  }

  const isAuthenticated = 'user_id' in reservation;
  const isMyReservation = reservation.is_mine;

  return (
    <Card 
      shadow="sm" 
      padding="lg" 
      radius="md" 
      withBorder
      style={{ 
        transition: 'all 0.2s ease',
        backgroundColor: isMyReservation ? 'var(--mantine-color-blue-0)' : undefined,
        borderColor: isMyReservation ? 'var(--mantine-color-blue-3)' : undefined
      }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Group gap="sm">
              <Text size="lg" fw={500} c="dark">{reservation.title}</Text>
              {isMyReservation && (
                <Badge variant="filled" size="xs">
                  내 예약
                </Badge>
              )}
            </Group>
            <Group gap="xs">
              <MapPin className="h-4 w-4" />
              <Text size="sm" c="dimmed">
                {'room_name' in reservation ? reservation.room_name : '회의실'}
              </Text>
            </Group>
          </Stack>
          <Badge variant="light">
            확정됨
          </Badge>
        </Group>
        
        <Stack gap="sm">
          {/* Time information */}
          <Group gap="xs">
            <Clock className="h-4 w-4" />
            <Text size="sm" c="dimmed">
              {formatDateTime(reservation.start_time, 'yyyy년 MM월 dd일 (EEE) HH:mm')}
              {' ~ '}
              {formatTime(reservation.end_time, 'HH:mm')}
            </Text>
          </Group>

          {/* Purpose (only for authenticated users and their own reservations) */}
          {isAuthenticated && 'purpose' in reservation && reservation.purpose && isMyReservation && (
            <Text size="sm">
              <Text component="span" fw={500}>목적: </Text>
              <Text component="span" c="dimmed">{reservation.purpose}</Text>
            </Text>
          )}

          {/* User information (only for authenticated users) */}
          {isAuthenticated && 'user_name' in reservation && (
            <Group gap="xs">
              <User className="h-4 w-4" />
              <Text size="sm" c="dimmed">
                {'department' in reservation && reservation.department && (
                  <Text component="span">{reservation.department} / </Text>
                )}
                {isMyReservation ? '나' : reservation.user_name}
              </Text>
            </Group>
          )}
        </Stack>
      </Stack>
    </Card>
  );
});

ReservationCard.displayName = 'ReservationCard';

export default InfiniteReservationList;