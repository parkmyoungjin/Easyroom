#!/usr/bin/env node

/**
 * Comprehensive Configuration Verifier
 * 
 * Advanced tool for verifying complete deployment configuration
 * including environment variables, platform settings, and runtime checks
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { DeploymentConfigVerifier } = require('./deployment-config-verifier');
const { EnvironmentConfigChecker } = require('./environment-config-checker');
const { DeploymentValidator } = require('./validate-deployment-config');

class ComprehensiveConfigVerifier {
  constructor(options = {}) {
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.platform = options.platform || 'auto-detect';
    this.verbose = options.verbose || false;
    this.results = {
      environment: [],
      platform: [],
      security: [],
      performance: [],
      compatibility: []
    };
  }

  /**
   * Run comprehensive verification
   */
  async runComprehensiveCheck() {
    console.log('🔍 COMPREHENSIVE CONFIGURATION VERIFICATION');
    console.log('='.repeat(60));
    console.log(`Environment: ${this.environment}`);
    console.log(`Platform: ${this.platform}`);
    console.log('');

    // Run all verification components
    await this.runEnvironmentVerification();
    await this.runPlatformVerification();
    await this.runSecurityVerification();
    await this.runPerformanceVerification();
    await this.runCompatibilityVerification();

    // Generate comprehensive report
    return this.generateComprehensiveReport();
  }

  /**
   * Environment-specific verification
   */
  async runEnvironmentVerification() {
    console.log('🌍 Environment Configuration Verification...');
    
    try {
      const validator = new DeploymentValidator(this.environment);
      const envVars = validator.loadEnvironmentVariables();
      
      validator.validateRequired(envVars);
      validator.validateOptional(envVars);
      validator.validateValues(envVars);

      this.results.environment = [
        {
          category: 'Environment Variables',
          passed: validator.success.length,
          failed: validator.errors.length,
          warnings: validator.warnings.length,
          details: {
            errors: validator.errors,
            warnings: validator.warnings,
            success: validator.success
          }
        }
      ];

      console.log(`  ✓ Environment validation completed`);
    } catch (error) {
      this.results.environment.push({
        category: 'Environment Variables',
        status: 'error',
        message: `Environment verification failed: ${error.message}`
      });
      console.log(`  ❌ Environment verification failed: ${error.message}`);
    }
  }

  /**
   * Platform-specific verification
   */
  async runPlatformVerification() {
    console.log('🏗️  Platform Configuration Verification...');
    
    try {
      const platformVerifier = new DeploymentConfigVerifier();
      await platformVerifier.verifyAllPlatforms();
      
      this.results.platform = platformVerifier.results.map(result => ({
        platform: result.platform,
        checks: result.results,
        passed: result.results.filter(r => r.status === 'pass').length,
        failed: result.results.filter(r => r.status === 'fail').length,
        warnings: result.results.filter(r => r.status === 'warning').length
      }));

      console.log(`  ✓ Platform verification completed`);
    } catch (error) {
      this.results.platform.push({
        platform: 'unknown',
        status: 'error',
        message: `Platform verification failed: ${error.message}`
      });
      console.log(`  ❌ Platform verification failed: ${error.message}`);
    }
  }

  /**
   * Security configuration verification
   */
  async runSecurityVerification() {
    console.log('🔒 Security Configuration Verification...');
    
    const securityChecks = [
      {
        name: 'Environment File Security',
        check: () => {
          if (!fs.existsSync('.gitignore')) {
            return { status: 'fail', message: '.gitignore file missing' };
          }
          
          const gitignore = fs.readFileSync('.gitignore', 'utf8');
          const envPatterns = ['.env', '.env.local', '.env.production'];
          const missing = envPatterns.filter(pattern => !gitignore.includes(pattern));
          
          if (missing.length > 0) {
            return { 
              status: 'fail', 
              message: `Environment patterns not in .gitignore: ${missing.join(', ')}` 
            };
          }
          
          return { status: 'pass', message: 'Environment files properly secured' };
        }
      },
      
      {
        name: 'Secret Key Strength',
        check: () => {
          const secrets = ['NEXTAUTH_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'];
          const issues = [];
          
          secrets.forEach(secret => {
            const value = process.env[secret];
            if (value) {
              if (value.length < 32) {
                issues.push(`${secret} too short (${value.length} chars, minimum 32)`);
              }
              if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
                issues.push(`${secret} lacks complexity (should include uppercase, lowercase, numbers)`);
              }
            }
          });
          
          if (issues.length > 0) {
            return { status: 'warning', message: issues.join('; ') };
          }
          
          return { status: 'pass', message: 'Secret keys meet security requirements' };
        }
      },
      
      {
        name: 'HTTPS Configuration',
        check: () => {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (!url) {
            return { status: 'fail', message: 'Supabase URL not configured' };
          }
          
          if (!url.startsWith('https://')) {
            return { status: 'fail', message: 'Supabase URL must use HTTPS' };
          }
          
          return { status: 'pass', message: 'HTTPS properly configured' };
        }
      },
      
      {
        name: 'Production Environment Security',
        check: () => {
          if (this.environment !== 'production') {
            return { status: 'pass', message: 'Not applicable for non-production' };
          }
          
          const requiredSecrets = ['NEXTAUTH_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'];
          const missing = requiredSecrets.filter(secret => !process.env[secret]);
          
          if (missing.length > 0) {
            return { 
              status: 'fail', 
              message: `Missing production secrets: ${missing.join(', ')}` 
            };
          }
          
          return { status: 'pass', message: 'Production security requirements met' };
        }
      }
    ];

    this.results.security = securityChecks.map(check => {
      try {
        const result = check.check();
        const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
        console.log(`  ${icon} ${check.name}: ${result.message}`);
        return { name: check.name, ...result };
      } catch (error) {
        console.log(`  ❌ ${check.name}: Check failed - ${error.message}`);
        return { 
          name: check.name, 
          status: 'fail', 
          message: `Check failed - ${error.message}` 
        };
      }
    });
  }

  /**
   * Performance configuration verification
   */
  async runPerformanceVerification() {
    console.log('⚡ Performance Configuration Verification...');
    
    const performanceChecks = [
      {
        name: 'Build Configuration',
        check: () => {
          const nextConfigExists = fs.existsSync('next.config.ts') || fs.existsSync('next.config.js');
          if (!nextConfigExists) {
            return { status: 'warning', message: 'No Next.js config file found' };
          }
          
          return { status: 'pass', message: 'Build configuration present' };
        }
      },
      
      {
        name: 'Environment Variable Optimization',
        check: () => {
          const publicVars = Object.keys(process.env).filter(key => 
            key.startsWith('NEXT_PUBLIC_')
          );
          
          if (publicVars.length > 10) {
            return { 
              status: 'warning', 
              message: `Many public variables (${publicVars.length}) - consider optimization` 
            };
          }
          
          return { status: 'pass', message: 'Environment variables optimized' };
        }
      },
      
      {
        name: 'Dependency Check',
        check: () => {
          if (!fs.existsSync('package.json')) {
            return { status: 'fail', message: 'package.json not found' };
          }
          
          const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
          const depCount = Object.keys(packageJson.dependencies || {}).length;
          const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
          
          if (depCount > 50) {
            return { 
              status: 'warning', 
              message: `Many dependencies (${depCount}) - consider optimization` 
            };
          }
          
          return { 
            status: 'pass', 
            message: `Dependencies optimized (${depCount} prod, ${devDepCount} dev)` 
          };
        }
      }
    ];

    this.results.performance = performanceChecks.map(check => {
      try {
        const result = check.check();
        const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
        console.log(`  ${icon} ${check.name}: ${result.message}`);
        return { name: check.name, ...result };
      } catch (error) {
        console.log(`  ❌ ${check.name}: Check failed - ${error.message}`);
        return { 
          name: check.name, 
          status: 'fail', 
          message: `Check failed - ${error.message}` 
        };
      }
    });
  }

  /**
   * Compatibility verification
   */
  async runCompatibilityVerification() {
    console.log('🔄 Compatibility Verification...');
    
    const compatibilityChecks = [
      {
        name: 'Node.js Version',
        check: () => {
          const nodeVersion = process.version;
          const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
          
          if (majorVersion < 16) {
            return { status: 'fail', message: `Node.js ${nodeVersion} too old (minimum 16)` };
          } else if (majorVersion < 18) {
            return { status: 'warning', message: `Node.js ${nodeVersion} works but 18+ recommended` };
          }
          
          return { status: 'pass', message: `Node.js ${nodeVersion} compatible` };
        }
      },
      
      {
        name: 'Package Manager',
        check: () => {
          try {
            const npmVersion = execSync('npm --version', { stdio: 'pipe', encoding: 'utf8' }).trim();
            return { status: 'pass', message: `npm ${npmVersion} available` };
          } catch (error) {
            return { status: 'fail', message: 'npm not available' };
          }
        }
      },
      
      {
        name: 'TypeScript Configuration',
        check: () => {
          if (!fs.existsSync('tsconfig.json')) {
            return { status: 'warning', message: 'No TypeScript configuration' };
          }
          
          try {
            const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
            if (!tsconfig.compilerOptions?.strict) {
              return { status: 'warning', message: 'TypeScript strict mode not enabled' };
            }
            
            return { status: 'pass', message: 'TypeScript properly configured' };
          } catch (error) {
            return { status: 'fail', message: 'Invalid TypeScript configuration' };
          }
        }
      }
    ];

    this.results.compatibility = compatibilityChecks.map(check => {
      try {
        const result = check.check();
        const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
        console.log(`  ${icon} ${check.name}: ${result.message}`);
        return { name: check.name, ...result };
      } catch (error) {
        console.log(`  ❌ ${check.name}: Check failed - ${error.message}`);
        return { 
          name: check.name, 
          status: 'fail', 
          message: `Check failed - ${error.message}` 
        };
      }
    });
  }

  /**
   * Generate comprehensive report
   */
  generateComprehensiveReport() {
    console.log('\n📊 COMPREHENSIVE CONFIGURATION REPORT');
    console.log('='.repeat(60));

    const categories = ['environment', 'platform', 'security', 'performance', 'compatibility'];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalWarnings = 0;

    categories.forEach(category => {
      const results = this.results[category];
      if (results && results.length > 0) {
        console.log(`\n🔧 ${category.toUpperCase()}:`);
        
        results.forEach(result => {
          if (result.passed !== undefined) {
            // Platform results format
            console.log(`  ${result.platform || result.category}: ${result.passed} passed, ${result.failed} failed, ${result.warnings} warnings`);
            totalPassed += result.passed;
            totalFailed += result.failed;
            totalWarnings += result.warnings;
          } else {
            // Individual check results format
            const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
            console.log(`  ${icon} ${result.name}: ${result.message}`);
            
            if (result.status === 'pass') totalPassed++;
            else if (result.status === 'fail') totalFailed++;
            else if (result.status === 'warning') totalWarnings++;
          }
        });
      }
    });

    // Overall assessment
    console.log('\n' + '='.repeat(60));
    console.log(`📈 OVERALL ASSESSMENT:`);
    console.log(`  Passed: ${totalPassed}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log(`  Warnings: ${totalWarnings}`);

    const totalChecks = totalPassed + totalFailed + totalWarnings;
    const score = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;
    console.log(`  Score: ${score}%`);

    // Recommendations
    if (totalFailed > 0) {
      console.log('\n🔴 CRITICAL ISSUES FOUND:');
      console.log('  • Address all failed checks before deployment');
      console.log('  • Review security and environment configuration');
      console.log('  • Run individual verification tools for detailed guidance');
    } else if (totalWarnings > 0) {
      console.log('\n🟡 WARNINGS DETECTED:');
      console.log('  • Configuration is functional but can be improved');
      console.log('  • Consider addressing warnings for optimal performance');
      console.log('  • Review best practices documentation');
    } else {
      console.log('\n✅ EXCELLENT CONFIGURATION:');
      console.log('  • All checks passed successfully');
      console.log('  • Configuration meets all requirements');
      console.log('  • Ready for deployment');
    }

    return {
      score,
      passed: totalPassed,
      failed: totalFailed,
      warnings: totalWarnings,
      ready: totalFailed === 0
    };
  }

  /**
   * Export results to JSON
   */
  exportResults(filename = 'config-verification-results.json') {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      platform: this.platform,
      results: this.results,
      summary: {
        passed: this.results.environment.reduce((sum, r) => sum + (r.passed || 0), 0),
        failed: this.results.environment.reduce((sum, r) => sum + (r.failed || 0), 0),
        warnings: this.results.environment.reduce((sum, r) => sum + (r.warnings || 0), 0)
      }
    };

    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\n📄 Results exported to ${filename}`);
    return filename;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    environment: args.find(arg => arg.startsWith('--env='))?.split('=')[1] || process.env.NODE_ENV || 'development',
    platform: args.find(arg => arg.startsWith('--platform='))?.split('=')[1] || 'auto-detect',
    verbose: args.includes('--verbose'),
    export: args.includes('--export')
  };

  const verifier = new ComprehensiveConfigVerifier(options);
  const results = await verifier.runComprehensiveCheck();

  if (options.export) {
    verifier.exportResults();
  }

  process.exit(results.ready ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Comprehensive verification failed:', error.message);
    process.exit(1);
  });
}

module.exports = { ComprehensiveConfigVerifier };