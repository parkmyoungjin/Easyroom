'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getNavigationController, type NavigationState } from '@/lib/navigation/NavigationController';

export function useNavigationController() {
  const searchParams = useSearchParams();
  const { userProfile, isAuthenticated } = useAuth();
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isRedirecting: false,
    redirectPath: null,
    redirectReason: 'login',
    timestamp: 0,
    attempt: 0
  });

  const navigationController = getNavigationController();

  // Update navigation state when it changes
  useEffect(() => {
    const updateState = () => {
      setNavigationState(navigationController.getNavigationState());
    };

    // Initial state
    updateState();

    // Set up polling for state changes (simple approach)
    const interval = setInterval(updateState, 100);

    return () => clearInterval(interval);
  }, [navigationController]);

  /**
   * Handles post-login redirect with user profile
   */
  const handlePostLoginRedirect = useCallback(async (previousPath?: string) => {
    if (!userProfile) {
      console.warn('[useNavigationController] No user profile available for redirect');
      return;
    }

    const redirectPath = previousPath || searchParams.get('redirect') || undefined;

    await navigationController.handlePostLoginRedirect({
      userProfile,
      previousPath: redirectPath,
      fallbackPath: '/',
      timeout: 5000,
      maxRetries: 2
    });
  }, [navigationController, userProfile, searchParams]);

  /**
   * Gets the appropriate redirect path for the current user
   */
  const getRedirectPath = useCallback((previousPath?: string) => {
    if (!userProfile) return '/';
    return navigationController.getRedirectPath(userProfile, previousPath);
  }, [navigationController, userProfile]);

  /**
   * Handles authentication timeout
   */
  const handleAuthTimeout = useCallback(() => {
    navigationController.handleAuthTimeout();
  }, [navigationController]);

  /**
   * Retries the last redirect operation
   */
  const retryLastRedirect = useCallback(async () => {
    await navigationController.retryLastRedirect();
  }, [navigationController]);

  /**
   * Clears redirect state
   */
  const clearRedirectState = useCallback(() => {
    navigationController.clearRedirectState();
  }, [navigationController]);

  return {
    // State
    navigationState,
    isRedirecting: navigationState.isRedirecting,
    redirectPath: navigationState.redirectPath,
    redirectReason: navigationState.redirectReason,
    
    // Actions
    handlePostLoginRedirect,
    getRedirectPath,
    handleAuthTimeout,
    retryLastRedirect,
    clearRedirectState,
    
    // Utilities
    isAuthenticated: isAuthenticated(),
    hasUserProfile: !!userProfile
  };
}