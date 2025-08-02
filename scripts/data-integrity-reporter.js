#!/usr/bin/env node

/**
 * Data Integrity Reporter
 * Provides detailed reporting functionality for data integrity issues
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
 * Report configuration
 */
const REPORT_CONFIG = {
  outputFormats: ['console', 'json', 'csv'],
  includeRecommendations: true,
  includeStatistics: true,
  maxRecordsPerIssue: 50,
  reportDirectory: './reports'
};

/**
 * Data integrity issue types
 */
const ISSUE_TYPES = {
  ORPHANED_RESERVATION: 'orphaned_reservation',
  AUTH_ID_CONFUSION: 'auth_id_confusion',
  DUPLICATE_AUTH_ID: 'duplicate_auth_id',
  ORPHANED_USER: 'orphaned_user',
  INVALID_FOREIGN_KEY: 'invalid_foreign_key',
  MISSING_REQUIRED_FIELD: 'missing_required_field'
};

/**
 * Issue severity levels
 */
const SEVERITY_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Data integrity issue class
 */
class DataIntegrityIssue {
  constructor(type, severity, description, recordId = null, metadata = {}) {
    this.id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.severity = severity;
    this.description = description;
    this.recordId = recordId;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
    this.resolved = false;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      severity: this.severity,
      description: this.description,
      recordId: this.recordId,
      metadata: this.metadata,
      timestamp: this.timestamp,
      resolved: this.resolved
    };
  }
}

/**
 * Comprehensive data integrity analysis
 */
class DataIntegrityAnalyzer {
  constructor() {
    this.issues = [];
    this.statistics = {};
    this.recommendations = [];
  }

  addIssue(type, severity, description, recordId = null, metadata = {}) {
    const issue = new DataIntegrityIssue(type, severity, description, recordId, metadata);
    this.issues.push(issue);
    return issue;
  }

  addRecommendation(priority, action, description) {
    this.recommendations.push({
      priority,
      action,
      description,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Analyze orphaned reservations
   */
  async analyzeOrphanedReservations() {
    try {
      const { data: orphanedReservations, error } = await supabase
        .from('reservations')
        .select(`
          id,
          user_id,
          title,
          purpose,
          start_time,
          end_time,
          status,
          created_at
        `)
        .not('user_id', 'in', `(SELECT id FROM users)`)
        .limit(REPORT_CONFIG.maxRecordsPerIssue);

      if (error) {
        this.addIssue(
          ISSUE_TYPES.ORPHANED_RESERVATION,
          SEVERITY_LEVELS.CRITICAL,
          `Failed to query orphaned reservations: ${error.message}`
        );
        return;
      }

      if (orphanedReservations && orphanedReservations.length > 0) {
        orphanedReservations.forEach(reservation => {
          this.addIssue(
            ISSUE_TYPES.ORPHANED_RESERVATION,
            SEVERITY_LEVELS.ERROR,
            `Reservation "${reservation.title}" references non-existent user_id`,
            reservation.id,
            {
              user_id: reservation.user_id,
              title: reservation.title,
              start_time: reservation.start_time,
              status: reservation.status,
              created_at: reservation.created_at
            }
          );
        });

        this.addRecommendation(
          'HIGH',
          'repair_orphaned_reservations',
          `Fix ${orphanedReservations.length} orphaned reservations by updating user_id references or removing invalid records`
        );
      }

      this.statistics.orphanedReservations = orphanedReservations?.length || 0;

    } catch (error) {
      this.addIssue(
        ISSUE_TYPES.ORPHANED_RESERVATION,
        SEVERITY_LEVELS.CRITICAL,
        `Analysis failed: ${error.message}`
      );
    }
  }

  /**
   * Analyze auth_id confusion in reservations
   */
  async analyzeAuthIdConfusion() {
    try {
      // Get all users for mapping
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, auth_id, name, email');

      if (usersError) {
        this.addIssue(
          ISSUE_TYPES.AUTH_ID_CONFUSION,
          SEVERITY_LEVELS.ERROR,
          `Could not fetch users for auth_id analysis: ${usersError.message}`
        );
        return;
      }

      const authIdToUser = new Map();
      users.forEach(user => {
        if (user.auth_id) {
          authIdToUser.set(user.auth_id, user);
        }
      });

      // Check reservations for auth_id usage
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, user_id, title, start_time, created_at')
        .limit(1000);

      if (reservationsError) {
        this.addIssue(
          ISSUE_TYPES.AUTH_ID_CONFUSION,
          SEVERITY_LEVELS.ERROR,
          `Could not fetch reservations for auth_id analysis: ${reservationsError.message}`
        );
        return;
      }

      let confusionCount = 0;
      reservations.forEach(reservation => {
        if (authIdToUser.has(reservation.user_id)) {
          const user = authIdToUser.get(reservation.user_id);
          this.addIssue(
            ISSUE_TYPES.AUTH_ID_CONFUSION,
            SEVERITY_LEVELS.ERROR,
            `Reservation uses auth_id instead of database id for user "${user.name}"`,
            reservation.id,
            {
              current_user_id: reservation.user_id,
              correct_user_id: user.id,
              user_name: user.name,
              user_email: user.email,
              title: reservation.title,
              start_time: reservation.start_time
            }
          );
          confusionCount++;
        }
      });

      if (confusionCount > 0) {
        this.addRecommendation(
          'CRITICAL',
          'fix_auth_id_confusion',
          `Fix ${confusionCount} reservations that use auth_id instead of database user_id`
        );
      }

      this.statistics.authIdConfusion = confusionCount;

    } catch (error) {
      this.addIssue(
        ISSUE_TYPES.AUTH_ID_CONFUSION,
        SEVERITY_LEVELS.CRITICAL,
        `Auth ID confusion analysis failed: ${error.message}`
      );
    }
  }

  /**
   * Analyze duplicate auth_id values
   */
  async analyzeDuplicateAuthIds() {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, auth_id, name, email, created_at')
        .not('auth_id', 'is', null);

      if (error) {
        this.addIssue(
          ISSUE_TYPES.DUPLICATE_AUTH_ID,
          SEVERITY_LEVELS.ERROR,
          `Could not fetch users for duplicate auth_id analysis: ${error.message}`
        );
        return;
      }

      const authIdGroups = {};
      users.forEach(user => {
        if (authIdGroups[user.auth_id]) {
          authIdGroups[user.auth_id].push(user);
        } else {
          authIdGroups[user.auth_id] = [user];
        }
      });

      let duplicateCount = 0;
      Object.entries(authIdGroups).forEach(([authId, userList]) => {
        if (userList.length > 1) {
          this.addIssue(
            ISSUE_TYPES.DUPLICATE_AUTH_ID,
            SEVERITY_LEVELS.CRITICAL,
            `Auth ID ${authId} is shared by ${userList.length} users`,
            authId,
            {
              auth_id: authId,
              affected_users: userList.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                created_at: u.created_at
              }))
            }
          );
          duplicateCount++;
        }
      });

      if (duplicateCount > 0) {
        this.addRecommendation(
          'CRITICAL',
          'resolve_duplicate_auth_ids',
          `Resolve ${duplicateCount} duplicate auth_id entries by merging or removing duplicate users`
        );
      }

      this.statistics.duplicateAuthIds = duplicateCount;

    } catch (error) {
      this.addIssue(
        ISSUE_TYPES.DUPLICATE_AUTH_ID,
        SEVERITY_LEVELS.CRITICAL,
        `Duplicate auth_id analysis failed: ${error.message}`
      );
    }
  }

  /**
   * Analyze orphaned users
   */
  async analyzeOrphanedUsers() {
    try {
      const { data: orphanedUsers, error } = await supabase
        .from('users')
        .select('id, name, email, department, created_at')
        .is('auth_id', null)
        .limit(REPORT_CONFIG.maxRecordsPerIssue);

      if (error) {
        this.addIssue(
          ISSUE_TYPES.ORPHANED_USER,
          SEVERITY_LEVELS.ERROR,
          `Failed to query orphaned users: ${error.message}`
        );
        return;
      }

      if (orphanedUsers && orphanedUsers.length > 0) {
        orphanedUsers.forEach(user => {
          this.addIssue(
            ISSUE_TYPES.ORPHANED_USER,
            SEVERITY_LEVELS.WARNING,
            `User "${user.name}" has no auth_id connection`,
            user.id,
            {
              name: user.name,
              email: user.email,
              department: user.department,
              created_at: user.created_at
            }
          );
        });

        this.addRecommendation(
          'MEDIUM',
          'review_orphaned_users',
          `Review ${orphanedUsers.length} users without auth_id and either connect or remove them`
        );
      }

      this.statistics.orphanedUsers = orphanedUsers?.length || 0;

    } catch (error) {
      this.addIssue(
        ISSUE_TYPES.ORPHANED_USER,
        SEVERITY_LEVELS.ERROR,
        `Orphaned users analysis failed: ${error.message}`
      );
    }
  }

  /**
   * Generate comprehensive statistics
   */
  async generateStatistics() {
    try {
      // Total counts
      const { data: userCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true });

      const { data: reservationCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true });

      const { data: activeReservationCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed');

      this.statistics.totalUsers = userCount?.length || 0;
      this.statistics.totalReservations = reservationCount?.length || 0;
      this.statistics.activeReservations = activeReservationCount?.length || 0;

      // Issue summary
      this.statistics.totalIssues = this.issues.length;
      this.statistics.criticalIssues = this.issues.filter(i => i.severity === SEVERITY_LEVELS.CRITICAL).length;
      this.statistics.errorIssues = this.issues.filter(i => i.severity === SEVERITY_LEVELS.ERROR).length;
      this.statistics.warningIssues = this.issues.filter(i => i.severity === SEVERITY_LEVELS.WARNING).length;

    } catch (error) {
      console.error('Failed to generate statistics:', error.message);
    }
  }

  /**
   * Run complete analysis
   */
  async runCompleteAnalysis() {
    console.log('🔍 Running comprehensive data integrity analysis...\n');

    await this.analyzeOrphanedReservations();
    await this.analyzeAuthIdConfusion();
    await this.analyzeDuplicateAuthIds();
    await this.analyzeOrphanedUsers();
    await this.generateStatistics();

    return {
      timestamp: new Date().toISOString(),
      statistics: this.statistics,
      issues: this.issues.map(issue => issue.toJSON()),
      recommendations: this.recommendations
    };
  }
}

/**
 * Generate detailed console report
 */
function generateConsoleReport(analysisResult) {
  console.log('📊 COMPREHENSIVE DATA INTEGRITY REPORT');
  console.log('=' .repeat(60));
  console.log(`Generated: ${analysisResult.timestamp}`);
  console.log('');

  // Statistics
  console.log('📈 DATABASE STATISTICS');
  console.log(`   Total Users: ${analysisResult.statistics.totalUsers}`);
  console.log(`   Total Reservations: ${analysisResult.statistics.totalReservations}`);
  console.log(`   Active Reservations: ${analysisResult.statistics.activeReservations}`);
  console.log('');

  // Issue Summary
  console.log('🚨 ISSUE SUMMARY');
  console.log(`   Total Issues: ${analysisResult.statistics.totalIssues}`);
  console.log(`   Critical: ${analysisResult.statistics.criticalIssues}`);
  console.log(`   Error: ${analysisResult.statistics.errorIssues}`);
  console.log(`   Warning: ${analysisResult.statistics.warningIssues}`);
  console.log('');

  // Detailed Issues by Type
  const issuesByType = {};
  analysisResult.issues.forEach(issue => {
    if (!issuesByType[issue.type]) {
      issuesByType[issue.type] = [];
    }
    issuesByType[issue.type].push(issue);
  });

  Object.entries(issuesByType).forEach(([type, issues]) => {
    console.log(`🔸 ${type.toUpperCase().replace(/_/g, ' ')} (${issues.length} issues)`);
    
    const issuesToShow = issues.slice(0, 5);
    issuesToShow.forEach((issue, index) => {
      const severityIcon = {
        info: 'ℹ️',
        warning: '⚠️',
        error: '🚨',
        critical: '🔥'
      }[issue.severity];
      
      console.log(`   ${index + 1}. ${severityIcon} ${issue.description}`);
      if (issue.recordId) {
        console.log(`      Record ID: ${issue.recordId}`);
      }
    });
    
    if (issues.length > 5) {
      console.log(`   ... and ${issues.length - 5} more issues`);
    }
    console.log('');
  });

  // Recommendations
  if (analysisResult.recommendations.length > 0) {
    console.log('💡 RECOMMENDATIONS');
    analysisResult.recommendations
      .sort((a, b) => {
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .forEach((rec, index) => {
        const priorityIcon = {
          CRITICAL: '🔥',
          HIGH: '🚨',
          MEDIUM: '⚠️',
          LOW: 'ℹ️'
        }[rec.priority];
        
        console.log(`   ${index + 1}. ${priorityIcon} [${rec.priority}] ${rec.description}`);
      });
  }

  console.log('\n' + '=' .repeat(60));
  
  if (analysisResult.statistics.totalIssues === 0) {
    console.log('✅ No data integrity issues found! Database is in good condition.');
  } else {
    console.log(`⚠️  ${analysisResult.statistics.totalIssues} data integrity issues require attention.`);
    console.log('   Review the detailed report and execute recommended repair actions.');
  }
}

/**
 * Save analysis results to files
 */
async function saveAnalysisResults(analysisResult) {
  try {
    await fs.mkdir(REPORT_CONFIG.reportDirectory, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save JSON report
    const jsonPath = path.join(REPORT_CONFIG.reportDirectory, `integrity-analysis-${timestamp}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(analysisResult, null, 2));
    console.log(`📄 JSON report saved: ${jsonPath}`);
    
    // Save CSV report for issues
    if (analysisResult.issues.length > 0) {
      const csvPath = path.join(REPORT_CONFIG.reportDirectory, `integrity-issues-${timestamp}.csv`);
      const csvHeader = 'Type,Severity,Description,Record ID,Timestamp\n';
      const csvRows = analysisResult.issues.map(issue => 
        `"${issue.type}","${issue.severity}","${issue.description}","${issue.recordId || ''}","${issue.timestamp}"`
      ).join('\n');
      
      await fs.writeFile(csvPath, csvHeader + csvRows);
      console.log(`📄 CSV report saved: ${csvPath}`);
    }
    
    // Save latest report
    const latestPath = path.join(REPORT_CONFIG.reportDirectory, 'latest-integrity-analysis.json');
    await fs.writeFile(latestPath, JSON.stringify(analysisResult, null, 2));
    
  } catch (error) {
    console.error('⚠️  Could not save analysis results:', error.message);
  }
}

/**
 * Main execution function
 */
async function runIntegrityReport() {
  try {
    const analyzer = new DataIntegrityAnalyzer();
    const analysisResult = await analyzer.runCompleteAnalysis();
    
    generateConsoleReport(analysisResult);
    await saveAnalysisResults(analysisResult);
    
    // Exit with appropriate code
    const exitCode = analysisResult.statistics.totalIssues > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('\n❌ Data integrity analysis failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = {
  DataIntegrityAnalyzer,
  DataIntegrityIssue,
  ISSUE_TYPES,
  SEVERITY_LEVELS
};

// Run analysis if script is executed directly
if (require.main === module) {
  runIntegrityReport();
}