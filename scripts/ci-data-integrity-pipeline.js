#!/usr/bin/env node

/**
 * CI/CD Data Integrity Validation Pipeline
 * Enhanced validation functions for deployment pipeline integration
 * Requirements: 4.2, 4.3
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const { generateIntegrityReport } = require('./data-integrity-validation');
const { generateConsistencyReport } = require('./automated-consistency-check');
const { DataIntegrityAnalyzer } = require('./data-integrity-reporter');
require('dotenv').config({ path: '.env.local' });

/**
 * Pipeline configuration
 */
const PIPELINE_CONFIG = {
  // Exit codes for different scenarios
  exitCodes: {
    SUCCESS: 0,
    VALIDATION_FAILED: 1,
    CRITICAL_ISSUES: 2,
    PIPELINE_ERROR: 3,
    ROLLBACK_REQUIRED: 4
  },
  
  // Thresholds for different severity levels
  thresholds: {
    maxCriticalIssues: 0,     // No critical issues allowed
    maxErrorIssues: 0,        // No error issues allowed in production
    maxWarningIssues: 5,      // Up to 5 warnings allowed
    maxOrphanedReservations: 0,
    maxAuthIdConfusion: 0,
    maxDuplicateAuthIds: 0
  },
  
  // Pipeline stages
  stages: {
    PRE_DEPLOYMENT: 'pre_deployment',
    POST_DEPLOYMENT: 'post_deployment',
    ROLLBACK_CHECK: 'rollback_check',
    SCHEDULED_CHECK: 'scheduled_check'
  },
  
  // Output configuration
  outputFormats: ['console', 'json', 'junit'],
  reportDirectory: './ci-reports',
  
  // Rollback configuration
  rollback: {
    enabled: true,
    triggerOnCritical: true,
    triggerOnMultipleErrors: true,
    maxErrorThreshold: 3
  }
};

/**
 * Pipeline validation result class
 */
class PipelineValidationResult {
  constructor(stage, environment = 'unknown') {
    this.stage = stage;
    this.environment = environment;
    this.timestamp = new Date().toISOString();
    this.success = true;
    this.exitCode = PIPELINE_CONFIG.exitCodes.SUCCESS;
    this.summary = {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      criticalIssues: 0,
      errorIssues: 0,
      warningIssues: 0,
      totalIssues: 0
    };
    this.checks = [];
    this.recommendations = [];
    this.rollbackRequired = false;
    this.rollbackReason = null;
  }

  addCheck(checkResult) {
    this.checks.push(checkResult);
    this.summary.totalChecks++;
    
    if (checkResult.passed) {
      this.summary.passedChecks++;
    } else {
      this.summary.failedChecks++;
      this.success = false;
    }
    
    // Count issues by severity
    if (checkResult.issues) {
      checkResult.issues.forEach(issue => {
        this.summary.totalIssues++;
        switch (issue.severity) {
          case 'critical':
            this.summary.criticalIssues++;
            break;
          case 'error':
            this.summary.errorIssues++;
            break;
          case 'warning':
            this.summary.warningIssues++;
            break;
        }
      });
    }
  }

  evaluateThresholds() {
    const { thresholds } = PIPELINE_CONFIG;
    
    // Check critical issues
    if (this.summary.criticalIssues > thresholds.maxCriticalIssues) {
      this.exitCode = PIPELINE_CONFIG.exitCodes.CRITICAL_ISSUES;
      this.rollbackRequired = true;
      this.rollbackReason = `Critical issues exceed threshold: ${this.summary.criticalIssues} > ${thresholds.maxCriticalIssues}`;
      return;
    }
    
    // Check error issues
    if (this.summary.errorIssues > thresholds.maxErrorIssues) {
      this.exitCode = PIPELINE_CONFIG.exitCodes.VALIDATION_FAILED;
      if (this.summary.errorIssues >= thresholds.maxErrorThreshold) {
        this.rollbackRequired = true;
        this.rollbackReason = `Error issues exceed rollback threshold: ${this.summary.errorIssues} >= ${thresholds.maxErrorThreshold}`;
      }
      return;
    }
    
    // Check warning issues
    if (this.summary.warningIssues > thresholds.maxWarningIssues) {
      this.exitCode = PIPELINE_CONFIG.exitCodes.VALIDATION_FAILED;
      this.recommendations.push(`Warning count (${this.summary.warningIssues}) exceeds threshold (${thresholds.maxWarningIssues})`);
    }
  }

  generateRecommendations() {
    if (this.rollbackRequired) {
      this.recommendations.unshift('IMMEDIATE ACTION REQUIRED: Initiate deployment rollback');
      this.recommendations.push('Do not proceed with deployment until critical issues are resolved');
    }
    
    if (this.summary.criticalIssues > 0) {
      this.recommendations.push('Address all critical data integrity issues before deployment');
    }
    
    if (this.summary.errorIssues > 0) {
      this.recommendations.push('Fix all error-level issues to ensure data consistency');
    }
    
    if (this.summary.warningIssues > 0) {
      this.recommendations.push('Review and address warning-level issues when possible');
    }
  }
}

/**
 * Enhanced validation check for CI/CD pipeline
 */
async function runPipelineValidation(stage = PIPELINE_CONFIG.stages.PRE_DEPLOYMENT, environment = 'production') {
  console.log(`🚀 Starting CI/CD Data Integrity Pipeline - Stage: ${stage.toUpperCase()}`);
  console.log(`📍 Environment: ${environment}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);
  
  const result = new PipelineValidationResult(stage, environment);
  
  try {
    // Run comprehensive data integrity analysis
    console.log('🔍 Running comprehensive data integrity analysis...');
    const analyzer = new DataIntegrityAnalyzer();
    const analysisResult = await analyzer.runCompleteAnalysis();
    
    // Convert analysis result to pipeline format
    const analysisCheck = {
      name: 'Comprehensive Data Integrity Analysis',
      passed: analysisResult.statistics.totalIssues === 0,
      issues: analysisResult.issues,
      statistics: analysisResult.statistics
    };
    
    result.addCheck(analysisCheck);
    
    // Run consistency checks
    console.log('🔄 Running automated consistency checks...');
    const consistencyReport = await generateConsistencyReport();
    
    const consistencyCheck = {
      name: 'Automated Consistency Check',
      passed: consistencyReport.summary.totalIssues === 0,
      issues: consistencyReport.checks.flatMap(check => 
        check.issues.map(issue => ({
          ...issue,
          checkName: check.checkName
        }))
      ),
      statistics: consistencyReport.summary
    };
    
    result.addCheck(consistencyCheck);
    
    // Run legacy validation report
    console.log('📋 Running legacy validation checks...');
    const legacyReport = await generateIntegrityReport();
    
    const legacyCheck = {
      name: 'Legacy Validation Report',
      passed: legacyReport.totalIssues === 0,
      issues: legacyReport.results.flatMap(check => 
        check.issues.map(issue => ({
          ...issue,
          severity: check.passed ? 'info' : 'error',
          checkName: check.checkName
        }))
      ),
      statistics: {
        totalIssues: legacyReport.totalIssues,
        passedChecks: legacyReport.passedChecks,
        failedChecks: legacyReport.failedChecks
      }
    };
    
    result.addCheck(legacyCheck);
    
    // Evaluate thresholds and determine exit code
    result.evaluateThresholds();
    result.generateRecommendations();
    
    console.log('\n✅ Pipeline validation completed');
    
  } catch (error) {
    console.error('\n❌ Pipeline validation failed:', error.message);
    result.success = false;
    result.exitCode = PIPELINE_CONFIG.exitCodes.PIPELINE_ERROR;
    result.rollbackRequired = true;
    result.rollbackReason = `Pipeline execution failed: ${error.message}`;
    
    result.addCheck({
      name: 'Pipeline Execution',
      passed: false,
      issues: [{
        description: `Pipeline execution error: ${error.message}`,
        severity: 'critical',
        timestamp: new Date().toISOString()
      }]
    });
  }
  
  return result;
}

/**
 * Generate console report for pipeline results
 */
function generatePipelineReport(result) {
  console.log('\n📊 CI/CD DATA INTEGRITY PIPELINE REPORT');
  console.log('=' .repeat(60));
  console.log(`Stage: ${result.stage.toUpperCase()}`);
  console.log(`Environment: ${result.environment}`);
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Overall Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Exit Code: ${result.exitCode}`);
  
  if (result.rollbackRequired) {
    console.log(`🚨 ROLLBACK REQUIRED: ${result.rollbackReason}`);
  }
  
  console.log('');

  // Summary statistics
  console.log('📈 VALIDATION SUMMARY');
  console.log(`   Total Checks: ${result.summary.totalChecks}`);
  console.log(`   Passed: ${result.summary.passedChecks}`);
  console.log(`   Failed: ${result.summary.failedChecks}`);
  console.log(`   Total Issues: ${result.summary.totalIssues}`);
  console.log(`   Critical: ${result.summary.criticalIssues}`);
  console.log(`   Error: ${result.summary.errorIssues}`);
  console.log(`   Warning: ${result.summary.warningIssues}`);
  console.log('');

  // Individual check results
  result.checks.forEach(check => {
    const statusIcon = check.passed ? '✅' : '❌';
    console.log(`${statusIcon} ${check.name}`);
    
    if (!check.passed && check.issues) {
      const criticalIssues = check.issues.filter(i => i.severity === 'critical');
      const errorIssues = check.issues.filter(i => i.severity === 'error');
      const warningIssues = check.issues.filter(i => i.severity === 'warning');
      
      if (criticalIssues.length > 0) {
        console.log(`   🔥 Critical: ${criticalIssues.length}`);
        criticalIssues.slice(0, 2).forEach(issue => {
          console.log(`      • ${issue.description}`);
        });
      }
      
      if (errorIssues.length > 0) {
        console.log(`   🚨 Error: ${errorIssues.length}`);
        errorIssues.slice(0, 2).forEach(issue => {
          console.log(`      • ${issue.description}`);
        });
      }
      
      if (warningIssues.length > 0) {
        console.log(`   ⚠️ Warning: ${warningIssues.length}`);
      }
    }
    console.log('');
  });

  // Recommendations
  if (result.recommendations.length > 0) {
    console.log('💡 PIPELINE RECOMMENDATIONS');
    result.recommendations.forEach((rec, index) => {
      const icon = rec.includes('IMMEDIATE') || rec.includes('ROLLBACK') ? '🚨' : '💡';
      console.log(`   ${index + 1}. ${icon} ${rec}`);
    });
    console.log('');
  }

  // Final status
  console.log('🎯 PIPELINE DECISION');
  if (result.rollbackRequired) {
    console.log('🚨 ROLLBACK REQUIRED - Do not proceed with deployment');
    console.log(`   Reason: ${result.rollbackReason}`);
  } else if (result.success) {
    console.log('✅ VALIDATION PASSED - Safe to proceed with deployment');
  } else {
    console.log('⚠️ VALIDATION FAILED - Review issues before proceeding');
  }
  
  console.log(`\n🔢 Exit Code: ${result.exitCode}`);
}

/**
 * Save pipeline results in multiple formats
 */
async function savePipelineResults(result) {
  try {
    await fs.mkdir(PIPELINE_CONFIG.reportDirectory, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `pipeline-${result.stage}-${timestamp}`;
    
    // Save JSON report
    const jsonPath = path.join(PIPELINE_CONFIG.reportDirectory, `${baseFilename}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(result, null, 2));
    console.log(`📄 JSON report saved: ${jsonPath}`);
    
    // Save JUnit XML format for CI/CD integration
    const junitXml = generateJUnitXML(result);
    const junitPath = path.join(PIPELINE_CONFIG.reportDirectory, `${baseFilename}-junit.xml`);
    await fs.writeFile(junitPath, junitXml);
    console.log(`📄 JUnit report saved: ${junitPath}`);
    
    // Save latest report
    const latestPath = path.join(PIPELINE_CONFIG.reportDirectory, `latest-pipeline-${result.stage}.json`);
    await fs.writeFile(latestPath, JSON.stringify(result, null, 2));
    
    // Save exit code for shell scripts
    const exitCodePath = path.join(PIPELINE_CONFIG.reportDirectory, `${baseFilename}-exitcode.txt`);
    await fs.writeFile(exitCodePath, result.exitCode.toString());
    
  } catch (error) {
    console.error('⚠️ Could not save pipeline results:', error.message);
  }
}

/**
 * Generate JUnit XML format for CI/CD integration
 */
function generateJUnitXML(result) {
  const escapeXml = (str) => str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuite name="DataIntegrityPipeline" tests="${result.summary.totalChecks}" failures="${result.summary.failedChecks}" errors="0" time="0" timestamp="${result.timestamp}">\n`;
  
  result.checks.forEach(check => {
    xml += `  <testcase name="${escapeXml(check.name)}" classname="DataIntegrity">\n`;
    
    if (!check.passed) {
      const failureMessage = check.issues ? 
        check.issues.map(i => i.description).join('; ') : 
        'Check failed';
      
      xml += `    <failure message="${escapeXml(failureMessage)}">\n`;
      xml += `      <![CDATA[\n`;
      xml += `Stage: ${result.stage}\n`;
      xml += `Environment: ${result.environment}\n`;
      xml += `Issues found: ${check.issues ? check.issues.length : 0}\n`;
      if (check.issues) {
        check.issues.forEach(issue => {
          xml += `- [${issue.severity?.toUpperCase() || 'ERROR'}] ${issue.description}\n`;
        });
      }
      xml += `      ]]>\n`;
      xml += `    </failure>\n`;
    }
    
    xml += `  </testcase>\n`;
  });
  
  xml += `</testsuite>\n`;
  return xml;
}

/**
 * Rollback trigger function
 */
async function triggerRollback(result) {
  if (!PIPELINE_CONFIG.rollback.enabled || !result.rollbackRequired) {
    return false;
  }
  
  console.log('\n🚨 TRIGGERING ROLLBACK PROCEDURE');
  console.log(`Reason: ${result.rollbackReason}`);
  
  try {
    // Save rollback trigger file
    const rollbackPath = path.join(PIPELINE_CONFIG.reportDirectory, 'ROLLBACK_REQUIRED.json');
    const rollbackData = {
      timestamp: new Date().toISOString(),
      stage: result.stage,
      environment: result.environment,
      reason: result.rollbackReason,
      criticalIssues: result.summary.criticalIssues,
      errorIssues: result.summary.errorIssues,
      exitCode: result.exitCode
    };
    
    await fs.writeFile(rollbackPath, JSON.stringify(rollbackData, null, 2));
    console.log(`📄 Rollback trigger saved: ${rollbackPath}`);
    
    // Set exit code for rollback
    result.exitCode = PIPELINE_CONFIG.exitCodes.ROLLBACK_REQUIRED;
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to trigger rollback:', error.message);
    return false;
  }
}

/**
 * Main pipeline execution function
 */
async function executePipeline() {
  const stage = process.argv[2] || PIPELINE_CONFIG.stages.PRE_DEPLOYMENT;
  const environment = process.argv[3] || 'production';
  
  try {
    const result = await runPipelineValidation(stage, environment);
    
    generatePipelineReport(result);
    await savePipelineResults(result);
    
    // Check if rollback is required
    if (result.rollbackRequired) {
      await triggerRollback(result);
    }
    
    console.log(`\n🏁 Pipeline execution completed with exit code: ${result.exitCode}`);
    process.exit(result.exitCode);
    
  } catch (error) {
    console.error('\n💥 Pipeline execution failed:', error.message);
    console.error(error.stack);
    process.exit(PIPELINE_CONFIG.exitCodes.PIPELINE_ERROR);
  }
}

// Export functions for use in other scripts
module.exports = {
  runPipelineValidation,
  PipelineValidationResult,
  PIPELINE_CONFIG,
  triggerRollback,
  generatePipelineReport,
  savePipelineResults
};

// Run pipeline if script is executed directly
if (require.main === module) {
  executePipeline();
}