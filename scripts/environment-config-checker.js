#!/usr/bin/env node

/**
 * Environment Configuration Checker
 * 
 * A comprehensive tool for checking environment configuration across different deployment scenarios
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class EnvironmentConfigChecker {
  constructor() {
    this.checks = [];
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  /**
   * Check if Supabase URL is accessible
   */
  async checkSupabaseConnectivity() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!supabaseUrl) {
      this.results.failed.push({
        check: 'Supabase Connectivity',
        message: 'NEXT_PUBLIC_SUPABASE_URL not set',
        fix: 'Set the NEXT_PUBLIC_SUPABASE_URL environment variable'
      });
      return;
    }

    try {
      // Simple connectivity check
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`
        }
      });

      if (response.ok || response.status === 401) {
        // 401 is expected without proper auth, but means the endpoint is reachable
        this.results.passed.push({
          check: 'Supabase Connectivity',
          message: 'Supabase endpoint is reachable'
        });
      } else {
        this.results.failed.push({
          check: 'Supabase Connectivity',
          message: `Supabase endpoint returned status ${response.status}`,
          fix: 'Check your Supabase URL and ensure the project is active'
        });
      }
    } catch (error) {
      this.results.failed.push({
        check: 'Supabase Connectivity',
        message: `Cannot reach Supabase: ${error.message}`,
        fix: 'Check your internet connection and Supabase URL'
      });
    }
  }

  /**
   * Check Next.js configuration
   */
  checkNextJsConfig() {
    const nextConfigPath = path.join(process.cwd(), 'next.config.ts');
    const nextConfigJsPath = path.join(process.cwd(), 'next.config.js');
    
    let configExists = false;
    let configPath = '';
    
    if (fs.existsSync(nextConfigPath)) {
      configExists = true;
      configPath = nextConfigPath;
    } else if (fs.existsSync(nextConfigJsPath)) {
      configExists = true;
      configPath = nextConfigJsPath;
    }
    
    if (configExists) {
      this.results.passed.push({
        check: 'Next.js Configuration',
        message: `Configuration file found at ${configPath}`
      });
      
      // Check if config includes environment variable handling
      try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        if (configContent.includes('env:') || configContent.includes('publicRuntimeConfig')) {
          this.results.passed.push({
            check: 'Environment Variable Configuration',
            message: 'Next.js config includes environment variable handling'
          });
        } else {
          this.results.warnings.push({
            check: 'Environment Variable Configuration',
            message: 'Next.js config may not be handling environment variables explicitly',
            suggestion: 'Consider adding env configuration to next.config.js'
          });
        }
      } catch (error) {
        this.results.warnings.push({
          check: 'Next.js Configuration Analysis',
          message: `Could not analyze config file: ${error.message}`
        });
      }
    } else {
      this.results.warnings.push({
        check: 'Next.js Configuration',
        message: 'No Next.js configuration file found',
        suggestion: 'Consider creating next.config.js for better environment handling'
      });
    }
  }

  /**
   * Check package.json scripts
   */
  checkPackageScripts() {
    const packagePath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      this.results.failed.push({
        check: 'Package Configuration',
        message: 'package.json not found',
        fix: 'Ensure you are in the correct project directory'
      });
      return;
    }
    
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const scripts = packageJson.scripts || {};
      
      // Check for essential scripts
      const essentialScripts = ['dev', 'build', 'start'];
      const missingScripts = essentialScripts.filter(script => !scripts[script]);
      
      if (missingScripts.length === 0) {
        this.results.passed.push({
          check: 'Package Scripts',
          message: 'All essential scripts are present'
        });
      } else {
        this.results.warnings.push({
          check: 'Package Scripts',
          message: `Missing scripts: ${missingScripts.join(', ')}`,
          suggestion: 'Add missing scripts to package.json'
        });
      }
      
      // Check for environment validation script
      if (scripts['validate:env'] || scripts['check:env']) {
        this.results.passed.push({
          check: 'Environment Validation Script',
          message: 'Environment validation script found'
        });
      } else {
        this.results.warnings.push({
          check: 'Environment Validation Script',
          message: 'No environment validation script found',
          suggestion: 'Add "validate:env": "node scripts/validate-deployment-config.js" to package.json scripts'
        });
      }
      
    } catch (error) {
      this.results.failed.push({
        check: 'Package Configuration',
        message: `Could not parse package.json: ${error.message}`,
        fix: 'Check package.json syntax'
      });
    }
  }

  /**
   * Check environment files
   */
  checkEnvironmentFiles() {
    const envFiles = [
      '.env',
      '.env.local',
      '.env.development',
      '.env.production',
      '.env.test'
    ];
    
    const existingFiles = envFiles.filter(file => fs.existsSync(file));
    
    if (existingFiles.length > 0) {
      this.results.passed.push({
        check: 'Environment Files',
        message: `Found environment files: ${existingFiles.join(', ')}`
      });
      
      // Check .env.example
      if (fs.existsSync('.env.example')) {
        this.results.passed.push({
          check: 'Environment Example',
          message: '.env.example file found for reference'
        });
      } else {
        this.results.warnings.push({
          check: 'Environment Example',
          message: '.env.example file not found',
          suggestion: 'Create .env.example with required environment variables for documentation'
        });
      }
    } else {
      this.results.failed.push({
        check: 'Environment Files',
        message: 'No environment files found',
        fix: 'Create .env.local with required environment variables'
      });
    }
  }

  /**
   * Check TypeScript configuration
   */
  checkTypeScriptConfig() {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    
    if (fs.existsSync(tsconfigPath)) {
      this.results.passed.push({
        check: 'TypeScript Configuration',
        message: 'tsconfig.json found'
      });
      
      try {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        
        // Check for strict mode
        if (tsconfig.compilerOptions?.strict) {
          this.results.passed.push({
            check: 'TypeScript Strict Mode',
            message: 'Strict mode is enabled'
          });
        } else {
          this.results.warnings.push({
            check: 'TypeScript Strict Mode',
            message: 'Strict mode is not enabled',
            suggestion: 'Enable strict mode for better type safety'
          });
        }
        
      } catch (error) {
        this.results.warnings.push({
          check: 'TypeScript Configuration Analysis',
          message: `Could not analyze tsconfig.json: ${error.message}`
        });
      }
    } else {
      this.results.warnings.push({
        check: 'TypeScript Configuration',
        message: 'No TypeScript configuration found',
        suggestion: 'Consider using TypeScript for better development experience'
      });
    }
  }

  /**
   * Check Git configuration
   */
  checkGitConfig() {
    if (fs.existsSync('.git')) {
      this.results.passed.push({
        check: 'Git Repository',
        message: 'Git repository initialized'
      });
      
      // Check .gitignore
      if (fs.existsSync('.gitignore')) {
        const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
        
        if (gitignoreContent.includes('.env')) {
          this.results.passed.push({
            check: 'Environment Security',
            message: 'Environment files are properly ignored by Git'
          });
        } else {
          this.results.failed.push({
            check: 'Environment Security',
            message: 'Environment files are not ignored by Git',
            fix: 'Add .env* to .gitignore to prevent committing secrets'
          });
        }
      } else {
        this.results.warnings.push({
          check: 'Git Ignore',
          message: '.gitignore file not found',
          suggestion: 'Create .gitignore to exclude sensitive files'
        });
      }
    } else {
      this.results.warnings.push({
        check: 'Git Repository',
        message: 'No Git repository found',
        suggestion: 'Initialize Git repository for version control'
      });
    }
  }

  /**
   * Run all checks
   */
  async runAllChecks() {
    console.log('🔍 Running comprehensive environment configuration checks...\n');
    
    this.checkEnvironmentFiles();
    this.checkNextJsConfig();
    this.checkPackageScripts();
    this.checkTypeScriptConfig();
    this.checkGitConfig();
    await this.checkSupabaseConnectivity();
    
    this.generateReport();
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    console.log('📊 ENVIRONMENT CONFIGURATION REPORT');
    console.log('='.repeat(60));
    
    if (this.results.passed.length > 0) {
      console.log('\n✅ PASSED CHECKS:');
      this.results.passed.forEach(result => {
        console.log(`  ✓ ${result.check}: ${result.message}`);
      });
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.results.warnings.forEach(result => {
        console.log(`  ⚠ ${result.check}: ${result.message}`);
        if (result.suggestion) {
          console.log(`    💡 Suggestion: ${result.suggestion}`);
        }
      });
    }
    
    if (this.results.failed.length > 0) {
      console.log('\n❌ FAILED CHECKS:');
      this.results.failed.forEach(result => {
        console.log(`  ✗ ${result.check}: ${result.message}`);
        if (result.fix) {
          console.log(`    🔧 Fix: ${result.fix}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    const totalChecks = this.results.passed.length + this.results.warnings.length + this.results.failed.length;
    const score = Math.round((this.results.passed.length / totalChecks) * 100);
    
    console.log(`📈 OVERALL SCORE: ${score}% (${this.results.passed.length}/${totalChecks} checks passed)`);
    
    if (this.results.failed.length > 0) {
      console.log('❌ CRITICAL ISSUES FOUND - Please address failed checks');
      process.exit(1);
    } else if (this.results.warnings.length > 0) {
      console.log('⚠️  CONFIGURATION NEEDS ATTENTION - Consider addressing warnings');
      process.exit(0);
    } else {
      console.log('✅ EXCELLENT CONFIGURATION - All checks passed!');
      process.exit(0);
    }
  }
}

// CLI Interface
async function main() {
  const checker = new EnvironmentConfigChecker();
  await checker.runAllChecks();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error running environment checks:', error.message);
    process.exit(1);
  });
}

module.exports = { EnvironmentConfigChecker };