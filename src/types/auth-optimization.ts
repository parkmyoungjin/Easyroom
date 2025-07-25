/**
 * Types for the optimized PWA authentication system
 * Replaces BroadcastChannel with localStorage-based state management
 */

export interface AuthState {
  status: 'authenticated' | 'unauthenticated' | 'pending';
  timestamp: number;
  userId?: string;
  sessionToken?: string;
  source: 'internal' | 'external_app';
}

export interface StoredAuthState {
  version: string; // '2.0' for optimized system
  state: AuthState;
  metadata: {
    createdAt: number;
    updatedAt: number;
    source: 'internal' | 'external_app' | 'migration';
  };
}

export interface PollingConfig {
  interval: number; // milliseconds
  maxAge: number; // maximum age of auth state in milliseconds
  retryAttempts: number;
  backoffMultiplier: number;
}

export interface RedirectionConfig {
  baseUrl: string;
  verifiedPagePath: string; // '/auth/callback/verified'
  autoRedirectDelay: number;
  fallbackEnabled: boolean;
}

export interface AuthReturnData {
  success: boolean;
  userId?: string;
  sessionToken?: string;
  error?: string;
}

export interface AuthResult {
  success: boolean;
  userId?: string;
  sessionToken?: string;
  error?: string;
  timestamp: number;
}

export type AuthStateChangeCallback = (state: AuthState | null) => void;