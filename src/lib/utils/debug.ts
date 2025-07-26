/**
 * 개발 환경에서 사용자 ID 매핑 상태를 확인하는 디버깅 유틸리티
 */

import { logger } from './logger';
import type { UserProfile } from '@/types/auth';
import type { ReservationWithDetails } from '@/types/database';

export interface UserIdMappingDebugInfo {
  userProfile: {
    authId: string;
    dbId: string;
    email: string;
    employeeId: string;
  };
  reservation?: {
    id: string;
    user_id: string;
    title: string;
  };
  mapping: {
    // ✅ 비교 로직을 dbId 기준으로 변경
    reservationUserIdMatchesDbId: boolean;
    reservationUserIdMatchesAuthId: boolean;
  };
  issues: string[];
}

/**
 * 사용자 ID 매핑 상태를 분석하고 디버깅 정보를 출력
 */
export async function debugUserIdMapping(
  userProfile: UserProfile, 
  reservation?: ReservationWithDetails
): Promise<UserIdMappingDebugInfo> {
  const debugInfo: UserIdMappingDebugInfo = {
    userProfile: {
      authId: userProfile.authId,
      dbId: userProfile.dbId, // dbId 로깅 추가
      email: userProfile.email,
      employeeId: userProfile.employeeId || '',
    },
    reservation: reservation ? {
      id: reservation.id,
      user_id: reservation.user_id,
      title: reservation.title,
    } : undefined,
    mapping: {
      // ✅ [수정] 비교 로직을 dbId 기준으로 변경
      reservationUserIdMatchesDbId: reservation ? reservation.user_id === userProfile.dbId : false,
      reservationUserIdMatchesAuthId: reservation ? reservation.user_id === userProfile.authId : false,
    },
    issues: []
  };

  // 문제점 분석
  if (reservation) {
    if (!debugInfo.mapping.reservationUserIdMatchesDbId) {
      // 🚨 가장 중요한 체크: 예약의 소유자 ID(user_id)와 사용자 프로필의 DB ID(dbId)가 일치해야 합니다.
      debugInfo.issues.push('🚨 예약의 user_id와 UserProfile의 dbId가 일치하지 않습니다! (가장 중요한 체크)');
    }
    
    if (debugInfo.mapping.reservationUserIdMatchesAuthId) {
      // 이것은 보통 문제가 됩니다. user_id는 dbId여야 하기 때문입니다.
      debugInfo.issues.push('⚠️ 예약의 user_id가 UserProfile의 authId와 일치합니다. (보통 dbId와 일치해야 함)');
    }
  }

  // 개발 환경에서만 콘솔에 출력
  const nodeEnv = await import('@/lib/security/secure-environment-access')
    .then(({ getPublicEnvVar }) => getPublicEnvVar('NODE_ENV', 'debug-utils'))
    .catch(() => 'production');
  
  if (nodeEnv === 'development') {
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
export async function debugPermissionCheck(
  action: 'edit' | 'cancel',
  userProfile: UserProfile,
  reservation: ReservationWithDetails,
  result: boolean
) {
  // ✅ [수정] user 객체에서 id 필드 제거, dbId 추가
  const debugInfo = {
    action,
    user: {
      authId: userProfile.authId,
      dbId: userProfile.dbId, // dbId 로깅 추가
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
      // ✅ [수정] isOwner 체크를 dbId 기준으로 변경
      isOwner: reservation.user_id === userProfile.dbId,
      isOwnerByAuthId: reservation.user_id === userProfile.authId, // 참고용으로 유지
      isAdmin: userProfile.role === 'admin',
      isNotCancelled: reservation.status !== 'cancelled',
    },
    result,
  };


  const nodeEnv = await import('@/lib/security/secure-environment-access')
    .then(({ getPublicEnvVar }) => getPublicEnvVar('NODE_ENV', 'debug-utils'))
    .catch(() => 'production');
  
  if (nodeEnv === 'development') {
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
export async function debugApiCall(
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

  const nodeEnv = await import('@/lib/security/secure-environment-access')
    .then(({ getPublicEnvVar }) => getPublicEnvVar('NODE_ENV', 'debug-utils'))
    .catch(() => 'production');
  
  if (nodeEnv === 'development') {
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