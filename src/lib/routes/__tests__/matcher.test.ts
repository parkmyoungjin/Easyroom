import { 
  matchRoute, 
  checkRouteAccess, 
  isPublicRoute, 
  isSemiPublicRoute, 
  requiresAuthentication,
  getAccessibleRoutes
} from '../matcher';
import { getRouteConfig, getRoutesByAccessLevel } from '../config';
import { AuthContext } from '../../../types/routes';

describe('Route Matcher System', () => {
  // Test data for different user contexts
  const unauthenticatedUser: AuthContext = {
    isAuthenticated: false
  };

  const authenticatedUser: AuthContext = {
    isAuthenticated: true,
    userRole: 'user',
    userId: 'user123'
  };

  const adminUser: AuthContext = {
    isAuthenticated: true,
    userRole: 'admin',
    userId: 'admin123'
  };

  describe('Route Pattern Matching', () => {
    describe('Exact Route Matching', () => {
      it('should match exact public routes', () => {
        const publicRoutes = ['/login', '/signup'];
        publicRoutes.forEach(route => {
          const result = matchRoute(route);
          expect(result.matches).toBe(true);
          expect(result.config?.path).toBe(route);
          expect(result.config?.accessLevel).toBe('public');
        });

        // Test semi-public route separately
        const homeResult = matchRoute('/');
        expect(homeResult.matches).toBe(true);
        expect(homeResult.config?.path).toBe('/');
        expect(homeResult.config?.accessLevel).toBe('semi-public');
      });

      it('should match exact semi-public routes', () => {
        const routes = ['/dashboard', '/reservations/status'];
        routes.forEach(route => {
          const result = matchRoute(route);
          expect(result.matches).toBe(true);
          expect(result.config?.path).toBe(route);
          expect(result.config?.accessLevel).toBe('semi-public');
        });
      });

      it('should match exact private routes', () => {
        const routes = ['/reservations/new', '/reservations/my', '/admin'];
        routes.forEach(route => {
          const result = matchRoute(route);
          expect(result.matches).toBe(true);
          expect(result.config?.path).toBe(route);
          expect(result.config?.accessLevel).toBe('private');
        });
      });
    });

    describe('Wildcard Route Matching', () => {
      it('should match admin wildcard routes', () => {
        const testCases = [
          { path: '/admin/users', expectedWildcard: 'users' },
          { path: '/admin/settings/general', expectedWildcard: 'settings/general' },
          { path: '/admin/dashboard', expectedWildcard: 'dashboard' }
        ];

        testCases.forEach(({ path, expectedWildcard }) => {
          const result = matchRoute(path);
          expect(result.matches).toBe(true);
          expect(result.config?.path).toBe('/admin/*');
          expect(result.params?.wildcard).toBe(expectedWildcard);
        });
      });

      it('should match reservation wildcard routes', () => {
        const testCases = [
          { path: '/reservations/edit/123', expectedPattern: '/reservations/edit/*', expectedWildcard: '123' },
          { path: '/reservations/view/456', expectedPattern: '/reservations/*', expectedWildcard: 'view/456' },
          { path: '/reservations/cancel/789', expectedPattern: '/reservations/*', expectedWildcard: 'cancel/789' }
        ];

        testCases.forEach(({ path, expectedPattern, expectedWildcard }) => {
          const result = matchRoute(path);
          expect(result.matches).toBe(true);
          expect(result.config?.path).toBe(expectedPattern);
          expect(result.params?.wildcard).toBe(expectedWildcard);
        });
      });

      it('should handle empty wildcard paths', () => {
        const result = matchRoute('/admin');
        expect(result.matches).toBe(true);
        expect(result.config?.path).toBe('/admin');
      });
    });

    describe('Path Cleaning', () => {
      it('should clean query parameters from paths', () => {
        const result = matchRoute('/dashboard?tab=overview&filter=active');
        expect(result.matches).toBe(true);
        expect(result.config?.path).toBe('/dashboard');
      });

      it('should clean hash fragments from paths', () => {
        const result = matchRoute('/reservations/new#form-section');
        expect(result.matches).toBe(true);
        expect(result.config?.path).toBe('/reservations/new');
      });

      it('should clean both query params and hash fragments', () => {
        const result = matchRoute('/admin/users?page=2&sort=name#user-list');
        expect(result.matches).toBe(true);
        expect(result.config?.path).toBe('/admin/*');
        expect(result.params?.wildcard).toBe('users');
      });
    });

    describe('Non-matching Routes', () => {
      it('should not match non-existent routes', () => {
        const nonExistentRoutes = [
          '/non-existent',
          '/api/users',
          '/unknown/path',
          '/completely/different/path'
        ];

        nonExistentRoutes.forEach(route => {
          const result = matchRoute(route);
          expect(result.matches).toBe(false);
          expect(result.config).toBe(null);
        });
      });
    });
  });

  describe('Route Access Control', () => {
    describe('Public Route Access', () => {
      it('should allow unauthenticated access to public routes', () => {
        const publicRoutes = ['/', '/login', '/signup'];
        
        publicRoutes.forEach(route => {
          const result = checkRouteAccess(route, unauthenticatedUser);
          expect(result.allowed).toBe(true);
          expect(result.reason).toBeUndefined();
          expect(result.redirectTo).toBeUndefined();
        });
      });

      it('should allow authenticated access to public routes', () => {
        const publicRoutes = ['/', '/login', '/signup'];
        
        publicRoutes.forEach(route => {
          const result = checkRouteAccess(route, authenticatedUser);
          expect(result.allowed).toBe(true);
        });
      });
    });

    describe('Semi-Public Route Access', () => {
      it('should allow unauthenticated access to semi-public routes', () => {
        const semiPublicRoutes = ['/dashboard', '/reservations/status'];
        
        semiPublicRoutes.forEach(route => {
          const result = checkRouteAccess(route, unauthenticatedUser);
          expect(result.allowed).toBe(true);
          expect(result.reason).toBeUndefined();
        });
      });

      it('should allow authenticated access to semi-public routes', () => {
        const semiPublicRoutes = ['/dashboard', '/reservations/status'];
        
        semiPublicRoutes.forEach(route => {
          const result = checkRouteAccess(route, authenticatedUser);
          expect(result.allowed).toBe(true);
        });
      });
    });

    describe('Private Route Access', () => {
      it('should deny unauthenticated access to private routes', () => {
        const privateRoutes = ['/reservations/new', '/reservations/my'];
        
        privateRoutes.forEach(route => {
          const result = checkRouteAccess(route, unauthenticatedUser);
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('not_authenticated');
          expect(result.redirectTo).toBe(`/login?redirect=${encodeURIComponent(route)}`);
        });
      });

      it('should allow authenticated access to private routes', () => {
        const privateRoutes = ['/reservations/new', '/reservations/my'];
        
        privateRoutes.forEach(route => {
          const result = checkRouteAccess(route, authenticatedUser);
          expect(result.allowed).toBe(true);
          expect(result.reason).toBeUndefined();
        });
      });
    });

    describe('Admin Route Access', () => {
      it('should deny unauthenticated access to admin routes', () => {
        const adminRoutes = ['/admin', '/admin/users'];
        
        adminRoutes.forEach(route => {
          const result = checkRouteAccess(route, unauthenticatedUser);
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('not_authenticated');
          expect(result.redirectTo).toBe(`/login?redirect=${encodeURIComponent(route)}`);
        });
      });

      it('should deny regular user access to admin routes', () => {
        const adminRoutes = ['/admin', '/admin/users'];
        
        adminRoutes.forEach(route => {
          const result = checkRouteAccess(route, authenticatedUser);
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('insufficient_role');
          expect(result.redirectTo).toBe('/');
        });
      });

      it('should allow admin access to admin routes', () => {
        const adminRoutes = ['/admin', '/admin/users'];
        
        adminRoutes.forEach(route => {
          const result = checkRouteAccess(route, adminUser);
          expect(result.allowed).toBe(true);
          expect(result.reason).toBeUndefined();
        });
      });
    });

    describe('Route Not Found Handling', () => {
      it('should handle non-existent routes', () => {
        const result = checkRouteAccess('/non-existent', authenticatedUser);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('route_not_found');
        expect(result.redirectTo).toBe('/');
      });
    });
  });

  describe('Utility Functions', () => {
    describe('Route Type Identification', () => {
      it('should correctly identify public routes', () => {
        expect(isPublicRoute('/')).toBe(false); // '/' is semi-public, not public
        expect(isPublicRoute('/login')).toBe(true);
        expect(isPublicRoute('/signup')).toBe(true);
        expect(isPublicRoute('/dashboard')).toBe(false);
        expect(isPublicRoute('/reservations/new')).toBe(false);
        expect(isPublicRoute('/admin')).toBe(false);
      });

      it('should correctly identify semi-public routes', () => {
        expect(isSemiPublicRoute('/dashboard')).toBe(true);
        expect(isSemiPublicRoute('/reservations/status')).toBe(true);
        expect(isSemiPublicRoute('/')).toBe(true); // '/' is semi-public according to config
        expect(isSemiPublicRoute('/reservations/new')).toBe(false);
        expect(isSemiPublicRoute('/admin')).toBe(false);
      });

      it('should correctly identify routes requiring authentication', () => {
        expect(requiresAuthentication('/reservations/new')).toBe(true);
        expect(requiresAuthentication('/reservations/my')).toBe(true);
        expect(requiresAuthentication('/admin')).toBe(true);
        expect(requiresAuthentication('/')).toBe(false);
        expect(requiresAuthentication('/dashboard')).toBe(false);
        expect(requiresAuthentication('/login')).toBe(false);
      });
    });

    describe('Accessible Routes Filtering', () => {
      it('should return correct accessible routes for unauthenticated users', () => {
        const accessibleRoutes = getAccessibleRoutes(unauthenticatedUser);
        const accessLevels = accessibleRoutes.map(route => route.accessLevel);
        
        expect(accessLevels).toContain('public');
        expect(accessLevels).toContain('semi-public');
        expect(accessLevels).not.toContain('private');
      });

      it('should return correct accessible routes for authenticated users', () => {
        const accessibleRoutes = getAccessibleRoutes(authenticatedUser);
        const accessLevels = accessibleRoutes.map(route => route.accessLevel);
        
        expect(accessLevels).toContain('public');
        expect(accessLevels).toContain('semi-public');
        expect(accessLevels).toContain('private');
        
        // Should not include admin-only routes
        const adminOnlyRoutes = accessibleRoutes.filter(route => 
          route.allowedRoles?.includes('admin')
        );
        expect(adminOnlyRoutes).toHaveLength(0);
      });

      it('should return all accessible routes for admin users', () => {
        const accessibleRoutes = getAccessibleRoutes(adminUser);
        const accessLevels = accessibleRoutes.map(route => route.accessLevel);
        
        expect(accessLevels).toContain('public');
        expect(accessLevels).toContain('semi-public');
        expect(accessLevels).toContain('private');
        
        // Should include admin-only routes
        const adminOnlyRoutes = accessibleRoutes.filter(route => 
          route.allowedRoles?.includes('admin')
        );
        expect(adminOnlyRoutes.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Route Configuration', () => {
    describe('Route Config Retrieval', () => {
      it('should retrieve route config by exact path', () => {
        const config = getRouteConfig('/dashboard');
        expect(config).not.toBeNull();
        expect(config?.path).toBe('/dashboard');
        expect(config?.accessLevel).toBe('semi-public');
      });

      it('should retrieve route config by wildcard path', () => {
        const config = getRouteConfig('/admin/users');
        expect(config).not.toBeNull();
        expect(config?.path).toBe('/admin/*');
        expect(config?.accessLevel).toBe('private');
        expect(config?.allowedRoles).toContain('admin');
      });

      it('should return null for non-existent routes', () => {
        const config = getRouteConfig('/non-existent');
        expect(config).toBeNull();
      });
    });

    describe('Routes by Access Level', () => {
      it('should return all public routes', () => {
        const publicRoutes = getRoutesByAccessLevel('public');
        expect(publicRoutes.length).toBeGreaterThan(0);
        expect(publicRoutes.every(route => route.accessLevel === 'public')).toBe(true);
        expect(publicRoutes.every(route => !route.requiresAuth)).toBe(true);
      });

      it('should return all semi-public routes', () => {
        const semiPublicRoutes = getRoutesByAccessLevel('semi-public');
        expect(semiPublicRoutes.length).toBeGreaterThan(0);
        expect(semiPublicRoutes.every(route => route.accessLevel === 'semi-public')).toBe(true);
        expect(semiPublicRoutes.every(route => !route.requiresAuth)).toBe(true);
      });

      it('should return all private routes', () => {
        const privateRoutes = getRoutesByAccessLevel('private');
        expect(privateRoutes.length).toBeGreaterThan(0);
        expect(privateRoutes.every(route => route.accessLevel === 'private')).toBe(true);
        expect(privateRoutes.every(route => route.requiresAuth)).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty paths', () => {
      const result = matchRoute('');
      expect(result.matches).toBe(false);
      expect(result.config).toBe(null);
    });

    it('should handle paths with only query parameters', () => {
      const result = matchRoute('?tab=overview');
      expect(result.matches).toBe(false);
      expect(result.config).toBe(null);
    });

    it('should handle paths with only hash fragments', () => {
      const result = matchRoute('#section');
      expect(result.matches).toBe(false);
      expect(result.config).toBe(null);
    });

    it('should handle malformed URLs gracefully', () => {
      const malformedPaths = [
        '//double-slash',
        '/path//with//double//slashes',
        '/path/with/trailing/slash/',
      ];

      malformedPaths.forEach(path => {
        expect(() => matchRoute(path)).not.toThrow();
      });
    });

    it('should handle undefined auth context gracefully', () => {
      const undefinedAuthContext = {
        isAuthenticated: false,
        userRole: undefined,
        userId: undefined
      };

      const result = checkRouteAccess('/reservations/new', undefinedAuthContext);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('not_authenticated');
    });
  });
});