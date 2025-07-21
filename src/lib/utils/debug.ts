/**
 * 개발 환경에서 사용자 ID 매핑 상태를 확인하는 디버깅 유틸리티
 */

import { logger } from './logger';
import type { UserProfile } from '@/types/auth';
import type { ReservationWithDetails } from '@/types/database';

export interface UserIdMappingDebugInfo {
  userProfile: {
    id: string;
    authId: string;
    email: string;
    employeeId: string;
  };
  reservation?: {
    id: string;
    user_id: string;
    title: string;
  };
  mapping: {
    profileIdMatchesAuthId: boolean;
    reservationUserIdMatchesProfileId: boolean;
    reservationUserIdMatchesAuthId: boolean;
  };
  issues: string[];
}

/**
 * 사용자 ID 매핑 상태를 분석하고 디버깅 정보를 출력
 */
export function debugUserIdMapping(
  userProfile: UserProfile, 
  reservation?: ReservationWithDetails
): UserIdMappingDebugInfo {
  const debugInfo: UserIdMappingDebugInfo = {
    userProfile: {
      id: userProfile.id,
      authId: userProfile.authId,
      email: userProfile.email,
      employeeId: userProfile.employeeId || '',
    },
    reservation: reservation ? {
      id: reservation.id,
      user_id: reservation.user_id,
      title: reservation.title,
    } : undefined,
    mapping: {
      profileIdMatchesAuthId: userProfile.id === userProfile.authId,
      reservationUserIdMatchesProfileId: reservation ? reservation.user_id === userProfile.id : false,
      reservationUserIdMatchesAuthId: reservation ? reservation.user_id === userProfile.authId : false,
    },
    issues: []
  };

  // 문제점 분석
  if (!debugInfo.mapping.profileIdMatchesAuthId) {
    debugInfo.issues.push('UserProfile.id와 UserProfile.authId가 일치하지 않음');
  }

  if (reservation) {
    if (!debugInfo.mapping.reservationUserIdMatchesProfileId) {
      debugInfo.issues.push('예약의 user_id와 UserProfile.id가 일치하지 않음');
    }
    
    if (!debugInfo.mapping.reservationUserIdMatchesAuthId) {
      debugInfo.issues.push('예약의 user_id와 UserProfile.authId가 일치하지 않음');
    }
  }

  // 개발 환경에서만 콘솔에 출력
  if (process.env.NODE_ENV === 'development') {
    console.group('🔍 사용자 ID 매핑 디버깅');
    console.log('사용자 정보:', debugInfo.userProfile);
    if (debugInfo.reservation) {
      console.log('예약 정보:', debugInfo.reservation);
    }
    console.log('매핑 상태:', debugInfo.mapping);
    if (debugInfo.issues.length > 0) {
      console.warn('발견된 문제점:', debugInfo.issues);
    } else {
      console.log('✅ ID 매핑 상태 정상');
    }
    console.groupEnd();
  }

  // 로거에도 기록
  logger.debug('사용자 ID 매핑 디버깅', debugInfo);

  return debugInfo;
}

/**
 * 권한 검증 과정을 시각화하는 디버깅 함수
 */
export function debugPermissionCheck(
  action: 'edit' | 'cancel',
  userProfile: UserProfile,
  reservation: ReservationWithDetails,
  result: boolean
) {
  const debugInfo = {
    action,
    user: {
      id: userProfile.id,
      authId: userProfile.authId,
      role: userProfile.role,
      email: userProfile.email,
    },
    reservation: {
      id: reservation.id,
      user_id: reservation.user_id,
      title: reservation.title,
      status: reservation.status,
    },
    checks: {
      isOwner: reservation.user_id === userProfile.id,
      isOwnerByAuthId: reservation.user_id === userProfile.authId,
      isAdmin: userProfile.role === 'admin',
      isNotCancelled: reservation.status !== 'cancelled',
    },
    result,
  };

  if (process.env.NODE_ENV === 'development') {
    console.group(`🔐 권한 검증 디버깅 - ${action.toUpperCase()}`);
    console.log('사용자:', debugInfo.user);
    console.log('예약:', debugInfo.reservation);
    console.log('검증 결과:', debugInfo.checks);
    console.log(`최종 결과: ${result ? '✅ 허용' : '❌ 거부'}`);
    console.groupEnd();
  }

  logger.debug('권한 검증 디버깅', debugInfo);

  return debugInfo;
}

/**
 * API 호출 상태를 추적하는 디버깅 함수
 */
export function debugApiCall(
  method: string,
  endpoint: string,
  payload?: any,
  response?: any,
  error?: any
) {
  const debugInfo = {
    method,
    endpoint,
    timestamp: new Date().toISOString(),
    payload: payload ? JSON.stringify(payload, null, 2) : null,
    response: response ? JSON.stringify(response, null, 2) : null,
    error: error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
    } : null,
  };

  if (process.env.NODE_ENV === 'development') {
    console.group(`🌐 API 호출 디버깅 - ${method} ${endpoint}`);
    console.log('시간:', debugInfo.timestamp);
    if (debugInfo.payload) {
      console.log('요청 데이터:', debugInfo.payload);
    }
    if (debugInfo.response) {
      console.log('응답 데이터:', debugInfo.response);
    }
    if (debugInfo.error) {
      console.error('오류:', debugInfo.error);
    }
    console.groupEnd();
  }

  logger.debug('API 호출 디버깅', debugInfo);

  return debugInfo;
}