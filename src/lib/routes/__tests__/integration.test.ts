import { 
  matchRoute, 
  checkRouteAccess, 
  getAccessibleRoutes,
  isPublicRoute,
  isSemiPublicRoute,
  requiresAuthentication
} from '../matcher';
import { getRouteConfig, getRoutesByAccessLevel, routeConfigs } from '../config';
import { AuthContext, RouteConfig } from '../../../types/routes';

describe('Route System Integration Tests', () => {
  // Test user contexts
  const contexts = {
    anonymous: { isAuthenticated: false } as AuthContext,
    user: { isAuthenticated: true, userRole: 'user' as const, userId: 'user123' } as AuthContext,
    admin: { isAuthenticated: true, userRole: 'admin' as const, userId: 'admin123' } as AuthContext
  };

  describe('End-to-End Route Access Scenarios', () => {
    describe('Anonymous User Journey', () => {
      it('should allow access to public pages only', () => {
        const publicPaths = ['/', '/login', '/signup'];
        const semiPublicPaths = ['/dashboard', '/reservations/status'];
        const privatePaths = ['/reservations/new', '/reservations/my', '/admin'];

        // Should access public routes
        publicPaths.forEach(path => {
          const access = checkRouteAccess(path, contexts.anonymous);
          expect(access.allowed).toBe(true);
        });

        // Should access semi-public routes (with limited functionality)
        semiPublicPaths.forEach(path => {
          const access = checkRouteAccess(path, contexts.anonymous);
          expect(access.allowed).toBe(true);
        });

        // Should be denied private routes
        privatePaths.forEach(path => {
          const access = checkRouteAccess(path, contexts.anonymous);
          expect(access.allowed).toBe(false);
          expect(access.reason).toBe('not_authenticated');
          expect(access.redirectTo).toContain('/login');
        });
      });

      it('should get correct accessible routes list', () => {
        const accessible = getAccessibleRoutes(contexts.anonymous);
        const accessLevels = accessible.map(route => route.accessLevel);
        
        expect(accessLevels).toContain('public');
        expect(accessLevels).toContain('semi-public');
        expect(accessLevels).not.toContain('private');
      });
    });

    describe('Regular User Journey', () => {
      it('should allow access to public, semi-public, and non-admin private routes', () => {
        const allowedPaths = [
          '/', '/login', '/signup', // public
          '/dashboard', '/reservations/status', // semi-public
          '/reservations/new', '/reservations/my' // private non-admin
        ];
        
        const deniedPaths = ['/admin', '/admin/users']; // admin only

        allowedPaths.forEach(path => {
          const access = checkRouteAccess(path, contexts.user);
          expect(access.allowed).toBe(true);
        });

        deniedPaths.forEach(path => {
          const access = checkRouteAccess(path, contexts.user);
          expect(access.allowed).toBe(false);
          expect(access.reason).toBe('insufficient_role');
        });
      });

      it('should get correct accessible routes list', () => {
        const accessible = getAccessibleRoutes(contexts.user);
        const hasAdminRoutes = accessible.some(route => 
          route.allowedRoles?.includes('admin')
        );
        
        expect(hasAdminRoutes).toBe(false);
        
        const accessLevels = accessible.map(route => route.accessLevel);
        expect(accessLevels).toContain('public');
        expect(accessLevels).toContain('semi-public');
        expect(accessLevels).toContain('private');
      });
    });

    describe('Admin User Journey', () => {
      it('should allow access to all routes', () => {
        const allPaths = [
          '/', '/login', '/signup', // public
          '/dashboard', '/reservations/status', // semi-public
          '/reservations/new', '/reservations/my', // private
          '/admin', '/admin/users' // admin
        ];

        allPaths.forEach(path => {
          const access = checkRouteAccess(path, contexts.admin);
          expect(access.allowed).toBe(true);
        });
      });

      it('should get all accessible routes including admin routes', () => {
        const accessible = getAccessibleRoutes(contexts.admin);
        const hasAdminRoutes = accessible.some(route => 
          route.allowedRoles?.includes('admin')
        );
        
        expect(hasAdminRoutes).toBe(true);
      });
    });
  });

  describe('Route Pattern Matching Integration', () => {
    it('should handle complex wildcard scenarios', () => {
      const testCases = [
        {
          path: '/admin/users/123/edit',
          expectedConfig: '/admin/*',
          expectedParams: { wildcard: 'users/123/edit' }
        },
        {
          path: '/reservations/edit/456/details',
          expectedConfig: '/reservations/edit/*',
          expectedParams: { wildcard: '456/details' }
        }
      ];

      testCases.forEach(({ path, expectedConfig, expectedParams }) => {
        const match = matchRoute(path);
        expect(match.matches).toBe(true);
        expect(match.config?.path).toBe(expectedConfig);
        expect(match.params).toEqual(expectedParams);
      });
    });

    it('should prioritize exact matches over wildcards', () => {
      // /admin should match exact route, not wildcard
      const exactMatch = matchRoute('/admin');
      expect(exactMatch.config?.path).toBe('/admin');
      
      // /admin/something should match wildcard
      const wildcardMatch = matchRoute('/admin/something');
      expect(wildcardMatch.config?.path).toBe('/admin/*');
    });
  });

  describe('Configuration Consistency Validation', () => {
    it('should have consistent route definitions across all functions', () => {
      routeConfigs.forEach(config => {
        // Test that getRouteConfig can find this route
        const foundConfig = getRouteConfig(config.path);
        if (!config.path.includes('*')) {
          expect(foundConfig).toEqual(config);
        }

        // Test utility functions consistency
        const isPublic = isPublicRoute(config.path);
        const isSemiPublic = isSemiPublicRoute(config.path);
        const requiresAuth = requiresAuthentication(config.path);

        expect(isPublic).toBe(config.accessLevel === 'public');
        expect(isSemiPublic).toBe(config.accessLevel === 'semi-public');
        expect(requiresAuth).toBe(config.requiresAuth);
      });
    });

    it('should have no conflicting route patterns', () => {
      const patterns = routeConfigs.map(config => config.path);
      
      // Check for potential conflicts
      patterns.forEach(pattern => {
        if (pattern.endsWith('/*')) {
          const basePath = pattern.slice(0, -2);
          const exactRouteExists = patterns.includes(basePath);
          
          if (exactRouteExists) {
            // This is okay - exact routes should take precedence
            const exactMatch = matchRoute(basePath);
            const wildcardMatch = matchRoute(`${basePath}/sub`);
            
            expect(exactMatch.config?.path).toBe(basePath);
            expect(wildcardMatch.config?.path).toBe(pattern);
          }
        }
      });
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should handle reservation management workflow', () => {
      // Anonymous user tries to create reservation
      let access = checkRouteAccess('/reservations/new', contexts.anonymous);
      expect(access.allowed).toBe(false);
      expect(access.redirectTo).toContain('/login');

      // User logs in and creates reservation
      access = checkRouteAccess('/reservations/new', contexts.user);
      expect(access.allowed).toBe(true);

      // User views their reservations
      access = checkRouteAccess('/reservations/my', contexts.user);
      expect(access.allowed).toBe(true);

      // User edits a specific reservation
      access = checkRouteAccess('/reservations/edit/123', contexts.user);
      expect(access.allowed).toBe(true);
    });

    it('should handle admin management workflow', () => {
      // Regular user tries to access admin
      let access = checkRouteAccess('/admin', contexts.user);
      expect(access.allowed).toBe(false);
      expect(access.reason).toBe('insufficient_role');

      // Admin accesses admin dashboard
      access = checkRouteAccess('/admin', contexts.admin);
      expect(access.allowed).toBe(true);

      // Admin manages users
      access = checkRouteAccess('/admin/users', contexts.admin);
      expect(access.allowed).toBe(true);

      // Admin accesses deep admin routes
      access = checkRouteAccess('/admin/settings/security', contexts.admin);
      expect(access.allowed).toBe(true);
    });

    it('should handle dashboard access for different user types', () => {
      // Anonymous user can view dashboard (limited functionality)
      let access = checkRouteAccess('/dashboard', contexts.anonymous);
      expect(access.allowed).toBe(true);

      // Regular user gets full dashboard access
      access = checkRouteAccess('/dashboard', contexts.user);
      expect(access.allowed).toBe(true);

      // Admin gets full dashboard access
      access = checkRouteAccess('/dashboard', contexts.admin);
      expect(access.allowed).toBe(true);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle malformed paths gracefully', () => {
      const malformedPaths = [
        '',
        '//double-slash',
        '/path//with//multiple//slashes',
        '/path/with/trailing/slash/',
        '?only=query',
        '#only-hash'
      ];

      malformedPaths.forEach(path => {
        expect(() => {
          const match = matchRoute(path);
          const access = checkRouteAccess(path, contexts.user);
          const isPublic = isPublicRoute(path);
          const isSemiPublic = isSemiPublicRoute(path);
          const requiresAuth = requiresAuthentication(path);
        }).not.toThrow();
      });
    });

    it('should handle undefined/null auth context gracefully', () => {
      const invalidContexts = [
        { isAuthenticated: false, userRole: undefined, userId: undefined },
        { isAuthenticated: true, userRole: undefined, userId: undefined },
        { isAuthenticated: true, userRole: 'user' as const, userId: undefined }
      ];

      invalidContexts.forEach(context => {
        expect(() => {
          checkRouteAccess('/reservations/new', context);
          getAccessibleRoutes(context);
        }).not.toThrow();
      });
    });

    it('should handle route access for non-existent routes', () => {
      const nonExistentPaths = [
        '/non-existent',
        '/api/should-not-match',
        '/unknown/deep/path'
      ];

      nonExistentPaths.forEach(path => {
        const access = checkRouteAccess(path, contexts.user);
        expect(access.allowed).toBe(false);
        expect(access.reason).toBe('route_not_found');
        expect(access.redirectTo).toBe('/');
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of route checks efficiently', () => {
      const paths = [
        '/', '/login', '/signup', '/dashboard', '/reservations/status',
        '/reservations/new', '/reservations/my', '/admin', '/admin/users'
      ];
      
      const startTime = performance.now();
      
      // Perform many route checks
      for (let i = 0; i < 1000; i++) {
        paths.forEach(path => {
          matchRoute(path);
          checkRouteAccess(path, contexts.user);
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second for 9000 operations
    });

    it('should handle complex wildcard patterns efficiently', () => {
      const wildcardPaths = [
        '/admin/users/123/edit/profile',
        '/admin/settings/security/advanced/options',
        '/reservations/edit/456/details/payment/history'
      ];
      
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        wildcardPaths.forEach(path => {
          const match = matchRoute(path);
          expect(match.matches).toBe(true);
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Route Configuration Completeness', () => {
    it('should cover all expected application routes', () => {
      const expectedRouteTypes = {
        public: ['/', '/login', '/signup'],
        semiPublic: ['/dashboard', '/reservations/status'],
        private: ['/reservations/new', '/reservations/my'],
        admin: ['/admin'],
        wildcards: ['/admin/*', '/reservations/edit/*']
      };

      const configPaths = routeConfigs.map(config => config.path);

      Object.entries(expectedRouteTypes).forEach(([type, paths]) => {
        paths.forEach(path => {
          expect(configPaths).toContain(path);
        });
      });
    });

    it('should have proper access level distribution', () => {
      const publicRoutes = getRoutesByAccessLevel('public');
      const semiPublicRoutes = getRoutesByAccessLevel('semi-public');
      const privateRoutes = getRoutesByAccessLevel('private');

      expect(publicRoutes.length).toBeGreaterThan(0);
      expect(semiPublicRoutes.length).toBeGreaterThan(0);
      expect(privateRoutes.length).toBeGreaterThan(0);

      const total = publicRoutes.length + semiPublicRoutes.length + privateRoutes.length;
      expect(total).toBe(routeConfigs.length);
    });
  });
});