#!/usr/bin/env node

/**
 * Fix User ID Consistency Script
 * Repairs existing inconsistent user_id records in reservations
 * Requirements: 4.3
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
 * Configuration for the fix operation
 */
const FIX_CONFIG = {
  dryRun: false,                    // Set to true to preview changes without applying them
  createBackup: true,               // Create backup before making changes
  batchSize: 50,                    // Number of records to process at once
  logLevel: 'info',                 // info, debug, warn, error
  backupDirectory: './backups'
};

/**
 * Result tracking for the fix operation
 */
class FixResult {
  constructor() {
    this.timestamp = new Date().toISOString();
    this.totalProcessed = 0;
    this.successfulFixes = 0;
    this.errors = 0;
    this.skipped = 0;
    this.fixes = [];
    this.errorDetails = [];
  }

  addFix(reservationId, oldUserId, newUserId, userName, title) {
    this.fixes.push({
      reservationId,
      oldUserId,
      newUserId,
      userName,
      title,
      timestamp: new Date().toISOString()
    });
    this.successfulFixes++;
    this.totalProcessed++;
  }

  addError(reservationId, error, context = {}) {
    this.errorDetails.push({
      reservationId,
      error: error.message || error,
      context,
      timestamp: new Date().toISOString()
    });
    this.errors++;
    this.totalProcessed++;
  }

  addSkipped(reservationId, reason) {
    this.skipped++;
    this.totalProcessed++;
  }
}

/**
 * Create backup of current reservation data
 */
async function createBackup() {
  if (!FIX_CONFIG.createBackup) {
    return null;
  }

  try {
    console.log('📦 Creating backup of reservation data...');
    
    await fs.mkdir(FIX_CONFIG.backupDirectory, { recursive: true });
    
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Backup failed: ${error.message}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(FIX_CONFIG.backupDirectory, `reservations-backup-${timestamp}.json`);
    
    await fs.writeFile(backupPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      recordCount: reservations.length,
      data: reservations
    }, null, 2));

    console.log(`✅ Backup created: ${backupPath} (${reservations.length} records)`);
    return backupPath;

  } catch (error) {
    console.error('❌ Backup creation failed:', error.message);
    throw error;
  }
}

/**
 * Identify reservations with user_id inconsistencies
 */
async function identifyInconsistentReservations() {
  try {
    console.log('🔍 Identifying reservations with user_id inconsistencies...');

    // Get all users for mapping
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, auth_id, name, email');

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const authIdToUser = new Map();
    const dbIdSet = new Set();
    
    users.forEach(user => {
      if (user.auth_id) {
        authIdToUser.set(user.auth_id, user);
      }
      dbIdSet.add(user.id);
    });

    // Get all reservations
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, user_id, title, start_time, status, created_at')
      .order('created_at', { ascending: true });

    if (reservationsError) {
      throw new Error(`Failed to fetch reservations: ${reservationsError.message}`);
    }

    const inconsistentReservations = [];
    const orphanedReservations = [];

    reservations.forEach(reservation => {
      if (!dbIdSet.has(reservation.user_id)) {
        // user_id doesn't exist in users table
        if (authIdToUser.has(reservation.user_id)) {
          // It's an auth_id that needs to be converted
          const user = authIdToUser.get(reservation.user_id);
          inconsistentReservations.push({
            ...reservation,
            correctUserId: user.id,
            userName: user.name,
            userEmail: user.email,
            issue: 'auth_id_confusion'
          });
        } else {
          // Completely orphaned
          orphanedReservations.push({
            ...reservation,
            issue: 'orphaned'
          });
        }
      }
    });

    console.log(`📊 Analysis complete:`);
    console.log(`   Total reservations: ${reservations.length}`);
    console.log(`   Auth ID confusion cases: ${inconsistentReservations.length}`);
    console.log(`   Orphaned reservations: ${orphanedReservations.length}`);

    return { inconsistentReservations, orphanedReservations };

  } catch (error) {
    console.error('❌ Failed to identify inconsistent reservations:', error.message);
    throw error;
  }
}

/**
 * Fix a single reservation's user_id
 */
async function fixSingleReservation(reservation, result) {
  try {
    if (FIX_CONFIG.dryRun) {
      console.log(`[DRY RUN] Would fix reservation ${reservation.id}: ${reservation.user_id} → ${reservation.correctUserId}`);
      result.addFix(
        reservation.id,
        reservation.user_id,
        reservation.correctUserId,
        reservation.userName,
        reservation.title
      );
      return;
    }

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

    if (FIX_CONFIG.logLevel === 'debug') {
      console.log(`✅ Fixed reservation ${reservation.id} (${reservation.title}): ${reservation.user_id} → ${reservation.correctUserId}`);
    }

    result.addFix(
      reservation.id,
      reservation.user_id,
      reservation.correctUserId,
      reservation.userName,
      reservation.title
    );

  } catch (error) {
    console.error(`❌ Failed to fix reservation ${reservation.id}:`, error.message);
    result.addError(reservation.id, error, {
      oldUserId: reservation.user_id,
      newUserId: reservation.correctUserId,
      title: reservation.title
    });
  }
}

/**
 * Process reservations in batches
 */
async function processReservationBatch(reservations, result) {
  const promises = reservations.map(reservation => 
    fixSingleReservation(reservation, result)
  );
  
  await Promise.allSettled(promises);
}

/**
 * Fix all inconsistent reservations
 */
async function fixInconsistentReservations(inconsistentReservations) {
  const result = new FixResult();
  
  if (inconsistentReservations.length === 0) {
    console.log('✅ No inconsistent reservations found to fix');
    return result;
  }

  console.log(`🔧 ${FIX_CONFIG.dryRun ? '[DRY RUN] ' : ''}Fixing ${inconsistentReservations.length} inconsistent reservations...`);

  // Process in batches
  for (let i = 0; i < inconsistentReservations.length; i += FIX_CONFIG.batchSize) {
    const batch = inconsistentReservations.slice(i, i + FIX_CONFIG.batchSize);
    const batchNumber = Math.floor(i / FIX_CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(inconsistentReservations.length / FIX_CONFIG.batchSize);
    
    console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} reservations)...`);
    
    await processReservationBatch(batch, result);
    
    // Brief pause between batches to avoid overwhelming the database
    if (i + FIX_CONFIG.batchSize < inconsistentReservations.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return result;
}

/**
 * Handle orphaned reservations
 */
async function handleOrphanedReservations(orphanedReservations) {
  if (orphanedReservations.length === 0) {
    return;
  }

  console.log(`⚠️  Found ${orphanedReservations.length} orphaned reservations (user_id doesn't exist)`);
  console.log('   These require manual review:');
  
  orphanedReservations.slice(0, 10).forEach((reservation, index) => {
    console.log(`   ${index + 1}. ${reservation.title} (ID: ${reservation.id}, user_id: ${reservation.user_id})`);
  });
  
  if (orphanedReservations.length > 10) {
    console.log(`   ... and ${orphanedReservations.length - 10} more`);
  }
  
  console.log('\n💡 Recommendations for orphaned reservations:');
  console.log('   1. Review each reservation to determine the correct user');
  console.log('   2. Either update user_id to a valid user or delete the reservation');
  console.log('   3. Consider if these are test data that can be safely removed');
}

/**
 * Save fix results to file
 */
async function saveFixResults(result, backupPath) {
  try {
    await fs.mkdir('./reports', { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `./reports/user-id-fix-report-${timestamp}.json`;
    
    const report = {
      ...result,
      config: FIX_CONFIG,
      backupPath
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Fix report saved: ${reportPath}`);
    
  } catch (error) {
    console.error('⚠️  Could not save fix report:', error.message);
  }
}

/**
 * Display fix results summary
 */
function displayResults(result) {
  console.log('\n📊 USER ID CONSISTENCY FIX RESULTS');
  console.log('=' .repeat(50));
  console.log(`Completed: ${result.timestamp}`);
  console.log(`Mode: ${FIX_CONFIG.dryRun ? 'DRY RUN (no changes made)' : 'LIVE (changes applied)'}`);
  console.log('');
  
  console.log('📈 SUMMARY');
  console.log(`   Total processed: ${result.totalProcessed}`);
  console.log(`   Successful fixes: ${result.successfulFixes}`);
  console.log(`   Errors: ${result.errors}`);
  console.log(`   Skipped: ${result.skipped}`);
  console.log('');
  
  if (result.successfulFixes > 0) {
    console.log('✅ SUCCESSFUL FIXES');
    result.fixes.slice(0, 10).forEach((fix, index) => {
      console.log(`   ${index + 1}. ${fix.title} (${fix.reservationId})`);
      console.log(`      User: ${fix.userName}`);
      console.log(`      Fixed: ${fix.oldUserId} → ${fix.newUserId}`);
    });
    
    if (result.fixes.length > 10) {
      console.log(`   ... and ${result.fixes.length - 10} more fixes`);
    }
    console.log('');
  }
  
  if (result.errors > 0) {
    console.log('❌ ERRORS');
    result.errorDetails.slice(0, 5).forEach((error, index) => {
      console.log(`   ${index + 1}. Reservation ${error.reservationId}: ${error.error}`);
    });
    
    if (result.errorDetails.length > 5) {
      console.log(`   ... and ${result.errorDetails.length - 5} more errors`);
    }
    console.log('');
  }
  
  if (result.successfulFixes > 0 && !FIX_CONFIG.dryRun) {
    console.log('🎉 User ID consistency fixes have been applied successfully!');
    console.log('   All affected reservations now use correct database user IDs.');
  } else if (FIX_CONFIG.dryRun) {
    console.log('ℹ️  This was a dry run. To apply changes, set dryRun: false in the configuration.');
  }
}

/**
 * Main execution function
 */
async function runUserIdConsistencyFix() {
  try {
    console.log('🚀 Starting User ID Consistency Fix...\n');
    
    // Create backup
    const backupPath = await createBackup();
    
    // Identify issues
    const { inconsistentReservations, orphanedReservations } = await identifyInconsistentReservations();
    
    // Handle orphaned reservations (manual review required)
    await handleOrphanedReservations(orphanedReservations);
    
    // Fix inconsistent reservations
    const result = await fixInconsistentReservations(inconsistentReservations);
    
    // Save results
    await saveFixResults(result, backupPath);
    
    // Display summary
    displayResults(result);
    
    // Exit with appropriate code
    const exitCode = result.errors > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n❌ User ID consistency fix failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export functions for testing
module.exports = {
  identifyInconsistentReservations,
  fixSingleReservation,
  createBackup,
  FixResult
};

// Run fix if script is executed directly
if (require.main === module) {
  // Check command line arguments
  const args = process.argv.slice(2);
  if (args.includes('--dry-run')) {
    FIX_CONFIG.dryRun = true;
    console.log('🔍 Running in DRY RUN mode - no changes will be made');
  }
  if (args.includes('--no-backup')) {
    FIX_CONFIG.createBackup = false;
    console.log('⚠️  Backup creation disabled');
  }
  if (args.includes('--debug')) {
    FIX_CONFIG.logLevel = 'debug';
  }
  
  runUserIdConsistencyFix();
}