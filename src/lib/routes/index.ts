// Route configuration
export { routeConfigs, getRouteConfig, getRoutesByAccessLevel } from './config';

// Route matching utilities
export {
  matchRoute,
  checkRouteAccess,
  getAccessibleRoutes,
  requiresAuthentication,
  isPublicRoute,
  isSemiPublicRoute
} from './matcher';

// Types
export type {
  RouteAccessLevel,
  UserRole,
  RouteConfig,
  RouteMatch,
  AuthContext,
  AccessCheckResult
} from '@/types/routes';