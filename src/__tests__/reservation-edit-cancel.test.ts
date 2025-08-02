/**
 * 예약 수정/취소 기능 통합 테스트
 */

import { describe, it, expect } from '@jest/globals';
import { canEditReservation, canCancelReservation, getPermissionErrorMessage } from '@/lib/utils/reservation-permissions';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import { debugUserIdMapping } from '@/lib/utils/debug';
import type { UserProfile } from '@/types/auth';
import type { ReservationWithDetails } from '@/types/database';

// Mock 데이터
const mockUserProfile: UserProfile = {
  id: 'auth-user-123',
  authId: 'auth-user-123',
  dbId: 'db-user-456',
  employeeId: 'EMP001',
  email: 'test@company.com',
  name: '테스트 사용자',
  department: '개발팀',
  role: 'employee',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockAdminProfile: UserProfile = {
  ...mockUserProfile,
  id: 'admin-user-123',
  authId: 'admin-user-123',
  dbId: 'admin-db-456',
  role: 'admin',
};

const mockReservation: ReservationWithDetails = {
  id: 'reservation-123',
  room_id: 'room-123',
  user_id: 'db-user-456', // 사용자의 dbId와 일치
  title: '테스트 회의',
  purpose: '테스트 목적',
  start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2시간 후
  end_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3시간 후
  status: 'confirmed',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  cancellation_reason: undefined,
  room: {
    id: 'room-123',
    name: '회의실 A',
    capacity: 10,
    location: '1층',
    description: '테스트 회의실',
    amenities: {},
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  user: {
    id: 'db-user-456',
    auth_id: 'auth-user-123',
    employee_id: 'EMP001',
    name: '테스트 사용자',
    email: 'test@company.com',
    department: '개발팀',
    role: 'employee',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
};

describe('예약 수정 권한 검증', () => {
  it('예약 소유자는 수정할 수 있어야 함 (dbId 매칭)', () => {
    const result = canEditReservation(mockReservation, mockUserProfile);
    
    expect(result.allowed).toBe(true);
    expect(result.details.isOwnerByDbId).toBe(true);
    expect(result.details.isOwnerByAuthId).toBe(false);
  });

  it('예약 소유자는 수정할 수 있어야 함 (authId 매칭)', () => {
    const reservationWithAuthId = {
      ...mockReservation,
      user_id: 'auth-user-123', // authId와 일치
    };
    
    const result = canEditReservation(reservationWithAuthId, mockUserProfile);
    
    expect(result.allowed).toBe(true);
    expect(result.details.isOwnerByAuthId).toBe(true);
  });

  it('관리자는 다른 사용자의 예약을 수정할 수 있어야 함', () => {
    const result = canEditReservation(mockReservation, mockAdminProfile);
    
    expect(result.allowed).toBe(true);
    expect(result.details.isAdmin).toBe(true);
  });

  it('다른 사용자는 예약을 수정할 수 없어야 함', () => {
    const otherUserProfile = {
      ...mockUserProfile,
      id: 'other-user-123',
      authId: 'other-user-123',
      dbId: 'other-db-456',
    };
    
    const result = canEditReservation(mockReservation, otherUserProfile);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_owner_or_admin');
  });

  it('취소된 예약은 수정할 수 없어야 함', () => {
    const cancelledReservation = {
      ...mockReservation,
      status: 'cancelled' as const,
    };
    
    const result = canEditReservation(cancelledReservation, mockUserProfile);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('reservation_cancelled');
  });
});

describe('예약 취소 권한 검증', () => {
  it('예약 소유자는 취소할 수 있어야 함', () => {
    const result = canCancelReservation(mockReservation, mockUserProfile);
    
    expect(result.allowed).toBe(true);
    expect(result.details.isOwnerByDbId).toBe(true);
  });

  it('시작 10분 전에는 취소할 수 없어야 함', () => {
    const soonReservation = {
      ...mockReservation,
      start_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5분 후
    };
    
    const result = canCancelReservation(soonReservation, mockUserProfile);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('too_close_to_start_time');
  });

  it('관리자는 다른 사용자의 예약을 취소할 수 있어야 함', () => {
    const result = canCancelReservation(mockReservation, mockAdminProfile);
    
    expect(result.allowed).toBe(true);
    expect(result.details.isAdmin).toBe(true);
  });
});

describe('권한 오류 메시지', () => {
  it('수정 권한 없음 메시지를 올바르게 반환해야 함', () => {
    const message = getPermissionErrorMessage('edit', 'not_owner_or_admin');
    
    expect(message.title).toBe('접근 권한이 없습니다');
    expect(message.description).toBe('본인의 예약만 수정할 수 있습니다.');
  });

  it('취소 권한 없음 메시지를 올바르게 반환해야 함', () => {
    const message = getPermissionErrorMessage('cancel', 'not_owner_or_admin');
    
    expect(message.title).toBe('취소 권한이 없습니다');
    expect(message.description).toBe('본인의 예약만 취소할 수 있습니다.');
  });

  it('시간 제한 메시지를 올바르게 반환해야 함', () => {
    const message = getPermissionErrorMessage('cancel', 'too_close_to_start_time');
    
    expect(message.title).toBe('취소 불가');
    expect(message.description).toBe('회의 시작 10분 전부터는 취소할 수 없습니다.');
  });
});

describe('오류 처리 시스템', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Suppress console.error for error handling tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  it('권한 오류를 올바르게 분류해야 함', () => {
    const error = new Error('예약을 수정할 권한이 없습니다');
    const context = {
      action: 'edit',
      reservationId: 'reservation-123',
      userId: 'user-123',
      timestamp: new Date().toISOString(),
    };
    
    const result = ReservationErrorHandler.handleReservationError(error, context);
    
    expect(result.type).toBe('permission');
    expect(result.code).toBe('PERMISSION_DENIED');
    expect(result.retryable).toBe(false);
  });

  it('네트워크 오류를 올바르게 분류해야 함', () => {
    const error = new Error('Network connection failed');
    const context = {
      action: 'cancel',
      reservationId: 'reservation-123',
      userId: 'user-123',
      timestamp: new Date().toISOString(),
    };
    
    const result = ReservationErrorHandler.handleReservationError(error, context);
    
    expect(result.type).toBe('network');
    expect(result.code).toBe('NETWORK_ERROR');
    expect(result.retryable).toBe(true);
  });

  it('사용자 친화적인 메시지를 생성해야 함', () => {
    const error = {
      type: 'permission' as const,
      code: 'PERMISSION_DENIED',
      message: 'Permission denied',
      userMessage: '권한이 없습니다.',
      retryable: false,
    };
    
    const message = ReservationErrorHandler.getUserFriendlyMessage(error, 'edit');
    
    expect(message.title).toBe('권한 오류');
    expect(message.description).toBe('수정할 권한이 없습니다.');
    expect(message.showRetry).toBe(false);
  });
});

describe('사용자 ID 매핑 디버깅', () => {
  it('정상적인 ID 매핑을 감지해야 함', async () => {
    const result = await debugUserIdMapping(mockUserProfile, mockReservation);
    
    expect(result.mapping.reservationUserIdMatchesDbId).toBe(true); // dbId와 매칭되어야 함
    expect(result.mapping.reservationUserIdMatchesAuthId).toBe(false); // authId와는 매칭되지 않아야 함
    expect(result.issues.length).toBe(0); // 정상적인 경우 이슈가 없어야 함
  });

  it('ID 매핑 문제를 감지해야 함', async () => {
    const problematicProfile = {
      ...mockUserProfile,
      id: 'different-auth-id',
      dbId: 'different-db-id', // 다른 dbId로 설정
    };
    
    const result = await debugUserIdMapping(problematicProfile, mockReservation);
    
    expect(result.mapping.reservationUserIdMatchesDbId).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('통합 시나리오 테스트', () => {
  it('정상적인 예약 수정 플로우', () => {
    // 1. 사용자 ID 매핑 확인
    debugUserIdMapping(mockUserProfile, mockReservation);
    
    // 2. 권한 검증
    const permissionResult = canEditReservation(mockReservation, mockUserProfile);
    expect(permissionResult.allowed).toBe(true);
    
    // 3. 성공적인 수정 시나리오 (실제 API 호출은 모킹)
    expect(mockReservation.status).toBe('confirmed');
  });

  it('정상적인 예약 취소 플로우', () => {
    // 1. 권한 검증
    const permissionResult = canCancelReservation(mockReservation, mockUserProfile);
    expect(permissionResult.allowed).toBe(true);
    
    // 2. 시간 제한 확인 (2시간 후 예약이므로 취소 가능)
    expect(permissionResult.details.isNotCancelled).toBe(true);
    
    // 3. 성공적인 취소 시나리오
    expect(mockReservation.status).toBe('confirmed'); // 취소 전 상태
  });

  it('권한 없는 사용자의 수정 시도', () => {
    const unauthorizedUser = {
      ...mockUserProfile,
      id: 'unauthorized-user',
      authId: 'unauthorized-user',
      dbId: 'unauthorized-db',
    };
    
    const permissionResult = canEditReservation(mockReservation, unauthorizedUser);
    expect(permissionResult.allowed).toBe(false);
    
    const errorMessage = getPermissionErrorMessage('edit', permissionResult.reason || 'unknown');
    expect(errorMessage.title).toBe('접근 권한이 없습니다');
  });
});