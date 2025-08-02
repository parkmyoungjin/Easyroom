import { 
  matchRoute, 
  checkRouteAccess, 
  getAccessibleRoutes,
  isPublicRoute,
  isSemiPublicRoute,
  requiresAuthentication
} from '../matcher';
import { getRouteConfig } from '../config';
import { AuthContext } from '../../../types/routes';

describe('End-to-End Route System Scenarios', () => {
  const contexts = {
    anonymous: { isAuthenticated: false } as AuthContext,
    newUser: { isAuthenticated: true, userRole: 'user' as const, userId: 'new-user-123' } as AuthContext,
    regularUser: { isAuthenticated: true, userRole: 'user' as const, userId: 'regular-user-456' } as AuthContext,
    adminUser: { isAuthenticated: true, userRole: 'admin' as const, userId: 'admin-789' } as AuthContext,
    expiredSession: { isAuthenticated: false, userId: 'expired-user-999' } as AuthContext
  };

  describe('User Journey: First-Time Visitor', () => {
    it('should handle complete first-time visitor flow', () => {
      const visitor = contexts.anonymous;
      
      // 1. Visitor lands on main page
      let access = checkRouteAccess('/', visitor);
      expect(access.allowed).toBe(true);
      expect(isSemiPublicRoute('/')).toBe(true);
      
      // 2. Visitor explores public pages
      const publicPages = ['/login', '/signup'];
      publicPages.forEach(page => {
        access = checkRouteAccess(page, visitor);
        expect(access.allowed).toBe(true);
      });
      
      // 3. Visitor tries to access semi-public pages
      const semiPublicPages = ['/dashboard', '/reservations/status'];
      semiPublicPages.forEach(page => {
        access = checkRouteAccess(page, visitor);
        expect(access.allowed).toBe(true);
        expect(isSemiPublicRoute(page)).toBe(true);
      });
      
      // 4. Visitor tries to access protected features
      const protectedPages = ['/reservations/new', '/reservations/my'];
      protectedPages.forEach(page => {
        access = checkRouteAccess(page, visitor);
        expect(access.allowed).toBe(false);
        expect(access.reason).toBe('not_authenticated');
        expect(access.redirectTo).toContain('/login');
        expect(requiresAuthentication(page)).toBe(true);
      });
      
      // 5. Check accessible routes for visitor
      const accessibleRoutes = getAccessibleRoutes(visitor);
      const accessLevels = accessibleRoutes.map(route => route.accessLevel);
      expect(accessLevels).toContain('public');
      expect(accessLevels).toContain('semi-public');
      expect(accessLevels).not.toContain('private');
    });

    it('should preserve intended destination during login flow', () => {
      const visitor = contexts.anonymous;
      const intendedDestination = '/reservations/new';
      
      // Visitor tries to access protected page
      const access = checkRouteAccess(intendedDestination, visitor);
      expect(access.allowed).toBe(false);
      expect(access.redirectTo).toBe(`/login?redirect=${encodeURIComponent(intendedDestination)}`);
      
      // After login, should be able to access the intended page
      const loggedInAccess = checkRouteAccess(intendedDestination, contexts.newUser);
      expect(loggedInAccess.allowed).toBe(true);
    });
  });

  describe('User Journey: New User Registration and First Use', () => {
    it('should handle complete new user onboarding flow', () => {
      const newUser = contexts.newUser;
      
      // 1. New user can access all public pages
      const publicPages = ['/', '/login', '/signup'];
      publicPages.forEach(page => {
        const access = checkRouteAccess(page, newUser);
        expect(access.allowed).toBe(true);
      });
      
      // 2. New user can access semi-public pages with full functionality
      const semiPublicPages = ['/dashboard', '/reservations/status'];
      semiPublicPages.forEach(page => {
        const access = checkRouteAccess(page, newUser);
        expect(access.allowed).toBe(true);
      });
      
      // 3. New user can access private pages
      const privatePages = ['/reservations/new', '/reservations/my'];
      privatePages.forEach(page => {
        const access = checkRouteAccess(page, newUser);
        expect(access.allowed).toBe(true);
      });
      
      // 4. New user cannot access admin pages
      const adminPages = ['/admin', '/admin/users'];
      adminPages.forEach(page => {
        const access = checkRouteAccess(page, newUser);
        expect(access.allowed).toBe(false);
        expect(access.reason).toBe('insufficient_role');
      });
      
      // 5. Check accessible routes for new user
      const accessibleRoutes = getAccessibleRoutes(newUser);
      const hasAdminRoutes = accessibleRoutes.some(route => 
        route.allowedRoles?.includes('admin')
      );
      expect(hasAdminRoutes).toBe(false);
    });
  });

  describe('User Journey: Regular User Daily Usage', () => {
    it('should handle typical user workflow', () => {
      const user = contexts.regularUser;
      
      // 1. User starts at main page
      let access = checkRouteAccess('/', user);
      expect(access.allowed).toBe(true);
      
      // 2. User navigates to dashboard
      access = checkRouteAccess('/dashboard', user);
      expect(access.allowed).toBe(true);
      
      // 3. User checks reservation status
      access = checkRouteAccess('/reservations/status', user);
      expect(access.allowed).toBe(true);
      
      // 4. User creates new reservation
      access = checkRouteAccess('/reservations/new', user);
      expect(access.allowed).toBe(true);
      
      // 5. User views their reservations
      access = checkRouteAccess('/reservations/my', user);
      expect(access.allowed).toBe(true);
      
      // 6. User edits a specific reservation
      access = checkRouteAccess('/reservations/edit/123', user);
      expect(access.allowed).toBe(true);
      
      // 7. User tries to access admin area (should be denied)
      access = checkRouteAccess('/admin', user);
      expect(access.allowed).toBe(false);
      expect(access.reason).toBe('insufficient_role');
    });

    it('should handle reservation management workflow', () => {
      const user = contexts.regularUser;
      
      // Complete reservation workflow
      const reservationFlow = [
        '/reservations/new',      // Create reservation
        '/reservations/my',       // View reservations
        '/reservations/edit/456', // Edit specific reservation
        '/reservations/status'    // Check status
      ];
      
      reservationFlow.forEach(path => {
        const access = checkRouteAccess(path, user);
        expect(access.allowed).toBe(true);
        
        const match = matchRoute(path);
        expect(match.matches).toBe(true);
      });
    });
  });

  describe('User Journey: Admin User Management', () => {
    it('should handle complete admin workflow', () => {
      const admin = contexts.adminUser;
      
      // 1. Admin can access all user pages
      const userPages = ['/', '/dashboard', '/reservations/new', '/reservations/my'];
      userPages.forEach(page => {
        const access = checkRouteAccess(page, admin);
        expect(access.allowed).toBe(true);
      });
      
      // 2. Admin can access admin pages
      const adminPages = ['/admin', '/admin/users', '/admin/settings'];
      adminPages.forEach(page => {
        const access = checkRouteAccess(page, admin);
        expect(access.allowed).toBe(true);
      });
      
      // 3. Admin can access deep admin routes
      const deepAdminRoutes = [
        '/admin/users/123/edit',
        '/admin/settings/security',
        '/admin/reports/monthly'
      ];
      deepAdminRoutes.forEach(route => {
        const access = checkRouteAccess(route, admin);
        expect(access.allowed).toBe(true);
        
        const match = matchRoute(route);
        expect(match.matches).toBe(true);
        expect(match.config?.path).toBe('/admin/*');
      });
      
      // 4. Check accessible routes for admin
      const accessibleRoutes = getAccessibleRoutes(admin);
      const hasAdminRoutes = accessibleRoutes.some(route => 
        route.allowedRoles?.includes('admin')
      );
      expect(hasAdminRoutes).toBe(true);
    });

    it('should handle admin user management scenarios', () => {
      const admin = contexts.adminUser;
      
      // Admin management workflow
      const adminWorkflow = [
        '/admin',                    // Admin dashboard
        '/admin/users',              // User management
        '/admin/users/123',          // Specific user
        '/admin/users/123/edit',     // Edit user
        '/admin/settings',           // System settings
        '/admin/settings/security',  // Security settings
        '/admin/reports',            // Reports
        '/admin/reports/analytics'   // Detailed analytics
      ];
      
      adminWorkflow.forEach(path => {
        const access = checkRouteAccess(path, admin);
        expect(access.allowed).toBe(true);
        
        const match = matchRoute(path);
        expect(match.matches).toBe(true);
      });
    });
  });

  describe('Session Management Scenarios', () => {
    it('should handle session expiration gracefully', () => {
      const expiredUser = contexts.expiredSession;
      
      // Previously accessible private pages should now be denied
      const privatePagesAfterExpiry = ['/reservations/new', '/reservations/my'];
      privatePagesAfterExpiry.forEach(page => {
        const access = checkRouteAccess(page, expiredUser);
        expect(access.allowed).toBe(false);
        expect(access.reason).toBe('not_authenticated');
        expect(access.redirectTo).toContain('/login');
      });
      
      // Public and semi-public pages should still be accessible
      const publicPages = ['/', '/dashboard', '/reservations/status'];
      publicPages.forEach(page => {
        const access = checkRouteAccess(page, expiredUser);
        expect(access.allowed).toBe(true);
      });
    });

    it('should handle role changes during session', () => {
      // Simulate user role change from user to admin
      const userContext = { ...contexts.regularUser };
      const adminContext = { ...userContext, userRole: 'admin' as const };
      
      // Before role change - no admin access
      let access = checkRouteAccess('/admin', userContext);
      expect(access.allowed).toBe(false);
      
      // After role change - admin access granted
      access = checkRouteAccess('/admin', adminContext);
      expect(access.allowed).toBe(true);
      
      // Accessible routes should change
      const userRoutes = getAccessibleRoutes(userContext);
      const adminRoutes = getAccessibleRoutes(adminContext);
      expect(adminRoutes.length).toBeGreaterThan(userRoutes.length);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle malformed route access gracefully', () => {
      const user = contexts.regularUser;
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
          const access = checkRouteAccess(path, user);
        }).not.toThrow();
      });
    });

    it('should handle non-existent route access', () => {
      const user = contexts.regularUser;
      const nonExistentPaths = [
        '/non-existent-page',
        '/api/should-not-match',
        '/unknown/deep/path'
      ];
      
      nonExistentPaths.forEach(path => {
        const access = checkRouteAccess(path, user);
        expect(access.allowed).toBe(false);
        expect(access.reason).toBe('route_not_found');
        expect(access.redirectTo).toBe('/');
      });
    });

    it('should handle undefined user context gracefully', () => {
      const undefinedContext = {
        isAuthenticated: false,
        userRole: undefined,
        userId: undefined
      };
      
      const testPaths = ['/', '/dashboard', '/reservations/new', '/admin'];
      testPaths.forEach(path => {
        expect(() => {
          checkRouteAccess(path, undefinedContext);
        }).not.toThrow();
      });
    });
  });

  describe('Complex Navigation Scenarios', () => {
    it('should handle deep linking scenarios', () => {
      const user = contexts.regularUser;
      
      // Deep links to specific resources
      const deepLinks = [
        '/reservations/edit/123/details',
        '/reservations/view/456/history',
        '/admin/users/789/profile' // Should be denied for regular user
      ];
      
      deepLinks.forEach(link => {
        const match = matchRoute(link);
        const access = checkRouteAccess(link, user);
        
        if (link.startsWith('/admin/')) {
          expect(access.allowed).toBe(false);
          expect(access.reason).toBe('insufficient_role');
        } else {
          expect(match.matches).toBe(true);
          expect(access.allowed).toBe(true);
        }
      });
    });

    it('should handle navigation between different access levels', () => {
      const user = contexts.regularUser;
      
      // Navigation flow: public -> semi-public -> private -> admin (denied)
      const navigationFlow = [
        { path: '/', expectedAccess: true },
        { path: '/dashboard', expectedAccess: true },
        { path: '/reservations/new', expectedAccess: true },
        { path: '/admin', expectedAccess: false }
      ];
      
      navigationFlow.forEach(({ path, expectedAccess }) => {
        const access = checkRouteAccess(path, user);
        expect(access.allowed).toBe(expectedAccess);
      });
    });

    it('should handle breadcrumb navigation scenarios', () => {
      const admin = contexts.adminUser;
      
      // Breadcrumb navigation in admin section
      const breadcrumbPath = [
        '/admin',
        '/admin/users',
        '/admin/users/123',
        '/admin/users/123/edit',
        '/admin/users/123/edit/profile'
      ];
      
      breadcrumbPath.forEach(path => {
        const access = checkRouteAccess(path, admin);
        expect(access.allowed).toBe(true);
        
        const match = matchRoute(path);
        expect(match.matches).toBe(true);
      });
    });
  });

  describe('Multi-User Concurrent Scenarios', () => {
    it('should handle multiple users accessing different routes simultaneously', () => {
      const scenarios = [
        { user: contexts.anonymous, path: '/', shouldAllow: true },
        { user: contexts.newUser, path: '/reservations/new', shouldAllow: true },
        { user: contexts.regularUser, path: '/reservations/my', shouldAllow: true },
        { user: contexts.adminUser, path: '/admin/users', shouldAllow: true },
        { user: contexts.regularUser, path: '/admin', shouldAllow: false }
      ];
      
      // Simulate concurrent access
      scenarios.forEach(({ user, path, shouldAllow }) => {
        const access = checkRouteAccess(path, user);
        expect(access.allowed).toBe(shouldAllow);
      });
    });

    it('should maintain consistent access control across user types', () => {
      const testPath = '/reservations/new';
      
      // Different user types accessing the same protected route
      const userTypes = [
        { context: contexts.anonymous, shouldAllow: false },
        { context: contexts.newUser, shouldAllow: true },
        { context: contexts.regularUser, shouldAllow: true },
        { context: contexts.adminUser, shouldAllow: true }
      ];
      
      userTypes.forEach(({ context, shouldAllow }) => {
        const access = checkRouteAccess(testPath, context);
        expect(access.allowed).toBe(shouldAllow);
      });
    });
  });

  describe('Route Configuration Validation in Real Scenarios', () => {
    it('should validate all configured routes work in practice', () => {
      const user = contexts.regularUser;
      const admin = contexts.adminUser;
      
      // Test every configured route with appropriate user context
      const routeTests = [
        { path: '/', context: contexts.anonymous, shouldWork: true },
        { path: '/login', context: contexts.anonymous, shouldWork: true },
        { path: '/signup', context: contexts.anonymous, shouldWork: true },
        { path: '/dashboard', context: contexts.anonymous, shouldWork: true },
        { path: '/reservations/status', context: contexts.anonymous, shouldWork: true },
        { path: '/reservations/new', context: user, shouldWork: true },
        { path: '/reservations/my', context: user, shouldWork: true },
        { path: '/admin', context: admin, shouldWork: true },
        { path: '/admin/users', context: admin, shouldWork: true }
      ];
      
      routeTests.forEach(({ path, context, shouldWork }) => {
        const match = matchRoute(path);
        const access = checkRouteAccess(path, context);
        
        expect(match.matches).toBe(true);
        expect(access.allowed).toBe(shouldWork);
      });
    });

    it('should ensure route hierarchy consistency', () => {
      // Test that parent routes and child routes have consistent access patterns
      const hierarchyTests = [
        { parent: '/admin', child: '/admin/users', context: contexts.adminUser },
        { parent: '/reservations', child: '/reservations/new', context: contexts.regularUser }
      ];
      
      hierarchyTests.forEach(({ parent, child, context }) => {
        const parentAccess = checkRouteAccess(parent, context);
        const childAccess = checkRouteAccess(child, context);
        
        // If parent is accessible, child should be too (for same role requirements)
        if (parentAccess.allowed) {
          expect(childAccess.allowed).toBe(true);
        }
      });
    });
  });
});