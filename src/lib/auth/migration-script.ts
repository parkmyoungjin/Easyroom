'use client';

import { UniversalAuthStateManager } from '@/lib/auth/universal-auth-state-manager';
import { AuthState } from '@/types/auth-optimization';

// Legacy auth state interfaces for migration
interface LegacyAuthState {
  isAuthenticated?: boolean;
  user?: {
    id: string;
    email?: string;
  };
  token?: string;
  timestamp?: number;
}

interface MigrationResult {
  migrationPerformed: boolean;
  success: boolean;
  error?: string;
  migratedData?: AuthState;
  legacyDataFound?: boolean;
}

export class AuthMigrationScript {
  private static readonly LEGACY_KEYS = [
    'easyroom_auth',
    'easyroom_user',
    'easyroom_token',
    'auth_state',
    'user_session'
  ];
  
  private static readonly MIGRATION_LOG_KEY = 'easyroom_migration_log';
  private static readonly MIGRATION_VERSION = '2.0';
  
  private authStateManager: UniversalAuthStateManager;

  constructor() {
    this.authStateManager = UniversalAuthStateManager.getInstance();
  }

  /**
   * Performs one-time migration from legacy auth state to new format
   * This should be called on app startup
   */
  public async performMigration(): Promise<MigrationResult> {
    try {
      const migrationLog = this.getMigrationLog();
      
      // Skip if migration already performed for this version
      if (migrationLog.version === AuthMigrationScript.MIGRATION_VERSION) {
        console.log('[Migration] Migration already performed for version', AuthMigrationScript.MIGRATION_VERSION);
        return {
          migrationPerformed: false,
          success: true,
          legacyDataFound: false
        };
      }

      console.log('[Migration] Starting auth state migration...');
      
      // Check for existing new format state
      const existingState = this.authStateManager.getAuthState();
      if (existingState) {
        console.log('[Migration] New format auth state already exists, updating migration log only');
        this.updateMigrationLog(true, 'New format state already exists');
        return {
          migrationPerformed: true,
          success: true,
          legacyDataFound: false,
          migratedData: existingState
        };
      }

      // Look for legacy auth state
      const legacyState = this.detectLegacyAuthState();
      
      if (!legacyState) {
        console.log('[Migration] No legacy auth state found');
        this.updateMigrationLog(true, 'No legacy data found');
        return {
          migrationPerformed: true,
          success: true,
          legacyDataFound: false
        };
      }

      console.log('[Migration] Legacy auth state detected, migrating...');
      
      // Convert legacy state to new format
      const migratedState = this.convertLegacyState(legacyState);
      
      // Store migrated state
      this.authStateManager.setAuthState(migratedState);
      
      // Clean up legacy data
      this.cleanupLegacyData();
      
      // Update migration log
      this.updateMigrationLog(true, 'Successfully migrated legacy auth state');
      
      console.log('[Migration] Migration completed successfully');
      
      return {
        migrationPerformed: true,
        success: true,
        legacyDataFound: true,
        migratedData: migratedState
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown migration error';
      console.error('[Migration] Migration failed:', errorMessage);
      
      try {
        this.updateMigrationLog(false, errorMessage);
      } catch (logError) {
        console.warn('[Migration] Failed to update migration log after error:', logError);
      }
      
      return {
        migrationPerformed: true,
        success: false,
        error: errorMessage,
        legacyDataFound: true
      };
    }
  }

  /**
   * Detects legacy auth state from various possible storage keys
   */
  private detectLegacyAuthState(): LegacyAuthState | null {
    for (const key of AuthMigrationScript.LEGACY_KEYS) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          console.log('[Migration] Found legacy data in key:', key);
          
          // Try to parse as JSON
          try {
            const parsed = JSON.parse(stored);
            if (this.isValidLegacyState(parsed)) {
              return parsed;
            }
          } catch {
            // If not JSON, might be a simple token string
            if (key.includes('token') && typeof stored === 'string') {
              return { token: stored, timestamp: Date.now() };
            }
          }
        }
      } catch (error) {
        console.warn('[Migration] Error reading legacy key', key, ':', error);
      }
    }
    
    return null;
  }

  /**
   * Validates if an object looks like legacy auth state
   */
  private isValidLegacyState(obj: any): obj is LegacyAuthState {
    return obj && (
      typeof obj.isAuthenticated === 'boolean' ||
      (obj.user && typeof obj.user === 'object') ||
      (obj.token && typeof obj.token === 'string') ||
      (obj.timestamp && typeof obj.timestamp === 'number')
    );
  }

  /**
   * Converts legacy auth state to new format
   */
  private convertLegacyState(legacyState: LegacyAuthState): AuthState {
    const isAuthenticated = legacyState.isAuthenticated || 
                           !!(legacyState.user || legacyState.token);
    
    return {
      status: isAuthenticated ? 'authenticated' : 'unauthenticated',
      timestamp: legacyState.timestamp || Date.now(),
      userId: legacyState.user?.id,
      sessionToken: legacyState.token,
      source: 'internal' as const
    };
  }

  /**
   * Removes legacy auth data from localStorage
   */
  private cleanupLegacyData(): void {
    let cleanedCount = 0;
    
    for (const key of AuthMigrationScript.LEGACY_KEYS) {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) {
          localStorage.removeItem(key);
          cleanedCount++;
          console.log('[Migration] Cleaned up legacy key:', key);
        }
      } catch (error) {
        console.warn('[Migration] Failed to clean up legacy key', key, ':', error);
      }
    }
    
    console.log('[Migration] Cleaned up', cleanedCount, 'legacy storage keys');
  }

  /**
   * Gets migration log from localStorage
   */
  private getMigrationLog(): { version?: string; timestamp?: number; success?: boolean; message?: string } {
    try {
      const stored = localStorage.getItem(AuthMigrationScript.MIGRATION_LOG_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Updates migration log in localStorage
   */
  private updateMigrationLog(success: boolean, message: string): void {
    const logEntry = {
      version: AuthMigrationScript.MIGRATION_VERSION,
      timestamp: Date.now(),
      success,
      message
    };
    
    try {
      localStorage.setItem(AuthMigrationScript.MIGRATION_LOG_KEY, JSON.stringify(logEntry));
      console.log('[Migration] Updated migration log:', logEntry);
    } catch (error) {
      console.warn('[Migration] Failed to update migration log:', error);
    }
  }

  /**
   * Checks if migration is needed (for external use)
   */
  public static isMigrationNeeded(): boolean {
    try {
      const stored = localStorage.getItem(AuthMigrationScript.MIGRATION_LOG_KEY);
      const log = stored ? JSON.parse(stored) : {};
      return log.version !== AuthMigrationScript.MIGRATION_VERSION;
    } catch {
      return true; // Assume migration needed if we can't read the log
    }
  }

  /**
   * Gets migration status for debugging
   */
  public getMigrationStatus(): {
    version: string;
    migrationNeeded: boolean;
    lastMigration?: { timestamp: number; success: boolean; message: string };
  } {
    const log = this.getMigrationLog();
    
    return {
      version: AuthMigrationScript.MIGRATION_VERSION,
      migrationNeeded: AuthMigrationScript.isMigrationNeeded(),
      lastMigration: log.timestamp ? {
        timestamp: log.timestamp,
        success: log.success || false,
        message: log.message || 'No message'
      } : undefined
    };
  }
}

/**
 * Convenience function to run migration on app startup
 * This should be called early in the app initialization
 */
export async function runStartupMigration(): Promise<MigrationResult> {
  const migrationScript = new AuthMigrationScript();
  return await migrationScript.performMigration();
}