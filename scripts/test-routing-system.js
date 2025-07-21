#!/usr/bin/env node

/**
 * Comprehensive routing system test runner
 * This script runs all routing-related tests and generates reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting comprehensive routing system tests...\n');

const testSuites = [
  {
    name: 'Route Configuration Tests',
    path: 'src/lib/routes/__tests__/config.test.ts',
    description: 'Tests route configuration management and validation'
  },
  {
    name: 'Route Matcher Tests',
    path: 'src/lib/routes/__tests__/matcher.test.ts',
    description: 'Tests route matching and access control logic'
  },
  {
    name: 'Integration Tests',
    path: 'src/lib/routes/__tests__/integration.test.ts',
    description: 'Tests complete routing system integration'
  },
  {
    name: 'Performance Tests',
    path: 'src/lib/routes/__tests__/performance.test.ts',
    description: 'Tests routing system performance and scalability'
  },
  {
    name: 'E2E Scenario Tests',
    path: 'src/lib/routes/__tests__/e2e-scenarios.test.ts',
    description: 'Tests end-to-end user journey scenarios'
  },
  {
    name: 'Middleware Tests',
    path: 'src/__tests__/middleware.test.ts',
    description: 'Tests Next.js middleware integration'
  }
];

let totalTests = 0;
let passedTests = 0;
let failedSuites = [];

console.log('📋 Test Suites to Run:');
testSuites.forEach((suite, index) => {
  console.log(`${index + 1}. ${suite.name}`);
  console.log(`   ${suite.description}`);
});
console.log('');

// Run each test suite
for (const suite of testSuites) {
  console.log(`🧪 Running ${suite.name}...`);
  
  try {
    const result = execSync(`npm test ${suite.path}`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Parse test results
    const lines = result.split('\n');
    const testLine = lines.find(line => line.includes('Tests:'));
    
    if (testLine) {
      const matches = testLine.match(/(\d+) passed/);
      if (matches) {
        const passed = parseInt(matches[1]);
        passedTests += passed;
        totalTests += passed;
        console.log(`✅ ${suite.name}: ${passed} tests passed`);
      }
    } else {
      // Fallback: assume success if no explicit failure
      console.log(`✅ ${suite.name}: Completed successfully`);
      passedTests += 1;
      totalTests += 1;
    }
    
  } catch (error) {
    console.log(`❌ ${suite.name}: FAILED`);
    failedSuites.push(suite.name);
    
    // Try to extract test count from error output
    const errorOutput = error.stdout || error.stderr || '';
    const lines = errorOutput.split('\n');
    const testLine = lines.find(line => line.includes('Tests:'));
    
    if (testLine) {
      const passedMatches = testLine.match(/(\d+) passed/);
      const failedMatches = testLine.match(/(\d+) failed/);
      
      if (passedMatches) {
        const passed = parseInt(passedMatches[1]);
        passedTests += passed;
        totalTests += passed;
      }
      
      if (failedMatches) {
        const failed = parseInt(failedMatches[1]);
        totalTests += failed;
      }
    } else {
      // Fallback for failed tests
      totalTests += 1;
    }
  }
  
  console.log('');
}

// Run coverage report
console.log('📊 Generating coverage report...');
try {
  execSync('npm test -- --coverage src/lib/routes src/middleware.ts', { 
    stdio: 'inherit'
  });
} catch (error) {
  console.log('⚠️  Coverage report generation failed');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📈 TEST SUMMARY');
console.log('='.repeat(50));
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success Rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%`);

if (failedSuites.length > 0) {
  console.log('\n❌ Failed Test Suites:');
  failedSuites.forEach(suite => console.log(`  - ${suite}`));
}

console.log('\n🎯 Test Categories Covered:');
console.log('  ✅ Route Configuration Management');
console.log('  ✅ Pattern Matching (Exact & Wildcard)');
console.log('  ✅ Access Control & Authorization');
console.log('  ✅ User Authentication Scenarios');
console.log('  ✅ Performance & Scalability');
console.log('  ✅ Error Handling & Edge Cases');
console.log('  ✅ Integration & E2E Scenarios');
console.log('  ✅ Middleware Integration');

console.log('\n📁 Test Reports Available:');
console.log('  - Coverage Report: coverage/lcov-report/index.html');
console.log('  - Jest Output: Console output above');

if (failedSuites.length === 0) {
  console.log('\n🎉 All routing system tests passed successfully!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please review the output above.');
  process.exit(1);
}