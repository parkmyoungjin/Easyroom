#!/usr/bin/env node

/**
 * Automated Data Consistency Check Script
 * Runs regular checks for user-related foreign key consistency
 * Requirements: 4.1, 4.2
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Required environment variables are missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Configuration for consistency checks
 */
const CHECK_CONFIG = {
  // Maximum number of issues to report per check type
  maxIssuesPerCheck: 10,
  
  // Thresholds for alerting
  thresholds: {
    orphanedReservations: 0,      // Alert if any orphaned reservations
    authIdConfusion: 0,           // Alert if any auth_id confusion
    duplicateAuthIds: 0,          // Alert if any duplicate auth_ids
    orphanedUsers: 5              // Alert if more than 5 orphaned users
  },
  
  // Output configuration
  generateReport: true,
  saveToFile: true,
  reportDirectory: './reports'
};

/**
 * Consistency check result structure
 */
class ConsistencyCheckResult {
  constructor(checkName) {
    this.checkName = checkName;
    this.timestamp = new Date().toISOString();
    this.passed = true;
    this.issueCount = 0;
    this.issues = [];
    this.severity = 'info'; // info, warning, error, critical
  }

  addIssue(description, recordId = null, severity = 'warning') {
    this.passed = false;
    this.issueCount++;
    this.issues.push({
      description,
      recordId,
      severity,
      timestamp: new Date().toISOString()
    });
    
    // Update overall severity
    const severityLevels = { info: 0, warning: 1, error: 2, critical: 3 };
    if (severityLevels[severity] > severityLevels[this.severity]) {
      this.severity = severity;
    }
  }

  setSeverity(severity) {
    this.severity = severity;
  }
}

/**
 * Check for orphaned reservations (user_id not in users table)
 */
async function checkOrphanedReservations() {
  const result = new ConsistencyCheckResult('Orphaned Reservations');
  
  try {
    const { data: orphanedReservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        user_id,
        title,
        start_time,
        created_at
      `)
      .not('user_id', 'in', `(SELECT id FROM users)`)
      .limit(CHECK_CONFIG.maxIssuesPerCheck);

    if (error) {
      result.addIssue(`Database query failed: ${error.message}`, null, 'error');
      return result;
    }

    if (orphanedReservations && orphanedReservations.length > 0) {
      orphanedReservations.forEach(reservation => {
        result.addIssue(
          `Reservation "${reservation.title}" references non-existent user_id: ${reservation.user_id}`,
          reservation.id,
          'error'
        );
      });
      
      if (result.issueCount >= CHECK_CONFIG.thresholds.orphanedReservations) {
        result.setSeverity('critical');
      }
    }

  } catch (error) {
    result.addIssue(`Check failed: ${error.message}`, null, 'critical');
  }

  return result;
}

/**
 * Check for auth_id/database_id confusion in reservations
 */
async function checkAuthIdConfusion() {
  const result = new ConsistencyCheckResult('Auth ID Confusion');
  
  try {
    // This is a complex query, so we'll do it in steps
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, auth_id, name, email');

    if (usersError) {
      result.addIssue(`Could not fetch users: ${usersError.message}`, null, 'error');
      return result;
    }

    const authIdToDbId = new Map();
    users.forEach(user => {
      if (user.auth_id) {
        authIdToDbId.set(user.auth_id, { dbId: user.id, name: user.name, email: user.email });
      }
    });

    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, user_id, title, start_time')
      .limit(1000); // Reasonable limit for checking

    if (reservationsError) {
      result.addIssue(`Could not fetch reservations: ${reservationsError.message}`, null, 'error');
      return result;
    }

    let confusionCount = 0;
    reservations.forEach(reservation => {
      if (authIdToDbId.has(reservation.user_id)) {
        const userInfo = authIdToDbId.get(reservation.user_id);
        result.addIssue(
          `Reservation "${reservation.title}" uses auth_id instead of database id for user ${userInfo.name}`,
          reservation.id,
          'error'
        );
        confusionCount++;
        
        if (confusionCount >= CHECK_CONFIG.maxIssuesPerCheck) {
          result.addIssue('... and potentially more auth_id confusion cases', null, 'warning');
          return;
        }
      }
    });

    if (result.issueCount >= CHECK_CONFIG.thresholds.authIdConfusion) {
      result.setSeverity('critical');
    }

  } catch (error) {
    result.addIssue(`Check failed: ${error.message}`, null, 'critical');
  }

  return result;
}

/**
 * Check for duplicate auth_id values
 */
async function checkDuplicateAuthIds() {
  const result = new ConsistencyCheckResult('Duplicate Auth IDs');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, auth_id, name, email')
      .not('auth_id', 'is', null);

    if (error) {
      result.addIssue(`Could not fetch users: ${error.message}`, null, 'error');
      return result;
    }

    const authIdCounts = {};
    users.forEach(user => {
      if (authIdCounts[user.auth_id]) {
        authIdCounts[user.auth_id].push(user);
      } else {
        authIdCounts[user.auth_id] = [user];
      }
    });

    Object.entries(authIdCounts).forEach(([authId, userList]) => {
      if (userList.length > 1) {
        result.addIssue(
          `Auth ID ${authId} is shared by ${userList.length} users: ${userList.map(u => u.name).join(', ')}`,
          authId,
          'critical'
        );
      }
    });

    if (result.issueCount >= CHECK_CONFIG.thresholds.duplicateAuthIds) {
      result.setSeverity('critical');
    }

  } catch (error) {
    result.addIssue(`Check failed: ${error.message}`, null, 'critical');
  }

  return result;
}

/**
 * Check for orphaned users (no auth_id connection)
 */
async function checkOrphanedUsers() {
  const result = new ConsistencyCheckResult('Orphaned Users');
  
  try {
    const { data: orphanedUsers, error } = await supabase
      .from('users')
      .select('id, name, email, created_at')
      .is('auth_id', null)
      .limit(CHECK_CONFIG.maxIssuesPerCheck);

    if (error) {
      result.addIssue(`Database query failed: ${error.message}`, null, 'error');
      return result;
    }

    if (orphanedUsers && orphanedUsers.length > 0) {
      orphanedUsers.forEach(user => {
        result.addIssue(
          `User "${user.name}" (${user.email}) has no auth_id connection`,
          user.id,
          'warning'
        );
      });
      
      if (result.issueCount >= CHECK_CONFIG.thresholds.orphanedUsers) {
        result.setSeverity('error');
      }
    }

  } catch (error) {
    result.addIssue(`Check failed: ${error.message}`, null, 'critical');
  }

  return result;
}

/**
 * Generate consistency check report
 */
async function generateConsistencyReport() {
  console.log('🔄 Running automated data consistency checks...\n');
  
  const checkResults = [];
  
  // Run all consistency checks
  console.log('📋 Executing checks...');
  checkResults.push(await checkOrphanedReservations());
  checkResults.push(await checkAuthIdConfusion());
  checkResults.push(await checkDuplicateAuthIds());
  checkResults.push(await checkOrphanedUsers());
  
  // Analyze results
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalChecks: checkResults.length,
      passedChecks: checkResults.filter(r => r.passed).length,
      failedChecks: checkResults.filter(r => !r.passed).length,
      totalIssues: checkResults.reduce((sum, r) => sum + r.issueCount, 0),
      highestSeverity: 'info'
    },
    checks: checkResults,
    recommendations: []
  };

  // Determine highest severity
  const severityLevels = { info: 0, warning: 1, error: 2, critical: 3 };
  checkResults.forEach(result => {
    if (severityLevels[result.severity] > severityLevels[report.summary.highestSeverity]) {
      report.summary.highestSeverity = result.severity;
    }
  });

  // Generate recommendations
  if (report.summary.totalIssues > 0) {
    report.recommendations.push('Run data integrity validation script for detailed analysis');
    report.recommendations.push('Execute repair scripts to fix identified issues');
    
    if (checkResults.some(r => r.checkName === 'Orphaned Reservations' && !r.passed)) {
      report.recommendations.push('Priority: Fix orphaned reservations to prevent data loss');
    }
    
    if (checkResults.some(r => r.checkName === 'Auth ID Confusion' && !r.passed)) {
      report.recommendations.push('Priority: Resolve auth_id/database_id confusion in reservations');
    }
    
    if (checkResults.some(r => r.checkName === 'Duplicate Auth IDs' && !r.passed)) {
      report.recommendations.push('Critical: Resolve duplicate auth_id entries immediately');
    }
  }

  return report;
}

/**
 * Save report to file
 */
async function saveReportToFile(report) {
  if (!CHECK_CONFIG.saveToFile) return;

  try {
    // Ensure reports directory exists
    await fs.mkdir(CHECK_CONFIG.reportDirectory, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `consistency-check-${timestamp}.json`;
    const filepath = path.join(CHECK_CONFIG.reportDirectory, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${filepath}`);
    
    // Also save a latest report for easy access
    const latestPath = path.join(CHECK_CONFIG.reportDirectory, 'latest-consistency-check.json');
    await fs.writeFile(latestPath, JSON.stringify(report, null, 2));
    
  } catch (error) {
    console.error('⚠️  Could not save report to file:', error.message);
  }
}

/**
 * Display report in console
 */
function displayReport(report) {
  console.log('\n📊 AUTOMATED CONSISTENCY CHECK REPORT');
  console.log('=' .repeat(50));
  console.log(`Generated: ${report.timestamp}`);
  console.log(`Overall Status: ${report.summary.highestSeverity.toUpperCase()}`);
  console.log('');

  // Summary
  console.log('📈 SUMMARY');
  console.log(`   Total checks: ${report.summary.totalChecks}`);
  console.log(`   Passed: ${report.summary.passedChecks}`);
  console.log(`   Failed: ${report.summary.failedChecks}`);
  console.log(`   Total issues: ${report.summary.totalIssues}`);
  console.log('');

  // Individual check results
  report.checks.forEach(result => {
    const statusIcon = result.passed ? '✅' : '❌';
    const severityIcon = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '🚨',
      critical: '🔥'
    }[result.severity];
    
    console.log(`${statusIcon} ${result.checkName} ${severityIcon}`);
    
    if (result.passed) {
      console.log('   No issues detected');
    } else {
      console.log(`   Issues found: ${result.issueCount}`);
      
      // Show first few issues
      const issuesToShow = result.issues.slice(0, 3);
      issuesToShow.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.description}`);
      });
      
      if (result.issues.length > 3) {
        console.log(`   ... and ${result.issues.length - 3} more issues`);
      }
    }
    console.log('');
  });

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('💡 RECOMMENDATIONS');
    report.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    console.log('');
  }

  // Final status
  if (report.summary.totalIssues === 0) {
    console.log('✅ All consistency checks passed! Database integrity looks good.');
  } else {
    console.log(`⚠️  ${report.summary.totalIssues} data consistency issues detected.`);
    console.log('   Review the issues above and run appropriate repair scripts.');
  }
}

/**
 * Main execution function
 */
async function runConsistencyCheck() {
  try {
    const report = await generateConsistencyReport();
    
    if (CHECK_CONFIG.generateReport) {
      displayReport(report);
    }
    
    if (CHECK_CONFIG.saveToFile) {
      await saveReportToFile(report);
    }
    
    // Exit with appropriate code
    const exitCode = report.summary.totalIssues > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n❌ Consistency check failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export functions for use in other scripts
module.exports = {
  checkOrphanedReservations,
  checkAuthIdConfusion,
  checkDuplicateAuthIds,
  checkOrphanedUsers,
  generateConsistencyReport,
  ConsistencyCheckResult
};

// Run check if script is executed directly
if (require.main === module) {
  runConsistencyCheck();
}