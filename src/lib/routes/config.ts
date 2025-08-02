import { RouteConfig } from '@/types/routes';

/**
 * Centralized route configuration for the application
 * This defines access levels and authentication requirements for all routes
 */
export const routeConfigs: RouteConfig[] = [
  // Public routes - no authentication required
  {
    path: '/',
    accessLevel: 'semi-public',
    requiresAuth: false,
    description: 'Main landing page, acts as hub for logged-in users'
  },
  {
    path: '/login',
    accessLevel: 'public',
    requiresAuth: false,
    description: 'Login page'
  },
  {
    path: '/signup',
    accessLevel: 'public',
    requiresAuth: false,
    description: 'Signup page'
  },

  // Semi-public routes - authentication optional, enhanced features for authenticated users
  {
    path: '/dashboard',
    accessLevel: 'semi-public',
    requiresAuth: false,
    description: 'Dashboard with limited access for non-authenticated users'
  },
  {
    path: '/reservations/status',
    accessLevel: 'semi-public',
    requiresAuth: false,
    description: 'Reservation status page with limited access for non-authenticated users'
  },

  // Private routes - authentication required
  {
    path: '/reservations/new',
    accessLevel: 'private',
    requiresAuth: true,
    description: 'Create new reservation'
  },
  {
    path: '/reservations/my',
    accessLevel: 'private',
    requiresAuth: true,
    description: 'User\'s reservations'
  },
  {
    path: '/reservations/edit/*',
    accessLevel: 'private',
    requiresAuth: true,
    description: 'Edit reservation (dynamic route)'
  },
  {
    path: '/reservations/*',
    accessLevel: 'private',
    requiresAuth: true,
    description: 'Other reservation pages'
  },

  // Admin routes - authentication and admin role required
  {
    path: '/admin',
    accessLevel: 'private',
    requiresAuth: true,
    allowedRoles: ['admin'],
    description: 'Admin dashboard'
  },
  {
    path: '/admin/*',
    accessLevel: 'private',
    requiresAuth: true,
    allowedRoles: ['admin'],
    description: 'Admin pages (dynamic routes)'
  }
];

/**
 * Get route configuration by path
 */
export function getRouteConfig(path: string): RouteConfig | null {
  return routeConfigs.find(config => matchesPath(config.path, path)) || null;
}

/**
 * Get all routes with a specific access level
 */
export function getRoutesByAccessLevel(accessLevel: RouteConfig['accessLevel']): RouteConfig[] {
  return routeConfigs.filter(config => config.accessLevel === accessLevel);
}

/**
 * Check if a path matches a route pattern (supports wildcards)
 */
function matchesPath(pattern: string, path: string): boolean {
  // Handle exact matches
  if (pattern === path) {
    return true;
  }

  // Handle wildcard patterns
  if (pattern.endsWith('/*')) {
    const basePattern = pattern.slice(0, -2);
    return path.startsWith(basePattern);
  }

  return false;
}