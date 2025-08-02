/**
 * Automatic Session Management System
 * 
 * Handles automatic session refresh, expiration detection, and recovery
 */

import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { categorizeAuthError, authErrorRecoveryManager } from './error-handler';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface SessionManagerConfig {
  refreshThreshold: number; // Minutes before expiry to refresh
  maxRefreshAttempts: number;
  refreshRetryDelay: number; // Milliseconds
  onSessionRefreshed?: (session: Session) => void;
  onSessionExpired?: () => void;
  onRefreshFailed?: (error: Error) => void;
}

interface SessionStatus {
  isValid: boolean;
  expiresAt: Date | null;
  refreshToken: string | null;
  lastRefresh: Date | null;
  refreshAttempts: number;
  nextRefreshAt: Date | null;
}

// ============================================================================
// SESSION MANAGER CLASS
// ============================================================================

export class AuthSessionManager {
  private config: SessionManagerConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshAttempts = 0;
  private lastRefreshAttempt: Date | null = null;
  private isRefreshing = false;

  constructor(config: Partial<SessionManagerConfig> = {}) {
    this.config = {
      refreshThreshold: 5, // 5 minutes before expiry
      maxRefreshAttempts: 3,
      refreshRetryDelay: 2000, // 2 seconds
      ...config
    };
  }

  /**
   * Start monitoring a session for automatic refresh
   */
  startMonitoring(supabase: SupabaseClient, session: Session | null): void {
    this.stopMonitoring(); // Clear any existing monitoring

    if (!session || !session.expires_at) {
      console.log('[SessionManager] No valid session to monitor');
      return;
    }

    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const refreshThresholdMs = this.config.refreshThreshold * 60 * 1000;

    console.log('[SessionManager] Starting session monitoring:', {
      expiresAt: expiresAt.toISOString(),
      timeUntilExpiry: Math.round(timeUntilExpiry / 1000 / 60) + ' minutes',
      refreshThreshold: this.config.refreshThreshold + ' minutes'
    });

    // If session is already close to expiry, refresh immediately
    if (timeUntilExpiry <= refreshThresholdMs) {
      console.log('[SessionManager] Session close to expiry, refreshing immediately');
      this.refreshSession(supabase);
      return;
    }

    // Schedule refresh before expiry
    const refreshDelay = timeUntilExpiry - refreshThresholdMs;
    this.refreshTimer = setTimeout(() => {
      this.refreshSession(supabase);
    }, refreshDelay);

    console.log('[SessionManager] Scheduled refresh in', Math.round(refreshDelay / 1000 / 60), 'minutes');
  }

  /**
   * Stop monitoring the current session
   */
  stopMonitoring(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.refreshAttempts = 0;
    this.isRefreshing = false;
  }

  /**
   * Manually refresh the session
   */
  async refreshSession(supabase: SupabaseClient): Promise<boolean> {
    if (this.isRefreshing) {
      console.log('[SessionManager] Refresh already in progress');
      return false;
    }

    if (this.refreshAttempts >= this.config.maxRefreshAttempts) {
      console.log('[SessionManager] Max refresh attempts reached');
      this.config.onSessionExpired?.();
      return false;
    }

    this.isRefreshing = true;
    this.refreshAttempts++;
    this.lastRefreshAttempt = new Date();

    console.log(`[SessionManager] Attempting session refresh (${this.refreshAttempts}/${this.config.maxRefreshAttempts})`);

    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        throw error;
      }

      if (data.session) {
        console.log('[SessionManager] Session refreshed successfully');
        this.refreshAttempts = 0; // Reset on success
        this.config.onSessionRefreshed?.(data.session);
        
        // Start monitoring the new session
        this.startMonitoring(supabase, data.session);
        return true;
      } else {
        throw new Error('No session returned from refresh');
      }
    } catch (error) {
      console.error('[SessionManager] Session refresh failed:', error);
      
      const authError = categorizeAuthError(error);
      this.config.onRefreshFailed?.(error instanceof Error ? error : new Error(String(error)));

      // Handle the error with recovery manager
      const recovered = await authErrorRecoveryManager.handleError(authError, {
        operation: 'session_refresh',
        onRetry: async () => {
          // Schedule another refresh attempt
          setTimeout(() => {
            this.refreshSession(supabase);
          }, this.config.refreshRetryDelay);
        }
      });

      if (!recovered && this.refreshAttempts >= this.config.maxRefreshAttempts) {
        console.log('[SessionManager] All refresh attempts failed, session expired');
        this.config.onSessionExpired?.();
      }

      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Check if a session is valid and not expired
   */
  isSessionValid(session: Session | null): boolean {
    if (!session || !session.expires_at) {
      return false;
    }

    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    
    return expiresAt.getTime() > now.getTime();
  }

  /**
   * Get the current session status
   */
  getSessionStatus(session: Session | null): SessionStatus {
    const isValid = this.isSessionValid(session);
    const expiresAt = session?.expires_at ? new Date(session.expires_at * 1000) : null;
    const refreshToken = session?.refresh_token || null;

    let nextRefreshAt: Date | null = null;
    if (expiresAt) {
      const refreshThresholdMs = this.config.refreshThreshold * 60 * 1000;
      nextRefreshAt = new Date(expiresAt.getTime() - refreshThresholdMs);
    }

    return {
      isValid,
      expiresAt,
      refreshToken,
      lastRefresh: this.lastRefreshAttempt,
      refreshAttempts: this.refreshAttempts,
      nextRefreshAt
    };
  }

  /**
   * Force a session check and refresh if needed
   */
  async checkAndRefreshSession(supabase: SupabaseClient): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }

      const session = data.session;
      
      if (!session) {
        console.log('[SessionManager] No session found');
        return null;
      }

      if (!this.isSessionValid(session)) {
        console.log('[SessionManager] Session expired, attempting refresh');
        const refreshed = await this.refreshSession(supabase);
        
        if (refreshed) {
          // Get the refreshed session
          const { data: newData } = await supabase.auth.getSession();
          return newData.session;
        } else {
          return null;
        }
      }

      // Session is valid, start monitoring if not already
      if (!this.refreshTimer) {
        this.startMonitoring(supabase, session);
      }

      return session;
    } catch (error) {
      console.error('[SessionManager] Session check failed:', error);
      const authError = categorizeAuthError(error);
      
      await authErrorRecoveryManager.handleError(authError, {
        operation: 'session_check'
      });

      return null;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopMonitoring();
    authErrorRecoveryManager.clearAll();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const authSessionManager = new AuthSessionManager({
  refreshThreshold: 5, // 5 minutes
  maxRefreshAttempts: 3,
  refreshRetryDelay: 2000,
  onSessionRefreshed: (session) => {
    console.log('[SessionManager] Session refreshed, expires at:', new Date(session.expires_at! * 1000).toISOString());
  },
  onSessionExpired: () => {
    console.log('[SessionManager] Session expired, user needs to re-authenticate');
    // Could trigger a redirect to login page or show a re-auth modal
  },
  onRefreshFailed: (error) => {
    console.error('[SessionManager] Session refresh failed:', error.message);
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get time until session expires in minutes
 */
export function getTimeUntilExpiry(session: Session | null): number | null {
  if (!session || !session.expires_at) {
    return null;
  }

  const expiresAt = new Date(session.expires_at * 1000);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  
  return Math.max(0, Math.round(diffMs / 1000 / 60));
}

/**
 * Check if session needs refresh soon
 */
export function needsRefreshSoon(session: Session | null, thresholdMinutes = 5): boolean {
  const timeUntilExpiry = getTimeUntilExpiry(session);
  return timeUntilExpiry !== null && timeUntilExpiry <= thresholdMinutes;
}

/**
 * Format session expiry time for display
 */
export function formatSessionExpiry(session: Session | null): string {
  if (!session || !session.expires_at) {
    return '알 수 없음';
  }

  const expiresAt = new Date(session.expires_at * 1000);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();

  if (diffMs <= 0) {
    return '만료됨';
  }

  const minutes = Math.floor(diffMs / 1000 / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}일 후`;
  } else if (hours > 0) {
    return `${hours}시간 후`;
  } else {
    return `${minutes}분 후`;
  }
}