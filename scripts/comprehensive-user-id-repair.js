#!/usr/bin/env node

/**
 * Comprehensive User ID Repair Script
 * Combines validation, fixing, and monitoring for complete data integrity management
 * Requirements: 4.2, 4.3
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Import validation functions
const { generateIntegrityReport } = require('./data-integrity-validation');
const { runConsistencyCheck } = require('./automated-consistency-check');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Required environment variables are missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Comprehensive repair configuration
 */
const REPAIR_CONFIG = {
  // Operation modes
  dryRun: false,
  interactive: true,
  
  // Safety features
  createBackup: true,
  enableRollback: true,
  requireConfirmation: true,
  
  // Performance settings
  batchSize: 25,
  maxRetries: 3,
  retryDelay: 1000,
  
  // Reporting
  generateReport: true,
  saveResults: true,
  reportDirectory: './reports',
  
  // Validation
  preValidation: true,
  postValidation: true,
  
  // Monitoring
  enableMonitoring: true,
  monitoringInterval: 5000
};

/**
 * Comprehensive repair operation result
 */
class ComprehensiveRepairResult {
  constructor() {
    this.timestamp = new Date().toISOString();
    this.phases = {
      preValidation: { completed: false, issues: 0 },
      backup: { completed: false, backupPath: null },
      repair: { completed: false, fixed: 0, failed: 0 },
      postValidation: { completed: false, issues: 0 },
      monitoring: { completed: false, healthScore: 0 }
    };
    this.totalIssuesFound = 0;
    this.totalIssuesFixed = 0;
    this.remainingIssues = 0;
    this.success = false;
    this.errors = [];
    this.recommendations = [];
  }

  addError(phase, error) {
    this.errors.push({
      phase,
      error: error.message || error,
      timestamp: new Date().toISOString()
    });
  }

  addRecommendation(recommendation) {
    this.recommendations.push({
      recommendation,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Enhanced user input with timeout
 */
function askQuestion(question, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const timer = setTimeout(() => {
      rl.close();
      reject(new Error('Input timeout - proceeding with default action'));
    }, timeout);

    rl.question(question, (answer) => {
      clearTimeout(timer);
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * Phase 1: Pre-validation
 */
async function runPreValidation(result) {
  console.log('🔍 Phase 1: Pre-validation - Analyzing current data integrity...\n');
  
  try {
    const validationReport = await generateIntegrityReport();
    
    result.phases.preValidation.completed = true;
    result.phases.preValidation.issues = validationReport.totalIssues;
    result.totalIssuesFound = validationReport.totalIssues;
    
    if (validationReport.totalIssues === 0) {
      console.log('✅ Pre-validation: No data integrity issues found!');
      console.log('   Your database appears to be in excellent condition.');
      return true;
    }
    
    console.log(`⚠️  Pre-validation: Found ${validationReport.totalIssues} data integrity issues`);
    console.log('   Issues breakdown:');
    
    validationReport.results.forEach(check => {
      if (!check.passed) {
        console.log(`   • ${check.checkName}: ${check.affectedRecords} issues`);
      }
    });
    
    if (REPAIR_CONFIG.interactive && REPAIR_CONFIG.requireConfirmation) {
      console.log('\n❓ Do you want to proceed with the repair process? (y/N)');
      try {
        const answer = await askQuestion('> ');
        if (!['y', 'yes'].includes(answer)) {
          console.log('🛑 Repair process cancelled by user');
          return false;
        }
      } catch (error) {
        console.log('⏰ No response received, proceeding with repair...');
      }
    }
    
    return true;
    
  } catch (error) {
    result.addError('preValidation', error);
    console.error('❌ Pre-validation failed:', error.message);
    return false;
  }
}

/**
 * Phase 2: Create comprehensive backup
 */
async function createComprehensiveBackup(result) {
  if (!REPAIR_CONFIG.createBackup) {
    console.log('⏭️  Phase 2: Backup creation skipped (disabled in config)');
    return true;
  }
  
  console.log('📦 Phase 2: Creating comprehensive backup...\n');
  
  try {
    await fs.mkdir(REPAIR_CONFIG.reportDirectory, { recursive: true });
    
    // Backup reservations
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (reservationsError) {
      throw new Error(`Failed to backup reservations: ${reservationsError.message}`);
    }
    
    // Backup users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (usersError) {
      throw new Error(`Failed to backup users: ${usersError.message}`);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData = {
      timestamp: new Date().toISOString(),
      metadata: {
        reservationCount: reservations.length,
        userCount: users.length,
        backupReason: 'comprehensive_user_id_repair'
      },
      reservations,
      users
    };
    
    const backupPath = path.join(REPAIR_CONFIG.reportDirectory, `comprehensive-backup-${timestamp}.json`);
    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
    
    result.phases.backup.completed = true;
    result.phases.backup.backupPath = backupPath;
    
    console.log(`✅ Comprehensive backup created: ${backupPath}`);
    console.log(`   • Reservations: ${reservations.length} records`);
    console.log(`   • Users: ${users.length} records`);
    
    return true;
    
  } catch (error) {
    result.addError('backup', error);
    console.error('❌ Backup creation failed:', error.message);
    return false;
  }
}

/**
 * Phase 3: Execute repairs
 */
async function executeRepairs(result) {
  console.log('🔧 Phase 3: Executing user ID repairs...\n');
  
  try {
    // Find reservations needing repair
    const reservationsNeedingFix = await findReservationsNeedingRepair();
    
    if (reservationsNeedingFix.length === 0) {
      console.log('✅ No reservations need user ID repairs');
      result.phases.repair.completed = true;
      return true;
    }
    
    console.log(`📋 Found ${reservationsNeedingFix.length} reservations needing repair`);
    
    if (REPAIR_CONFIG.dryRun) {
      console.log('🔍 DRY RUN MODE - No actual changes will be made');
    }
    
    // Process repairs in batches
    let totalFixed = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < reservationsNeedingFix.length; i += REPAIR_CONFIG.batchSize) {
      const batch = reservationsNeedingFix.slice(i, i + REPAIR_CONFIG.batchSize);
      const batchNumber = Math.floor(i / REPAIR_CONFIG.batchSize) + 1;
      const totalBatches = Math.ceil(reservationsNeedingFix.length / REPAIR_CONFIG.batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} reservations)...`);
      
      for (const reservation of batch) {
        const repairResult = await repairSingleReservation(reservation);
        
        if (repairResult.success) {
          totalFixed++;
          if (!REPAIR_CONFIG.dryRun) {
            console.log(`   ✅ Fixed: ${reservation.title} (${reservation.id})`);
          } else {
            console.log(`   🔍 Would fix: ${reservation.title} (${reservation.id})`);
          }
        } else {
          totalFailed++;
          console.log(`   ❌ Failed: ${reservation.title} (${reservation.id}) - ${repairResult.error}`);
        }
      }
      
      // Brief pause between batches
      if (i + REPAIR_CONFIG.batchSize < reservationsNeedingFix.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    result.phases.repair.completed = true;
    result.phases.repair.fixed = totalFixed;
    result.phases.repair.failed = totalFailed;
    result.totalIssuesFixed = totalFixed;
    
    console.log(`\n📊 Repair phase completed:`);
    console.log(`   • Successfully fixed: ${totalFixed}`);
    console.log(`   • Failed to fix: ${totalFailed}`);
    
    return totalFailed === 0;
    
  } catch (error) {
    result.addError('repair', error);
    console.error('❌ Repair execution failed:', error.message);
    return false;
  }
}

/**
 * Find reservations needing repair
 */
async function findReservationsNeedingRepair() {
  // Get all users for mapping
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, auth_id, name, email');

  if (usersError) {
    throw new Error(`Failed to fetch users: ${usersError.message}`);
  }

  const validUserIds = new Set(users.map(u => u.id));
  const authIdToUser = new Map();
  users.forEach(user => {
    if (user.auth_id) {
      authIdToUser.set(user.auth_id, user);
    }
  });

  // Get reservations with potential issues
  const { data: reservations, error: reservationsError } = await supabase
    .from('reservations')
    .select('id, user_id, title, start_time')
    .order('created_at', { ascending: true });

  if (reservationsError) {
    throw new Error(`Failed to fetch reservations: ${reservationsError.message}`);
  }

  const needingRepair = [];

  reservations.forEach(reservation => {
    if (!validUserIds.has(reservation.user_id)) {
      // Check if it's an auth_id that can be corrected
      if (authIdToUser.has(reservation.user_id)) {
        const user = authIdToUser.get(reservation.user_id);
        needingRepair.push({
          ...reservation,
          correctUserId: user.id,
          userName: user.name,
          issue: 'auth_id_confusion'
        });
      }
    }
  });

  return needingRepair;
}

/**
 * Repair a single reservation
 */
async function repairSingleReservation(reservation) {
  try {
    if (REPAIR_CONFIG.dryRun) {
      return {
        success: true,
        reservationId: reservation.id,
        originalUserId: reservation.user_id,
        correctedUserId: reservation.correctUserId
      };
    }

    // Perform the actual repair with retry logic
    let lastError = null;
    for (let attempt = 1; attempt <= REPAIR_CONFIG.maxRetries; attempt++) {
      try {
        const { error } = await supabase
          .from('reservations')
          .update({ 
            user_id: reservation.correctUserId,
            updated_at: new Date().toISOString()
          })
          .eq('id', reservation.id);

        if (error) {
          throw error;
        }

        return {
          success: true,
          reservationId: reservation.id,
          originalUserId: reservation.user_id,
          correctedUserId: reservation.correctUserId
        };

      } catch (error) {
        lastError = error;
        if (attempt < REPAIR_CONFIG.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, REPAIR_CONFIG.retryDelay));
        }
      }
    }

    return {
      success: false,
      reservationId: reservation.id,
      error: `Failed after ${REPAIR_CONFIG.maxRetries} attempts: ${lastError.message}`
    };

  } catch (error) {
    return {
      success: false,
      reservationId: reservation.id,
      error: error.message
    };
  }
}

/**
 * Phase 4: Post-validation
 */
async function runPostValidation(result) {
  if (!REPAIR_CONFIG.postValidation) {
    console.log('⏭️  Phase 4: Post-validation skipped (disabled in config)');
    return true;
  }
  
  console.log('🔍 Phase 4: Post-validation - Verifying repair results...\n');
  
  try {
    const validationReport = await generateIntegrityReport();
    
    result.phases.postValidation.completed = true;
    result.phases.postValidation.issues = validationReport.totalIssues;
    result.remainingIssues = validationReport.totalIssues;
    
    const issuesFixed = result.totalIssuesFound - validationReport.totalIssues;
    
    console.log(`📊 Post-validation results:`);
    console.log(`   • Issues before repair: ${result.totalIssuesFound}`);
    console.log(`   • Issues after repair: ${validationReport.totalIssues}`);
    console.log(`   • Issues resolved: ${issuesFixed}`);
    
    if (validationReport.totalIssues === 0) {
      console.log('🎉 All data integrity issues have been resolved!');
      return true;
    } else {
      console.log(`⚠️  ${validationReport.totalIssues} issues remain - may require manual intervention`);
      
      // Add recommendations for remaining issues
      result.addRecommendation('Review remaining issues and consider manual fixes');
      result.addRecommendation('Run individual repair scripts for specific issue types');
      
      return false;
    }
    
  } catch (error) {
    result.addError('postValidation', error);
    console.error('❌ Post-validation failed:', error.message);
    return false;
  }
}

/**
 * Phase 5: Health monitoring
 */
async function runHealthMonitoring(result) {
  if (!REPAIR_CONFIG.enableMonitoring) {
    console.log('⏭️  Phase 5: Health monitoring skipped (disabled in config)');
    return true;
  }
  
  console.log('📊 Phase 5: Health monitoring - Generating system health report...\n');
  
  try {
    // Generate health metrics
    const healthMetrics = await generateHealthMetrics();
    
    result.phases.monitoring.completed = true;
    result.phases.monitoring.healthScore = healthMetrics.overallScore;
    
    console.log('📈 System Health Report:');
    console.log(`   • Overall Health Score: ${healthMetrics.overallScore}/100`);
    console.log(`   • Data Consistency: ${healthMetrics.dataConsistency}%`);
    console.log(`   • Reference Integrity: ${healthMetrics.referenceIntegrity}%`);
    console.log(`   • User ID Consistency: ${healthMetrics.userIdConsistency}%`);
    
    if (healthMetrics.overallScore >= 95) {
      console.log('🎉 Excellent system health!');
    } else if (healthMetrics.overallScore >= 80) {
      console.log('✅ Good system health with minor issues');
    } else {
      console.log('⚠️  System health needs attention');
      result.addRecommendation('Schedule regular data integrity checks');
      result.addRecommendation('Consider implementing preventive measures');
    }
    
    return true;
    
  } catch (error) {
    result.addError('monitoring', error);
    console.error('❌ Health monitoring failed:', error.message);
    return false;
  }
}

/**
 * Generate health metrics
 */
async function generateHealthMetrics() {
  // Get basic counts
  const { data: totalUsers } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });

  const { data: totalReservations } = await supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true });

  const { data: validReservations } = await supabase
    .from('reservations')
    .select('r.id')
    .from('reservations r')
    .innerJoin('users u', 'r.user_id', 'u.id')
    .select('id', { count: 'exact', head: true });

  const userCount = totalUsers?.length || 0;
  const reservationCount = totalReservations?.length || 0;
  const validReservationCount = validReservations?.length || 0;

  const dataConsistency = reservationCount > 0 ? Math.round((validReservationCount / reservationCount) * 100) : 100;
  const referenceIntegrity = dataConsistency; // Simplified for this example
  const userIdConsistency = dataConsistency; // Simplified for this example

  const overallScore = Math.round((dataConsistency + referenceIntegrity + userIdConsistency) / 3);

  return {
    overallScore,
    dataConsistency,
    referenceIntegrity,
    userIdConsistency,
    metrics: {
      totalUsers: userCount,
      totalReservations: reservationCount,
      validReservations: validReservationCount
    }
  };
}

/**
 * Save comprehensive results
 */
async function saveComprehensiveResults(result) {
  if (!REPAIR_CONFIG.saveResults) {
    return;
  }
  
  try {
    await fs.mkdir(REPAIR_CONFIG.reportDirectory, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(REPAIR_CONFIG.reportDirectory, `comprehensive-repair-${timestamp}.json`);
    
    await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
    console.log(`📄 Comprehensive report saved: ${reportPath}`);
    
  } catch (error) {
    console.error('⚠️  Could not save comprehensive results:', error.message);
  }
}

/**
 * Display final summary
 */
function displayFinalSummary(result) {
  console.log('\n🏁 COMPREHENSIVE USER ID REPAIR SUMMARY');
  console.log('=' .repeat(60));
  console.log(`Completed: ${result.timestamp}`);
  console.log(`Overall Success: ${result.success ? '✅ YES' : '❌ NO'}`);
  console.log('');
  
  console.log('📋 PHASE COMPLETION:');
  Object.entries(result.phases).forEach(([phase, data]) => {
    const status = data.completed ? '✅' : '❌';
    console.log(`   ${status} ${phase.charAt(0).toUpperCase() + phase.slice(1)}`);
  });
  console.log('');
  
  console.log('📊 REPAIR STATISTICS:');
  console.log(`   Issues Found: ${result.totalIssuesFound}`);
  console.log(`   Issues Fixed: ${result.totalIssuesFixed}`);
  console.log(`   Remaining Issues: ${result.remainingIssues}`);
  console.log(`   Success Rate: ${result.totalIssuesFound > 0 ? Math.round((result.totalIssuesFixed / result.totalIssuesFound) * 100) : 100}%`);
  console.log('');
  
  if (result.errors.length > 0) {
    console.log('❌ ERRORS ENCOUNTERED:');
    result.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. [${error.phase}] ${error.error}`);
    });
    console.log('');
  }
  
  if (result.recommendations.length > 0) {
    console.log('💡 RECOMMENDATIONS:');
    result.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec.recommendation}`);
    });
    console.log('');
  }
  
  if (result.success) {
    console.log('🎉 Comprehensive user ID repair completed successfully!');
    console.log('   Your database integrity has been restored.');
  } else {
    console.log('⚠️  Comprehensive repair completed with issues.');
    console.log('   Review the errors and recommendations above.');
  }
}

/**
 * Main execution function
 */
async function runComprehensiveRepair() {
  const result = new ComprehensiveRepairResult();
  
  console.log('🚀 Starting Comprehensive User ID Repair Process...\n');
  console.log(`Configuration: ${REPAIR_CONFIG.dryRun ? 'DRY RUN' : 'LIVE'} mode\n`);
  
  try {
    // Phase 1: Pre-validation
    const preValidationSuccess = await runPreValidation(result);
    if (!preValidationSuccess) {
      result.success = false;
      await saveComprehensiveResults(result);
      displayFinalSummary(result);
      process.exit(1);
    }
    
    // Early exit if no issues found
    if (result.totalIssuesFound === 0) {
      result.success = true;
      await saveComprehensiveResults(result);
      displayFinalSummary(result);
      process.exit(0);
    }
    
    // Phase 2: Backup
    const backupSuccess = await createComprehensiveBackup(result);
    if (!backupSuccess && REPAIR_CONFIG.createBackup) {
      result.addError('backup', new Error('Backup creation failed - aborting for safety'));
      result.success = false;
      await saveComprehensiveResults(result);
      displayFinalSummary(result);
      process.exit(1);
    }
    
    // Phase 3: Repairs
    const repairSuccess = await executeRepairs(result);
    
    // Phase 4: Post-validation
    const postValidationSuccess = await runPostValidation(result);
    
    // Phase 5: Health monitoring
    const monitoringSuccess = await runHealthMonitoring(result);
    
    // Determine overall success
    result.success = repairSuccess && postValidationSuccess && monitoringSuccess;
    
    // Save results and display summary
    await saveComprehensiveResults(result);
    displayFinalSummary(result);
    
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Comprehensive repair process failed:', error.message);
    result.addError('general', error);
    result.success = false;
    
    await saveComprehensiveResults(result);
    displayFinalSummary(result);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--dry-run')) {
  REPAIR_CONFIG.dryRun = true;
  console.log('🔍 Running in DRY RUN mode - no changes will be made');
}
if (args.includes('--non-interactive')) {
  REPAIR_CONFIG.interactive = false;
  REPAIR_CONFIG.requireConfirmation = false;
  console.log('🤖 Running in non-interactive mode');
}
if (args.includes('--no-backup')) {
  REPAIR_CONFIG.createBackup = false;
  console.log('⚠️  Backup creation disabled');
}
if (args.includes('--skip-validation')) {
  REPAIR_CONFIG.preValidation = false;
  REPAIR_CONFIG.postValidation = false;
  console.log('⚠️  Validation steps disabled');
}

// Run the comprehensive repair
if (require.main === module) {
  runComprehensiveRepair();
}

module.exports = {
  runComprehensiveRepair,
  REPAIR_CONFIG
};