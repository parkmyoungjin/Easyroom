import { RouteMatch, RouteConfig, AuthContext, AccessCheckResult } from '@/types/routes';
import { routeConfigs } from '@/lib/routes/config';

/**
 * Match a path against route configurations
 */
export function matchRoute(path: string): RouteMatch {
  // Clean the path (remove query params and hash)
  const cleanPath = path.split('?')[0].split('#')[0];
  
  for (const config of routeConfigs) {
    const matches = matchesRoutePattern(config.path, cleanPath);
    if (matches.isMatch) {
      return {
        matches: true,
        config,
        params: matches.params
      };
    }
  }

  return {
    matches: false,
    config: null
  };
}

/**
 * Check if a path matches a route pattern and extract parameters
 */
function matchesRoutePattern(pattern: string, path: string): { isMatch: boolean; params?: Record<string, string> } {
  // Handle exact matches
  if (pattern === path) {
    return { isMatch: true };
  }

  // Handle wildcard patterns (e.g., /admin/*)
  if (pattern.endsWith('/*')) {
    const basePattern = pattern.slice(0, -2);
    if (path.startsWith(basePattern)) {
      const remainingPath = path.slice(basePattern.length);
      return {
        isMatch: true,
        params: remainingPath ? { wildcard: remainingPath.slice(1) } : {}
      };
    }
  }

  // Handle dynamic segments (e.g., /users/[id])
  if (pattern.includes('[') && pattern.includes(']')) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return { isMatch: false };
    }

    const params: Record<string, string> = {};
    let isMatch = true;

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith('[') && patternPart.endsWith(']')) {
        // Dynamic segment
        const paramName = patternPart.slice(1, -1);
        params[paramName] = pathPart;
      } else if (patternPart !== pathPart) {
        // Static segment doesn't match
        isMatch = false;
        break;
      }
    }

    return { isMatch, params: isMatch ? params : undefined };
  }

  return { isMatch: false };
}

/**
 * Check if a user has access to a specific route
 */
export function checkRouteAccess(path: string, authContext: AuthContext): AccessCheckResult {
  const routeMatch = matchRoute(path);

  if (!routeMatch.matches || !routeMatch.config) {
    return {
      allowed: false,
      reason: 'route_not_found',
      redirectTo: '/'
    };
  }

  const config = routeMatch.config;

  // Public routes are always accessible
  if (config.accessLevel === 'public') {
    return { allowed: true };
  }

  // Semi-public routes are accessible but may have limited functionality
  if (config.accessLevel === 'semi-public') {
    return { allowed: true };
  }

  // Private routes require authentication
  if (config.requiresAuth && !authContext.isAuthenticated) {
    return {
      allowed: false,
      reason: 'not_authenticated',
      redirectTo: `/login?redirect=${encodeURIComponent(path)}`
    };
  }

  // Check role-based access
  if (config.allowedRoles && config.allowedRoles.length > 0) {
    if (!authContext.userRole || !config.allowedRoles.includes(authContext.userRole)) {
      return {
        allowed: false,
        reason: 'insufficient_role',
        redirectTo: '/'
      };
    }
  }

  return { allowed: true };
}

/**
 * Get all accessible routes for a given auth context
 */
export function getAccessibleRoutes(authContext: AuthContext): RouteConfig[] {
  return routeConfigs.filter(config => {
    const accessResult = checkRouteAccess(config.path, authContext);
    return accessResult.allowed;
  });
}

/**
 * Check if a route requires authentication
 */
export function requiresAuthentication(path: string): boolean {
  const routeMatch = matchRoute(path);
  return routeMatch.config?.requiresAuth ?? false;
}

/**
 * Check if a route is public (no authentication required)
 */
export function isPublicRoute(path: string): boolean {
  const routeMatch = matchRoute(path);
  return routeMatch.config?.accessLevel === 'public' || false;
}

/**
 * Check if a route is semi-public (optional authentication)
 */
export function isSemiPublicRoute(path: string): boolean {
  const routeMatch = matchRoute(path);
  return routeMatch.config?.accessLevel === 'semi-public' || false;
}