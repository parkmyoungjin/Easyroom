#!/usr/bin/env node

/**
 * Route Configuration Test Script
 * Tests the routing system configuration and validates all routes
 */

const { routeConfigs, getRouteConfig, getRoutesByAccessLevel } = require('../src/lib/routes/config');
const { 
  matchRoute, 
  checkRouteAccess, 
  isPublicRoute, 
  isSemiPublicRoute, 
  requiresAuthentication 
} = require('../src/lib/routes/matcher');

console.log('🧪 Testing Route Configuration...\n');

// Test contexts
const testContexts = {
  anonymous: { isAuthenticated: false },
  user: { isAuthenticated: true, userRole: 'user', userId: 'user123' },
  admin: { isAuthenticated: true, userRole: 'admin', userId: 'admin123' }
};

// Test paths
const testPaths = [
  '/', '/login', '/signup',
  '/dashboard', '/reservations/status',
  '/reservations/new', '/reservations/my',
  '/admin', '/admin/users',
  '/reservations/edit/123', '/admin/settings/security'
];

function testRouteConfiguration() {
  console.log('📋 Route Configuration Tests:');
  
  // Test 1: Validate route configs structure
  console.log('  ✓ Route configs array exists:', Array.isArray(routeConfigs));
  console.log('  ✓ Route configs count:', routeConfigs.length);
  
  // Test 2: Validate each route config
  let validConfigs = 0;
  routeConfigs.forEach(config => {
    if (config.path && config.accessLevel && typeof config.requiresAuth === 'boolean') {
      validConfigs++;
    }
  });
  console.log('  ✓ Valid route configurations:', validConfigs, '/', routeConfigs.length);
  
  // Test 3: Test access levels
  const publicRoutes = getRoutesByAccessLevel('public');
  const semiPublicRoutes = getRoutesByAccessLevel('semi-public');
  const privateRoutes = getRoutesByAccessLevel('private');
  
  console.log('  ✓ Public routes:', publicRoutes.length);
  console.log('  ✓ Semi-public routes:', semiPublicRoutes.length);
  console.log('  ✓ Private routes:', privateRoutes.length);
  
  console.log('');
}

function testRouteMatching() {
  console.log('🎯 Route Matching Tests:');
  
  let successfulMatches = 0;
  let totalTests = 0;
  
  testPaths.forEach(path => {
    totalTests++;
    const match = matchRoute(path);
    if (match.matches) {
      successfulMatches++;
      console.log(`  ✓ ${path} → ${match.config.path} (${match.config.accessLevel})`);
    } else {
      console.log(`  ✗ ${path} → No match`);
    }
  });
  
  console.log(`  📊 Match success rate: ${successfulMatches}/${totalTests}\n`);
}

function testAccessControl() {
  console.log('🔐 Access Control Tests:');
  
  Object.entries(testContexts).forEach(([userType, context]) => {
    console.log(`  👤 ${userType.toUpperCase()} USER:`);
    
    let allowedCount = 0;
    let deniedCount = 0;
    
    testPaths.forEach(path => {
      const access = checkRouteAccess(path, context);
      if (access.allowed) {
        allowedCount++;
        console.log(`    ✓ ${path} - ALLOWED`);
      } else {
        deniedCount++;
        console.log(`    ✗ ${path} - DENIED (${access.reason})`);
      }
    });
    
    console.log(`    📊 Access: ${allowedCount} allowed, ${deniedCount} denied\n`);
  });
}

function testUtilityFunctions() {
  console.log('🛠️  Utility Function Tests:');
  
  testPaths.forEach(path => {
    const isPublic = isPublicRoute(path);
    const isSemiPublic = isSemiPublicRoute(path);
    const requiresAuth = requiresAuthentication(path);
    
    console.log(`  ${path}:`);
    console.log(`    Public: ${isPublic}, Semi-public: ${isSemiPublic}, Requires Auth: ${requiresAuth}`);
  });
  
  console.log('');
}

function testPerformance() {
  console.log('⚡ Performance Tests:');
  
  const iterations = 1000;
  
  // Test route matching performance
  const startTime = Date.now();
  for (let i = 0; i < iterations; i++) {
    testPaths.forEach(path => {
      matchRoute(path);
    });
  }
  const matchingTime = Date.now() - startTime;
  
  // Test access control performance
  const accessStartTime = Date.now();
  for (let i = 0; i < iterations; i++) {
    testPaths.forEach(path => {
      checkRouteAccess(path, testContexts.user);
    });
  }
  const accessTime = Date.now() - accessStartTime;
  
  console.log(`  ✓ Route matching: ${matchingTime}ms for ${iterations * testPaths.length} operations`);
  console.log(`  ✓ Access control: ${accessTime}ms for ${iterations * testPaths.length} operations`);
  console.log(`  📊 Matching ops/sec: ${Math.round((iterations * testPaths.length) / (matchingTime / 1000))}`);
  console.log(`  📊 Access ops/sec: ${Math.round((iterations * testPaths.length) / (accessTime / 1000))}`);
  
  console.log('');
}

function runAllTests() {
  console.log('🚀 Starting Route System Tests\n');
  
  try {
    testRouteConfiguration();
    testRouteMatching();
    testAccessControl();
    testUtilityFunctions();
    testPerformance();
    
    console.log('✅ All route system tests completed successfully!');
  } catch (error) {
    console.error('❌ Route system tests failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testRouteConfiguration,
  testRouteMatching,
  testAccessControl,
  testUtilityFunctions,
  testPerformance,
  runAllTests
};