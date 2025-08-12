/**
 * 알림 히스토리 조회 훅
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

interface NotificationHistoryParams {
  limit?: number;
  offset?: number;
  status?: 'sent' | 'failed' | 'pending_retry';
  type?: string;
}

interface NotificationHistoryItem {
  id: string;
  notification_type: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'pending_retry';
  error_message?: string;
  retry_count: number;
  reservations: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    rooms: {
      name: string;
    };
  };
}

interface NotificationHistoryResponse {
  notifications: NotificationHistoryItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  stats: {
    total: number;
    sent: number;
    failed: number;
    pending_retry: number;
  };
  filters: {
    status?: string;
    type: string;
  };
}

export function useNotificationHistory(params: NotificationHistoryParams = {}) {
  const [filters, setFilters] = useState({
    status: params.status,
    type: params.type || 'checkin_reminder'
  });

  const [pagination, setPagination] = useState({
    limit: params.limit || 20,
    offset: params.offset || 0
  });

  const queryKey = ['notification-history', filters, pagination];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<NotificationHistoryResponse> => {
      const searchParams = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        type: filters.type
      });

      if (filters.status) {
        searchParams.append('status', filters.status);
      }

      const response = await fetch(`/api/notifications/history?${searchParams}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '알림 히스토리 조회에 실패했습니다');
      }

      return response.json();
    },
    staleTime: 30000, // 30초
    refetchInterval: 60000, // 1분마다 자동 갱신
    retry: 2
  });

  const loadMore = () => {
    if (query.data?.pagination.hasMore) {
      setPagination(prev => ({
        ...prev,
        offset: prev.offset + prev.limit
      }));
    }
  };

  const refresh = () => {
    setPagination(prev => ({ ...prev, offset: 0 }));
    query.refetch();
  };

  const updateFilters = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, offset: 0 })); // 필터 변경 시 첫 페이지로
  };

  return {
    // 데이터
    notifications: query.data?.notifications || [],
    stats: query.data?.stats,
    pagination: query.data?.pagination,
    
    // 상태
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    
    // 액션
    loadMore,
    refresh,
    updateFilters,
    
    // 현재 필터
    filters,
    
    // 유틸리티
    hasMore: query.data?.pagination.hasMore || false,
    isEmpty: !query.isLoading && (!query.data?.notifications.length)
  };
}

/**
 * 관리자용 알림 통계 훅
 */
export function useNotificationStats(days: number = 7) {
  return useQuery({
    queryKey: ['notification-stats', days],
    queryFn: async () => {
      const response = await fetch(`/api/admin/notification-stats?days=${days}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '통계 조회에 실패했습니다');
      }

      return response.json();
    },
    staleTime: 60000, // 1분
    refetchInterval: 300000, // 5분마다 자동 갱신
    retry: 2
  });
}