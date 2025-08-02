// src/lib/auth/SessionPollingManager.ts

export interface PollingConfig {
  maxRetries: number;
  baseInterval: number; // milliseconds
  maxInterval: number; // milliseconds
  backoffMultiplier: number;
  enabledPaths: string[]; // Pages where polling is allowed
}

export interface PollingState {
  isActive: boolean;
  retryCount: number;
  currentInterval: number;
  lastAttempt: Date | null;
  intervalId: NodeJS.Timeout | null;
}

export interface SessionCheckOptions {
  force?: boolean; // Force check even if recently checked
  source?: 'initial' | 'polling' | 'focus' | 'manual'; // Track check source for debugging
  maxRetries?: number; // Override default retry limit
}

export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  maxRetries: 3,
  baseInterval: 2000, // Start with 2 seconds (more reasonable than 1 second)
  maxInterval: 30000, // Cap at 30 seconds
  backoffMultiplier: 2, // Double the interval each time
  enabledPaths: ['/login', '/auth/callback'] // Only poll on these pages
};

export class SessionPollingManager {
  private config: PollingConfig;
  private state: PollingState;
  private onSessionCheck: (options?: SessionCheckOptions) => Promise<void>;

  constructor(
    config: PollingConfig = DEFAULT_POLLING_CONFIG,
    onSessionCheck: (options?: SessionCheckOptions) => Promise<void>
  ) {
    this.config = config;
    this.onSessionCheck = onSessionCheck;
    this.state = {
      isActive: false,
      retryCount: 0,
      currentInterval: config.baseInterval,
      lastAttempt: null,
      intervalId: null
    };
  }

  start(): void {
    if (this.state.isActive) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[SessionPollingManager] Polling already active, skipping start');
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[SessionPollingManager] Starting intelligent session polling');
    }
    this.state.isActive = true;
    this.scheduleNext();
  }

  stop(): void {
    if (!this.state.isActive) {
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[SessionPollingManager] Stopping session polling');
    }
    this.state.isActive = false;
    
    if (this.state.intervalId) {
      clearTimeout(this.state.intervalId);
      this.state.intervalId = null;
    }
  }

  reset(): void {
    this.stop();
    this.state.retryCount = 0;
    this.state.currentInterval = this.config.baseInterval;
    this.state.lastAttempt = null;
  }

  shouldPoll(currentPath: string, authStatus: string): boolean {
    // Don't poll if authenticated
    if (authStatus === 'authenticated') {
      return false;
    }

    // Only poll on enabled paths
    return this.config.enabledPaths.some(path => currentPath === path);
  }

  private scheduleNext(): void {
    if (!this.state.isActive) {
      return;
    }

    // Check retry limit before scheduling
    if (this.state.retryCount >= this.config.maxRetries) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[SessionPollingManager] Max retries reached, stopping polling');
      }
      this.stop();
      return;
    }

    const interval = this.calculateNextInterval();
    // Only log scheduling in development to reduce noise
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SessionPollingManager] Scheduling next check in ${interval}ms (attempt ${this.state.retryCount + 1}/${this.config.maxRetries})`);
    }

    this.state.intervalId = setTimeout(async () => {
      if (!this.state.isActive) {
        return;
      }

      this.state.lastAttempt = new Date();
      this.state.retryCount++;

      try {
        await this.onSessionCheck({
          source: 'polling',
          maxRetries: this.config.maxRetries
        });
        
        // If session check was successful and we found a session, reset retry count
        // The polling will be stopped by the auth state change if user is authenticated
        
      } catch (error) {
        // Only log errors in development or for critical failures
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[SessionPollingManager] Session check failed (attempt ${this.state.retryCount}):`, error);
        }
        
        // For AuthSessionMissingError, we should stop polling after a few attempts
        if (error instanceof Error && error.name === 'AuthSessionMissingError' && this.state.retryCount >= 2) {
          if (process.env.NODE_ENV === 'development') {
            console.log('[SessionPollingManager] Session missing after retries, stopping polling');
          }
          this.stop();
          return;
        }
      }

      // Schedule next attempt if still active and haven't reached max retries
      if (this.state.isActive && this.state.retryCount < this.config.maxRetries) {
        this.scheduleNext();
      } else if (this.state.retryCount >= this.config.maxRetries) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[SessionPollingManager] Max retries reached, stopping polling');
        }
        this.stop();
      }
    }, interval);
  }

  private calculateNextInterval(): number {
    // Exponential backoff: 2s, 4s, 8s
    const exponentialInterval = this.config.baseInterval * Math.pow(this.config.backoffMultiplier, this.state.retryCount);
    return Math.min(exponentialInterval, this.config.maxInterval);
  }

  // Getters for debugging and monitoring
  getState(): Readonly<PollingState> {
    return { ...this.state };
  }

  getConfig(): Readonly<PollingConfig> {
    return { ...this.config };
  }
}