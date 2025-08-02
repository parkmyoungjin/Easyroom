/**
 * 예약 권한 검증 유틸리티
 */

import type { UserProfile } from '@/types/auth';
import type { ReservationWithDetails } from '@/types/database';
import { logger } from './logger';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  details: {
    isOwnerByDbId: boolean;
    isOwnerByAuthId: boolean;
    isAdmin: boolean;
    isNotCancelled: boolean;
    userDbId?: string;
    userAuthId: string;
    reservationUserId: string;
  };
}

/**
 * 예약 수정 권한을 확인합니다
 */
export function canEditReservation(
  reservation: ReservationWithDetails,
  user: UserProfile
): PermissionCheckResult {
  const details = {
    isOwnerByDbId: !!(user.dbId && reservation.user_id === user.dbId),
    isOwnerByAuthId: reservation.user_id === user.authId,
    isAdmin: user.role === 'admin',
    isNotCancelled: reservation.status !== 'cancelled',
    userDbId: user.dbId,
    userAuthId: user.authId,
    reservationUserId: reservation.user_id,
  };

  const isOwner = details.isOwnerByDbId || details.isOwnerByAuthId;
  const hasPermission = (isOwner || details.isAdmin) && details.isNotCancelled;

  let reason: string | undefined;
  if (!hasPermission) {
    if (!details.isNotCancelled) {
      reason = 'reservation_cancelled';
    } else if (!isOwner && !details.isAdmin) {
      reason = 'not_owner_or_admin';
    }
  }

  const result: PermissionCheckResult = {
    allowed: hasPermission,
    reason,
    details,
  };

  logger.debug('예약 수정 권한 검증', {
    reservationId: reservation.id,
    userId: user.authId,
    result,
  });

  return result;
}

/**
 * 예약 취소 권한을 확인합니다
 */
export function canCancelReservation(
  reservation: ReservationWithDetails,
  user: UserProfile
): PermissionCheckResult {
  const details = {
    isOwnerByDbId: !!(user.dbId && reservation.user_id === user.dbId),
    isOwnerByAuthId: reservation.user_id === user.authId,
    isAdmin: user.role === 'admin',
    isNotCancelled: reservation.status !== 'cancelled',
    userDbId: user.dbId,
    userAuthId: user.authId,
    reservationUserId: reservation.user_id,
  };

  const isOwner = details.isOwnerByDbId || details.isOwnerByAuthId;
  const hasPermission = (isOwner || details.isAdmin) && details.isNotCancelled;

  // 취소는 시작 시간 10분 전까지만 가능
  const startTime = new Date(reservation.start_time);
  const now = new Date();
  const timeDiff = startTime.getTime() - now.getTime();
  const minutesDiff = Math.floor(timeDiff / (1000 * 60));
  const canCancelByTime = minutesDiff >= 10;

  let reason: string | undefined;
  if (!hasPermission) {
    if (!details.isNotCancelled) {
      reason = 'reservation_cancelled';
    } else if (!isOwner && !details.isAdmin) {
      reason = 'not_owner_or_admin';
    }
  } else if (!canCancelByTime) {
    reason = 'too_close_to_start_time';
  }

  const result: PermissionCheckResult = {
    allowed: hasPermission && canCancelByTime,
    reason,
    details: {
      ...details,
      minutesUntilStart: minutesDiff,
      canCancelByTime,
    } as any,
  };

  logger.debug('예약 취소 권한 검증', {
    reservationId: reservation.id,
    userId: user.authId,
    minutesUntilStart: minutesDiff,
    result,
  });

  return result;
}

/**
 * 권한 오류에 대한 사용자 친화적인 메시지를 반환합니다
 */
export function getPermissionErrorMessage(
  action: 'edit' | 'cancel',
  reason: string
): { title: string; description: string } {
  const messages = {
    edit: {
      not_owner_or_admin: {
        title: '접근 권한이 없습니다',
        description: '본인의 예약만 수정할 수 있습니다.',
      },
      reservation_cancelled: {
        title: '수정할 수 없습니다',
        description: '취소된 예약은 수정할 수 없습니다.',
      },
    },
    cancel: {
      not_owner_or_admin: {
        title: '취소 권한이 없습니다',
        description: '본인의 예약만 취소할 수 있습니다.',
      },
      reservation_cancelled: {
        title: '이미 취소됨',
        description: '이미 취소된 예약입니다.',
      },
      too_close_to_start_time: {
        title: '취소 불가',
        description: '회의 시작 10분 전부터는 취소할 수 없습니다.',
      },
    },
  } as const;

  const actionMessages = messages[action];
  const message = actionMessages[reason as keyof typeof actionMessages];
  
  return message || {
    title: `${action === 'edit' ? '수정' : '취소'} 실패`,
    description: '권한이 없거나 처리할 수 없는 상태입니다.',
  };
}

/**
 * 관리자 권한을 확인합니다
 */
export function isAdmin(user: UserProfile): boolean {
  return user.role === 'admin';
}

/**
 * 사용자가 예약의 소유자인지 확인합니다
 */
export function isReservationOwner(
  reservation: ReservationWithDetails,
  user: UserProfile
): boolean {
  const isOwnerByDbId = !!(user.dbId && reservation.user_id === user.dbId);
  const isOwnerByAuthId = reservation.user_id === user.authId;
  return isOwnerByDbId || isOwnerByAuthId;
}

/**
 * 예약의 user_id를 올바른 사용자 DB ID로 수정합니다
 * 이 함수는 Auth ID로 저장된 잘못된 user_id를 수정하기 위해 사용됩니다
 */
export async function fixReservationUserId(
  reservationId: string,
  correctDbId: string
): Promise<boolean> {
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('reservations')
      .update({ user_id: correctDbId })
      .eq('id', reservationId);

    if (error) {
      logger.error('예약 user_id 수정 실패', {
        reservationId,
        correctDbId,
        error: error.message
      });
      return false;
    }

    logger.debug('예약 user_id 수정 성공', {
      reservationId,
      correctDbId
    });
    return true;
  } catch (error) {
    logger.error('예약 user_id 수정 중 오류', {
      reservationId,
      correctDbId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}