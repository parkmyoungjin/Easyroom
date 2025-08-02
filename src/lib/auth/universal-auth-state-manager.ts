'use client';

import { 
  AuthState, 
  StoredAuthState, 
  PollingConfig, 
  AuthStateChangeCallback 
} from '@/types/auth-optimization';
import { AuthHealthMonitor } from '@/lib/auth/auth-health-monitor';

/**
 * Universal Auth State Manager
 * Replaces BroadcastChannel with localStorage polling for unified state management
 */
export class UniversalAuthStateManager {
  private static instance: UniversalAuthStateManager | null = null;
  private static readonly STORAGE_KEY = 'easyroom_auth_state';
  private static readonly DEFAULT_CONFIG: PollingConfig = {
    interval: 500,
    maxAge: 5 * 60 * 1000, // 5 minutes
    retryAttempts: 3,
    backoffMultiplier: 2
  };

  private pollingInterval: NodeJS.Timeout | null = null;
  private callbacks: Set<AuthStateChangeCallback> = new Set();
  private config: PollingConfig;
  private lastKnownState: AuthState | null = null;
  private isPolling = false;
  private retryCount = 0;
  private healthMonitor: AuthHealthMonitor;

  private constructor(config: Partial<PollingConfig> = {}) {
    this.config = { ...UniversalAuthStateManager.DEFAULT_CONFIG, ...config };
    this.healthMonitor = AuthHealthMonitor.getInstance();
    this.initializePolling();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<PollingConfig>): UniversalAuthStateManager {
    if (!UniversalAuthStateManager.instance) {
      UniversalAuthStateManager.instance = new UniversalAuthStateManager(config);
    }
    return UniversalAuthStateManager.instance;
  }

  /**
   * Set authentication state in localStorage
   */
  public setAuthState(state: AuthState): void {
    try {
      const storedState: StoredAuthState = {
        version: '2.0',
        state,
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: state.source
        }
      };

      localStorage.setItem(
        UniversalAuthStateManager.STORAGE_KEY, 
        JSON.stringify(storedState)
      );

      this.lastKnownState = state;
      this.notifyCallbacks(state);
      this.healthMonitor.recordStorageEvent(true, 'set');
      this.healthMonitor.recordStateChange(state, 'direct');
      
      console.log('[UniversalAuthStateManager] Auth state set:', state.status);
    } catch (error) {
      console.error('[UniversalAuthStateManager] Failed to set auth state:', error);
      this.healthMonitor.recordStorageEvent(false, 'set', error as Error);
      this.handleStorageError(error);
    }
  }

  /**
   * Get current authentication state from localStorage
   */
  public getAuthState(): AuthState | null {
    try {
      const stored = localStorage.getItem(UniversalAuthStateManager.STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const storedState: StoredAuthState = JSON.parse(stored);
      
      // Check if state is expired
      if (this.isStateExpired(storedState)) {
        this.clearAuthState();
        return null;
      }

      this.healthMonitor.recordStorageEvent(true, 'get');
      return storedState.state;
    } catch (error) {
      console.error('[UniversalAuthStateManager] Failed to get auth state:', error);
      this.healthMonitor.recordStorageEvent(false, 'get', error as Error);
      this.handleStorageError(error);
      return null;
    }
  }

  /**
   * Clear authentication state from localStorage
   */
  public clearAuthState(): void {
    try {
      localStorage.removeItem(UniversalAuthStateManager.STORAGE_KEY);
      this.lastKnownState = null;
      this.notifyCallbacks(null);
      this.healthMonitor.recordStorageEvent(true, 'remove');
      this.healthMonitor.recordStateChange(null, 'direct');
      
      console.log('[UniversalAuthStateManager] Auth state cleared');
    } catch (error) {
      console.error('[UniversalAuthStateManager] Failed to clear auth state:', error);
      this.healthMonitor.recordStorageEvent(false, 'remove', error as Error);
      this.handleStorageError(error);
    }
  }

  /**
   * Subscribe to auth state changes
   */
  public onStateChange(callback: AuthStateChangeCallback): () => void {
    this.callbacks.add(callback);
    
    // Immediately call with current state
    const currentState = this.getAuthState();
    try {
      callback(currentState);
    } catch (error) {
      console.error('[UniversalAuthStateManager] Error in callback:', error);
    }

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Start polling for state changes
   */
  private initializePolling(): void {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.healthMonitor.recordPollingStatus(true);
    this.startPolling();
  }

  /**
   * Start the polling mechanism
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(() => {
      this.checkForStateChanges();
    }, this.config.interval);

    console.log(`[UniversalAuthStateManager] Polling started with ${this.config.interval}ms interval`);
  }

  /**
   * Check for state changes and notify callbacks
   */
  private checkForStateChanges(): void {
    const startTime = Date.now();
    try {
      const currentState = this.getAuthState();
      
      // Compare with last known state
      if (!this.statesEqual(currentState, this.lastKnownState)) {
        this.lastKnownState = currentState;
        this.notifyCallbacks(currentState);
        this.healthMonitor.recordStateChange(currentState, 'polling');
        this.retryCount = 0; // Reset retry count on successful check
      }
      
      const endTime = Date.now();
      this.healthMonitor.recordPollingEvent(true, endTime - startTime);
    } catch (error) {
      console.error('[UniversalAuthStateManager] Error during polling:', error);
      const endTime = Date.now();
      this.healthMonitor.recordPollingEvent(false, endTime - startTime, error as Error);
      this.handlePollingError(error);
    }
  }

  /**
   * Compare two auth states for equality
   */
  private statesEqual(state1: AuthState | null, state2: AuthState | null): boolean {
    if (state1 === null && state2 === null) return true;
    if (state1 === null || state2 === null) return false;
    
    return (
      state1.status === state2.status &&
      state1.userId === state2.userId &&
      state1.sessionToken === state2.sessionToken &&
      state1.source === state2.source
    );
  }

  /**
   * Check if stored state is expired
   */
  private isStateExpired(storedState: StoredAuthState): boolean {
    const now = Date.now();
    const age = now - storedState.metadata.updatedAt;
    return age > this.config.maxAge;
  }

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(state: AuthState | null): void {
    let successCount = 0;
    let errorCount = 0;
    
    this.callbacks.forEach(callback => {
      try {
        callback(state);
        successCount++;
      } catch (error) {
        console.error('[UniversalAuthStateManager] Error in callback:', error);
        errorCount++;
        this.healthMonitor.recordCallbackEvent(false, this.callbacks.size, error as Error);
      }
    });
    
    if (successCount > 0) {
      this.healthMonitor.recordCallbackEvent(true, this.callbacks.size);
    }
  }

  /**
   * Handle localStorage access errors
   */
  private handleStorageError(error: any): void {
    console.error('[UniversalAuthStateManager] localStorage error:', error);
    
    // Check if localStorage is available
    if (!this.isLocalStorageAvailable()) {
      console.error('[UniversalAuthStateManager] localStorage is not available');
      // Could emit a specific error event here for UI to handle
    }
  }

  /**
   * Handle polling errors with retry logic
   */
  private handlePollingError(error: any): void {
    this.retryCount++;
    
    if (this.retryCount >= this.config.retryAttempts) {
      console.error('[UniversalAuthStateManager] Max retry attempts reached, restarting polling');
      this.restartPolling();
    } else {
      // Increase polling interval with backoff
      const newInterval = this.config.interval * Math.pow(this.config.backoffMultiplier, this.retryCount);
      console.warn(`[UniversalAuthStateManager] Polling error, retrying with ${newInterval}ms interval`);
      
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }
      
      this.pollingInterval = setInterval(() => {
        this.checkForStateChanges();
      }, newInterval);
    }
  }

  /**
   * Restart polling with default interval
   */
  private restartPolling(): void {
    this.retryCount = 0;
    this.startPolling();
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    this.callbacks.clear();
    this.isPolling = false;
    this.healthMonitor.recordPollingStatus(false);
    this.lastKnownState = null;
    
    console.log('[UniversalAuthStateManager] Destroyed');
  }

  /**
   * Get current configuration
   */
  public getConfig(): PollingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PollingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart polling with new config
    if (this.isPolling) {
      this.startPolling();
    }
  }

  /**
   * Get health metrics for monitoring
   */
  public getHealthMetrics() {
    return this.healthMonitor.getMetrics();
  }

  /**
   * Get health status summary
   */
  public getHealthStatus() {
    return this.healthMonitor.getHealthStatus();
  }

  /**
   * Subscribe to health alerts
   */
  public onHealthAlert(callback: (alert: any) => void) {
    return this.healthMonitor.onAlert(callback);
  }
}