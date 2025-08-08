#!/usr/bin/env node

/**
 * Data Integrity Validation Scripts
 * Identifies and reports data consistency issues, particularly user_id references
 * Requirements: 4.1, 4.2
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Required environment variables are missing:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Data integrity validation results structure
 */
class ValidationResult {
  constructor(checkName, description) {
    this.checkName = checkName;
    this.description = description;
    this.passed = true;
    this.issues = [];
    this.affectedRecords = 0;
    this.recommendations = [];
  }

  addIssue(issue, recordId = null) {
    this.passed = false;
    this.issues.push({
      description: issue,
      recordId,
      timestamp: new Date().toISOString()
    });
    this.affectedRecords++;
  }

  addRecommendation(recommendation) {
    this.recommendations.push(recommendation);
  }
}

/**
 * Check for reservations with inconsistent user_id values
 * Identifies cases where user_id might reference auth_id instead of public.users.id
 */
async function validateReservationUserIds() {
  const result = new ValidationResult(
    'Reservation User ID Consistency',
    'Validates that reservations.user_id references public.users.id correctly'
  );

  try {
    // Check for reservations where user_id doesn't exist in public.users table
    const { data: orphanedReservations, error: orphanError } = await supabase
      .from('reservations')
      .select(`
        id,
        user_id,
        title,
        start_time,
        created_at
      `)
      .not('user_id', 'in', `(SELECT id FROM users)`);

    if (orphanError) {
      result.addIssue(`Database query error: ${orphanError.message}`);
      return result;
    }

    if (orphanedReservations && orphanedReservations.length > 0) {
      orphanedReservations.forEach(reservation => {
        result.addIssue(
          `Reservation references non-existent user_id: ${reservation.user_id}`,
          reservation.id
        );
      });
      result.addRecommendation('Run user ID repair script to fix orphaned reservations');
    }

    // Check for reservations where user_id might be auth_id instead of database id
    const { data: potentialAuthIdReservations, error: authIdError } = await supabase
      .from('reservations')
      .select(`
        r.id,
        r.user_id,
        r.title,
        r.start_time,
        u.id as correct_user_id,
        u.auth_id,
        u.name as user_name
      `)
      .from('reservations as r')
      .leftJoin('users as u', 'r.user_id', 'u.auth_id')
      .not('u.auth_id', 'is', null);

    if (authIdError) {
      console.warn('Could not check for auth_id confusion:', authIdError.message);
    } else if (potentialAuthIdReservations && potentialAuthIdReservations.length > 0) {
      potentialAuthIdReservations.forEach(reservation => {
        result.addIssue(
          `Reservation may be using auth_id instead of database id. User: ${reservation.user_name}`,
          reservation.id
        );
      });
      result.addRecommendation('Review reservations that may be using auth_id instead of database user id');
    }

  } catch (error) {
    result.addIssue(`Validation error: ${error.message}`);
  }

  return result;
}

/**
 * Validate user_id references across all user-related foreign keys
 */
async function validateUserIdReferences() {
  const result = new ValidationResult(
    'User ID Reference Validation',
    'Checks all foreign key references to users table for consistency'
  );

  try {
    // Get all users for reference
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, auth_id, name, email');

    if (usersError) {
      result.addIssue(`Could not fetch users: ${usersError.message}`);
      return result;
    }

    const validUserIds = new Set(users.map(u => u.id));
    const authIdToDbId = new Map(users.map(u => [u.auth_id, u.id]));

    // Check reservations table
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, user_id, title, start_time');

    if (reservationsError) {
      result.addIssue(`Could not fetch reservations: ${reservationsError.message}`);
    } else {
      reservations.forEach(reservation => {
        if (!validUserIds.has(reservation.user_id)) {
          // Check if it might be an auth_id
          if (authIdToDbId.has(reservation.user_id)) {
            result.addIssue(
              `Reservation ${reservation.id} uses auth_id (${reservation.user_id}) instead of database id (${authIdToDbId.get(reservation.user_id)})`,
              reservation.id
            );
          } else {
            result.addIssue(
              `Reservation ${reservation.id} references invalid user_id: ${reservation.user_id}`,
              reservation.id
            );
          }
        }
      });
    }

    if (result.affectedRecords > 0) {
      result.addRecommendation('Use fixReservationUserId function to repair inconsistent user IDs');
      result.addRecommendation('Implement type guards to prevent future auth_id/dbId confusion');
    }

  } catch (error) {
    result.addIssue(`Reference validation error: ${error.message}`);
  }

  return result;
}

/**
 * Check for duplicate or inconsistent user records
 */
async function validateUserDataConsistency() {
  const result = new ValidationResult(
    'User Data Consistency',
    'Validates user table data integrity and uniqueness constraints'
  );

  try {
    // Check for duplicate emails
    const { data: duplicateEmails, error: emailError } = await supabase
      .rpc('check_duplicate_emails');

    if (emailError && !emailError.message.includes('function "check_duplicate_emails" does not exist')) {
      result.addIssue(`Email duplication check failed: ${emailError.message}`);
    }

    // Check for users without auth_id connection
    const { data: orphanedUsers, error: orphanError } = await supabase
      .from('users')
      .select('id, name, email, auth_id')
      .is('auth_id', null);

    if (orphanError) {
      result.addIssue(`Orphaned users check failed: ${orphanError.message}`);
    } else if (orphanedUsers && orphanedUsers.length > 0) {
      orphanedUsers.forEach(user => {
        result.addIssue(
          `User ${user.name} (${user.email}) has no auth_id connection`,
          user.id
        );
      });
      result.addRecommendation('Review users without auth_id and either connect or remove them');
    }

    // Check for auth_id duplicates
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, auth_id, name, email')
      .not('auth_id', 'is', null);

    if (usersError) {
      result.addIssue(`Users fetch failed: ${usersError.message}`);
    } else {
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
            `Duplicate auth_id ${authId} found in users: ${userList.map(u => u.name).join(', ')}`,
            authId
          );
        }
      });

      if (result.affectedRecords > 0) {
        result.addRecommendation('Resolve duplicate auth_id entries by merging or removing duplicate users');
      }
    }

  } catch (error) {
    result.addIssue(`User consistency validation error: ${error.message}`);
  }

  return result;
}

/**
 * Generate comprehensive data integrity report
 */
async function generateIntegrityReport() {
  console.log('🔍 Starting Data Integrity Validation...\n');
  
  const validationResults = [];
  
  // Run all validation checks
  console.log('📋 Running validation checks...');
  validationResults.push(await validateReservationUserIds());
  validationResults.push(await validateUserIdReferences());
  validationResults.push(await validateUserDataConsistency());
  
  // Generate report
  console.log('\n📊 DATA INTEGRITY VALIDATION REPORT');
  console.log('=' .repeat(50));
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Database: ${supabaseUrl}`);
  console.log('');

  let totalIssues = 0;
  let passedChecks = 0;

  validationResults.forEach(result => {
    console.log(`\n🔸 ${result.checkName}`);
    console.log(`   ${result.description}`);
    console.log(`   Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (result.passed) {
      passedChecks++;
      console.log('   No issues found.');
    } else {
      console.log(`   Issues found: ${result.affectedRecords}`);
      totalIssues += result.affectedRecords;
      
      // Show first few issues
      const issuesToShow = result.issues.slice(0, 5);
      issuesToShow.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.description}`);
        if (issue.recordId) {
          console.log(`      Record ID: ${issue.recordId}`);
        }
      });
      
      if (result.issues.length > 5) {
        console.log(`   ... and ${result.issues.length - 5} more issues`);
      }
      
      // Show recommendations
      if (result.recommendations.length > 0) {
        console.log('   Recommendations:');
        result.recommendations.forEach((rec, index) => {
          console.log(`   • ${rec}`);
        });
      }
    }
  });

  // Summary
  console.log('\n📈 SUMMARY');
  console.log('=' .repeat(30));
  console.log(`Total checks run: ${validationResults.length}`);
  console.log(`Checks passed: ${passedChecks}`);
  console.log(`Checks failed: ${validationResults.length - passedChecks}`);
  console.log(`Total issues found: ${totalIssues}`);
  
  if (totalIssues > 0) {
    console.log('\n⚠️  Data integrity issues detected!');
    console.log('   Run the repair scripts to fix identified issues.');
    console.log('   Consider implementing preventive measures to avoid future issues.');
  } else {
    console.log('\n✅ All data integrity checks passed!');
    console.log('   Your database appears to be in good condition.');
  }

  // Return structured results for programmatic use
  return {
    timestamp: new Date().toISOString(),
    totalChecks: validationResults.length,
    passedChecks,
    failedChecks: validationResults.length - passedChecks,
    totalIssues,
    results: validationResults
  };
}

/**
 * Export individual validation functions for use in other scripts
 */
module.exports = {
  validateReservationUserIds,
  validateUserIdReferences,
  validateUserDataConsistency,
  generateIntegrityReport,
  ValidationResult
};

// Run validation if script is executed directly
if (require.main === module) {
  generateIntegrityReport()
    .then(report => {
      process.exit(report.totalIssues > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n❌ Validation script failed:', error.message);
      process.exit(1);
    });
}