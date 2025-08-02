/**
 * Enhanced fixReservationUserId Function and Related Utilities
 * Provides comprehensive data repair operations with logging, backup, and rollback
 * Requirements: 4.2, 4.3
 */

import { logger } from '@/lib/utils/logger';
import { UserIdGuards } from '@/lib/security/user-id-guards';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Configuration for fix operations
 */
export interface FixOperationConfig {
  dryRun?: boolean;
  createBackup?: boolean;
  enableRollback?: boolean;
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Result of a fix operation
 */
export interface FixOperationResult {
  success: boolean;
  reservationId: string;
  originalUserId: string;
  correctedUserId?: string;
  userName?: string;
  reservationTitle?: string;
  error?: string;
  timestamp: string;
  backupId?: string;
}

/**
 * Batch fix operation result
 */
export interface BatchFixResult {
  totalProcessed: number;
  successfulFixes: number;
  failures: number;
  results: FixOperationResult[];
  backupId?: string;
  rollbackAvailable: boolean;
  timestamp: string;
}

/**
 * Backup record for rollback operations
 */
export interface ReservationBackup {
  id: string;
  reservationId: string;
  originalData: any;
  timestamp: string;
  operation: string;
}

/**
 * Enhanced fixReservationUserId function with comprehensive error handling
 */
export class ReservationUserIdFixer {
  private config: Required<FixOperationConfig>;
  private backups: Map<string, ReservationBackup> = new Map();

  constructor(config: FixOperationConfig = {}) {
    this.config = {
      dryRun: config.dryRun ?? false,
      createBackup: config.createBackup ?? true,
      enableRollback: config.enableRollback ?? true,
      batchSize: config.batchSize ?? 10,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000
    };
  }

  /**
   * Create backup of reservation before modification
   */
  private async createReservationBackup(supabase: TypedSupabaseClient, reservationId: string, operation: string): Promise<string | null> {
    if (!this.config.createBackup) {
      return null;
    }

    try {
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (error || !reservation) {
        logger.error('Failed to create backup - reservation not found', {
          reservationId,
          error: error?.message
        });
        return null;
      }

      const backupId = `backup_${reservationId}_${Date.now()}`;
      const backup: ReservationBackup = {
        id: backupId,
        reservationId,
        originalData: reservation,
        timestamp: new Date().toISOString(),
        operation
      };

      this.backups.set(backupId, backup);

      logger.debug('Reservation backup created', {
        backupId,
        reservationId,
        operation
      });

      return backupId;

    } catch (error) {
      logger.error('Failed to create reservation backup', {
        reservationId,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Validate that user_id correction is needed and safe
   */
  private async validateFixOperation(supabase: TypedSupabaseClient, reservationId: string): Promise<{
    needsFix: boolean;
    currentUserId: string;
    correctedUserId?: string;
    userName?: string;
    reservationTitle?: string;
    error?: string;
  }> {
    try {
      // Get current reservation data
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .select('id, user_id, title')
        .eq('id', reservationId)
        .single();

      if (reservationError || !reservation) {
        return {
          needsFix: false,
          currentUserId: '',
          error: `Reservation not found: ${reservationError?.message || 'Unknown error'}`
        };
      }

      // Validate current user_id
      const validation = await UserIdGuards.validateUserIdClient(supabase, reservation.user_id);
      
      if (validation.isValid) {
        return {
          needsFix: false,
          currentUserId: reservation.user_id,
          reservationTitle: reservation.title
        };
      }

      if (!validation.correctedUserId) {
        return {
          needsFix: false,
          currentUserId: reservation.user_id,
          reservationTitle: reservation.title,
          error: `Cannot fix reservation: ${validation.error}`
        };
      }

      // Get user information for logging
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('name')
        .eq('id', validation.correctedUserId)
        .single();

      return {
        needsFix: true,
        currentUserId: reservation.user_id,
        correctedUserId: validation.correctedUserId,
        userName: user?.name || 'Unknown User',
        reservationTitle: reservation.title
      };

    } catch (error) {
      return {
        needsFix: false,
        currentUserId: '',
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Fix a single reservation's user_id with retry logic
   */
  public async fixSingleReservation(supabase: TypedSupabaseClient, reservationId: string): Promise<FixOperationResult> {
    const startTime = new Date().toISOString();
    
    logger.info('Starting reservation user_id fix', {
      reservationId,
      dryRun: this.config.dryRun
    });

    try {
      // Validate the fix operation
      const validation = await this.validateFixOperation(supabase, reservationId);
      
      if (validation.error) {
        return {
          success: false,
          reservationId,
          originalUserId: validation.currentUserId,
          error: validation.error,
          timestamp: startTime
        };
      }

      if (!validation.needsFix) {
        return {
          success: true,
          reservationId,
          originalUserId: validation.currentUserId,
          reservationTitle: validation.reservationTitle,
          error: 'No fix needed - user_id is already correct',
          timestamp: startTime
        };
      }

      // Create backup before making changes
      const backupId = await this.createReservationBackup(supabase, reservationId, 'fix_user_id') || undefined;

      // Perform the fix (with retry logic)
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        try {
          if (this.config.dryRun) {
            logger.info('DRY RUN: Would fix reservation user_id', {
              reservationId,
              from: validation.currentUserId,
              to: validation.correctedUserId,
              userName: validation.userName,
              title: validation.reservationTitle
            });

            return {
              success: true,
              reservationId,
              originalUserId: validation.currentUserId,
              correctedUserId: validation.correctedUserId,
              userName: validation.userName,
              reservationTitle: validation.reservationTitle,
              timestamp: startTime,
              backupId
            };
          }

          // Perform actual update
          const { error: updateError } = await supabase
            .from('reservations')
            .update({ 
              user_id: validation.correctedUserId,
              updated_at: new Date().toISOString()
            })
            .eq('id', reservationId);

          if (updateError) {
            throw updateError;
          }

          // Success
          logger.info('Reservation user_id fixed successfully', {
            reservationId,
            originalUserId: validation.currentUserId,
            correctedUserId: validation.correctedUserId,
            userName: validation.userName,
            title: validation.reservationTitle,
            attempt
          });

          return {
            success: true,
            reservationId,
            originalUserId: validation.currentUserId,
            correctedUserId: validation.correctedUserId,
            userName: validation.userName,
            reservationTitle: validation.reservationTitle,
            timestamp: startTime,
            backupId
          };

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt < this.config.maxRetries) {
            logger.warn(`Fix attempt ${attempt} failed, retrying...`, {
              reservationId,
              error: lastError.message,
              nextAttemptIn: this.config.retryDelay
            });
            
            await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          }
        }
      }

      // All attempts failed
      logger.error('All fix attempts failed', {
        reservationId,
        attempts: this.config.maxRetries,
        lastError: lastError?.message
      });

      return {
        success: false,
        reservationId,
        originalUserId: validation.currentUserId,
        userName: validation.userName,
        reservationTitle: validation.reservationTitle,
        error: `Fix failed after ${this.config.maxRetries} attempts: ${lastError?.message}`,
        timestamp: startTime,
        backupId
      };

    } catch (error) {
      logger.error('Unexpected error during reservation fix', {
        reservationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        reservationId,
        originalUserId: '',
        error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: startTime
      };
    }
  }

  /**
   * Fix multiple reservations in batches
   */
  public async fixMultipleReservations(supabase: TypedSupabaseClient, reservationIds: string[]): Promise<BatchFixResult> {
    const startTime = new Date().toISOString();
    const results: FixOperationResult[] = [];
    let successfulFixes = 0;
    let failures = 0;

    logger.info('Starting batch reservation user_id fix', {
      totalReservations: reservationIds.length,
      batchSize: this.config.batchSize,
      dryRun: this.config.dryRun
    });

    // Process in batches
    for (let i = 0; i < reservationIds.length; i += this.config.batchSize) {
      const batch = reservationIds.slice(i, i + this.config.batchSize);
      const batchNumber = Math.floor(i / this.config.batchSize) + 1;
      const totalBatches = Math.ceil(reservationIds.length / this.config.batchSize);

      logger.debug(`Processing batch ${batchNumber}/${totalBatches}`, {
        batchSize: batch.length,
        reservationIds: batch
      });

      // Process batch in parallel
      const batchPromises = batch.map(id => this.fixSingleReservation(supabase, id));
      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.success) {
            successfulFixes++;
          } else {
            failures++;
          }
        } else {
          const reservationId = batch[index];
          results.push({
            success: false,
            reservationId,
            originalUserId: '',
            error: `Promise rejected: ${result.reason}`,
            timestamp: new Date().toISOString()
          });
          failures++;
        }
      });

      // Brief pause between batches
      if (i + this.config.batchSize < reservationIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const batchResult: BatchFixResult = {
      totalProcessed: reservationIds.length,
      successfulFixes,
      failures,
      results,
      rollbackAvailable: this.config.enableRollback && this.backups.size > 0,
      timestamp: startTime
    };

    logger.info('Batch reservation fix completed', {
      totalProcessed: batchResult.totalProcessed,
      successfulFixes: batchResult.successfulFixes,
      failures: batchResult.failures,
      rollbackAvailable: batchResult.rollbackAvailable
    });

    return batchResult;
  }

  /**
   * Rollback a single reservation fix
   */
  public async rollbackReservationFix(supabase: TypedSupabaseClient, backupId: string): Promise<boolean> {
    if (!this.config.enableRollback) {
      logger.warn('Rollback attempted but rollback is disabled');
      return false;
    }

    const backup = this.backups.get(backupId);
    if (!backup) {
      logger.error('Backup not found for rollback', { backupId });
      return false;
    }

    try {
      logger.info('Rolling back reservation fix', {
        backupId,
        reservationId: backup.reservationId
      });
      const { error } = await supabase
        .from('reservations')
        .update(backup.originalData)
        .eq('id', backup.reservationId);

      if (error) {
        logger.error('Rollback failed', {
          backupId,
          reservationId: backup.reservationId,
          error: error.message
        });
        return false;
      }

      logger.info('Rollback completed successfully', {
        backupId,
        reservationId: backup.reservationId
      });

      // Remove backup after successful rollback
      this.backups.delete(backupId);
      return true;

    } catch (error) {
      logger.error('Unexpected error during rollback', {
        backupId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Get all available backups
   */
  public getAvailableBackups(): ReservationBackup[] {
    return Array.from(this.backups.values());
  }

  /**
   * Clear all backups
   */
  public clearBackups(): void {
    this.backups.clear();
    logger.debug('All backups cleared');
  }

  /**
   * Validate data integrity after fix operations
   */
  public async validateDataIntegrity(supabase: TypedSupabaseClient, reservationIds: string[]): Promise<{
    valid: boolean;
    issues: Array<{ reservationId: string; issue: string }>;
  }> {
    const issues: Array<{ reservationId: string; issue: string }> = [];

    for (const reservationId of reservationIds) {
      try {
        const { data: reservation, error } = await supabase
          .from('reservations')
          .select('id, user_id, title')
          .eq('id', reservationId)
          .single();

        if (error || !reservation) {
          issues.push({
            reservationId,
            issue: `Reservation not found: ${error?.message || 'Unknown error'}`
          });
          continue;
        }

        const validation = await UserIdGuards.validateUserIdClient(supabase, reservation.user_id);
        if (!validation.isValid) {
          issues.push({
            reservationId,
            issue: `Invalid user_id: ${validation.error}`
          });
        }

      } catch (error) {
        issues.push({
          reservationId,
          issue: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

/**
 * Convenience function for fixing a single reservation
 */
export async function fixReservationUserId(
  supabase: TypedSupabaseClient,
  reservationId: string, 
  config: FixOperationConfig = {}
): Promise<FixOperationResult> {
  const fixer = new ReservationUserIdFixer(config);
  return await fixer.fixSingleReservation(supabase, reservationId);
}

/**
 * Convenience function for batch fixing reservations
 */
export async function fixMultipleReservationUserIds(
  supabase: TypedSupabaseClient,
  reservationIds: string[],
  config: FixOperationConfig = {}
): Promise<BatchFixResult> {
  const fixer = new ReservationUserIdFixer(config);
  return await fixer.fixMultipleReservations(supabase, reservationIds);
}

/**
 * Find all reservations that need user_id fixes
 */
export async function findReservationsNeedingFix(supabase: TypedSupabaseClient): Promise<string[]> {
  try {
    logger.info('Searching for reservations needing user_id fixes');

    // Get all users for mapping
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, auth_id');

    if (usersError) {
      logger.error('Failed to fetch users for fix detection', usersError);
      return [];
    }

    const validUserIds = new Set(users.map(u => u.id));
    const authIdToDbId = new Map(users.map(u => [u.auth_id, u.id]));

    // Get all reservations
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, user_id');

    if (reservationsError) {
      logger.error('Failed to fetch reservations for fix detection', reservationsError);
      return [];
    }

    const needingFix: string[] = [];

    reservations.forEach(reservation => {
      if (!validUserIds.has(reservation.user_id)) {
        // Check if it's an auth_id that can be corrected
        if (authIdToDbId.has(reservation.user_id)) {
          needingFix.push(reservation.id);
        }
      }
    });

    logger.info('Found reservations needing user_id fixes', {
      totalReservations: reservations.length,
      needingFix: needingFix.length
    });

    return needingFix;

  } catch (error) {
    logger.error('Error finding reservations needing fix', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return [];
  }
}