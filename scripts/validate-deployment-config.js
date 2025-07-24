#!/usr/bin/env node

/**
 * Deployment Configuration Validation Script
 * 
 * This script validates environment configuration for different deployment environments
 * and provides detailed feedback on missing or invalid configuration.
 */

const fs = require('fs');
const path = require('path');

// Environment-specific configuration requirements
const ENVIRONMENT_CONFIGS = {
  development: {
    required: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ],
    optional: [
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXTAUTH_SECRET',
      'NODE_ENV'
    ],
    validation: {
      'NEXT_PUBLIC_SUPABASE_URL': (value) => {
        if (!value.startsWith('https://')) {
          return { valid: false, error: 'Must start with https://' };
        }
        if (!value.includes('supabase.co')) {
          return { valid: false, error: 'Must be a valid Supabase URL' };
        }
        return { valid: true };
      },
      'NEXT_PUBLIC_SUPABASE_ANON_KEY': (value) => {
        if (value.length < 100) {
          return { valid: false, error: 'Anon key appears to be too short' };
        }
        return { valid: true };
      }
    }
  },
  test: {
    required: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NODE_ENV'
    ],
    optional: [
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXTAUTH_SECRET'
    ],
    validation: {
      'NODE_ENV': (value) => {
        if (!['test', 'testing'].includes(value)) {
          return { valid: false, error: 'NODE_ENV should be "test" or "testing" for test environment' };
        }
        return { valid: true };
      }
    }
  },
  production: {
    required: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXTAUTH_SECRET',
      'NODE_ENV'
    ],
    optional: [],
    validation: {
      'NODE_ENV': (value) => {
        if (value !== 'production') {
          return { valid: false, error: 'NODE_ENV must be "production" for production environment' };
        }
        return { valid: true };
      },
      'NEXTAUTH_SECRET': (value) => {
        if (value.length < 32) {
          return { valid: false, error: 'NEXTAUTH_SECRET should be at least 32 characters long' };
        }
        return { valid: true };
      }
    }
  }
};

class DeploymentValidator {
  constructor(environment = 'development') {
    this.environment = environment;
    this.config = ENVIRONMENT_CONFIGS[environment];
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  /**
   * Load environment variables from various sources
   */
  loadEnvironmentVariables() {
    const envVars = {};
    
    // Load from process.env
    Object.keys(process.env).forEach(key => {
      envVars[key] = process.env[key];
    });

    // Try to load from .env files
    const envFiles = [
      '.env.local',
      '.env.production',
      '.env',
      `.env.${this.environment}`
    ];

    envFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match && !envVars[match[1]]) {
              envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
            }
          });
        }
      } catch (error) {
        this.warnings.push(`Could not read ${file}: ${error.message}`);
      }
    });

    return envVars;
  }

  /**
   * Validate required environment variables
   */
  validateRequired(envVars) {
    this.config.required.forEach(key => {
      if (!envVars[key]) {
        this.errors.push({
          type: 'missing_required',
          key,
          message: `Required environment variable ${key} is not set`,
          troubleshooting: this.getTroubleshootingSteps(key)
        });
      } else {
        this.success.push(`✓ ${key} is set`);
      }
    });
  }

  /**
   * Validate optional environment variables
   */
  validateOptional(envVars) {
    this.config.optional.forEach(key => {
      if (!envVars[key]) {
        this.warnings.push(`Optional environment variable ${key} is not set`);
      } else {
        this.success.push(`✓ ${key} is set`);
      }
    });
  }

  /**
   * Validate environment variable values
   */
  validateValues(envVars) {
    Object.keys(this.config.validation || {}).forEach(key => {
      if (envVars[key]) {
        const validator = this.config.validation[key];
        const result = validator(envVars[key]);
        
        if (!result.valid) {
          this.errors.push({
            type: 'invalid_value',
            key,
            message: `Invalid value for ${key}: ${result.error}`,
            troubleshooting: this.getTroubleshootingSteps(key)
          });
        } else {
          this.success.push(`✓ ${key} has valid format`);
        }
      }
    });
  }

  /**
   * Get troubleshooting steps for specific environment variables
   */
  getTroubleshootingSteps(key) {
    const troubleshooting = {
      'NEXT_PUBLIC_SUPABASE_URL': [
        '1. Go to your Supabase project dashboard',
        '2. Navigate to Settings > API',
        '3. Copy the Project URL',
        '4. Add it to your .env file as NEXT_PUBLIC_SUPABASE_URL=your_url_here'
      ],
      'NEXT_PUBLIC_SUPABASE_ANON_KEY': [
        '1. Go to your Supabase project dashboard',
        '2. Navigate to Settings > API',
        '3. Copy the anon/public key',
        '4. Add it to your .env file as NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here'
      ],
      'SUPABASE_SERVICE_ROLE_KEY': [
        '1. Go to your Supabase project dashboard',
        '2. Navigate to Settings > API',
        '3. Copy the service_role key (keep this secret!)',
        '4. Add it to your .env file as SUPABASE_SERVICE_ROLE_KEY=your_key_here'
      ],
      'NEXTAUTH_SECRET': [
        '1. Generate a random 32+ character string',
        '2. You can use: openssl rand -base64 32',
        '3. Add it to your .env file as NEXTAUTH_SECRET=your_secret_here'
      ],
      'NODE_ENV': [
        `1. Set NODE_ENV=${this.environment} in your environment`,
        '2. For production deployments, ensure this is set to "production"',
        '3. For test environments, use "test" or "testing"'
      ]
    };

    return troubleshooting[key] || [
      '1. Check your .env files for this variable',
      '2. Ensure the variable is properly set in your deployment environment',
      '3. Verify the variable name is spelled correctly'
    ];
  }

  /**
   * Run complete validation
   */
  validate() {
    console.log(`🔍 Validating ${this.environment} environment configuration...\n`);
    
    const envVars = this.loadEnvironmentVariables();
    
    this.validateRequired(envVars);
    this.validateOptional(envVars);
    this.validateValues(envVars);
    
    return this.generateReport();
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const hasErrors = this.errors.length > 0;
    const hasWarnings = this.warnings.length > 0;
    
    console.log('📊 VALIDATION REPORT');
    console.log('='.repeat(50));
    
    if (this.success.length > 0) {
      console.log('\n✅ SUCCESS:');
      this.success.forEach(msg => console.log(`  ${msg}`));
    }
    
    if (hasWarnings) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`  ${warning}`));
    }
    
    if (hasErrors) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => {
        console.log(`  ${error.message}`);
        if (error.troubleshooting) {
          console.log('    Troubleshooting:');
          error.troubleshooting.forEach(step => console.log(`      ${step}`));
        }
        console.log('');
      });
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (hasErrors) {
      console.log('❌ VALIDATION FAILED - Please fix the errors above');
      process.exit(1);
    } else if (hasWarnings) {
      console.log('⚠️  VALIDATION PASSED WITH WARNINGS');
      process.exit(0);
    } else {
      console.log('✅ VALIDATION PASSED - All configuration looks good!');
      process.exit(0);
    }
  }
}

// CLI Interface
function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || process.env.NODE_ENV || 'development';
  
  if (!ENVIRONMENT_CONFIGS[environment]) {
    console.error(`❌ Unknown environment: ${environment}`);
    console.error(`Available environments: ${Object.keys(ENVIRONMENT_CONFIGS).join(', ')}`);
    process.exit(1);
  }
  
  const validator = new DeploymentValidator(environment);
  validator.validate();
}

if (require.main === module) {
  main();
}

module.exports = { DeploymentValidator, ENVIRONMENT_CONFIGS };