'use client';

import { UniversalAuthStateManager } from '@/lib/auth/universal-auth-state-manager';
import { SimplifiedRedirectionHandler } from '@/lib/auth/simplified-redirection-handler';
import { 
  AuthState, 
  AuthStateChangeCallback, 
  AuthResult,
  PollingConfig,
  RedirectionConfig 
} from '@/types/auth-optimization';

/**
 * Optimized Auth System
 * Unified interface for the new localStorage-based authentication system
 * Replaces the old BroadcastChannel approach
 */
export class OptimizedAuthSystem {
  private stateManager: UniversalAuthStateManager;
  private redirectionHandler: SimplifiedRedirectionHandler;

  constructor(
    pollingConfig?: Partial<PollingConfig>,
    redirectionConfig?: Partial<RedirectionConfig>
  ) {
    this.stateManager = UniversalAuthStateManager.getInstance(pollingConfig);
    this.redirectionHandler = new SimplifiedRedirectionHandler(redirectionConfig);
  }

  // State Management Methods
  
  /**
   * Set authentication state
   */
  public setAuthState(state: AuthState): void {
    this.stateManager.setAuthState(state);
  }

  /**
   * Get current authentication state
   */
  public getAuthState(): AuthState | null {
    return this.stateManager.getAuthState();
  }

  /**
   * Clear authentication state
   */
  public clearAuthState(): void {
    this.stateManager.clearAuthState();
  }

  /**
   * Subscribe to authentication state changes
   */
  public onStateChange(callback: AuthStateChangeCallback): () => void {
    return this.stateManager.onStateChange(callback);
  }

  /**
   * Listen for authentication success events
   * This method specifically listens for successful authentication state changes
   */
  public listenForAuthSuccess(callback: () => void): () => void {
    return this.onStateChange((state) => {
      if (state?.status === 'authenticated') {
        callback();
      }
    });
  }

  // Redirection Methods

  /**
   * Redirect to authentication provider
   */
  public redirectToAuth(provider: string, returnUrl?: string): void {
    this.redirectionHandler.redirectToAuth(provider, returnUrl);
  }

  /**
   * Handle authentication return from external provider
   */
  public handleAuthReturn(authResult: AuthResult): void {
    // Update state manager with the result
    const authState: AuthState = {
      status: authResult.success ? 'authenticated' : 'unauthenticated',
      timestamp: authResult.timestamp,
      userId: authResult.userId,
      sessionToken: authResult.sessionToken,
      source: 'external_app'
    };

    this.setAuthState(authState);
    
    // Handle the redirection
    this.redirectionHandler.handleAuthReturn(authResult);
  }

  /**
   * Build return URL for authentication flow
   */
  public buildReturnUrl(baseUrl?: string): string {
    const url = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return this.redirectionHandler.buildReturnUrl(url);
  }

  /**
   * Parse return URL to extract authentication data
   */
  public parseReturnUrl(url: string) {
    return this.redirectionHandler.parseReturnUrl(url);
  }

  // Utility Methods

  /**
   * Check if user is currently authenticated
   */
  public isAuthenticated(): boolean {
    const state = this.getAuthState();
    return state?.status === 'authenticated';
  }

  /**
   * Check if authentication is pending
   */
  public isPending(): boolean {
    const state = this.getAuthState();
    return state?.status === 'pending';
  }

  /**
   * Get current user ID if authenticated
   */
  public getCurrentUserId(): string | null {
    const state = this.getAuthState();
    return state?.userId || null;
  }

  /**
   * Get current session token if authenticated
   */
  public getCurrentSessionToken(): string | null {
    const state = this.getAuthState();
    return state?.sessionToken || null;
  }

  /**
   * Set authentication as pending (useful during login process)
   */
  public setPendingAuth(userId?: string): void {
    const authState: AuthState = {
      status: 'pending',
      timestamp: Date.now(),
      userId,
      source: 'internal'
    };
    this.setAuthState(authState);
  }

  /**
   * Complete authentication with user data
   */
  public completeAuth(userId: string, sessionToken: string, source: 'internal' | 'external_app' = 'internal'): void {
    const authState: AuthState = {
      status: 'authenticated',
      timestamp: Date.now(),
      userId,
      sessionToken,
      source
    };
    this.setAuthState(authState);
  }

  /**
   * Logout user
   */
  public logout(): void {
    const authState: AuthState = {
      status: 'unauthenticated',
      timestamp: Date.now(),
      source: 'internal'
    };
    this.setAuthState(authState);
  }

  /**
   * Get stored authentication result from redirection
   */
  public getStoredAuthResult() {
    return this.redirectionHandler.getStoredAuthResult();
  }

  /**
   * Clear stored authentication result
   */
  public clearStoredAuthResult(): void {
    this.redirectionHandler.clearStoredAuthResult();
  }

  /**
   * Get stored return URL
   */
  public getStoredReturnUrl(): string | null {
    return this.redirectionHandler.getStoredReturnUrl();
  }

  /**
   * Clear stored return URL
   */
  public clearStoredReturnUrl(): void {
    this.redirectionHandler.clearStoredReturnUrl();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stateManager.destroy();
  }

  /**
   * Get state manager configuration
   */
  public getStateManagerConfig() {
    return this.stateManager.getConfig();
  }

  /**
   * Get redirection handler configuration
   */
  public getRedirectionConfig() {
    return this.redirectionHandler.getConfig();
  }

  /**
   * Update state manager configuration
   */
  public updateStateManagerConfig(config: Partial<PollingConfig>): void {
    this.stateManager.updateConfig(config);
  }

  /**
   * Update redirection handler configuration
   */
  public updateRedirectionConfig(config: Partial<RedirectionConfig>): void {
    this.redirectionHandler.updateConfig(config);
  }
}

// Export singleton instance for easy usage
let optimizedAuthSystemInstance: OptimizedAuthSystem | null = null;

/**
 * Get singleton instance of OptimizedAuthSystem
 */
export function getOptimizedAuthSystem(
  pollingConfig?: Partial<PollingConfig>,
  redirectionConfig?: Partial<RedirectionConfig>
): OptimizedAuthSystem {
  if (!optimizedAuthSystemInstance) {
    optimizedAuthSystemInstance = new OptimizedAuthSystem(pollingConfig, redirectionConfig);
  }
  return optimizedAuthSystemInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetOptimizedAuthSystem(): void {
  if (optimizedAuthSystemInstance) {
    optimizedAuthSystemInstance.destroy();
    optimizedAuthSystemInstance = null;
  }
}