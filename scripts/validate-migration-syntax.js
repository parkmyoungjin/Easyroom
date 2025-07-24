#!/usr/bin/env node

/**
 * Migration Syntax Validation Script
 * Validates SQL migration files for syntax errors and potential issues
 * Requirements: 4.1, 4.4
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Migration validation configuration
 */
const VALIDATION_CONFIG = {
  migrationsDir: './supabase/migrations',
  allowedExtensions: ['.sql'],
  
  // SQL syntax patterns to check
  syntaxChecks: {
    // Dangerous operations that should be reviewed
    dangerousPatterns: [
      /DROP\s+TABLE/i,
      /DROP\s+DATABASE/i,
      /TRUNCATE/i,
      /DELETE\s+FROM.*WHERE\s*$/i, // DELETE without WHERE clause
    ],
    
    // Required patterns for certain operations
    requiredPatterns: {
      createTable: /CREATE\s+TABLE.*PRIMARY\s+KEY/i,
      alterTable: /ALTER\s+TABLE/i,
    },
    
    // Forbidden patterns
    forbiddenPatterns: [
      /--\s*password/i, // Comments containing passwords
      /INSERT.*VALUES.*'[^']*password[^']*'/i, // Hardcoded passwords
    ]
  },
  
  // Migration naming convention
  namingConvention: /^\d{14}_[a-z0-9_]+\.sql$/,
  
  // File size limits (in bytes)
  maxFileSize: 1024 * 1024, // 1MB
};

/**
 * Validation result class
 */
class ValidationResult {
  constructor(filename) {
    this.filename = filename;
    this.valid = true;
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  addError(message) {
    this.errors.push(message);
    this.valid = false;
  }

  addWarning(message) {
    this.warnings.push(message);
  }

  addInfo(message) {
    this.info.push(message);
  }

  hasIssues() {
    return this.errors.length > 0 || this.warnings.length > 0;
  }
}

/**
 * Validate migration file naming convention
 */
function validateNaming(filename) {
  const result = new ValidationResult(filename);
  
  if (!VALIDATION_CONFIG.namingConvention.test(filename)) {
    result.addError(`Invalid naming convention. Expected format: YYYYMMDDHHMMSS_description.sql`);
  }
  
  // Check timestamp validity
  const timestampMatch = filename.match(/^(\d{14})/);
  if (timestampMatch) {
    const timestamp = timestampMatch[1];
    const year = parseInt(timestamp.substr(0, 4));
    const month = parseInt(timestamp.substr(4, 2));
    const day = parseInt(timestamp.substr(6, 2));
    const hour = parseInt(timestamp.substr(8, 2));
    const minute = parseInt(timestamp.substr(10, 2));
    const second = parseInt(timestamp.substr(12, 2));
    
    if (year < 2020 || year > 2030) {
      result.addWarning(`Unusual year in timestamp: ${year}`);
    }
    
    if (month < 1 || month > 12) {
      result.addError(`Invalid month in timestamp: ${month}`);
    }
    
    if (day < 1 || day > 31) {
      result.addError(`Invalid day in timestamp: ${day}`);
    }
    
    if (hour > 23) {
      result.addError(`Invalid hour in timestamp: ${hour}`);
    }
    
    if (minute > 59) {
      result.addError(`Invalid minute in timestamp: ${minute}`);
    }
    
    if (second > 59) {
      result.addError(`Invalid second in timestamp: ${second}`);
    }
  }
  
  return result;
}

/**
 * Validate SQL syntax and content
 */
function validateSQLContent(filename, content) {
  const result = new ValidationResult(filename);
  
  // Check file size
  if (Buffer.byteLength(content, 'utf8') > VALIDATION_CONFIG.maxFileSize) {
    result.addWarning(`File size exceeds recommended limit (${VALIDATION_CONFIG.maxFileSize} bytes)`);
  }
  
  // Check for dangerous patterns
  VALIDATION_CONFIG.syntaxChecks.dangerousPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      result.addWarning(`Potentially dangerous operation detected: ${pattern.source}`);
    }
  });
  
  // Check for forbidden patterns
  VALIDATION_CONFIG.syntaxChecks.forbiddenPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      result.addError(`Forbidden pattern detected: ${pattern.source}`);
    }
  });
  
  // Basic SQL syntax checks
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Skip comments and empty lines
    if (trimmedLine.startsWith('--') || trimmedLine === '') {
      return;
    }
    
    // Check for unmatched quotes
    const singleQuotes = (line.match(/'/g) || []).length;
    const doubleQuotes = (line.match(/"/g) || []).length;
    
    if (singleQuotes % 2 !== 0) {
      result.addError(`Line ${lineNum}: Unmatched single quote`);
    }
    
    if (doubleQuotes % 2 !== 0) {
      result.addError(`Line ${lineNum}: Unmatched double quote`);
    }
    
    // Check for missing semicolons on statement lines
    if (trimmedLine.length > 0 && 
        !trimmedLine.endsWith(';') && 
        !trimmedLine.endsWith(',') &&
        !trimmedLine.includes('BEGIN') &&
        !trimmedLine.includes('END') &&
        /^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)/i.test(trimmedLine)) {
      result.addWarning(`Line ${lineNum}: SQL statement may be missing semicolon`);
    }
  });
  
  // Check for transaction blocks
  const hasBegin = /BEGIN/i.test(content);
  const hasCommit = /COMMIT/i.test(content);
  const hasRollback = /ROLLBACK/i.test(content);
  
  if (hasBegin && !hasCommit && !hasRollback) {
    result.addWarning('Transaction block started but no COMMIT or ROLLBACK found');
  }
  
  // Check for proper UUID usage
  if (/uuid/i.test(content)) {
    if (!/uuid_generate_v4\(\)/i.test(content) && !/gen_random_uuid\(\)/i.test(content)) {
      result.addInfo('Consider using uuid_generate_v4() or gen_random_uuid() for UUID generation');
    }
  }
  
  // Check for proper indexing
  if (/CREATE\s+TABLE/i.test(content)) {
    if (!/PRIMARY\s+KEY/i.test(content)) {
      result.addWarning('Table creation without explicit PRIMARY KEY');
    }
  }
  
  return result;
}

/**
 * Check for migration dependencies and conflicts
 */
async function validateMigrationOrder(migrationFiles) {
  const results = [];
  
  // Sort migrations by timestamp
  const sortedMigrations = migrationFiles.sort();
  
  // Check for timestamp conflicts
  const timestamps = new Set();
  const duplicates = [];
  
  sortedMigrations.forEach(filename => {
    const timestamp = filename.match(/^(\d{14})/)?.[1];
    if (timestamp) {
      if (timestamps.has(timestamp)) {
        duplicates.push(timestamp);
      }
      timestamps.add(timestamp);
    }
  });
  
  if (duplicates.length > 0) {
    const result = new ValidationResult('migration-order');
    result.addError(`Duplicate migration timestamps found: ${duplicates.join(', ')}`);
    results.push(result);
  }
  
  // Check for logical dependencies
  for (let i = 0; i < sortedMigrations.length; i++) {
    const filename = sortedMigrations[i];
    const result = new ValidationResult(filename);
    
    try {
      const filePath = path.join(VALIDATION_CONFIG.migrationsDir, filename);
      const content = await fs.readFile(filePath, 'utf8');
      
      // Check if migration references tables that should be created in later migrations
      const createTableMatches = content.match(/CREATE\s+TABLE\s+(\w+)/gi);
      const alterTableMatches = content.match(/ALTER\s+TABLE\s+(\w+)/gi);
      
      if (alterTableMatches) {
        alterTableMatches.forEach(match => {
          const tableName = match.split(/\s+/)[2];
          
          // Check if table is created in a later migration
          for (let j = i + 1; j < sortedMigrations.length; j++) {
            const laterFilename = sortedMigrations[j];
            // This is a simplified check - in practice, you'd want to parse the SQL more thoroughly
            if (laterFilename.toLowerCase().includes(tableName.toLowerCase())) {
              result.addWarning(`References table '${tableName}' that may be created in later migration: ${laterFilename}`);
            }
          }
        });
      }
      
    } catch (error) {
      result.addError(`Failed to read migration file: ${error.message}`);
    }
    
    if (result.hasIssues()) {
      results.push(result);
    }
  }
  
  return results;
}

/**
 * Main validation function
 */
async function validateMigrations() {
  console.log('🔍 Starting migration syntax validation...\n');
  
  try {
    // Check if migrations directory exists
    const migrationsDir = VALIDATION_CONFIG.migrationsDir;
    
    try {
      await fs.access(migrationsDir);
    } catch (error) {
      console.error(`❌ Migrations directory not found: ${migrationsDir}`);
      process.exit(1);
    }
    
    // Get all migration files
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files.filter(file => 
      VALIDATION_CONFIG.allowedExtensions.some(ext => file.endsWith(ext))
    );
    
    if (migrationFiles.length === 0) {
      console.log('ℹ️ No migration files found');
      return;
    }
    
    console.log(`📁 Found ${migrationFiles.length} migration files\n`);
    
    const allResults = [];
    
    // Validate each migration file
    for (const filename of migrationFiles) {
      console.log(`🔍 Validating: ${filename}`);
      
      // Validate naming convention
      const namingResult = validateNaming(filename);
      if (namingResult.hasIssues()) {
        allResults.push(namingResult);
      }
      
      // Validate SQL content
      try {
        const filePath = path.join(migrationsDir, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const contentResult = validateSQLContent(filename, content);
        
        if (contentResult.hasIssues()) {
          allResults.push(contentResult);
        }
        
      } catch (error) {
        const errorResult = new ValidationResult(filename);
        errorResult.addError(`Failed to read file: ${error.message}`);
        allResults.push(errorResult);
      }
    }
    
    // Validate migration order and dependencies
    const orderResults = await validateMigrationOrder(migrationFiles);
    allResults.push(...orderResults);
    
    // Generate report
    console.log('\n📊 MIGRATION VALIDATION REPORT');
    console.log('=' .repeat(50));
    
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfo = 0;
    
    if (allResults.length === 0) {
      console.log('✅ All migrations passed validation');
    } else {
      allResults.forEach(result => {
        if (result.errors.length > 0) {
          console.log(`\n❌ ${result.filename}`);
          result.errors.forEach(error => {
            console.log(`   🔥 ERROR: ${error}`);
            totalErrors++;
          });
        }
        
        if (result.warnings.length > 0) {
          console.log(`\n⚠️ ${result.filename}`);
          result.warnings.forEach(warning => {
            console.log(`   ⚠️ WARNING: ${warning}`);
            totalWarnings++;
          });
        }
        
        if (result.info.length > 0) {
          console.log(`\nℹ️ ${result.filename}`);
          result.info.forEach(info => {
            console.log(`   💡 INFO: ${info}`);
            totalInfo++;
          });
        }
      });
    }
    
    console.log('\n📈 SUMMARY');
    console.log(`   Errors: ${totalErrors}`);
    console.log(`   Warnings: ${totalWarnings}`);
    console.log(`   Info: ${totalInfo}`);
    console.log(`   Files validated: ${migrationFiles.length}`);
    
    // Exit with appropriate code
    if (totalErrors > 0) {
      console.log('\n❌ Migration validation failed');
      process.exit(1);
    } else if (totalWarnings > 0) {
      console.log('\n⚠️ Migration validation completed with warnings');
      process.exit(0);
    } else {
      console.log('\n✅ Migration validation passed');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Migration validation error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = {
  validateMigrations,
  validateNaming,
  validateSQLContent,
  validateMigrationOrder,
  ValidationResult,
  VALIDATION_CONFIG
};

// Run validation if script is executed directly
if (require.main === module) {
  validateMigrations();
}