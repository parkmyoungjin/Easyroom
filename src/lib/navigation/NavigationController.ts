/**
 * Centralized Navigation Controller
 * Handles all post-authentication redirects with fallback mechanisms and timeout handling
 */

import { UserProfile } from '@/types/auth';
import { 
  createTimeoutHandler, 
  createAuthTimeoutError, 
  withTimeout, 
  DEFAULT_TIMEOUT_CONFIG,
  type TimeoutHandler 
} from '@/lib/utils/auth-timeout';
import { getAuthErrorHandler } from '@/lib/utils/auth-error-handler';

export interface NavigationState {
  isRedirecting: boolean;
  redirectPath: string | null;
  redirectReason: 'login' | 'logout' | 'timeout' | 'error';
  timestamp: number;
  attempt: number;
  lastError?: string;
}

export interface RedirectOptions {
  userProfile: UserProfile;
  previousPath?: string;
  fallbackPath?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface NavigationController {
  handlePostLoginRedirect: (options: RedirectOptions) => Promise<void>;
  handleAuthTimeout: () => void;
  getRedirectPath: (userProfile: UserProfile, previousPath?: string) => string;
  clearRedirectState: () => void;
  getNavigationState: () => NavigationState;
  retryLastRedirect: () => Promise<void>;
}

class NavigationControllerImpl implements NavigationController {
  private navigationState: NavigationState = {
    isRedirecting: false,
    redirectPath: null,
    redirectReason: 'login',
    timestamp: 0,
    attempt: 0
  };

  private timeoutHandler: TimeoutHandler;
  private lastRedirectOptions: RedirectOptions | null = null;

  constructor() {
    this.timeoutHandler = createTimeoutHandler();
  }

  /**
   * Determines the correct redirect path based on user role and previous page
   */
  getRedirectPath(userProfile: UserProfile, previousPath?: string): string {
    // Priority 1: Previous page if valid and accessible
    if (previousPath && this.isValidRedirectPath(previousPath, userProfile)) {
      return previousPath;
    }

    // Priority 2: Role-based default pages
    switch (userProfile.role) {
      case 'admin':
        return '/admin';
      case 'employee':
        return '/';
      default:
        return '/';
    }
  }

  /**
   * Validates if a redirect path is accessible for the user
   */
  private isValidRedirectPath(path: string, userProfile: UserProfile): boolean {
    // Exclude auth pages
    if (path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/auth/')) {
      return false;
    }

    // Check admin-only paths
    if (path.startsWith('/admin') && userProfile.role !== 'admin') {
      return false;
    }

    // Allow other paths
    return true;
  }

  /**
   * Handles post-login redirect with fallback mechanisms and timeout
   */
  async handlePostLoginRedirect(options: RedirectOptions): Promise<void> {
    const { 
      userProfile, 
      previousPath, 
      fallbackPath = '/', 
      timeout = DEFAULT_TIMEOUT_CONFIG.redirectTimeout,
      maxRetries = 2
    } = options;

    // Store options for retry
    this.lastRedirectOptions = options;

    // Set redirecting state
    this.navigationState = {
      isRedirecting: true,
      redirectPath: null,
      redirectReason: 'login',
      timestamp: Date.now(),
      attempt: (this.navigationState.attempt || 0) + 1
    };

    try {
      // Determine redirect path
      const redirectPath = this.getRedirectPath(userProfile, previousPath || this.getPreviousPathFromUrl());
      this.navigationState.redirectPath = redirectPath;

      console.log(`[NavigationController] Redirecting user ${userProfile.name} to ${redirectPath} (attempt ${this.navigationState.attempt})`);

      // Use timeout wrapper for redirect operation
      await withTimeout(
        this.performRedirect(redirectPath),
        timeout,
        'redirect_timeout',
        () => this.retryLastRedirect()
      );

      // Clear state on success
      this.clearRedirectState();

    } catch (error) {
      console.error('[NavigationController] Redirect failed:', error);
      
      const errorHandler = getAuthErrorHandler();
      const authError = errorHandler.handleAuthError(error);
      
      this.navigationState.lastError = authError.message;
      this.navigationState.redirectReason = 'error';

      // Try fallback redirect if we haven't exceeded max retries
      if (this.navigationState.attempt < maxRetries) {
        console.log(`[NavigationController] Attempting fallback redirect to ${fallbackPath}`);
        this.secondaryRedirect(fallbackPath);
      } else {
        console.error(`[NavigationController] Max retries exceeded, staying on current page`);
        this.navigationState.isRedirecting = false;
      }
    }
  }

  /**
   * Performs redirect with primary and fallback mechanisms
   */
  private async performRedirect(path: string): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Cannot use router redirect in SSR environment');
    }

    try {
      // Primary redirect mechanism: window.location
      window.location.href = path;
      
      // Wait a bit to see if redirect worked
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // If we're still here, the redirect might have failed
      if (window.location.pathname !== path) {
        throw new Error('Primary redirect failed');
      }
    } catch (error) {
      console.warn('[NavigationController] Primary redirect failed, trying fallback');
      this.secondaryRedirect(path);
    }
  }

  /**
   * Secondary redirect using window.location (fallback)
   */
  private secondaryRedirect(path: string): void {
    if (typeof window !== 'undefined') {
      console.log(`[NavigationController] Using fallback redirect to ${path}`);
      window.location.href = path;
    }
  }



  /**
   * Retries the last redirect operation
   */
  async retryLastRedirect(): Promise<void> {
    if (!this.lastRedirectOptions) {
      console.warn('[NavigationController] No previous redirect to retry');
      return;
    }

    console.log('[NavigationController] Retrying last redirect');
    await this.handlePostLoginRedirect(this.lastRedirectOptions);
  }

  /**
   * Handles authentication timeout
   */
  handleAuthTimeout(): void {
    console.warn('[NavigationController] Authentication timeout detected');
    
    this.navigationState = {
      isRedirecting: true,
      redirectPath: '/login',
      redirectReason: 'timeout',
      timestamp: Date.now(),
      attempt: 0
    };

    // Show user-friendly message and redirect to login
    if (typeof window !== 'undefined') {
      // Clear any existing timeouts
      this.timeoutHandler.clearAllTimeouts();

      // Redirect to login with timeout message
      const loginUrl = new URL('/login', window.location.origin);
      loginUrl.searchParams.set('timeout', 'true');
      window.location.href = loginUrl.toString();
    }
  }

  /**
   * Gets previous path from URL parameters
   */
  private getPreviousPathFromUrl(): string | undefined {
    if (typeof window === 'undefined') return undefined;

    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');
    
    return redirectPath && redirectPath.startsWith('/') ? redirectPath : undefined;
  }

  /**
   * Clears redirect state
   */
  clearRedirectState(): void {
    this.timeoutHandler.clearAllTimeouts();

    this.navigationState = {
      isRedirecting: false,
      redirectPath: null,
      redirectReason: 'login',
      timestamp: 0,
      attempt: 0
    };
  }

  /**
   * Gets current navigation state
   */
  getNavigationState(): NavigationState {
    return { ...this.navigationState };
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    this.clearRedirectState();
  }
}

// Singleton instance
let navigationControllerInstance: NavigationControllerImpl | null = null;

/**
 * Gets the singleton navigation controller instance
 */
export function getNavigationController(): NavigationController {
  if (!navigationControllerInstance) {
    navigationControllerInstance = new NavigationControllerImpl();
  }
  return navigationControllerInstance;
}

/**
 * Hook for using navigation controller in React components
 */
export function useNavigationController(): NavigationController {
  return getNavigationController();
}