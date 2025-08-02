import "server-only";

import { createClient as createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { isValidUUID, type UserIdValidationResult } from '@/lib/security/user-id-guards';

/**
 * Server-side user ID validation
 * This file contains server-only functions for user ID validation
 * Requirements: 4.3
 */

/**
 * Validate user_id against database (server-side only)
 */
export async function validateUserIdServer(userId: string): Promise<UserIdValidationResult> {
  try {
    if (!isValidUUID(userId)) {
      return {
        isValid: false,
        error: 'Invalid UUID format for user_id'
      };
    }

    const supabaseServer = createServerClient();

    // Check if user_id exists in users table
    const { data: user, error } = await supabaseServer
      .from('users')
      .select('id, auth_id, name, email')
      .eq('id', userId)
      .single();

    if (error) {
      // Check if it might be an auth_id instead
      const { data: userByAuthId, error: authError } = await supabaseServer
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
    logger.error('Server user ID validation failed', error instanceof Error ? error : new Error(String(error)));
    return {
      isValid: false,
      userId,
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Get correct database user_id from auth_id (server-side only)
 */
export async function getCorrectUserIdFromAuthIdServer(authId: string): Promise<string | null> {
  try {
    if (!isValidUUID(authId)) {
      logger.warn('Invalid auth_id format provided', { authId });
      return null;
    }

    const supabaseServer = createServerClient();

    const { data: user, error } = await supabaseServer
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
    logger.error('Failed to get correct user_id from auth_id (server)', {
      authId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}