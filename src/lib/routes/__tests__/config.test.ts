import { routeConfigs, getRouteConfig, getRoutesByAccessLevel } from '../config';
import { RouteAccessLevel } from '../../../types/routes';

describe('Route Configuration', () => {
  describe('Route Configs Array', () => {
    it('should have all required route configurations', () => {
      expect(routeConfigs).toBeDefined();
      expect(Array.isArray(routeConfigs)).toBe(true);
      expect(routeConfigs.length).toBeGreaterThan(0);
    });

    it('should have valid structure for each route config', () => {
      routeConfigs.forEach(config => {
        expect(config).toHaveProperty('path');
        expect(config).toHaveProperty('accessLevel');
        expect(config).toHaveProperty('requiresAuth');
        expect(typeof config.path).toBe('string');
        expect(['public', 'semi-public', 'private']).toContain(config.accessLevel);
        expect(typeof config.requiresAuth).toBe('boolean');
      });
    });

    it('should have consistent auth requirements for access levels', () => {
      const publicRoutes = routeConfigs.filter(config => config.accessLevel === 'public');
      const semiPublicRoutes = routeConfigs.filter(config => config.accessLevel === 'semi-public');
      const privateRoutes = routeConfigs.filter(config => config.accessLevel === 'private');

      // Public routes should not require auth
      publicRoutes.forEach(route => {
        expect(route.requiresAuth).toBe(false);
      });

      // Semi-public routes should not require auth
      semiPublicRoutes.forEach(route => {
        expect(route.requiresAuth).toBe(false);
      });

      // Private routes should require auth
      privateRoutes.forEach(route => {
        expect(route.requiresAuth).toBe(true);
      });
    });

    it('should include expected core routes', () => {
      const paths = routeConfigs.map(config => config.path);
      
      // Public routes
      expect(paths).toContain('/login');
      expect(paths).toContain('/signup');
      
      // Semi-public routes
      expect(paths).toContain('/');
      expect(paths).toContain('/dashboard');
      expect(paths).toContain('/reservations/status');
      
      // Private routes
      expect(paths).toContain('/reservations/new');
      expect(paths).toContain('/reservations/my');
      expect(paths).toContain('/admin');
      
      // Wildcard routes
      expect(paths).toContain('/admin/*');
      expect(paths).toContain('/reservations/edit/*');
    });
  });

  describe('getRouteConfig Function', () => {
    it('should return correct config for exact path matches', () => {
      const testCases = [
        { path: '/', expectedAccessLevel: 'semi-public' as RouteAccessLevel },
        { path: '/login', expectedAccessLevel: 'public' as RouteAccessLevel },
        { path: '/dashboard', expectedAccessLevel: 'semi-public' as RouteAccessLevel },
        { path: '/reservations/new', expectedAccessLevel: 'private' as RouteAccessLevel },
        { path: '/admin', expectedAccessLevel: 'private' as RouteAccessLevel }
      ];

      testCases.forEach(({ path, expectedAccessLevel }) => {
        const config = getRouteConfig(path);
        expect(config).not.toBeNull();
        expect(config?.path).toBe(path);
        expect(config?.accessLevel).toBe(expectedAccessLevel);
      });
    });

    it('should return correct config for wildcard path matches', () => {
      const testCases = [
        { path: '/admin/users', expectedPattern: '/admin/*' },
        { path: '/admin/settings/general', expectedPattern: '/admin/*' },
        { path: '/reservations/edit/123', expectedPattern: '/reservations/edit/*' }
      ];

      testCases.forEach(({ path, expectedPattern }) => {
        const config = getRouteConfig(path);
        expect(config).not.toBeNull();
        expect(config?.path).toBe(expectedPattern);
        expect(config?.accessLevel).toBe('private');
      });
    });

    it('should return null for non-existent routes', () => {
      const nonExistentPaths = [
        '/non-existent',
        '/api/users',
        '/unknown/path',
        '/completely/different/path'
      ];

      nonExistentPaths.forEach(path => {
        const config = getRouteConfig(path);
        expect(config).toBeNull();
      });
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = ['', '/', '//double-slash', '/path/with/trailing/slash/'];
      
      edgeCases.forEach(path => {
        expect(() => getRouteConfig(path)).not.toThrow();
      });
    });
  });

  describe('getRoutesByAccessLevel Function', () => {
    it('should return all public routes', () => {
      const publicRoutes = getRoutesByAccessLevel('public');
      
      expect(publicRoutes.length).toBeGreaterThan(0);
      expect(publicRoutes.every(route => route.accessLevel === 'public')).toBe(true);
      expect(publicRoutes.every(route => !route.requiresAuth)).toBe(true);
      
      const paths = publicRoutes.map(route => route.path);
      expect(paths).toContain('/login');
      expect(paths).toContain('/signup');
    });

    it('should return all semi-public routes', () => {
      const semiPublicRoutes = getRoutesByAccessLevel('semi-public');
      
      expect(semiPublicRoutes.length).toBeGreaterThan(0);
      expect(semiPublicRoutes.every(route => route.accessLevel === 'semi-public')).toBe(true);
      expect(semiPublicRoutes.every(route => !route.requiresAuth)).toBe(true);
      
      const paths = semiPublicRoutes.map(route => route.path);
      expect(paths).toContain('/');
      expect(paths).toContain('/dashboard');
      expect(paths).toContain('/reservations/status');
    });

    it('should return all private routes', () => {
      const privateRoutes = getRoutesByAccessLevel('private');
      
      expect(privateRoutes.length).toBeGreaterThan(0);
      expect(privateRoutes.every(route => route.accessLevel === 'private')).toBe(true);
      expect(privateRoutes.every(route => route.requiresAuth)).toBe(true);
      
      const paths = privateRoutes.map(route => route.path);
      expect(paths).toContain('/reservations/new');
      expect(paths).toContain('/reservations/my');
      expect(paths).toContain('/admin');
    });

    it('should return empty array for invalid access level', () => {
      // @ts-expect-error Testing invalid access level
      const invalidRoutes = getRoutesByAccessLevel('invalid');
      expect(invalidRoutes).toEqual([]);
    });
  });

  describe('Route Consistency Validation', () => {
    it('should have no duplicate exact paths', () => {
      const exactPaths = routeConfigs
        .filter(config => !config.path.includes('*'))
        .map(config => config.path);
      
      const uniquePaths = [...new Set(exactPaths)];
      expect(exactPaths.length).toBe(uniquePaths.length);
    });

    it('should have admin routes with proper role restrictions', () => {
      const adminRoutes = routeConfigs.filter(config => 
        config.path.startsWith('/admin')
      );
      
      adminRoutes.forEach(route => {
        expect(route.accessLevel).toBe('private');
        expect(route.requiresAuth).toBe(true);
        expect(route.allowedRoles).toContain('admin');
      });
    });

    it('should have proper descriptions for all routes', () => {
      routeConfigs.forEach(config => {
        expect(config.description).toBeDefined();
        expect(typeof config.description).toBe('string');
        expect(config.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Wildcard Pattern Matching', () => {
    it('should match wildcard patterns correctly', () => {
      const wildcardConfigs = routeConfigs.filter(config => config.path.endsWith('/*'));
      
      expect(wildcardConfigs.length).toBeGreaterThan(0);
      
      wildcardConfigs.forEach(config => {
        const basePath = config.path.slice(0, -2);
        
        // Test exact base path match
        const exactMatch = getRouteConfig(basePath);
        if (exactMatch && exactMatch.path === basePath) {
          // If exact route exists, it should take precedence
          expect(exactMatch.path).toBe(basePath);
        }
        
        // Test wildcard path match
        const wildcardMatch = getRouteConfig(`${basePath}/subpath`);
        expect(wildcardMatch?.path).toBe(config.path);
      });
    });

    it('should prioritize exact matches over wildcard matches', () => {
      // Test that /admin exact match takes precedence over /admin/* wildcard
      const exactMatch = getRouteConfig('/admin');
      expect(exactMatch?.path).toBe('/admin');
      
      // Test that wildcard still works for sub-paths
      const wildcardMatch = getRouteConfig('/admin/users');
      expect(wildcardMatch?.path).toBe('/admin/*');
    });
  });
});