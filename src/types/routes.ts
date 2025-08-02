
/**
 * Route access levels for the application
 */
export type RouteAccessLevel = 'public' | 'semi-public' | 'private';

/**
 * User roles for authorization
 */
export type UserRole = 'user' | 'admin';

/**
 * Configuration for a single route
 */
export interface RouteConfig {
  /** The route path pattern (supports wildcards) */
  path: string;
  /** Access level determining authentication requirements */
  accessLevel: RouteAccessLevel;
  /** Whether authentication is required for this route */
  requiresAuth: boolean;
  /** Optional roles required to access this route */
  allowedRoles?: UserRole[];
  /** Optional description for documentation */
  description?: string;
}

/**
 * Result of route matching operation
 */
export interface RouteMatch {
  /** Whether the path matches the route pattern */
  matches: boolean;
  /** The matched route configuration */
  config: RouteConfig | null;
  /** Extracted parameters from dynamic routes */
  params?: Record<string, string>;
}

/**
 * Authentication context for route access control
 */
export interface AuthContext {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** User's role if authenticated */
  userRole?: UserRole;
  /** User ID if authenticated */
  userId?: string;
}

/**
 * Result of route access check
 */
export interface AccessCheckResult {
  /** Whether access is allowed */
  allowed: boolean;
  /** Reason for denial if access is not allowed */
  reason?: 'not_authenticated' | 'insufficient_role' | 'route_not_found';
  /** Suggested redirect URL if access is denied */
  redirectTo?: string;
}