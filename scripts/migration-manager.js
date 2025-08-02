#!/usr/bin/env node

/**
 * Migration Management Utility
 * Provides tools for managing Supabase migrations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const ARCHIVE_DIR = path.join(MIGRATIONS_DIR, 'archive');

class MigrationManager {
  constructor() {
    this.migrationsDir = MIGRATIONS_DIR;
    this.archiveDir = ARCHIVE_DIR;
  }

  /**
   * List all current migrations
   */
  listMigrations() {
    console.log('\n=== Current Migrations ===');
    
    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql') && file !== '00000000000000_initial_schema.sql')
      .sort();

    if (files.length === 0) {
      console.log('No migrations found.');
      return;
    }

    files.forEach((file, index) => {
      const filePath = path.join(this.migrationsDir, file);
      const stats = fs.statSync(filePath);
      const timestamp = file.substring(0, 14);
      const description = file.substring(15).replace('.sql', '').replace(/_/g, ' ');
      
      console.log(`${index + 1}. ${file}`);
      console.log(`   Date: ${this.formatTimestamp(timestamp)}`);
      console.log(`   Description: ${description}`);
      console.log(`   Size: ${stats.size} bytes`);
      console.log('');
    });
  }

  /**
   * Validate migration files
   */
  validateMigrations() {
    console.log('\n=== Validating Migrations ===');
    
    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    let isValid = true;
    const issues = [];
    const metadata = this.loadMetadata();

    files.forEach(file => {
      const filePath = path.join(this.migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const migrationKey = file.replace('.sql', '');
      
      // Check file naming convention
      if (file !== '00000000000000_initial_schema.sql' && !file.match(/^\d{14}_[a-z_]+\.sql$/)) {
        issues.push(`❌ ${file}: Invalid naming convention`);
        isValid = false;
      }

      // Check for basic SQL syntax issues
      if (!content.trim()) {
        issues.push(`❌ ${file}: Empty file`);
        isValid = false;
      }

      // Check metadata existence
      if (metadata.migrations[migrationKey]) {
        const meta = metadata.migrations[migrationKey];
        
        // Validate dependencies
        meta.dependencies.forEach(dep => {
          if (!metadata.migrations[dep]) {
            issues.push(`❌ ${file}: Missing dependency ${dep} in metadata`);
            isValid = false;
          }
        });

        // Check required elements
        if (meta.requiredTables) {
          meta.requiredTables.forEach(table => {
            if (!content.toLowerCase().includes(table.toLowerCase())) {
              issues.push(`⚠️  ${file}: Required table ${table} not found in migration`);
            }
          });
        }

        if (meta.requiredFunctions) {
          meta.requiredFunctions.forEach(func => {
            if (!content.toLowerCase().includes(func.toLowerCase())) {
              issues.push(`⚠️  ${file}: Required function ${func} not found in migration`);
            }
          });
        }

        console.log(`✅ ${file}: Metadata validation passed`);
      } else {
        issues.push(`⚠️  ${file}: No metadata found - consider adding to migration-metadata.json`);
      }

      // Check for dangerous operations in production
      const dangerousPatterns = [
        /DROP\s+TABLE/i,
        /DROP\s+DATABASE/i,
        /TRUNCATE/i,
        /DELETE\s+FROM.*WHERE\s*$/i // DELETE without WHERE clause
      ];

      dangerousPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          issues.push(`⚠️  ${file}: Contains potentially dangerous operation`);
        }
      });

      // Check for proper comments
      if (!content.includes('--')) {
        issues.push(`⚠️  ${file}: No comments found - consider adding documentation`);
      }

      // Check for security best practices
      this.validateSecurityPractices(file, content, issues);

      console.log(`✅ ${file}: Basic validation passed`);
    });

    // Validate dependency chain
    this.validateDependencyChain(metadata, issues);

    if (issues.length > 0) {
      console.log('\n=== Issues Found ===');
      issues.forEach(issue => console.log(issue));
    }

    if (isValid) {
      console.log('\n✅ All migrations are valid!');
    } else {
      console.log('\n❌ Some migrations have issues that need attention.');
    }

    return isValid;
  }

  /**
   * Validate security practices in migration
   */
  validateSecurityPractices(filename, content, issues) {
    // Check for RLS policies
    if (content.includes('CREATE TABLE') && !content.includes('ENABLE ROW LEVEL SECURITY')) {
      issues.push(`⚠️  ${filename}: New table without RLS - consider enabling Row Level Security`);
    }

    // Check for SECURITY DEFINER functions
    if (content.includes('SECURITY DEFINER')) {
      if (!content.includes('GRANT EXECUTE')) {
        issues.push(`⚠️  ${filename}: SECURITY DEFINER function without explicit permissions`);
      }
    }

    // Check for proper indexing
    if (content.includes('CREATE TABLE') && !content.includes('CREATE INDEX')) {
      issues.push(`⚠️  ${filename}: New table without indexes - consider adding performance indexes`);
    }

    // Check for input validation in functions
    if (content.includes('CREATE OR REPLACE FUNCTION') && !content.includes('RAISE EXCEPTION')) {
      issues.push(`⚠️  ${filename}: Function without input validation - consider adding error handling`);
    }
  }

  /**
   * Validate dependency chain
   */
  validateDependencyChain(metadata, issues) {
    const migrations = metadata.migrations;
    const visited = new Set();
    const visiting = new Set();

    function hasCycle(migrationKey) {
      if (visiting.has(migrationKey)) {
        return true; // Cycle detected
      }
      if (visited.has(migrationKey)) {
        return false;
      }

      visiting.add(migrationKey);
      
      const migration = migrations[migrationKey];
      if (migration && migration.dependencies) {
        for (const dep of migration.dependencies) {
          if (hasCycle(dep)) {
            return true;
          }
        }
      }

      visiting.delete(migrationKey);
      visited.add(migrationKey);
      return false;
    }

    // Check for circular dependencies
    for (const migrationKey in migrations) {
      if (hasCycle(migrationKey)) {
        issues.push(`❌ Circular dependency detected involving ${migrationKey}`);
      }
    }
  }

  /**
   * Load migration metadata
   */
  loadMetadata() {
    const metadataPath = path.join(__dirname, 'migration-metadata.json');
    try {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (error) {
      console.warn('⚠️  Could not load migration metadata:', error.message);
      return { migrations: {} };
    }
  }

  /**
   * Create a new migration file
   */
  createMigration(description) {
    if (!description) {
      console.error('❌ Description is required');
      console.log('Usage: node migration-manager.js create "description_of_migration"');
      return;
    }

    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .substring(0, 14);
    
    const filename = `${timestamp}_${description.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filepath = path.join(this.migrationsDir, filename);

    const template = `-- ${description}
-- Created: ${new Date().toISOString()}
-- Requirements: [Add requirement references here]

-- Add your migration SQL here

-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name TEXT NOT NULL,
--     created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Don't forget to:
-- 1. Add appropriate indexes
-- 2. Set up RLS policies if needed
-- 3. Grant necessary permissions
-- 4. Add comments for documentation

-- Migration completion log
DO $$
BEGIN
    RAISE NOTICE '${description} migration completed successfully';
END $$;
`;

    fs.writeFileSync(filepath, template);
    console.log(`✅ Created migration: ${filename}`);
    console.log(`📝 Edit the file at: ${filepath}`);
  }

  /**
   * Archive old migrations
   */
  archiveMigrations(patterns = []) {
    console.log('\n=== Archiving Migrations ===');
    
    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql') && file !== '00000000000000_initial_schema.sql');

    if (patterns.length === 0) {
      console.log('No patterns specified. Use --pattern to specify files to archive.');
      console.log('Available files:');
      files.forEach(file => console.log(`  - ${file}`));
      return;
    }

    let archivedCount = 0;

    patterns.forEach(pattern => {
      const regex = new RegExp(pattern, 'i');
      const matchingFiles = files.filter(file => regex.test(file));

      matchingFiles.forEach(file => {
        const sourcePath = path.join(this.migrationsDir, file);
        const targetPath = path.join(this.archiveDir, file);
        
        // Copy to archive
        fs.copyFileSync(sourcePath, targetPath);
        
        // Remove from migrations
        fs.unlinkSync(sourcePath);
        
        console.log(`📦 Archived: ${file}`);
        archivedCount++;
      });
    });

    console.log(`\n✅ Archived ${archivedCount} migration(s)`);
  }

  /**
   * Generate migration status report
   */
  generateReport() {
    console.log('\n=== Migration Status Report ===');
    
    const migrations = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const archived = fs.existsSync(this.archiveDir) 
      ? fs.readdirSync(this.archiveDir).filter(file => file.endsWith('.sql')).length
      : 0;

    console.log(`📊 Total active migrations: ${migrations.length}`);
    console.log(`📦 Archived migrations: ${archived}`);
    console.log(`📅 Latest migration: ${migrations[migrations.length - 1] || 'None'}`);

    // Check for potential issues
    const issues = [];
    
    // Check for gaps in timestamps
    const timestamps = migrations
      .filter(file => file !== '00000000000000_initial_schema.sql')
      .map(file => file.substring(0, 14))
      .sort();

    for (let i = 1; i < timestamps.length; i++) {
      const prev = new Date(this.parseTimestamp(timestamps[i - 1]));
      const curr = new Date(this.parseTimestamp(timestamps[i]));
      const diffHours = (curr - prev) / (1000 * 60 * 60);
      
      if (diffHours > 24 * 7) { // More than a week gap
        issues.push(`Large time gap between ${timestamps[i - 1]} and ${timestamps[i]}`);
      }
    }

    if (issues.length > 0) {
      console.log('\n⚠️  Potential Issues:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    console.log('\n=== Migration Timeline ===');
    migrations.forEach(file => {
      if (file === '00000000000000_initial_schema.sql') {
        console.log(`🏗️  ${file} (Initial Schema)`);
      } else {
        const timestamp = file.substring(0, 14);
        const description = file.substring(15).replace('.sql', '').replace(/_/g, ' ');
        console.log(`📝 ${this.formatTimestamp(timestamp)} - ${description}`);
      }
    });
  }

  /**
   * Test migrations (dry run)
   */
  testMigrations() {
    console.log('\n=== Testing Migrations (Dry Run) ===');
    console.log('⚠️  This would run: supabase db reset --dry-run');
    console.log('💡 To actually test, run: supabase db reset --dry-run');
    console.log('💡 To apply migrations, run: supabase db reset');
    
    // Run validation queries if metadata exists
    const metadata = this.loadMetadata();
    this.runValidationQueries(metadata);
  }

  /**
   * Run validation queries for migrations
   */
  runValidationQueries(metadata) {
    console.log('\n=== Validation Queries ===');
    
    if (!metadata.migrations) {
      console.log('⚠️  No metadata found - skipping validation queries');
      return;
    }

    const migrations = Object.keys(metadata.migrations).sort();
    
    migrations.forEach(migrationKey => {
      const migration = metadata.migrations[migrationKey];
      if (migration.validationQueries && migration.validationQueries.length > 0) {
        console.log(`\n📋 ${migrationKey}:`);
        migration.validationQueries.forEach((query, index) => {
          console.log(`  ${index + 1}. ${query}`);
        });
        
        // Show expected results
        if (migration.requiredTables) {
          console.log(`  Expected tables: ${migration.requiredTables.join(', ')}`);
        }
        if (migration.requiredFunctions) {
          console.log(`  Expected functions: ${migration.requiredFunctions.join(', ')}`);
        }
        if (migration.requiredIndexes) {
          console.log(`  Expected indexes: ${migration.requiredIndexes.join(', ')}`);
        }
      }
    });

    console.log('\n💡 To run these queries against your database:');
    console.log('   supabase db connect');
    console.log('   Then copy and paste the queries above');
  }

  /**
   * Check migration conflicts
   */
  checkConflicts() {
    console.log('\n=== Checking Migration Conflicts ===');
    
    const metadata = this.loadMetadata();
    const conflicts = [];
    
    if (!metadata.migrations) {
      console.log('⚠️  No metadata found - skipping conflict detection');
      return;
    }

    const migrations = metadata.migrations;
    const migrationKeys = Object.keys(migrations);
    
    // Check for conflicting table modifications
    const tableModifications = {};
    
    migrationKeys.forEach(key => {
      const migration = migrations[key];
      if (migration.requiredTables) {
        migration.requiredTables.forEach(table => {
          if (!tableModifications[table]) {
            tableModifications[table] = [];
          }
          tableModifications[table].push(key);
        });
      }
    });

    // Check for potential conflicts
    Object.keys(tableModifications).forEach(table => {
      const modifyingMigrations = tableModifications[table];
      if (modifyingMigrations.length > 1) {
        // Check if they're in dependency chain
        const sortedMigrations = modifyingMigrations.sort();
        for (let i = 1; i < sortedMigrations.length; i++) {
          const current = migrations[sortedMigrations[i]];
          const previous = sortedMigrations[i - 1];
          
          if (!current.dependencies.includes(previous)) {
            conflicts.push(`⚠️  Table ${table} modified by ${sortedMigrations[i]} without depending on ${previous}`);
          }
        }
      }
    });

    // Check for function conflicts
    const functionModifications = {};
    
    migrationKeys.forEach(key => {
      const migration = migrations[key];
      
      // Check both requiredFunctions and modifiedFunctions
      const allFunctions = [
        ...(migration.requiredFunctions || []),
        ...(migration.modifiedFunctions || [])
      ];
      
      allFunctions.forEach(func => {
        if (!functionModifications[func]) {
          functionModifications[func] = [];
        }
        functionModifications[func].push(key);
      });
    });

    Object.keys(functionModifications).forEach(func => {
      const modifyingMigrations = functionModifications[func];
      if (modifyingMigrations.length > 1) {
        // Check if they're in proper dependency chain
        const sortedMigrations = modifyingMigrations.sort();
        let hasProperDependencies = true;
        
        for (let i = 1; i < sortedMigrations.length; i++) {
          const current = migrations[sortedMigrations[i]];
          const previous = sortedMigrations[i - 1];
          
          // Check if current migration depends on previous one (directly or indirectly)
          if (!this.hasDependency(current, previous, migrations)) {
            hasProperDependencies = false;
            break;
          }
        }
        
        if (!hasProperDependencies) {
          conflicts.push(`⚠️  Function ${func} modified in multiple migrations without proper dependencies: ${modifyingMigrations.join(', ')}`);
        }
      }
    });

    if (conflicts.length > 0) {
      console.log('\n❌ Conflicts Found:');
      conflicts.forEach(conflict => console.log(conflict));
    } else {
      console.log('\n✅ No conflicts detected!');
    }

    return conflicts.length === 0;
  }

  /**
   * Update migration metadata for CI/CD pipeline
   */
  updateMetadata(options = {}) {
    console.log('\n=== Updating Migration Metadata ===');
    
    const metadataPath = path.join(__dirname, 'migration-metadata.json');
    let metadata = this.loadMetadata();
    
    // Ensure migrations object exists
    if (!metadata.migrations) {
      metadata.migrations = {};
    }
    
    // Add deployment tracking
    if (!metadata.deployments) {
      metadata.deployments = [];
    }
    
    // Add new deployment record
    const deployment = {
      timestamp: options.timestamp || new Date().toISOString(),
      commit: options.commit || 'unknown',
      workflowRun: options.workflowRun || 'unknown',
      actor: options.actor || 'system',
      environment: options.environment || 'production',
      migrationsApplied: this.getAppliedMigrations(),
      status: options.status || 'completed'
    };
    
    metadata.deployments.push(deployment);
    
    // Keep only last 50 deployments
    if (metadata.deployments.length > 50) {
      metadata.deployments = metadata.deployments.slice(-50);
    }
    
    // Update last deployment info
    metadata.lastDeployment = deployment;
    
    // Save updated metadata
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`✅ Updated metadata with deployment: ${deployment.timestamp}`);
    console.log(`📝 Commit: ${deployment.commit}`);
    console.log(`🏃 Actor: ${deployment.actor}`);
    console.log(`🌍 Environment: ${deployment.environment}`);
    
    return metadata;
  }

  /**
   * Get list of applied migrations
   */
  getAppliedMigrations() {
    const migrations = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    return migrations.map(file => ({
      filename: file,
      timestamp: file.substring(0, 14),
      description: file.substring(15).replace('.sql', '').replace(/_/g, ' ')
    }));
  }

  /**
   * Generate CI/CD deployment report
   */
  generateDeploymentReport() {
    console.log('\n=== CI/CD Deployment Report ===');
    
    const metadata = this.loadMetadata();
    
    if (!metadata.deployments || metadata.deployments.length === 0) {
      console.log('📭 No deployment history found');
      return;
    }
    
    const deployments = metadata.deployments.slice(-10); // Last 10 deployments
    
    console.log(`📊 Showing last ${deployments.length} deployments:\n`);
    
    deployments.forEach((deployment, index) => {
      const statusIcon = deployment.status === 'completed' ? '✅' : 
                        deployment.status === 'failed' ? '❌' : '⏳';
      
      console.log(`${statusIcon} ${deployment.timestamp}`);
      console.log(`   Commit: ${deployment.commit.substring(0, 8)}`);
      console.log(`   Actor: ${deployment.actor}`);
      console.log(`   Environment: ${deployment.environment}`);
      console.log(`   Migrations: ${deployment.migrationsApplied?.length || 0}`);
      
      if (deployment.workflowRun !== 'unknown') {
        console.log(`   Workflow: ${deployment.workflowRun}`);
      }
      
      console.log('');
    });
    
    // Show deployment statistics
    const totalDeployments = metadata.deployments.length;
    const successfulDeployments = metadata.deployments.filter(d => d.status === 'completed').length;
    const failedDeployments = metadata.deployments.filter(d => d.status === 'failed').length;
    
    console.log('📈 Deployment Statistics:');
    console.log(`   Total deployments: ${totalDeployments}`);
    console.log(`   Successful: ${successfulDeployments} (${Math.round(successfulDeployments/totalDeployments*100)}%)`);
    console.log(`   Failed: ${failedDeployments} (${Math.round(failedDeployments/totalDeployments*100)}%)`);
    
    // Show recent migration activity
    if (metadata.lastDeployment) {
      const lastDeployment = metadata.lastDeployment;
      const daysSinceLastDeployment = Math.floor((new Date() - new Date(lastDeployment.timestamp)) / (1000 * 60 * 60 * 24));
      
      console.log('\n🕒 Recent Activity:');
      console.log(`   Last deployment: ${daysSinceLastDeployment} days ago`);
      console.log(`   Last commit: ${lastDeployment.commit.substring(0, 8)}`);
      console.log(`   Last actor: ${lastDeployment.actor}`);
    }
  }

  /**
   * Validate deployment readiness
   */
  validateDeploymentReadiness() {
    console.log('\n=== Validating Deployment Readiness ===');
    
    const issues = [];
    const warnings = [];
    
    // Check migration files
    const isValid = this.validateMigrations();
    if (!isValid) {
      issues.push('Migration validation failed');
    }
    
    // Check for conflicts
    const hasConflicts = !this.checkConflicts();
    if (hasConflicts) {
      issues.push('Migration conflicts detected');
    }
    
    // Check metadata consistency
    const metadata = this.loadMetadata();
    const migrationFiles = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql') && file !== '00000000000000_initial_schema.sql');
    
    migrationFiles.forEach(file => {
      const migrationKey = file.replace('.sql', '');
      if (!metadata.migrations || !metadata.migrations[migrationKey]) {
        warnings.push(`Migration ${file} has no metadata`);
      }
    });
    
    // Check for recent deployment frequency
    if (metadata.deployments && metadata.deployments.length > 0) {
      const recentDeployments = metadata.deployments.filter(d => {
        const deploymentDate = new Date(d.timestamp);
        const daysSince = (new Date() - deploymentDate) / (1000 * 60 * 60 * 24);
        return daysSince <= 1; // Last 24 hours
      });
      
      if (recentDeployments.length > 5) {
        warnings.push(`High deployment frequency: ${recentDeployments.length} deployments in last 24 hours`);
      }
    }
    
    // Generate readiness report
    console.log('\n📋 Deployment Readiness Report:');
    
    if (issues.length === 0) {
      console.log('✅ Ready for deployment');
    } else {
      console.log('❌ Not ready for deployment');
      console.log('\n🚨 Issues that must be resolved:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Migration files: ${migrationFiles.length}`);
    console.log(`   Issues: ${issues.length}`);
    console.log(`   Warnings: ${warnings.length}`);
    
    return {
      ready: issues.length === 0,
      issues,
      warnings,
      migrationCount: migrationFiles.length
    };
  }

  /**
   * Create deployment backup
   */
  createDeploymentBackup(options = {}) {
    console.log('\n=== Creating Deployment Backup ===');
    
    const timestamp = options.timestamp || new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'rollback-backups', `backup-${timestamp}`);
    
    // Create backup directory
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Copy migration files
    const migrationsBackupDir = path.join(backupDir, 'migrations');
    fs.mkdirSync(migrationsBackupDir, { recursive: true });
    
    const migrationFiles = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'));
    
    migrationFiles.forEach(file => {
      const sourcePath = path.join(this.migrationsDir, file);
      const targetPath = path.join(migrationsBackupDir, file);
      fs.copyFileSync(sourcePath, targetPath);
    });
    
    // Copy metadata
    const metadataPath = path.join(__dirname, 'migration-metadata.json');
    if (fs.existsSync(metadataPath)) {
      const targetMetadataPath = path.join(backupDir, 'migration-metadata.json');
      fs.copyFileSync(metadataPath, targetMetadataPath);
    }
    
    // Create backup manifest
    const manifest = {
      timestamp,
      commit: options.commit || 'unknown',
      workflowRun: options.workflowRun || 'unknown',
      actor: options.actor || 'system',
      environment: options.environment || 'production',
      migrationFiles: migrationFiles.length,
      backupType: options.backupType || 'deployment',
      createdBy: 'migration-manager'
    };
    
    fs.writeFileSync(
      path.join(backupDir, 'backup-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    console.log(`✅ Backup created: ${backupDir}`);
    console.log(`📁 Migration files backed up: ${migrationFiles.length}`);
    console.log(`📝 Backup manifest created`);
    
    return {
      backupDir,
      timestamp,
      manifest
    };
  }

  /**
   * Check if migration has dependency (direct or indirect)
   */
  hasDependency(migration, targetDependency, allMigrations) {
    if (!migration.dependencies) {
      return false;
    }

    // Direct dependency
    if (migration.dependencies.includes(targetDependency)) {
      return true;
    }

    // Indirect dependency (recursive check)
    for (const dep of migration.dependencies) {
      if (allMigrations[dep] && this.hasDependency(allMigrations[dep], targetDependency, allMigrations)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp) {
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(8, 10);
    const minute = timestamp.substring(10, 12);
    const second = timestamp.substring(12, 14);
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  /**
   * Parse timestamp to ISO string
   */
  parseTimestamp(timestamp) {
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(8, 10);
    const minute = timestamp.substring(10, 12);
    const second = timestamp.substring(12, 14);
    
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const manager = new MigrationManager();

  switch (command) {
    case 'list':
      manager.listMigrations();
      break;
      
    case 'validate':
      manager.validateMigrations();
      break;
      
    case 'create':
      manager.createMigration(args[1]);
      break;
      
    case 'archive':
      const patterns = args.slice(1).filter(arg => !arg.startsWith('--'));
      manager.archiveMigrations(patterns);
      break;
      
    case 'report':
      manager.generateReport();
      break;
      
    case 'test':
      manager.testMigrations();
      break;
      
    case 'conflicts':
      manager.checkConflicts();
      break;
      
    case 'update-metadata':
      const options = {};
      for (let i = 1; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        if (value) {
          options[key] = value;
        }
      }
      manager.updateMetadata(options);
      break;
      
    case 'deployment-report':
      manager.generateDeploymentReport();
      break;
      
    case 'deployment-readiness':
      const readiness = manager.validateDeploymentReadiness();
      process.exit(readiness.ready ? 0 : 1);
      break;
      
    case 'create-backup':
      const backupOptions = {};
      for (let i = 1; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        if (value) {
          backupOptions[key] = value;
        }
      }
      manager.createDeploymentBackup(backupOptions);
      break;
      
    default:
      console.log('Migration Manager');
      console.log('');
      console.log('Usage:');
      console.log('  node migration-manager.js <command> [options]');
      console.log('');
      console.log('Commands:');
      console.log('  list                         List all current migrations');
      console.log('  validate                     Validate migration files');
      console.log('  create <description>         Create a new migration file');
      console.log('  archive <pattern>            Archive migrations matching pattern');
      console.log('  report                       Generate migration status report');
      console.log('  test                         Test migrations (dry run)');
      console.log('  conflicts                    Check for migration conflicts');
      console.log('  update-metadata [options]    Update migration metadata for CI/CD');
      console.log('  deployment-report            Generate CI/CD deployment report');
      console.log('  deployment-readiness         Validate deployment readiness');
      console.log('  create-backup [options]      Create deployment backup');
      console.log('');
      console.log('CI/CD Options:');
      console.log('  --commit <hash>              Git commit hash');
      console.log('  --timestamp <iso>            Deployment timestamp');
      console.log('  --workflow-run <id>          GitHub workflow run ID');
      console.log('  --actor <name>               Deployment actor');
      console.log('  --environment <env>          Target environment');
      console.log('  --status <status>            Deployment status');
      console.log('  --backup-type <type>         Backup type');
      console.log('');
      console.log('Examples:');
      console.log('  node migration-manager.js list');
      console.log('  node migration-manager.js create "add user preferences table"');
      console.log('  node migration-manager.js archive "old_function"');
      console.log('  node migration-manager.js validate');
      console.log('  node migration-manager.js conflicts');
      console.log('  node migration-manager.js update-metadata --commit abc123 --actor github-actions');
      console.log('  node migration-manager.js deployment-readiness');
      console.log('  node migration-manager.js create-backup --backup-type pre_deployment');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = MigrationManager;