/**
 * Automated Test Runner
 * Orchestrates execution of all automated testing infrastructure components
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  path: string;
  category: 'data-integrity' | 'security-performance' | 'api-validation' | 'performance-benchmark';
  timeout: number;
  critical: boolean;
}

interface TestResult {
  suite: string;
  category: string;
  passed: boolean;
  duration: number;
  coverage?: number;
  errors: string[];
  warnings: string[];
  performance: {
    averageTime: number;
    slowestTest: string;
    fastestTest: string;
  };
}

interface TestReport {
  timestamp: string;
  environment: string;
  totalSuites: number;
  passedSuites: number;
  failedSuites: number;
  overallDuration: number;
  coveragePercentage: number;
  results: TestResult[];
  summary: {
    dataIntegrity: { passed: number; total: number };
    securityPerformance: { passed: number; total: number };
    apiValidation: { passed: number; total: number };
    performanceBenchmark: { passed: number; total: number };
  };
  recommendations: string[];
}

class AutomatedTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Data Integrity Comprehensive Tests',
      path: 'src/__tests__/integration/data-integrity-comprehensive.test.ts',
      category: 'data-integrity',
      timeout: 30000,
      critical: true
    },
    {
      name: 'Security Performance Monitoring Tests',
      path: 'src/__tests__/integration/security-performance-monitoring.test.ts',
      category: 'security-performance',
      timeout: 25000,
      critical: true
    },
    {
      name: 'Standardized API Validation Tests',
      path: 'src/__tests__/api/standardized-validation.test.ts',
      category: 'api-validation',
      timeout: 20000,
      critical: true
    },
    {
      name: 'Performance Benchmark Regression Tests',
      path: 'src/__tests__/performance/benchmark-regression.test.ts',
      category: 'performance-benchmark',
      timeout: 45000,
      critical: true
    }
  ];

  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(private options: {
    environment?: string;
    coverage?: boolean;
    parallel?: boolean;
    failFast?: boolean;
    outputDir?: string;
  } = {}) {
    this.options = {
      environment: 'test',
      coverage: true,
      parallel: false,
      failFast: false,
      outputDir: './test-reports',
      ...options
    };
  }

  /**
   * Run all automated test suites
   */
  async runAllTests(): Promise<TestReport> {
    console.log('🚀 Starting Automated Testing Infrastructure...');
    this.startTime = Date.now();

    try {
      // Setup test environment
      this.setupTestEnvironment();

      // Run test suites
      if (this.options.parallel) {
        await this.runTestsInParallel();
      } else {
        await this.runTestsSequentially();
      }

      // Generate report
      const report = this.generateReport();

      // Save report
      this.saveReport(report);

      // Display summary
      this.displaySummary(report);

      return report;

    } catch (error) {
      console.error('❌ Test runner failed:', error);
      throw error;
    }
  }

  /**
   * Run specific test category
   */
  async runCategory(category: TestSuite['category']): Promise<TestResult[]> {
    const categoryTests = this.testSuites.filter(suite => suite.category === category);
    const results: TestResult[] = [];

    console.log(`🧪 Running ${category} tests...`);

    for (const suite of categoryTests) {
      const result = await this.runSingleTest(suite);
      results.push(result);

      if (!result.passed && this.options.failFast) {
        console.log(`❌ Failing fast due to failed test: ${suite.name}`);
        break;
      }
    }

    return results;
  }

  /**
   * Setup test environment
   */
  private setupTestEnvironment(): void {
    console.log('⚙️ Setting up test environment...');

    // Set environment variables
    process.env.NODE_ENV = this.options.environment;
    process.env.JEST_TIMEOUT = '60000';

    // Create output directory
    if (this.options.outputDir && !existsSync(this.options.outputDir)) {
      execSync(`mkdir -p ${this.options.outputDir}`);
    }

    // Clear previous test artifacts
    try {
      execSync('rm -rf coverage/tmp-*');
      execSync('rm -rf .jest-cache');
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Run tests sequentially
   */
  private async runTestsSequentially(): Promise<void> {
    console.log('📋 Running tests sequentially...');

    for (const suite of this.testSuites) {
      const result = await this.runSingleTest(suite);
      this.results.push(result);

      if (!result.passed && this.options.failFast) {
        console.log(`❌ Failing fast due to failed test: ${suite.name}`);
        break;
      }
    }
  }

  /**
   * Run tests in parallel
   */
  private async runTestsInParallel(): Promise<void> {
    console.log('⚡ Running tests in parallel...');

    const promises = this.testSuites.map(suite => this.runSingleTest(suite));
    this.results = await Promise.all(promises);
  }

  /**
   * Run a single test suite
   */
  private async runSingleTest(suite: TestSuite): Promise<TestResult> {
    console.log(`🧪 Running: ${suite.name}`);
    const startTime = Date.now();

    try {
      // Build Jest command
      const jestCommand = this.buildJestCommand(suite);
      
      // Execute test
      const output = execSync(jestCommand, {
        encoding: 'utf8',
        timeout: suite.timeout,
        env: {
          ...process.env,
          FORCE_COLOR: '1'
        }
      });

      const duration = Date.now() - startTime;
      const result = this.parseTestOutput(suite, output, duration, true);

      console.log(`✅ ${suite.name} - Passed (${duration}ms)`);
      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const result = this.parseTestOutput(suite, error.stdout || error.message, duration, false);

      console.log(`❌ ${suite.name} - Failed (${duration}ms)`);
      if (suite.critical) {
        console.log(`🚨 Critical test failed: ${suite.name}`);
      }

      return result;
    }
  }

  /**
   * Build Jest command for test suite
   */
  private buildJestCommand(suite: TestSuite): string {
    const baseCommand = 'npx jest';
    const options = [
      `"${suite.path}"`,
      '--verbose',
      '--no-cache',
      `--testTimeout=${suite.timeout}`,
      '--detectOpenHandles',
      '--forceExit'
    ];

    if (this.options.coverage) {
      options.push('--coverage');
      options.push(`--coverageDirectory=coverage/tmp-${suite.category}`);
    }

    return `${baseCommand} ${options.join(' ')}`;
  }

  /**
   * Parse test output to extract results
   */
  private parseTestOutput(
    suite: TestSuite, 
    output: string, 
    duration: number, 
    passed: boolean
  ): TestResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let coverage = 0;

    // Extract errors and warnings from output
    const lines = output.split('\n');
    lines.forEach(line => {
      if (line.includes('FAIL') || line.includes('Error:')) {
        errors.push(line.trim());
      }
      if (line.includes('Warning:') || line.includes('WARN')) {
        warnings.push(line.trim());
      }
      if (line.includes('All files') && line.includes('%')) {
        const match = line.match(/(\d+\.?\d*)%/);
        if (match) {
          coverage = parseFloat(match[1]);
        }
      }
    });

    // Extract performance metrics
    const performance = this.extractPerformanceMetrics(output);

    return {
      suite: suite.name,
      category: suite.category,
      passed,
      duration,
      coverage,
      errors,
      warnings,
      performance
    };
  }

  /**
   * Extract performance metrics from test output
   */
  private extractPerformanceMetrics(output: string): TestResult['performance'] {
    // Default values
    let averageTime = 0;
    let slowestTest = 'N/A';
    let fastestTest = 'N/A';

    try {
      // Parse Jest timing information
      const timingRegex = /(\w+.*?)\s+\((\d+)\s*ms\)/g;
      const matches = Array.from(output.matchAll(timingRegex));
      
      if (matches.length > 0) {
        const times = matches.map(match => parseInt(match[2], 10));
        averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);
        
        const slowestMatch = matches.find(match => parseInt(match[2], 10) === maxTime);
        const fastestMatch = matches.find(match => parseInt(match[2], 10) === minTime);
        
        slowestTest = slowestMatch ? `${slowestMatch[1]} (${maxTime}ms)` : 'N/A';
        fastestTest = fastestMatch ? `${fastestMatch[1]} (${minTime}ms)` : 'N/A';
      }
    } catch (error) {
      // Ignore parsing errors
    }

    return {
      averageTime,
      slowestTest,
      fastestTest
    };
  }

  /**
   * Generate comprehensive test report
   */
  private generateReport(): TestReport {
    const totalDuration = Date.now() - this.startTime;
    const passedSuites = this.results.filter(r => r.passed).length;
    const failedSuites = this.results.length - passedSuites;

    // Calculate overall coverage
    const coverageValues = this.results
      .map(r => r.coverage)
      .filter(c => c !== undefined) as number[];
    const overallCoverage = coverageValues.length > 0 
      ? coverageValues.reduce((sum, c) => sum + c, 0) / coverageValues.length 
      : 0;

    // Categorize results
    const summary = {
      dataIntegrity: this.getCategorySummary('data-integrity'),
      securityPerformance: this.getCategorySummary('security-performance'),
      apiValidation: this.getCategorySummary('api-validation'),
      performanceBenchmark: this.getCategorySummary('performance-benchmark')
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      timestamp: new Date().toISOString(),
      environment: this.options.environment || 'test',
      totalSuites: this.results.length,
      passedSuites,
      failedSuites,
      overallDuration: totalDuration,
      coveragePercentage: overallCoverage,
      results: this.results,
      summary,
      recommendations
    };
  }

  /**
   * Get summary for specific category
   */
  private getCategorySummary(category: TestSuite['category']): { passed: number; total: number } {
    const categoryResults = this.results.filter(r => r.category === category);
    return {
      passed: categoryResults.filter(r => r.passed).length,
      total: categoryResults.length
    };
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check for failed critical tests
    const failedCritical = this.results.filter(r => !r.passed && 
      this.testSuites.find(s => s.name === r.suite)?.critical
    );
    
    if (failedCritical.length > 0) {
      recommendations.push('🚨 Critical tests failed - immediate attention required');
    }

    // Check coverage
    const lowCoverage = this.results.filter(r => r.coverage && r.coverage < 80);
    if (lowCoverage.length > 0) {
      recommendations.push('📊 Test coverage below 80% in some areas - consider adding more tests');
    }

    // Check performance
    const slowTests = this.results.filter(r => r.performance.averageTime > 5000);
    if (slowTests.length > 0) {
      recommendations.push('⚡ Some tests are running slowly - consider optimization');
    }

    // Check error patterns
    const commonErrors = this.findCommonErrors();
    if (commonErrors.length > 0) {
      recommendations.push(`🔍 Common error patterns detected: ${commonErrors.join(', ')}`);
    }

    // Category-specific recommendations
    const dataIntegrityFailed = this.results.filter(r => 
      r.category === 'data-integrity' && !r.passed
    );
    if (dataIntegrityFailed.length > 0) {
      recommendations.push('🛡️ Data integrity issues detected - review database constraints and validation');
    }

    const securityFailed = this.results.filter(r => 
      r.category === 'security-performance' && !r.passed
    );
    if (securityFailed.length > 0) {
      recommendations.push('🔒 Security monitoring issues detected - review security configurations');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All tests passed - system is healthy');
    }

    return recommendations;
  }

  /**
   * Find common error patterns across test results
   */
  private findCommonErrors(): string[] {
    const errorCounts: Record<string, number> = {};

    this.results.forEach(result => {
      result.errors.forEach(error => {
        // Extract error type/pattern
        const errorType = error.split(':')[0].trim();
        errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
      });
    });

    // Return errors that appear in multiple tests
    return Object.entries(errorCounts)
      .filter(([_, count]) => count > 1)
      .map(([error, _]) => error);
  }

  /**
   * Save test report to file
   */
  private saveReport(report: TestReport): void {
    if (!this.options.outputDir) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(this.options.outputDir, `test-report-${timestamp}.json`);
    const summaryPath = join(this.options.outputDir, 'latest-test-summary.json');

    // Save detailed report
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Save summary for quick access
    const summary = {
      timestamp: report.timestamp,
      passed: report.passedSuites,
      failed: report.failedSuites,
      coverage: report.coveragePercentage,
      duration: report.overallDuration,
      recommendations: report.recommendations
    };
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`📄 Report saved to: ${reportPath}`);
  }

  /**
   * Display test summary
   */
  private displaySummary(report: TestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUTOMATED TEST INFRASTRUCTURE SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`⏱️  Total Duration: ${(report.overallDuration / 1000).toFixed(2)}s`);
    console.log(`📈 Overall Coverage: ${report.coveragePercentage.toFixed(1)}%`);
    console.log(`✅ Passed Suites: ${report.passedSuites}/${report.totalSuites}`);
    
    if (report.failedSuites > 0) {
      console.log(`❌ Failed Suites: ${report.failedSuites}`);
    }

    console.log('\n📋 Category Summary:');
    Object.entries(report.summary).forEach(([category, stats]) => {
      const status = stats.passed === stats.total ? '✅' : '❌';
      console.log(`  ${status} ${category}: ${stats.passed}/${stats.total}`);
    });

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  ${rec}`));
    }

    console.log('\n' + '='.repeat(60));
    
    if (report.failedSuites === 0) {
      console.log('🎉 All automated tests passed successfully!');
    } else {
      console.log('⚠️  Some tests failed - review the detailed report');
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: any = {};

  // Parse command line arguments
  args.forEach(arg => {
    if (arg === '--coverage') options.coverage = true;
    if (arg === '--parallel') options.parallel = true;
    if (arg === '--fail-fast') options.failFast = true;
    if (arg.startsWith('--env=')) options.environment = arg.split('=')[1];
    if (arg.startsWith('--output=')) options.outputDir = arg.split('=')[1];
  });

  const runner = new AutomatedTestRunner(options);
  
  runner.runAllTests()
    .then(report => {
      process.exit(report.failedSuites === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

export { AutomatedTestRunner, TestResult, TestReport };

// Add a simple test to satisfy Jest requirements
describe('Automated Test Runner', () => {
  it('should export AutomatedTestRunner class', () => {
    expect(AutomatedTestRunner).toBeDefined();
  });

  it('should create AutomatedTestRunner instance', () => {
    const runner = new AutomatedTestRunner();
    expect(runner).toBeInstanceOf(AutomatedTestRunner);
  });
});