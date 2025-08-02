#!/usr/bin/env tsx

/**
 * Comprehensive Test Runner for OTP Authentication System
 * Executes all test suites and generates comprehensive reports
 * Requirements: All requirements - comprehensive testing and integration verification
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  path: string;
  description: string;
  requirements: string[];
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  coverage?: number;
  errors?: string[];
}

interface TestReport {
  timestamp: string;
  totalSuites: number;
  passedSuites: number;
  failedSuites: number;
  totalDuration: number;
  overallCoverage: number;
  results: TestResult[];
  summary: string;
}

class ComprehensiveTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'End-to-End Authentication Flow',
      path: 'src/__tests__/e2e/otp-authentication-flow.test.ts',
      description: 'Complete OTP authentication flow testing',
      requirements: ['2.1', '2.2', '2.3', '2.4', '2.5', '3.1', '3.2', '3.4', '4.1', '4.2', '4.3', '4.4', '4.5']
    },
    {
      name: 'PWA Integration Tests',
      path: 'src/__tests__/pwa/otp-pwa-integration.test.ts',
      description: 'PWA-specific functionality and offline scenarios',
      requirements: ['3.1', '3.2', '3.3', '3.4', '3.5']
    },
    {
      name: 'Accessibility Tests',
      path: 'src/__tests__/accessibility/otp-accessibility.test.ts',
      description: 'Screen reader support and keyboard navigation',
      requirements: ['4.1', '4.2', '4.3', '4.4', '4.5']
    },
    {
      name: 'Error Handling Tests',
      path: 'src/__tests__/error-scenarios/otp-error-handling.test.ts',
      description: 'Comprehensive error scenarios and edge cases',
      requirements: ['2.3', '2.4', '2.5', '3.2', '5.1', '5.2', '5.3', '5.4', '5.5']
    },
    {
      name: 'Signup Integration Tests',
      path: 'src/__tests__/integration/signup-otp-integration.test.ts',
      description: 'Signup to OTP login flow integration',
      requirements: ['1.1', '1.2', '1.3', '1.4', '1.5', '2.1', '2.2', '2.3']
    },
    {
      name: 'Migration End-to-End Tests',
      path: 'src/lib/auth/__tests__/migration-end-to-end.test.ts',
      description: 'Complete migration compatibility testing',
      requirements: ['5.1', '5.2', '5.3', '5.4', '5.5', '6.1', '6.2', '6.3', '6.4', '6.5']
    },
    {
      name: 'Final Integration Tests',
      path: 'src/__tests__/comprehensive/final-integration.test.ts',
      description: 'Complete system integration validation',
      requirements: ['All requirements - comprehensive testing and integration verification']
    }
  ];

  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      'test-reports',
      'test-reports/comprehensive',
      'test-reports/coverage'
    ];

    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  private async runTestSuite(suite: TestSuite): Promise<TestResult> {
    console.log(`\n🧪 Running: ${suite.name}`);
    console.log(`📝 Description: ${suite.description}`);
    console.log(`📋 Requirements: ${suite.requirements.join(', ')}`);

    const startTime = Date.now();
    let passed = false;
    let errors: string[] = [];

    try {
      // Run the test suite
      const command = `npx jest "${suite.path}" --verbose --coverage --coverageDirectory=test-reports/coverage/${suite.name.replace(/\s+/g, '-').toLowerCase()}`;
      
      console.log(`⚡ Executing: ${command}`);
      
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });

      console.log(`✅ ${suite.name} - PASSED`);
      passed = true;

      // Extract coverage information if available
      const coverageMatch = output.match(/All files\s+\|\s+(\d+\.?\d*)/);
      const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;

      return {
        suite: suite.name,
        passed,
        duration: Date.now() - startTime,
        coverage,
        errors
      };

    } catch (error: any) {
      console.log(`❌ ${suite.name} - FAILED`);
      
      errors.push(error.message);
      if (error.stdout) {
        console.log('STDOUT:', error.stdout);
      }
      if (error.stderr) {
        console.log('STDERR:', error.stderr);
        errors.push(error.stderr);
      }

      return {
        suite: suite.name,
        passed: false,
        duration: Date.now() - startTime,
        errors
      };
    }
  }

  private generateReport(): TestReport {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    const passedSuites = this.results.filter(r => r.passed).length;
    const failedSuites = this.results.filter(r => r.passed === false).length;
    
    const coverageValues = this.results
      .filter(r => r.coverage !== undefined)
      .map(r => r.coverage!);
    
    const overallCoverage = coverageValues.length > 0 
      ? coverageValues.reduce((sum, cov) => sum + cov, 0) / coverageValues.length
      : 0;

    const summary = this.generateSummary(passedSuites, failedSuites, totalDuration, overallCoverage);

    return {
      timestamp: new Date().toISOString(),
      totalSuites: this.testSuites.length,
      passedSuites,
      failedSuites,
      totalDuration,
      overallCoverage,
      results: this.results,
      summary
    };
  }

  private generateSummary(passed: number, failed: number, duration: number, coverage: number): string {
    const total = passed + failed;
    const successRate = (passed / total) * 100;
    
    let summary = `\n${'='.repeat(80)}\n`;
    summary += `🎯 COMPREHENSIVE OTP AUTHENTICATION TEST RESULTS\n`;
    summary += `${'='.repeat(80)}\n\n`;
    
    summary += `📊 OVERALL STATISTICS:\n`;
    summary += `   • Total Test Suites: ${total}\n`;
    summary += `   • Passed: ${passed} (${successRate.toFixed(1)}%)\n`;
    summary += `   • Failed: ${failed}\n`;
    summary += `   • Total Duration: ${(duration / 1000).toFixed(2)}s\n`;
    summary += `   • Average Coverage: ${coverage.toFixed(1)}%\n\n`;

    summary += `📋 DETAILED RESULTS:\n`;
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = (result.duration / 1000).toFixed(2);
      const coverage = result.coverage ? `${result.coverage.toFixed(1)}%` : 'N/A';
      
      summary += `   ${index + 1}. ${result.suite}\n`;
      summary += `      Status: ${status} | Duration: ${duration}s | Coverage: ${coverage}\n`;
      
      if (result.errors && result.errors.length > 0) {
        summary += `      Errors: ${result.errors.length} error(s)\n`;
      }
      summary += '\n';
    });

    if (failed > 0) {
      summary += `⚠️  FAILED SUITES:\n`;
      this.results.filter(r => !r.passed).forEach(result => {
        summary += `   • ${result.suite}\n`;
        if (result.errors) {
          result.errors.forEach(error => {
            summary += `     - ${error.split('\n')[0]}\n`;
          });
        }
      });
      summary += '\n';
    }

    summary += `🎉 SYSTEM READINESS:\n`;
    if (successRate === 100) {
      summary += `   ✅ All test suites passed - System is ready for production!\n`;
    } else if (successRate >= 90) {
      summary += `   ⚠️  Most tests passed - Minor issues need attention\n`;
    } else if (successRate >= 70) {
      summary += `   🔧 Some tests failed - Significant issues need resolution\n`;
    } else {
      summary += `   🚨 Many tests failed - System needs major fixes before deployment\n`;
    }

    summary += `\n${'='.repeat(80)}\n`;
    
    return summary;
  }

  private saveReport(report: TestReport): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save JSON report
    const jsonPath = join('test-reports', 'comprehensive', `test-report-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    
    // Save text summary
    const textPath = join('test-reports', 'comprehensive', `test-summary-${timestamp}.txt`);
    writeFileSync(textPath, report.summary);
    
    // Save latest report (overwrite)
    const latestJsonPath = join('test-reports', 'comprehensive', 'latest-report.json');
    const latestTextPath = join('test-reports', 'comprehensive', 'latest-summary.txt');
    
    writeFileSync(latestJsonPath, JSON.stringify(report, null, 2));
    writeFileSync(latestTextPath, report.summary);

    console.log(`\n📄 Reports saved:`);
    console.log(`   • JSON: ${jsonPath}`);
    console.log(`   • Summary: ${textPath}`);
    console.log(`   • Latest: ${latestJsonPath}`);
  }

  public async runAll(): Promise<void> {
    console.log('🚀 Starting Comprehensive OTP Authentication Test Suite');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`🧪 Total Test Suites: ${this.testSuites.length}`);
    
    this.startTime = Date.now();

    // Run all test suites
    for (const suite of this.testSuites) {
      const result = await this.runTestSuite(suite);
      this.results.push(result);
    }

    // Generate and save report
    const report = this.generateReport();
    this.saveReport(report);

    // Display summary
    console.log(report.summary);

    // Exit with appropriate code
    const failedCount = this.results.filter(r => !r.passed).length;
    if (failedCount > 0) {
      console.log(`\n❌ ${failedCount} test suite(s) failed. Check the reports for details.`);
      process.exit(1);
    } else {
      console.log('\n🎉 All test suites passed successfully!');
      process.exit(0);
    }
  }

  public async runSpecific(suiteName: string): Promise<void> {
    const suite = this.testSuites.find(s => 
      s.name.toLowerCase().includes(suiteName.toLowerCase()) ||
      s.path.toLowerCase().includes(suiteName.toLowerCase())
    );

    if (!suite) {
      console.log(`❌ Test suite not found: ${suiteName}`);
      console.log('\n📋 Available test suites:');
      this.testSuites.forEach((s, index) => {
        console.log(`   ${index + 1}. ${s.name}`);
        console.log(`      Path: ${s.path}`);
      });
      process.exit(1);
    }

    console.log(`🎯 Running specific test suite: ${suite.name}`);
    this.startTime = Date.now();

    const result = await this.runTestSuite(suite);
    this.results.push(result);

    const report = this.generateReport();
    console.log(report.summary);

    if (!result.passed) {
      process.exit(1);
    }
  }

  public listSuites(): void {
    console.log('📋 Available Test Suites:\n');
    
    this.testSuites.forEach((suite, index) => {
      console.log(`${index + 1}. ${suite.name}`);
      console.log(`   📝 ${suite.description}`);
      console.log(`   📂 ${suite.path}`);
      console.log(`   📋 Requirements: ${suite.requirements.join(', ')}`);
      console.log('');
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new ComprehensiveTestRunner();

  if (args.length === 0) {
    // Run all tests
    await runner.runAll();
  } else if (args[0] === '--list' || args[0] === '-l') {
    // List available test suites
    runner.listSuites();
  } else if (args[0] === '--suite' || args[0] === '-s') {
    // Run specific test suite
    if (args[1]) {
      await runner.runSpecific(args[1]);
    } else {
      console.log('❌ Please specify a test suite name or path');
      console.log('Usage: tsx comprehensive-test-runner.ts --suite <suite-name>');
      process.exit(1);
    }
  } else if (args[0] === '--help' || args[0] === '-h') {
    // Show help
    console.log('🧪 Comprehensive OTP Authentication Test Runner\n');
    console.log('Usage:');
    console.log('  tsx comprehensive-test-runner.ts                    # Run all test suites');
    console.log('  tsx comprehensive-test-runner.ts --list             # List available test suites');
    console.log('  tsx comprehensive-test-runner.ts --suite <name>     # Run specific test suite');
    console.log('  tsx comprehensive-test-runner.ts --help             # Show this help\n');
    console.log('Examples:');
    console.log('  tsx comprehensive-test-runner.ts --suite "End-to-End"');
    console.log('  tsx comprehensive-test-runner.ts --suite "PWA"');
    console.log('  tsx comprehensive-test-runner.ts --suite "accessibility"');
  } else {
    console.log('❌ Unknown argument:', args[0]);
    console.log('Use --help for usage information');
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { ComprehensiveTestRunner };

// Add a simple test to satisfy Jest requirements
describe('Comprehensive Test Runner', () => {
  it('should export ComprehensiveTestRunner class', () => {
    expect(ComprehensiveTestRunner).toBeDefined();
  });

  it('should create ComprehensiveTestRunner instance', () => {
    const runner = new ComprehensiveTestRunner();
    expect(runner).toBeInstanceOf(ComprehensiveTestRunner);
  });
});