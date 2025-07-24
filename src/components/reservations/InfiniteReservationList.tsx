"use client";

import { useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, Loader2, AlertCircle } from 'lucide-react';
import { useInfinitePublicReservations, useFlattenedReservations } from '@/hooks/useInfinitePublicReservations';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { logger } from '@/lib/utils/logger';
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
      <div className="space-y-4">
        {[...Array(skeletonCount)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/3"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
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
      <Card className={className}>
        <CardContent className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">예약 목록을 불러올 수 없습니다</h3>
          <p className="text-muted-foreground mb-4">
            {isNetworkError 
              ? '네트워크 연결을 확인해주세요' 
              : isServerError 
                ? '서버에 일시적인 문제가 발생했습니다' 
                : error instanceof Error 
                  ? error.message 
                  : '알 수 없는 오류가 발생했습니다'
            }
          </p>
          <div className="space-x-2">
            <Button onClick={() => refetch()} variant="outline">
              다시 시도
            </Button>
            {reservations.length > 0 && (
              <Button 
                onClick={() => window.location.reload()} 
                variant="ghost"
                size="sm"
              >
                페이지 새로고침
              </Button>
            )}
          </div>
        </CardContent>
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
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">예약이 없습니다</h3>
          <p className="text-muted-foreground">
            선택한 기간에 예약된 회의실이 없습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header with total count */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">예약 목록</h2>
        <Badge variant="secondary">
          총 {totalCount}개 중 {reservations.length}개 표시
        </Badge>
      </div>

      {/* Reservation list */}
      <div className="space-y-4">
        {reservations.map((reservation, index) => (
          <ReservationCard
            key={`${reservation.id}-${index}`}
            reservation={reservation}
          />
        ))}
      </div>

      {/* Load more trigger with enhanced UX */}
      <div ref={loadMoreRef} className="mt-6">
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-muted-foreground">
              더 많은 예약을 불러오는 중... ({reservations.length}/{totalCount})
            </span>
          </div>
        )}

        {hasNextPage && !isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              className="w-full max-w-xs"
              disabled={isFetchingNextPage}
            >
              더 보기 ({totalCount - reservations.length}개 남음)
            </Button>
          </div>
        )}

        {!hasNextPage && reservations.length > 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>모든 예약을 불러왔습니다 (총 {totalCount}개)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Individual reservation card component
function ReservationCard({
  reservation
}: {
  reservation: PublicReservation | PublicReservationAnonymous;
}) {
  const isAuthenticated = 'user_id' in reservation;
  const isMyReservation = reservation.is_mine;

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${
      isMyReservation ? 'ring-2 ring-primary/20 bg-primary/5' : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {reservation.title}
              {isMyReservation && (
                <Badge variant="default" className="text-xs">
                  내 예약
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {'room_name' in reservation ? reservation.room_name : '회의실'}
            </CardDescription>
          </div>
          <Badge variant="secondary">
            확정됨
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Time information */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {format(new Date(reservation.start_time), 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })}
              {' ~ '}
              {format(new Date(reservation.end_time), 'HH:mm', { locale: ko })}
            </span>
          </div>

          {/* Purpose (only for authenticated users and their own reservations) */}
          {isAuthenticated && 'purpose' in reservation && reservation.purpose && isMyReservation && (
            <div className="text-sm">
              <span className="font-medium">목적: </span>
              <span className="text-muted-foreground">{reservation.purpose}</span>
            </div>
          )}

          {/* User information (only for authenticated users) */}
          {isAuthenticated && 'user_name' in reservation && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              <span className="text-muted-foreground">
                {'department' in reservation && reservation.department && (
                  <span>{reservation.department} / </span>
                )}
                {isMyReservation ? '나' : reservation.user_name}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default InfiniteReservationList;