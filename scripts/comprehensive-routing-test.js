#!/usr/bin/env node

/**
 * Comprehensive Routing System Test Runner
 * Runs all routing-related tests and generates a detailed report
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Comprehensive Routing System Test Suite\n');
console.log('=' .repeat(60));

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

function logTest(testName, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}`);
    if (details) console.log(`   ${details}`);
  }
  
  testResults.details.push({
    name: testName,
    passed,
    details
  });
}

function runConfigurationTests() {
  console.log('\n📋 Route Configuration Tests');
  console.log('-'.repeat(40));
  
  try {
    const { routeConfigs, getRouteConfig, getRoutesByAccessLevel } = require('../src/lib/routes/config');
    
    // Test 1: Route configs exist and are valid
    logTest('Route configurations exist', Array.isArray(routeConfigs) && routeConfigs.length > 0);
    
    // Test 2: All configs have required properties
    const validConfigs = routeConfigs.every(config => 
      config.path && 
      config.accessLevel && 
      typeof config.requiresAuth === 'boolean'
    );
    logTest('All route configurations are valid', validConfigs);
    
    // Test 3: Access level distribution
    const publicRoutes = getRoutesByAccessLevel('public');
    const semiPublicRoutes = getRoutesByAccessLevel('semi-public');
    const privateRoutes = getRoutesByAccessLevel('private');
    
    logTest('Public routes exist', publicRoutes.length > 0);
    logTest('Semi-public routes exist', semiPublicRoutes.length > 0);
    logTest('Private routes exist', privateRoutes.length > 0);
    
    // Test 4: Core routes are present
    const corePaths = ['/', '/login', '/signup', '/dashboard', '/admin'];
    const hasAllCoreRoutes = corePaths.every(path => getRouteConfig(path) !== null);
    logTest('All core routes are configured', hasAllCoreRoutes);
    
    // Test 5: Admin routes have proper restrictions
    const adminRoutes = routeConfigs.filter(config => config.path.startsWith('/admin'));
    const adminRoutesValid = adminRoutes.every(route => 
      route.requiresAuth && 
      route.allowedRoles && 
      route.allowedRoles.includes('admin')
    );
    logTest('Admin routes have proper restrictions', adminRoutesValid);
    
  } catch (error) {
    logTest('Route configuration tests', false, error.message);
  }
}

function runMatchingTests() {
  console.log('\n🎯 Route Matching Tests');
  console.log('-'.repeat(40));
  
  try {
    const { matchRoute } = require('../src/lib/routes/matcher');
    
    const testCases = [
      { path: '/', shouldMatch: true, expectedPath: '/' },
      { path: '/login', shouldMatch: true, expectedPath: '/login' },
      { path: '/admin/users', shouldMatch: true, expectedPath: '/admin/*' },
      { path: '/reservations/edit/123', shouldMatch: true, expectedPath: '/reservations/edit/*' },
      { path: '/non-existent', shouldMatch: false, expectedPath: null }
    ];
    
    testCases.forEach(testCase => {
      const result = matchRoute(testCase.path);
      const passed = result.matches === testCase.shouldMatch && 
                    (testCase.shouldMatch ? result.config?.path === testCase.expectedPath : true);
      
      logTest(`Route matching: ${testCase.path}`, passed, 
        passed ? '' : `Expected ${testCase.expectedPath}, got ${result.config?.path}`);
    });
    
    // Test path cleaning
    const pathsWithQuery = [
      '/dashboard?tab=overview',
      '/reservations/new#form',
      '/admin/users?page=1&sort=name#list'
    ];
    
    pathsWithQuery.forEach(path => {
      const result = matchRoute(path);
      logTest(`Path cleaning: ${path}`, result.matches);
    });
    
  } catch (error) {
    logTest('Route matching tests', false, error.message);
  }
}

function runAccessControlTests() {
  console.log('\n🔐 Access Control Tests');
  console.log('-'.repeat(40));
  
  try {
    const { checkRouteAccess } = require('../src/lib/routes/matcher');
    
    const contexts = {
      anonymous: { isAuthenticated: false },
      user: { isAuthenticated: true, userRole: 'user', userId: 'user123' },
      admin: { isAuthenticated: true, userRole: 'admin', userId: 'admin123' }
    };
    
    const testCases = [
      { path: '/', context: 'anonymous', shouldAllow: true },
      { path: '/login', context: 'anonymous', shouldAllow: true },
      { path: '/dashboard', context: 'anonymous', shouldAllow: true },
      { path: '/reservations/new', context: 'anonymous', shouldAllow: false },
      { path: '/admin', context: 'anonymous', shouldAllow: false },
      
      { path: '/reservations/new', context: 'user', shouldAllow: true },
      { path: '/admin', context: 'user', shouldAllow: false },
      
      { path: '/admin', context: 'admin', shouldAllow: true },
      { path: '/admin/users', context: 'admin', shouldAllow: true }
    ];
    
    testCases.forEach(testCase => {
      const result = checkRouteAccess(testCase.path, contexts[testCase.context]);
      const passed = result.allowed === testCase.shouldAllow;
      
      logTest(`Access control: ${testCase.context} → ${testCase.path}`, passed,
        passed ? '' : `Expected ${testCase.shouldAllow ? 'ALLOW' : 'DENY'}, got ${result.allowed ? 'ALLOW' : 'DENY'}`);
    });
    
  } catch (error) {
    logTest('Access control tests', false, error.message);
  }
}

function runUtilityTests() {
  console.log('\n🛠️  Utility Function Tests');
  console.log('-'.repeat(40));
  
  try {
    const { 
      isPublicRoute, 
      isSemiPublicRoute, 
      requiresAuthentication,
      getAccessibleRoutes 
    } = require('../src/lib/routes/matcher');
    
    const testCases = [
      { path: '/', isPublic: true, isSemiPublic: false, requiresAuth: false },
      { path: '/login', isPublic: true, isSemiPublic: false, requiresAuth: false },
      { path: '/dashboard', isPublic: false, isSemiPublic: true, requiresAuth: false },
      { path: '/reservations/new', isPublic: false, isSemiPublic: false, requiresAuth: true },
      { path: '/admin', isPublic: false, isSemiPublic: false, requiresAuth: true }
    ];
    
    testCases.forEach(testCase => {
      const publicResult = isPublicRoute(testCase.path) === testCase.isPublic;
      const semiPublicResult = isSemiPublicRoute(testCase.path) === testCase.isSemiPublic;
      const authResult = requiresAuthentication(testCase.path) === testCase.requiresAuth;
      
      logTest(`Utility functions: ${testCase.path}`, publicResult && semiPublicResult && authResult);
    });
    
    // Test accessible routes
    const contexts = {
      anonymous: { isAuthenticated: false },
      user: { isAuthenticated: true, userRole: 'user', userId: 'user123' },
      admin: { isAuthenticated: true, userRole: 'admin', userId: 'admin123' }
    };
    
    Object.entries(contexts).forEach(([contextName, context]) => {
      const accessible = getAccessibleRoutes(context);
      logTest(`Accessible routes for ${contextName}`, Array.isArray(accessible) && accessible.length > 0);
    });
    
  } catch (error) {
    logTest('Utility function tests', false, error.message);
  }
}

function runPerformanceTests() {
  console.log('\n⚡ Performance Tests');
  console.log('-'.repeat(40));
  
  try {
    const { matchRoute, checkRouteAccess } = require('../src/lib/routes/matcher');
    
    const testPaths = ['/', '/dashboard', '/reservations/new', '/admin/users'];
    const testContext = { isAuthenticated: true, userRole: 'user', userId: 'user123' };
    
    // Route matching performance
    const matchingIterations = 1000;
    const matchingStart = Date.now();
    
    for (let i = 0; i < matchingIterations; i++) {
      testPaths.forEach(path => matchRoute(path));
    }
    
    const matchingDuration = Date.now() - matchingStart;
    const matchingOpsPerSec = Math.round((matchingIterations * testPaths.length) / (matchingDuration / 1000));
    
    logTest('Route matching performance', matchingOpsPerSec > 5000, 
      `${matchingOpsPerSec} ops/sec (target: >5000)`);
    
    // Access control performance
    const accessIterations = 1000;
    const accessStart = Date.now();
    
    for (let i = 0; i < accessIterations; i++) {
      testPaths.forEach(path => checkRouteAccess(path, testContext));
    }
    
    const accessDuration = Date.now() - accessStart;
    const accessOpsPerSec = Math.round((accessIterations * testPaths.length) / (accessDuration / 1000));
    
    logTest('Access control performance', accessOpsPerSec > 3000,
      `${accessOpsPerSec} ops/sec (target: >3000)`);
    
  } catch (error) {
    logTest('Performance tests', false, error.message);
  }
}

function runEdgeCaseTests() {
  console.log('\n🔍 Edge Case Tests');
  console.log('-'.repeat(40));
  
  try {
    const { matchRoute, checkRouteAccess } = require('../src/lib/routes/matcher');
    
    // Test empty and malformed paths
    const edgePaths = ['', '/', '//double', '/path//with//doubles', '?only=query', '#only-hash'];
    
    edgePaths.forEach(path => {
      try {
        const result = matchRoute(path);
        logTest(`Edge case path: "${path}"`, true, 'Handled gracefully');
      } catch (error) {
        logTest(`Edge case path: "${path}"`, false, 'Threw error');
      }
    });
    
    // Test invalid auth contexts
    const invalidContexts = [
      { isAuthenticated: false, userRole: undefined, userId: undefined },
      { isAuthenticated: true, userRole: undefined, userId: undefined }
    ];
    
    invalidContexts.forEach((context, index) => {
      try {
        const result = checkRouteAccess('/reservations/new', context);
        logTest(`Invalid auth context ${index + 1}`, true, 'Handled gracefully');
      } catch (error) {
        logTest(`Invalid auth context ${index + 1}`, false, 'Threw error');
      }
    });
    
  } catch (error) {
    logTest('Edge case tests', false, error.message);
  }
}

function generateReport() {
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(60));
  
  const passRate = Math.round((testResults.passed / testResults.total) * 100);
  
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Pass Rate: ${passRate}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details
      .filter(test => !test.passed)
      .forEach(test => {
        console.log(`  - ${test.name}`);
        if (test.details) console.log(`    ${test.details}`);
      });
  }
  
  // Generate JSON report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      passRate: passRate
    },
    details: testResults.details
  };
  
  const reportPath = path.join(__dirname, '..', 'test-reports', 'routing-system-report.json');
  
  // Ensure reports directory exists
  const reportsDir = path.dirname(reportPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  return passRate === 100;
}

function runAllTests() {
  console.log('🚀 Starting Comprehensive Routing System Tests\n');
  
  try {
    runConfigurationTests();
    runMatchingTests();
    runAccessControlTests();
    runUtilityTests();
    runPerformanceTests();
    runEdgeCaseTests();
    
    const allTestsPassed = generateReport();
    
    if (allTestsPassed) {
      console.log('\n🎉 All routing system tests passed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Please review the results above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Test suite crashed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runConfigurationTests,
  runMatchingTests,
  runAccessControlTests,
  runUtilityTests,
  runPerformanceTests,
  runEdgeCaseTests,
  runAllTests
};