#!/usr/bin/env node

/**
 * Deployment Configuration Verifier
 * 
 * Comprehensive tool for verifying configuration across different deployment environments
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Platform-specific configuration handlers
const PLATFORM_HANDLERS = {
  vercel: {
    name: 'Vercel',
    detect: () => process.env.VERCEL || fs.existsSync('vercel.json'),
    verify: async function() {
      const results = [];
      
      // Check vercel.json configuration
      if (fs.existsSync('vercel.json')) {
        try {
          const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
          results.push({
            check: 'Vercel Configuration',
            status: 'pass',
            message: 'vercel.json found and valid'
          });
          
          // Check for environment variable configuration
          if (config.env) {
            results.push({
              check: 'Environment Variables in Config',
              status: 'pass',
              message: `${Object.keys(config.env).length} environment variables configured`
            });
          } else {
            results.push({
              check: 'Environment Variables in Config',
              status: 'warning',
              message: 'No environment variables in vercel.json - ensure they are set in dashboard'
            });
          }
        } catch (error) {
          results.push({
            check: 'Vercel Configuration',
            status: 'fail',
            message: `Invalid vercel.json: ${error.message}`
          });
        }
      }
      
      // Check Vercel CLI availability
      try {
        execSync('vercel --version', { stdio: 'pipe' });
        results.push({
          check: 'Vercel CLI',
          status: 'pass',
          message: 'Vercel CLI is available'
        });
        
        // Try to get environment variables from Vercel
        try {
          const envOutput = execSync('vercel env ls', { stdio: 'pipe', encoding: 'utf8' });
          const envCount = (envOutput.match(/\n/g) || []).length - 1; // Subtract header
          results.push({
            check: 'Vercel Environment Variables',
            status: envCount > 0 ? 'pass' : 'warning',
            message: `${envCount} environment variables found in Vercel project`
          });
        } catch (error) {
          results.push({
            check: 'Vercel Environment Variables',
            status: 'warning',
            message: 'Could not fetch Vercel environment variables - ensure you are logged in'
          });
        }
      } catch (error) {
        results.push({
          check: 'Vercel CLI',
          status: 'warning',
          message: 'Vercel CLI not available - install with: npm i -g vercel'
        });
      }
      
      return results;
    }
  },
  
  netlify: {
    name: 'Netlify',
    detect: () => process.env.NETLIFY || fs.existsSync('netlify.toml'),
    verify: async function() {
      const results = [];
      
      // Check netlify.toml configuration
      if (fs.existsSync('netlify.toml')) {
        results.push({
          check: 'Netlify Configuration',
          status: 'pass',
          message: 'netlify.toml found'
        });
        
        try {
          const config = fs.readFileSync('netlify.toml', 'utf8');
          if (config.includes('[build.environment]')) {
            results.push({
              check: 'Build Environment Configuration',
              status: 'pass',
              message: 'Build environment variables configured'
            });
          } else {
            results.push({
              check: 'Build Environment Configuration',
              status: 'warning',
              message: 'No build environment variables in netlify.toml'
            });
          }
        } catch (error) {
          results.push({
            check: 'Netlify Configuration Analysis',
            status: 'warning',
            message: `Could not analyze netlify.toml: ${error.message}`
          });
        }
      }
      
      // Check Netlify CLI
      try {
        execSync('netlify --version', { stdio: 'pipe' });
        results.push({
          check: 'Netlify CLI',
          status: 'pass',
          message: 'Netlify CLI is available'
        });
      } catch (error) {
        results.push({
          check: 'Netlify CLI',
          status: 'warning',
          message: 'Netlify CLI not available - install with: npm i -g netlify-cli'
        });
      }
      
      return results;
    }
  },
  
  docker: {
    name: 'Docker',
    detect: () => fs.existsSync('Dockerfile') || fs.existsSync('docker-compose.yml'),
    verify: async function() {
      const results = [];
      
      // Check Dockerfile
      if (fs.existsSync('Dockerfile')) {
        results.push({
          check: 'Dockerfile',
          status: 'pass',
          message: 'Dockerfile found'
        });
        
        try {
          const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
          
          // Check for environment variable handling
          if (dockerfile.includes('ENV ') || dockerfile.includes('ARG ')) {
            results.push({
              check: 'Docker Environment Variables',
              status: 'pass',
              message: 'Environment variables configured in Dockerfile'
            });
          } else {
            results.push({
              check: 'Docker Environment Variables',
              status: 'warning',
              message: 'No environment variables in Dockerfile - ensure they are passed at runtime'
            });
          }
          
          // Check for multi-stage build
          if (dockerfile.includes('FROM ') && dockerfile.split('FROM ').length > 2) {
            results.push({
              check: 'Docker Multi-stage Build',
              status: 'pass',
              message: 'Multi-stage build detected'
            });
          }
        } catch (error) {
          results.push({
            check: 'Dockerfile Analysis',
            status: 'warning',
            message: `Could not analyze Dockerfile: ${error.message}`
          });
        }
      }
      
      // Check docker-compose.yml
      if (fs.existsSync('docker-compose.yml')) {
        results.push({
          check: 'Docker Compose',
          status: 'pass',
          message: 'docker-compose.yml found'
        });
        
        try {
          const compose = fs.readFileSync('docker-compose.yml', 'utf8');
          
          if (compose.includes('environment:') || compose.includes('env_file:')) {
            results.push({
              check: 'Docker Compose Environment',
              status: 'pass',
              message: 'Environment configuration found in docker-compose.yml'
            });
          } else {
            results.push({
              check: 'Docker Compose Environment',
              status: 'warning',
              message: 'No environment configuration in docker-compose.yml'
            });
          }
        } catch (error) {
          results.push({
            check: 'Docker Compose Analysis',
            status: 'warning',
            message: `Could not analyze docker-compose.yml: ${error.message}`
          });
        }
      }
      
      // Check Docker availability
      try {
        execSync('docker --version', { stdio: 'pipe' });
        results.push({
          check: 'Docker Runtime',
          status: 'pass',
          message: 'Docker is available'
        });
      } catch (error) {
        results.push({
          check: 'Docker Runtime',
          status: 'warning',
          message: 'Docker not available - install Docker to test containerized deployment'
        });
      }
      
      return results;
    }
  },
  
  generic: {
    name: 'Generic/Self-hosted',
    detect: () => true, // Always available as fallback
    verify: async function() {
      const results = [];
      
      // Check Node.js version
      try {
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion >= 18) {
          results.push({
            check: 'Node.js Version',
            status: 'pass',
            message: `Node.js ${nodeVersion} (compatible)`
          });
        } else {
          results.push({
            check: 'Node.js Version',
            status: 'warning',
            message: `Node.js ${nodeVersion} (consider upgrading to 18+)`
          });
        }
      } catch (error) {
        results.push({
          check: 'Node.js Version',
          status: 'fail',
          message: 'Could not determine Node.js version'
        });
      }
      
      // Check npm/yarn
      try {
        const npmVersion = execSync('npm --version', { stdio: 'pipe', encoding: 'utf8' }).trim();
        results.push({
          check: 'Package Manager',
          status: 'pass',
          message: `npm ${npmVersion} available`
        });
      } catch (error) {
        results.push({
          check: 'Package Manager',
          status: 'fail',
          message: 'npm not available'
        });
      }
      
      // Check if dependencies are installed
      if (fs.existsSync('node_modules')) {
        results.push({
          check: 'Dependencies',
          status: 'pass',
          message: 'node_modules directory exists'
        });
      } else {
        results.push({
          check: 'Dependencies',
          status: 'fail',
          message: 'Dependencies not installed - run npm install'
        });
      }
      
      return results;
    }
  }
};

class DeploymentConfigVerifier {
  constructor() {
    this.detectedPlatforms = [];
    this.results = [];
  }

  /**
   * Detect deployment platforms
   */
  detectPlatforms() {
    this.detectedPlatforms = Object.entries(PLATFORM_HANDLERS)
      .filter(([key, handler]) => handler.detect())
      .map(([key, handler]) => ({ key, ...handler }));
    
    if (this.detectedPlatforms.length === 0) {
      this.detectedPlatforms.push({ key: 'generic', ...PLATFORM_HANDLERS.generic });
    }
    
    return this.detectedPlatforms;
  }

  /**
   * Verify configuration for all detected platforms
   */
  async verifyAllPlatforms() {
    console.log('🔍 Detecting deployment platforms...\n');
    
    const platforms = this.detectPlatforms();
    
    console.log('📋 Detected platforms:');
    platforms.forEach(platform => {
      console.log(`  • ${platform.name}`);
    });
    console.log('');
    
    for (const platform of platforms) {
      console.log(`🔧 Verifying ${platform.name} configuration...`);
      
      try {
        const platformResults = await platform.verify();
        this.results.push({
          platform: platform.name,
          results: platformResults
        });
        
        // Show immediate feedback
        platformResults.forEach(result => {
          const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
          console.log(`  ${icon} ${result.check}: ${result.message}`);
        });
        
      } catch (error) {
        this.results.push({
          platform: platform.name,
          results: [{
            check: 'Platform Verification',
            status: 'fail',
            message: `Verification failed: ${error.message}`
          }]
        });
        console.log(`  ❌ Platform Verification: Verification failed: ${error.message}`);
      }
      
      console.log('');
    }
  }

  /**
   * Run environment-specific tests
   */
  async runEnvironmentTests(environment = 'development') {
    console.log(`🧪 Running ${environment} environment tests...\n`);
    
    const tests = [
      {
        name: 'Environment Variable Loading',
        test: () => {
          const requiredVars = this.getRequiredVariables(environment);
          const missing = requiredVars.filter(varName => !process.env[varName]);
          
          if (missing.length > 0) {
            return {
              status: 'fail',
              message: `Missing required variables: ${missing.join(', ')}`,
              details: missing.map(v => `${v}: Required for ${environment} environment`)
            };
          }
          
          return {
            status: 'pass',
            message: 'All required environment variables are loaded'
          };
        }
      },
      
      {
        name: 'Supabase URL Format',
        test: () => {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          
          if (!url) {
            return { status: 'fail', message: 'NEXT_PUBLIC_SUPABASE_URL not set' };
          }
          
          if (!url.startsWith('https://')) {
            return { status: 'fail', message: 'Supabase URL must use HTTPS' };
          }
          
          if (!url.includes('supabase.co')) {
            return { status: 'warning', message: 'URL does not appear to be a standard Supabase URL' };
          }
          
          return { status: 'pass', message: 'Supabase URL format is valid' };
        }
      },
      
      {
        name: 'API Key Length',
        test: () => {
          const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          
          if (!key) {
            return { status: 'fail', message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY not set' };
          }
          
          if (key.length < 100) {
            return { status: 'warning', message: 'API key appears to be too short' };
          }
          
          return { status: 'pass', message: 'API key length looks correct' };
        }
      },
      
      {
        name: 'Build Configuration',
        test: () => {
          if (!fs.existsSync('next.config.ts') && !fs.existsSync('next.config.js')) {
            return { status: 'warning', message: 'No Next.js config file found' };
          }
          
          return { status: 'pass', message: 'Next.js configuration file exists' };
        }
      },

      {
        name: 'Environment File Security',
        test: () => {
          if (!fs.existsSync('.gitignore')) {
            return { status: 'fail', message: '.gitignore file missing' };
          }
          
          const gitignore = fs.readFileSync('.gitignore', 'utf8');
          if (!gitignore.includes('.env')) {
            return { status: 'fail', message: 'Environment files not ignored by Git' };
          }
          
          return { status: 'pass', message: 'Environment files properly secured' };
        }
      },

      {
        name: 'Production Security Check',
        test: () => {
          if (environment !== 'production') {
            return { status: 'pass', message: 'Not applicable for non-production environment' };
          }
          
          const requiredSecrets = ['NEXTAUTH_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'];
          const missing = requiredSecrets.filter(secret => !process.env[secret]);
          
          if (missing.length > 0) {
            return { 
              status: 'fail', 
              message: `Missing production secrets: ${missing.join(', ')}` 
            };
          }
          
          // Check NEXTAUTH_SECRET length
          if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
            return { 
              status: 'fail', 
              message: 'NEXTAUTH_SECRET too short (minimum 32 characters)' 
            };
          }
          
          return { status: 'pass', message: 'Production security requirements met' };
        }
      },

      {
        name: 'Database Connectivity',
        test: async () => {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          
          if (!url || !key) {
            return { status: 'fail', message: 'Cannot test connectivity - missing credentials' };
          }
          
          try {
            const response = await fetch(`${url}/rest/v1/`, {
              method: 'GET',
              headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
              }
            });
            
            if (response.ok || response.status === 401) {
              return { status: 'pass', message: 'Database endpoint is reachable' };
            } else {
              return { 
                status: 'fail', 
                message: `Database endpoint returned ${response.status}` 
              };
            }
          } catch (error) {
            return { 
              status: 'fail', 
              message: `Database connectivity failed: ${error.message}` 
            };
          }
        }
      }
    ];
    
    const testResults = [];
    for (const test of tests) {
      try {
        const result = await test.test();
        const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
        console.log(`  ${icon} ${test.name}: ${result.message}`);
        if (result.details) {
          result.details.forEach(detail => console.log(`    • ${detail}`));
        }
        testResults.push({ ...result, name: test.name });
      } catch (error) {
        console.log(`  ❌ ${test.name}: Test failed - ${error.message}`);
        testResults.push({ 
          status: 'fail', 
          message: `Test failed - ${error.message}`, 
          name: test.name 
        });
      }
    }
    
    return testResults;
  }

  /**
   * Get required variables for environment
   */
  getRequiredVariables(environment) {
    const base = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    
    switch (environment) {
      case 'production':
        return [...base, 'SUPABASE_SERVICE_ROLE_KEY', 'NEXTAUTH_SECRET', 'NODE_ENV'];
      case 'test':
        return [...base, 'NODE_ENV'];
      default:
        return base;
    }
  }

  /**
   * Generate deployment recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Analyze results for recommendations
    this.results.forEach(platformResult => {
      const failedChecks = platformResult.results.filter(r => r.status === 'fail');
      const warningChecks = platformResult.results.filter(r => r.status === 'warning');
      
      if (failedChecks.length > 0) {
        recommendations.push({
          priority: 'high',
          platform: platformResult.platform,
          message: `Fix ${failedChecks.length} critical issues in ${platformResult.platform}`,
          actions: failedChecks.map(check => `• ${check.check}: ${check.message}`)
        });
      }
      
      if (warningChecks.length > 0) {
        recommendations.push({
          priority: 'medium',
          platform: platformResult.platform,
          message: `Address ${warningChecks.length} warnings in ${platformResult.platform}`,
          actions: warningChecks.map(check => `• ${check.check}: ${check.message}`)
        });
      }
    });
    
    return recommendations;
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    console.log('\n📊 DEPLOYMENT CONFIGURATION REPORT');
    console.log('='.repeat(60));
    
    // Platform-specific results
    this.results.forEach(platformResult => {
      const passed = platformResult.results.filter(r => r.status === 'pass').length;
      const warnings = platformResult.results.filter(r => r.status === 'warning').length;
      const failed = platformResult.results.filter(r => r.status === 'fail').length;
      const total = platformResult.results.length;
      
      console.log(`\n🏗️  ${platformResult.platform.toUpperCase()}`);
      console.log(`   Passed: ${passed}/${total} | Warnings: ${warnings} | Failed: ${failed}`);
    });
    
    // Recommendations
    const recommendations = this.generateRecommendations();
    
    if (recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      
      const highPriority = recommendations.filter(r => r.priority === 'high');
      const mediumPriority = recommendations.filter(r => r.priority === 'medium');
      
      if (highPriority.length > 0) {
        console.log('\n🔴 HIGH PRIORITY:');
        highPriority.forEach(rec => {
          console.log(`  ${rec.message}`);
          rec.actions.forEach(action => console.log(`    ${action}`));
        });
      }
      
      if (mediumPriority.length > 0) {
        console.log('\n🟡 MEDIUM PRIORITY:');
        mediumPriority.forEach(rec => {
          console.log(`  ${rec.message}`);
          rec.actions.forEach(action => console.log(`    ${action}`));
        });
      }
    }
    
    // Overall status
    const totalFailed = this.results.reduce((sum, pr) => 
      sum + pr.results.filter(r => r.status === 'fail').length, 0);
    const totalWarnings = this.results.reduce((sum, pr) => 
      sum + pr.results.filter(r => r.status === 'warning').length, 0);
    
    console.log('\n' + '='.repeat(60));
    
    if (totalFailed > 0) {
      console.log('❌ DEPLOYMENT NOT READY - Critical issues must be resolved');
      return false;
    } else if (totalWarnings > 0) {
      console.log('⚠️  DEPLOYMENT READY WITH WARNINGS - Consider addressing warnings');
      return true;
    } else {
      console.log('✅ DEPLOYMENT READY - All checks passed!');
      return true;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || process.env.NODE_ENV || 'development';
  
  console.log(`🚀 Deployment Configuration Verifier`);
  console.log(`Environment: ${environment}\n`);
  
  const verifier = new DeploymentConfigVerifier();
  
  // Run platform verification
  await verifier.verifyAllPlatforms();
  
  // Run environment-specific tests
  await verifier.runEnvironmentTests(environment);
  
  // Generate final report
  const isReady = verifier.generateReport();
  
  process.exit(isReady ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  });
}

module.exports = { DeploymentConfigVerifier, PLATFORM_HANDLERS };