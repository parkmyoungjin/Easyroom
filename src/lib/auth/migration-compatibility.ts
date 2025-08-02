/**
 * Migration compatibility utilities for transitioning from Magic Link to OTP authentication
 * Handles backward compatibility, session management, and user messaging
 */

import { NextRequest } from 'next/server';

export interface MigrationConfig {
  /** Whether to show migration messages to users */
  showMigrationMessages: boolean;
  /** Whether to redirect old magic link URLs */
  redirectMagicLinks: boolean;
  /** Grace period for existing sessions (in days) */
  sessionGracePeriod: number;
}

export const DEFAULT_MIGRATION_CONFIG: MigrationConfig = {
  showMigrationMessages: true,
  redirectMagicLinks: true,
  sessionGracePeriod: 30, // 30 days grace period
};

/**
 * Detects if a URL is an old magic link callback URL
 */
export function isMagicLinkCallback(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Check for magic link specific parameters
    const hasCode = urlObj.searchParams.has('code');
    const hasAccessToken = urlObj.hash.includes('access_token') || urlObj.searchParams.has('access_token');
    const hasRefreshToken = urlObj.hash.includes('refresh_token') || urlObj.searchParams.has('refresh_token');
    const hasTokenType = urlObj.hash.includes('token_type') || urlObj.searchParams.has('token_type');
    const hasError = urlObj.hash.includes('error') || urlObj.searchParams.has('error');
    
    // Magic link URLs typically have either:
    // 1. A 'code' parameter for PKCE flow
    // 2. Access token in hash/query for implicit flow
    // 3. Error parameter for failed authentication
    return hasCode || (hasAccessToken && (hasRefreshToken || hasTokenType)) || hasError;
  } catch {
    return false;
  }
}

/**
 * Extracts magic link parameters from URL for migration purposes
 */
export function extractMagicLinkParams(url: string): {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
} {
  try {
    const urlObj = new URL(url);
    const hashParams = new URLSearchParams(urlObj.hash.substring(1));
    const queryParams = urlObj.searchParams;
    
    return {
      code: queryParams.get('code') || undefined,
      accessToken: hashParams.get('access_token') || queryParams.get('access_token') || undefined,
      refreshToken: hashParams.get('refresh_token') || queryParams.get('refresh_token') || undefined,
      error: hashParams.get('error') || queryParams.get('error') || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Generates a redirect URL to the OTP login flow with migration context
 */
export function generateOTPRedirectUrl(
  baseUrl: string,
  originalUrl: string,
  config: MigrationConfig = DEFAULT_MIGRATION_CONFIG
): string {
  const loginUrl = new URL('/login', baseUrl);
  
  if (config.showMigrationMessages) {
    loginUrl.searchParams.set('migration', 'magic-link');
    loginUrl.searchParams.set('message', 'auth-method-changed');
  }
  
  // Preserve any error information
  const params = extractMagicLinkParams(originalUrl);
  if (params.error) {
    loginUrl.searchParams.set('error', params.error);
  }
  
  return loginUrl.toString();
}

/**
 * Validates that an existing session structure is compatible with OTP authentication
 */
export function validateSessionCompatibility(session: any): {
  isCompatible: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  if (!session) {
    issues.push('No session provided');
    return { isCompatible: false, issues, recommendations };
  }
  
  // Check required session properties
  if (!session.access_token) {
    issues.push('Missing access_token');
  }
  
  if (!session.refresh_token) {
    issues.push('Missing refresh_token');
  }
  
  if (!session.user) {
    issues.push('Missing user object');
  } else {
    // Check user object structure
    if (!session.user.id) {
      issues.push('Missing user.id');
    }
    
    if (!session.user.email) {
      issues.push('Missing user.email');
    }
    
    // Check user metadata structure (important for profile creation)
    if (!session.user.user_metadata) {
      recommendations.push('Consider adding user_metadata for profile information');
    } else {
      const metadata = session.user.user_metadata;
      if (!metadata.fullName && !metadata.name) {
        recommendations.push('Consider adding fullName to user_metadata');
      }
      if (!metadata.department) {
        recommendations.push('Consider adding department to user_metadata');
      }
    }
  }
  
  // Check token expiration
  if (session.expires_at) {
    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    
    if (expiresAt <= now) {
      issues.push('Session has expired');
    } else if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      recommendations.push('Session expires soon, consider refreshing');
    }
  }
  
  const isCompatible = issues.length === 0;
  
  return {
    isCompatible,
    issues,
    recommendations
  };
}

/**
 * Checks if a session is within the migration grace period
 */
export function isWithinGracePeriod(
  sessionCreatedAt: string | number,
  config: MigrationConfig = DEFAULT_MIGRATION_CONFIG
): boolean {
  try {
    const createdAt = typeof sessionCreatedAt === 'string' 
      ? new Date(sessionCreatedAt)
      : new Date(sessionCreatedAt * 1000);
    
    const gracePeriodMs = config.sessionGracePeriod * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - gracePeriodMs);
    
    return createdAt >= cutoffDate;
  } catch {
    // If we can't parse the date, assume it's not within grace period
    return false;
  }
}

/**
 * Migration message types for user communication
 */
export const MIGRATION_MESSAGES = {
  'auth-method-changed': {
    title: '인증 방식이 변경되었습니다',
    description: '보안 강화를 위해 매직 링크 대신 6자리 OTP 코드를 사용합니다. 이메일로 전송되는 코드를 입력해주세요.',
    type: 'info' as const,
  },
  'session-preserved': {
    title: '기존 로그인이 유지됩니다',
    description: '현재 로그인 상태는 그대로 유지되며, 다음 로그인부터 OTP 방식을 사용하게 됩니다.',
    type: 'success' as const,
  },
  'migration-complete': {
    title: '마이그레이션이 완료되었습니다',
    description: '이제 OTP 인증을 사용하여 더욱 안전하게 로그인할 수 있습니다.',
    type: 'success' as const,
  },
  'compatibility-warning': {
    title: '호환성 문제가 감지되었습니다',
    description: '일부 기능이 제한될 수 있습니다. 다시 로그인해주세요.',
    type: 'warning' as const,
  },
} as const;

export type MigrationMessageType = keyof typeof MIGRATION_MESSAGES;

/**
 * Gets migration message by type
 */
export function getMigrationMessage(type: MigrationMessageType) {
  return MIGRATION_MESSAGES[type];
}

/**
 * Middleware helper to handle magic link redirects
 */
export function handleMagicLinkRedirect(
  request: NextRequest,
  config: MigrationConfig = DEFAULT_MIGRATION_CONFIG
): Response | null {
  if (!config.redirectMagicLinks) {
    return null;
  }
  
  const url = request.url;
  const pathname = new URL(url).pathname;
  
  // Only handle auth callback URLs
  if (pathname !== '/auth/callback') {
    return null;
  }
  
  // Check if this is a magic link callback
  if (isMagicLinkCallback(url)) {
    const redirectUrl = generateOTPRedirectUrl(
      request.nextUrl.origin,
      url,
      config
    );
    
    return Response.redirect(redirectUrl, 302);
  }
  
  return null;
}

/**
 * Client-side helper to detect and handle magic link redirects
 */
export function handleClientMagicLinkRedirect(config: MigrationConfig = DEFAULT_MIGRATION_CONFIG): boolean {
  if (typeof window === 'undefined' || !config.redirectMagicLinks) {
    return false;
  }
  
  const currentUrl = window.location.href;
  const pathname = window.location.pathname;
  
  // Only handle auth callback URLs
  if (pathname !== '/auth/callback') {
    return false;
  }
  
  // Check if this is a magic link callback
  if (isMagicLinkCallback(currentUrl)) {
    const redirectUrl = generateOTPRedirectUrl(
      window.location.origin,
      currentUrl,
      config
    );
    
    window.location.href = redirectUrl;
    return true;
  }
  
  return false;
}