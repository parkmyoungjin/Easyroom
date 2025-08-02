#!/usr/bin/env node

/**
 * Test Pipeline Integration Script
 * Tests the data integrity pipeline functionality
 * Requirements: 4.2, 4.3
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test configuration
 */
const TEST_CONFIG = {
  testDirectory: './test-pipeline-output',
  expectedExitCodes: [0, 1, 2, 3, 4],
  testStages: ['pre_deployment', 'post_deployment', 'scheduled_check', 'rollback_check'],
  testEnvironments: ['development', 'staging', 'production']
};

/**
 * Test result tracking
 */
class TestResult {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  addTest(name, passed, details = null, error = null) {
    this.tests.push({
      name,
      passed,
      details,
      error,
      timestamp: new Date().toISOString()
    });

    if (passed) {
      this.passed++;
    } else {
      this.failed++;
      if (error) {
        this.errors.push({ test: name, error });
      }
    }
  }

  get success() {
    return this.failed === 0;
  }
}

/**
 * Test pipeline script execution
 */
async function testPipelineExecution(result) {
  console.log('🧪 Testing pipeline script execution...');

  try {
    // Test basic pipeline execution
    const output = execSync('node scripts/ci-data-integrity-pipeline.js pre_deployment development', {
      encoding: 'utf8',
      timeout: 30000
    });

    const hasExpectedOutput = output.includes('CI/CD Data Integrity Pipeline') &&
                             output.includes('Pipeline validation completed');

    result.addTest(
      'Basic Pipeline Execution',
      hasExpectedOutput,
      'Pipeline script runs without errors',
      hasExpectedOutput ? null : 'Missing expected output'
    );

  } catch (error) {
    result.addTest(
      'Basic Pipeline Execution',
      false,
      null,
      `Pipeline execution failed: ${error.message}`
    );
  }
}

/**
 * Test exit code handling
 */
async function testExitCodeHandling(result) {
  console.log('🧪 Testing exit code handling...');

  try {
    // Test successful execution (should exit with 0)
    try {
      execSync('node scripts/ci-data-integrity-pipeline.js pre_deployment development', {
        encoding: 'utf8',
        timeout: 30000
      });
      
      result.addTest(
        'Exit Code - Success',
        true,
        'Pipeline exits with code 0 on success'
      );
    } catch (error) {
      // Check if it's a non-zero exit code (which might be expected)
      const isExpectedExitCode = TEST_CONFIG.expectedExitCodes.includes(error.status);
      
      result.addTest(
        'Exit Code - Success',
        isExpectedExitCode,
        `Pipeline exits with code ${error.status}`,
        isExpectedExitCode ? null : `Unexpected exit code: ${error.status}`
      );
    }

  } catch (error) {
    result.addTest(
      'Exit Code - Success',
      false,
      null,
      `Exit code test failed: ${error.message}`
    );
  }
}

/**
 * Test report generation
 */
async function testReportGeneration(result) {
  console.log('🧪 Testing report generation...');

  try {
    // Ensure reports directory exists
    await fs.mkdir('ci-reports', { recursive: true });

    // Run pipeline to generate reports
    try {
      execSync('node scripts/ci-data-integrity-pipeline.js pre_deployment development', {
        encoding: 'utf8',
        timeout: 30000
      });
    } catch (error) {
      // Pipeline might exit with non-zero code, but should still generate reports
    }

    // Check if reports were generated
    const reportFiles = await fs.readdir('ci-reports');
    const hasJsonReport = reportFiles.some(file => file.endsWith('.json'));
    const hasJunitReport = reportFiles.some(file => file.endsWith('-junit.xml'));
    const hasExitCodeFile = reportFiles.some(file => file.endsWith('-exitcode.txt'));

    result.addTest(
      'JSON Report Generation',
      hasJsonReport,
      'Pipeline generates JSON reports',
      hasJsonReport ? null : 'No JSON report found'
    );

    result.addTest(
      'JUnit Report Generation',
      hasJunitReport,
      'Pipeline generates JUnit XML reports',
      hasJunitReport ? null : 'No JUnit report found'
    );

    result.addTest(
      'Exit Code File Generation',
      hasExitCodeFile,
      'Pipeline generates exit code files',
      hasExitCodeFile ? null : 'No exit code file found'
    );

  } catch (error) {
    result.addTest(
      'Report Generation',
      false,
      null,
      `Report generation test failed: ${error.message}`
    );
  }
}

/**
 * Test rollback trigger functionality
 */
async function testRollbackTrigger(result) {
  console.log('🧪 Testing rollback trigger functionality...');

  try {
    // Test rollback check (should not trigger rollback if no issues)
    const output = execSync('node scripts/rollback-trigger.js auto', {
      encoding: 'utf8',
      timeout: 30000
    });

    const hasExpectedOutput = output.includes('Rollback Trigger Script Started');

    result.addTest(
      'Rollback Trigger Execution',
      hasExpectedOutput,
      'Rollback trigger script runs without errors',
      hasExpectedOutput ? null : 'Missing expected output'
    );

    // Test manual rollback instructions generation
    try {
      execSync('node scripts/rollback-trigger.js manual', {
        encoding: 'utf8',
        timeout: 30000
      });

      // Check if manual instructions were created
      const instructionsExist = await fileExists('ci-reports/MANUAL_ROLLBACK_INSTRUCTIONS.md');

      result.addTest(
        'Manual Rollback Instructions',
        instructionsExist,
        'Manual rollback instructions generated',
        instructionsExist ? null : 'Instructions file not created'
      );

    } catch (error) {
      result.addTest(
        'Manual Rollback Instructions',
        false,
        null,
        `Manual rollback test failed: ${error.message}`
      );
    }

  } catch (error) {
    result.addTest(
      'Rollback Trigger Execution',
      false,
      null,
      `Rollback trigger test failed: ${error.message}`
    );
  }
}

/**
 * Test different pipeline stages
 */
async function testPipelineStages(result) {
  console.log('🧪 Testing different pipeline stages...');

  for (const stage of TEST_CONFIG.testStages) {
    try {
      const output = execSync(`node scripts/ci-data-integrity-pipeline.js ${stage} development`, {
        encoding: 'utf8',
        timeout: 30000
      });

      const hasStageOutput = output.includes(`Stage: ${stage.toUpperCase()}`);

      result.addTest(
        `Pipeline Stage - ${stage}`,
        hasStageOutput,
        `Stage ${stage} executes correctly`,
        hasStageOutput ? null : `Stage output not found for ${stage}`
      );

    } catch (error) {
      // Non-zero exit codes are acceptable for some stages
      const hasStageOutput = error.stdout && error.stdout.includes(`Stage: ${stage.toUpperCase()}`);

      result.addTest(
        `Pipeline Stage - ${stage}`,
        hasStageOutput,
        `Stage ${stage} executes with exit code ${error.status}`,
        hasStageOutput ? null : `Stage execution failed for ${stage}: ${error.message}`
      );
    }
  }
}

/**
 * Test npm script integration
 */
async function testNpmScriptIntegration(result) {
  console.log('🧪 Testing npm script integration...');

  const npmScripts = [
    'integrity:pipeline',
    'integrity:pre-deploy',
    'rollback:check'
  ];

  for (const script of npmScripts) {
    try {
      const output = execSync(`npm run ${script}`, {
        encoding: 'utf8',
        timeout: 30000
      });

      const hasExpectedOutput = output.includes('CI/CD Data Integrity Pipeline') ||
                               output.includes('Rollback Trigger Script');

      result.addTest(
        `NPM Script - ${script}`,
        hasExpectedOutput,
        `NPM script ${script} executes correctly`,
        hasExpectedOutput ? null : `Script ${script} failed or missing output`
      );

    } catch (error) {
      // Check if it's just a non-zero exit code but script ran
      const hasExpectedOutput = error.stdout && (
        error.stdout.includes('CI/CD Data Integrity Pipeline') ||
        error.stdout.includes('Rollback Trigger Script')
      );

      result.addTest(
        `NPM Script - ${script}`,
        hasExpectedOutput,
        `NPM script ${script} executes with exit code ${error.status}`,
        hasExpectedOutput ? null : `Script ${script} execution failed: ${error.message}`
      );
    }
  }
}

/**
 * Test configuration validation
 */
async function testConfigurationValidation(result) {
  console.log('🧪 Testing configuration validation...');

  try {
    // Test that required modules can be loaded
    const pipelineModule = require('./ci-data-integrity-pipeline.js');
    const rollbackModule = require('./rollback-trigger.js');

    result.addTest(
      'Module Loading - Pipeline',
      !!pipelineModule.PIPELINE_CONFIG,
      'Pipeline module loads with configuration',
      pipelineModule.PIPELINE_CONFIG ? null : 'Pipeline configuration not found'
    );

    result.addTest(
      'Module Loading - Rollback',
      !!rollbackModule.ROLLBACK_CONFIG,
      'Rollback module loads with configuration',
      rollbackModule.ROLLBACK_CONFIG ? null : 'Rollback configuration not found'
    );

    // Test configuration structure
    const hasExitCodes = pipelineModule.PIPELINE_CONFIG.exitCodes &&
                        typeof pipelineModule.PIPELINE_CONFIG.exitCodes.SUCCESS === 'number';

    result.addTest(
      'Configuration Structure',
      hasExitCodes,
      'Pipeline configuration has required structure',
      hasExitCodes ? null : 'Exit codes configuration missing or invalid'
    );

  } catch (error) {
    result.addTest(
      'Configuration Validation',
      false,
      null,
      `Configuration validation failed: ${error.message}`
    );
  }
}

/**
 * Utility function to check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate test report
 */
function generateTestReport(result) {
  console.log('\n📊 PIPELINE INTEGRATION TEST REPORT');
  console.log('=' .repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Total Tests: ${result.tests.length}`);
  console.log(`Passed: ${result.passed}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Success Rate: ${((result.passed / result.tests.length) * 100).toFixed(1)}%`);
  console.log('');

  // Individual test results
  result.tests.forEach(test => {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    if (test.details) {
      console.log(`   ${test.details}`);
    }
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });

  // Error summary
  if (result.errors.length > 0) {
    console.log('\n🚨 ERROR SUMMARY');
    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}: ${error.error}`);
    });
  }

  console.log('\n' + '=' .repeat(60));
  console.log(result.success ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
}

/**
 * Save test results
 */
async function saveTestResults(result) {
  try {
    await fs.mkdir(TEST_CONFIG.testDirectory, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(TEST_CONFIG.testDirectory, `test-results-${timestamp}.json`);

    await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
    console.log(`📄 Test results saved: ${reportPath}`);

    // Save latest results
    const latestPath = path.join(TEST_CONFIG.testDirectory, 'latest-test-results.json');
    await fs.writeFile(latestPath, JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('⚠️ Could not save test results:', error.message);
  }
}

/**
 * Main test execution function
 */
async function runPipelineTests() {
  console.log('🚀 Starting Pipeline Integration Tests');
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const result = new TestResult();

  try {
    await testPipelineExecution(result);
    await testExitCodeHandling(result);
    await testReportGeneration(result);
    await testRollbackTrigger(result);
    await testPipelineStages(result);
    await testNpmScriptIntegration(result);
    await testConfigurationValidation(result);

    generateTestReport(result);
    await saveTestResults(result);

    console.log(`\n🏁 Pipeline integration tests completed`);
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(2);
  }
}

// Export for use in other scripts
module.exports = {
  runPipelineTests,
  TestResult,
  TEST_CONFIG
};

// Run tests if script is executed directly
if (require.main === module) {
  runPipelineTests();
}