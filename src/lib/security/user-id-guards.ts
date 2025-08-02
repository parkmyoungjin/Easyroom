/**
 * User ID Type Guards and Validation
 * Ensures user_id always references public.users.id consistently
 * Requirements: 4.3
 */

import { logger } from '@/lib/utils/logger';
import type { ValidatedReservationData, Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Type definitions for user ID validation
 */
export interface UserIdValidationResult {
  isValid: boolean;
  userId?: string;
  authId?: string;
  error?: string;
  correctedUserId?: string;
}

export interface UserIdContext {
  authId: string;
  dbId: string;
  name: string;
  email: string;
}

/**
 * Type guard to check if a string is a valid UUID format
 */
export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard to ensure user_id references database users.id (not auth_id)
 */
export function isValidDatabaseUserId(userId: unknown): userId is string {
  return isValidUUID(userId);
}

/**
 * Type guard to check if user_id might be an auth_id instead of database id
 */
export function isPotentialAuthId(userId: string, userContext?: UserIdContext): boolean {
  if (!userContext) {
    return false;
  }
  
  return userId === userContext.authId && userId !== userContext.dbId;
}

/**
 * Validate user_id against database (client-side)
 */
export async function validateUserIdClient(supabase: TypedSupabaseClient, userId: string): Promise<UserIdValidationResult> {
  try {
    if (!isValidUUID(userId)) {
      return {
        isValid: false,
        error: 'Invalid UUID format for user_id'
      };
    }

    // Check if user_id exists in users table
    const { data: user, error } = await supabase
      .from('users')
      .select('id, auth_id, name, email')
      .eq('id', userId)
      .single();

    if (error) {
      // Check if it might be an auth_id instead
      const { data: userByAuthId, error: authError } = await supabase
        .from('users')
        .select('id, auth_id, name, email')
        .eq('auth_id', userId)
        .single();

      if (!authError && userByAuthId) {
        return {
          isValid: false,
          userId,
          authId: userByAuthId.auth_id,
          error: 'user_id appears to be auth_id instead of database id',
          correctedUserId: userByAuthId.id
        };
      }

      return {
        isValid: false,
        userId,
        error: 'user_id does not exist in users table'
      };
    }

    return {
      isValid: true,
      userId: user.id,
      authId: user.auth_id
    };

  } catch (error) {
    logger.error('User ID validation failed', error instanceof Error ? error : new Error(String(error)));
    return {
      isValid: false,
      userId,
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Validate user_id against database (server-side)
 * Note: This function should only be called from server-side code
 * This is a placeholder - actual implementation moved to server-only file
 */
export async function validateUserIdServer(userId: string): Promise<UserIdValidationResult> {
  // This function should not be called from client-side code
  // Use validateUserIdClient instead for client-side validation
  throw new Error('validateUserIdServer should only be called from server-side code. Use validateUserIdClient for client-side validation.');
}

/**
 * Get correct database user_id from auth_id
 */
export async function getCorrectUserIdFromAuthId(supabase: TypedSupabaseClient, authId: string): Promise<string | null> {
  try {
    if (!isValidUUID(authId)) {
      logger.warn('Invalid auth_id format provided', { authId });
      return null;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authId)
      .single();

    if (error || !user) {
      logger.warn('Could not find user for auth_id', { authId, error: error?.message });
      return null;
    }

    return user.id;

  } catch (error) {
    logger.error('Failed to get correct user_id from auth_id', {
      authId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Get current user's database ID from auth context
 */
export async function getCurrentUserDatabaseId(supabase: TypedSupabaseClient): Promise<string | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return await getCorrectUserIdFromAuthId(supabase, user.id);

  } catch (error) {
    logger.error('Failed to get current user database ID', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Strict type guard for reservation user_id validation
 */
export function assertValidReservationUserId(userId: unknown): asserts userId is string {
  if (!isValidDatabaseUserId(userId)) {
    throw new Error(`Invalid reservation user_id: ${userId}. Must be a valid UUID referencing users.id`);
  }
}



/**
 * Validate and sanitize reservation data before creation
 */
export async function validateReservationData(supabase: TypedSupabaseClient, data: any): Promise<ValidatedReservationData> {
  // Validate required fields
  if (!data.room_id || !isValidUUID(data.room_id)) {
    throw new Error('Invalid or missing room_id');
  }

  if (!data.user_id || !isValidUUID(data.user_id)) {
    throw new Error('Invalid or missing user_id');
  }

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    throw new Error('Invalid or missing title');
  }

  if (!data.start_time || !data.end_time) {
    throw new Error('Invalid or missing start_time or end_time');
  }

  // Validate user_id references correct database id
  const userValidation = await validateUserIdClient(supabase, data.user_id);
  if (!userValidation.isValid) {
    if (userValidation.correctedUserId) {
      logger.warn('Correcting auth_id to database id in reservation data', {
        originalUserId: data.user_id,
        correctedUserId: userValidation.correctedUserId
      });
      data.user_id = userValidation.correctedUserId;
    } else {
      throw new Error(`Invalid user_id: ${userValidation.error}`);
    }
  }

  // Return validated data
  return {
    room_id: data.room_id,
    user_id: data.user_id,
    title: data.title.trim(),
    purpose: data.purpose?.trim() || undefined,
    start_time: data.start_time,
    end_time: data.end_time,
    status: data.status || 'confirmed'
  };
}

/**
 * Validate user_id in reservation update data
 */
export async function validateReservationUpdateData(supabase: TypedSupabaseClient, data: any): Promise<Partial<ValidatedReservationData>> {
  const validatedData: Partial<ValidatedReservationData> = {};

  // Only validate fields that are being updated
  if (data.room_id !== undefined) {
    if (!isValidUUID(data.room_id)) {
      throw new Error('Invalid room_id format');
    }
    validatedData.room_id = data.room_id;
  }

  if (data.user_id !== undefined) {
    if (!isValidUUID(data.user_id)) {
      throw new Error('Invalid user_id format');
    }

    // Validate user_id references correct database id
    const userValidation = await validateUserIdClient(supabase, data.user_id);
    if (!userValidation.isValid) {
      if (userValidation.correctedUserId) {
        logger.warn('Correcting auth_id to database id in reservation update', {
          originalUserId: data.user_id,
          correctedUserId: userValidation.correctedUserId
        });
        validatedData.user_id = userValidation.correctedUserId;
      } else {
        throw new Error(`Invalid user_id: ${userValidation.error}`);
      }
    } else {
      validatedData.user_id = data.user_id;
    }
  }

  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new Error('Invalid title');
    }
    validatedData.title = data.title.trim();
  }

  if (data.purpose !== undefined) {
    validatedData.purpose = data.purpose?.trim() || undefined;
  }

  if (data.start_time !== undefined) {
    validatedData.start_time = data.start_time;
  }

  if (data.end_time !== undefined) {
    validatedData.end_time = data.end_time;
  }

  if (data.status !== undefined) {
    if (!['confirmed', 'cancelled'].includes(data.status)) {
      throw new Error('Invalid status value');
    }
    validatedData.status = data.status;
  }

  return validatedData;
}

/**
 * Export type guards and validation functions (client-side only)
 */
export const UserIdGuards = {
  isValidUUID,
  isValidDatabaseUserId,
  isPotentialAuthId,
  validateUserIdClient,
  getCorrectUserIdFromAuthId,
  getCurrentUserDatabaseId,
  assertValidReservationUserId,
  validateReservationData,
  validateReservationUpdateData
} as const;