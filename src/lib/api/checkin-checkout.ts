/**
 * Check-in/Check-out API Client
 * 서버 API 라우트 호출을 위한 클라이언트 라이브러리
 */

import type { 
  CheckInResponse, 
  CheckOutResponse, 
  ReservationStatusResponse,
  AutomationResult,
  RoomUsageStatistics,
  NoShowReservation,
  RoomStatusData,
  CronJobStatus
} from '@/types/database';

/**
 * 예약 체크인 처리
 */
export async function checkInReservation(reservationId: string): Promise<CheckInResponse> {
  try {
    const response = await fetch('/api/reservations/checkin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservation_id: reservationId }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Check-in error:', data);
      return {
        success: false,
        error: data.error || 'Check-in failed',
        code: data.code || 'REQUEST_FAILED'
      };
    }

    return data as CheckInResponse;
  } catch (error) {
    console.error('Check-in request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'REQUEST_FAILED'
    };
  }
}

/**
 * 예약 체크아웃 처리
 */
export async function checkOutReservation(reservationId: string): Promise<CheckOutResponse> {
  try {
    const response = await fetch('/api/reservations/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservation_id: reservationId }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Check-out error:', data);
      return {
        success: false,
        error: data.error || 'Check-out failed',
        code: data.code || 'REQUEST_FAILED'
      };
    }

    return data as CheckOutResponse;
  } catch (error) {
    console.error('Check-out request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'REQUEST_FAILED'
    };
  }
}

/**
 * 예약의 체크인/체크아웃 상태 조회
 */
export async function getReservationStatus(reservationId: string): Promise<ReservationStatusResponse> {
  try {
    const response = await fetch(`/api/reservations/status?reservation_id=${reservationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Status check error:', data);
      return {
        success: false,
        error: data.error || 'Status check failed',
        code: data.code || 'REQUEST_FAILED'
      };
    }

    return data as ReservationStatusResponse;
  } catch (error) {
    console.error('Status check request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'REQUEST_FAILED'
    };
  }
}

/**
 * 실시간 회의실 상태 조회
 */
export async function getCurrentRoomStatus(): Promise<RoomStatusData[]> {
  // 현재는 서버 API 라우트가 없으므로 빈 배열 반환
  // 나중에 /api/rooms/status 라우트 구현 필요
  return [];
}

/**
 * 회의실 사용률 통계 조회 (관리자 전용)
 */
export async function getRoomUsageStatistics(): Promise<RoomUsageStatistics[]> {
  try {
    const response = await fetch('/api/admin/room-usage-statistics', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Room usage statistics error:', data);
      return [];
    }

    return data;
  } catch (error) {
    console.error('Room usage statistics request failed:', error);
    return [];
  }
}

/**
 * No-Show 예약 목록 조회 (관리자 전용)
 */
export async function getNoShowReservations(): Promise<NoShowReservation[]> {
  try {
    const response = await fetch('/api/admin/no-show-reservations', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('No-show reservations error:', data);
      return [];
    }

    return data;
  } catch (error) {
    console.error('No-show reservations request failed:', error);
    return [];
  }
}

/**
 * 자동화 작업 수동 실행 (관리자 전용)
 */
export async function runAutomationManually(): Promise<AutomationResult> {
  // 현재는 서버 API 라우트가 없으므로 더미 데이터 반환
  // 나중에 /api/admin/run-automation 라우트 구현 필요
  return {
    execution_time: new Date().toISOString(),
    overtime_updated: 0,
    no_shows_marked: 0,
    auto_checkouts: 0,
    total_processed: 0,
    success: true
  };
}

/**
 * Cron 작업 상태 조회 (관리자 전용)
 */
export async function getCronJobsStatus(): Promise<CronJobStatus[]> {
  // 현재는 서버 API 라우트가 없으므로 빈 배열 반환
  // 나중에 /api/admin/cron-status 라우트 구현 필요
  return [];
}

// 실시간 구독 기능은 나중에 필요할 때 추가
// 현재는 폴링 방식으로 상태 업데이트

/**
 * 에러 코드별 사용자 친화적 메시지 변환
 */
export function getErrorMessage(code: string, defaultMessage: string): string {
  const errorMessages: Record<string, string> = {
    'AUTH_REQUIRED': '로그인이 필요합니다.',
    'NOT_FOUND': '예약을 찾을 수 없거나 접근 권한이 없습니다.',
    'INVALID_STATUS': '현재 예약 상태에서는 이 작업을 수행할 수 없습니다.',
    'TOO_EARLY': '체크인은 예약 시작 30분 전부터 가능합니다.',
    'EXPIRED': '체크인 시간이 만료되었습니다 (시작 후 30분).',
    'DATA_INTEGRITY_ERROR': '데이터 오류가 발생했습니다. 관리자에게 문의하세요.',
    'RPC_ERROR': '서버 오류가 발생했습니다.',
    'REQUEST_FAILED': '요청 처리 중 오류가 발생했습니다.'
  };

  return errorMessages[code] || defaultMessage;
}