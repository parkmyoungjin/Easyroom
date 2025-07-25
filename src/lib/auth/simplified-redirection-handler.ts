'use client';

import { 
  AuthReturnData, 
  AuthResult, 
  RedirectionConfig 
} from '@/types/auth-optimization';

/**
 * Simplified Redirection Handler
 * Handles authentication redirections using standard web URLs only
 * Removes dependency on custom URL schemes
 */
export class SimplifiedRedirectionHandler {
  private static readonly DEFAULT_CONFIG: RedirectionConfig = {
    baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
    verifiedPagePath: '/auth/callback/verified',
    autoRedirectDelay: 2000,
    fallbackEnabled: true
  };

  private config: RedirectionConfig;

  constructor(config: Partial<RedirectionConfig> = {}) {
    this.config = { ...SimplifiedRedirectionHandler.DEFAULT_CONFIG, ...config };
    
    // Ensure baseUrl is set correctly
    if (typeof window !== 'undefined' && !this.config.baseUrl) {
      this.config.baseUrl = window.location.origin;
    }
  }

  /**
   * Redirect to authentication provider
   */
  public redirectToAuth(provider: string, returnUrl?: string): void {
    try {
      const finalReturnUrl = returnUrl || this.buildReturnUrl(this.config.baseUrl);
      
      console.log(`[SimplifiedRedirectionHandler] Redirecting to ${provider} auth`);
      console.log(`[SimplifiedRedirectionHandler] Return URL: ${finalReturnUrl}`);
      
      // Store the intended return URL for later use
      this.storeReturnUrl(finalReturnUrl);
      
      // Construct auth provider URL with return URL
      const authUrl = this.buildAuthProviderUrl(provider, finalReturnUrl);
      
      // Perform the redirect
      window.location.href = authUrl;
      
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to redirect to auth:', error);
      throw new Error(`Failed to redirect to ${provider} authentication: ${error}`);
    }
  }

  /**
   * Handle authentication return from external provider
   */
  public handleAuthReturn(authResult: AuthResult): void {
    try {
      console.log('[SimplifiedRedirectionHandler] Handling auth return:', authResult.success);
      
      if (authResult.success) {
        this.handleSuccessfulAuth(authResult);
      } else {
        this.handleFailedAuth(authResult);
      }
      
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to handle auth return:', error);
      this.handleFailedAuth({
        success: false,
        error: `Failed to process authentication result: ${error}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Build return URL for authentication flow
   */
  public buildReturnUrl(baseUrl: string): string {
    try {
      const url = new URL(this.config.verifiedPagePath, baseUrl);
      
      // Add timestamp to prevent caching issues
      url.searchParams.set('t', Date.now().toString());
      
      // Add source identifier
      url.searchParams.set('source', 'external_app');
      
      return url.toString();
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to build return URL:', error);
      throw new Error(`Failed to build return URL: ${error}`);
    }
  }

  /**
   * Parse return URL to extract authentication data
   */
  public parseReturnUrl(url: string): AuthReturnData {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      const success = params.get('success') === 'true';
      const userId = params.get('user_id') || undefined;
      const sessionToken = params.get('session_token') || undefined;
      const error = params.get('error') || undefined;
      
      return {
        success,
        userId,
        sessionToken,
        error
      };
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to parse return URL:', error);
      return {
        success: false,
        error: `Failed to parse return URL: ${error}`
      };
    }
  }

  /**
   * Get stored return URL
   */
  public getStoredReturnUrl(): string | null {
    try {
      return localStorage.getItem('easyroom_auth_return_url');
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to get stored return URL:', error);
      return null;
    }
  }

  /**
   * Clear stored return URL
   */
  public clearStoredReturnUrl(): void {
    try {
      localStorage.removeItem('easyroom_auth_return_url');
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to clear stored return URL:', error);
    }
  }

  /**
   * Build authentication provider URL
   */
  private buildAuthProviderUrl(provider: string, returnUrl: string): string {
    // This would be customized based on your auth providers
    // For now, returning a placeholder that includes the return URL
    const encodedReturnUrl = encodeURIComponent(returnUrl);
    
    switch (provider.toLowerCase()) {
      case 'google':
        return `/auth/google?return_url=${encodedReturnUrl}`;
      case 'microsoft':
        return `/auth/microsoft?return_url=${encodedReturnUrl}`;
      case 'email':
        return `/auth/email?return_url=${encodedReturnUrl}`;
      default:
        return `/auth/${provider}?return_url=${encodedReturnUrl}`;
    }
  }

  /**
   * Store return URL in localStorage
   */
  private storeReturnUrl(returnUrl: string): void {
    try {
      localStorage.setItem('easyroom_auth_return_url', returnUrl);
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to store return URL:', error);
    }
  }

  /**
   * Handle successful authentication
   */
  private handleSuccessfulAuth(authResult: AuthResult): void {
    console.log('[SimplifiedRedirectionHandler] Authentication successful');
    
    // Store success state for other components to detect
    this.storeAuthResult(authResult);
    
    // Redirect to verified page
    this.redirectToVerifiedPage(authResult);
  }

  /**
   * Handle failed authentication
   */
  private handleFailedAuth(authResult: AuthResult): void {
    console.error('[SimplifiedRedirectionHandler] Authentication failed:', authResult.error);
    
    // Store failure state
    this.storeAuthResult(authResult);
    
    // Redirect to error page or verified page with error
    this.redirectToVerifiedPage(authResult);
  }

  /**
   * Store authentication result in localStorage
   */
  private storeAuthResult(authResult: AuthResult): void {
    try {
      localStorage.setItem('easyroom_auth_result', JSON.stringify(authResult));
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to store auth result:', error);
    }
  }

  /**
   * Redirect to verified page
   */
  private redirectToVerifiedPage(authResult: AuthResult): void {
    try {
      const verifiedUrl = new URL(this.config.verifiedPagePath, this.config.baseUrl);
      
      // Add result parameters to URL
      verifiedUrl.searchParams.set('success', authResult.success.toString());
      if (authResult.error) {
        verifiedUrl.searchParams.set('error', authResult.error);
      }
      if (authResult.userId) {
        verifiedUrl.searchParams.set('user_id', authResult.userId);
      }
      
      console.log('[SimplifiedRedirectionHandler] Redirecting to verified page:', verifiedUrl.toString());
      window.location.href = verifiedUrl.toString();
      
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to redirect to verified page:', error);
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): RedirectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<RedirectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get authentication result from localStorage
   */
  public getStoredAuthResult(): AuthResult | null {
    try {
      const stored = localStorage.getItem('easyroom_auth_result');
      if (!stored) {
        return null;
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to get stored auth result:', error);
      return null;
    }
  }

  /**
   * Clear stored authentication result
   */
  public clearStoredAuthResult(): void {
    try {
      localStorage.removeItem('easyroom_auth_result');
    } catch (error) {
      console.error('[SimplifiedRedirectionHandler] Failed to clear stored auth result:', error);
    }
  }
}