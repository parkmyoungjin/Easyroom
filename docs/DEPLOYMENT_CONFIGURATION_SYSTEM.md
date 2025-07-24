# Deployment Configuration System

This document provides a comprehensive overview of the deployment configuration system, including validation tools, troubleshooting guides, and best practices.

## Overview

The deployment configuration system ensures robust environment variable management across different deployment environments (development, test, production) with comprehensive validation, error handling, and troubleshooting capabilities.

## Quick Start

### Validate Your Configuration

```bash
# Quick environment validation
npm run validate:env

# Environment-specific validation
npm run validate:env:dev
npm run validate:env:test
npm run validate:env:prod

# Comprehensive configuration check
npm run verify:comprehensive

# Platform-specific deployment verification
npm run verify:deployment
```

### Run Tests

```bash
# All deployment tests
npm run test:deployment

# Specific test suites
npm run test:deployment:scenarios
npm run test:deployment:platform
```

## System Components

### 1. Validation Scripts

#### Environment Validator (`validate-deployment-config.js`)
- Validates required environment variables for each environment
- Provides detailed error messages and troubleshooting steps
- Supports development, test, and production configurations

```bash
# Usage
node scripts/validate-deployment-config.js [environment]
npm run validate:env:prod
```

#### Environment Config Checker (`environment-config-checker.js`)
- Comprehensive environment configuration analysis
- Checks file security, connectivity, and configuration completeness
- Provides actionable recommendations

```bash
# Usage
node scripts/environment-config-checker.js
npm run check:config
```

#### Deployment Config Verifier (`deployment-config-verifier.js`)
- Platform-specific deployment verification (Vercel, Netlify, Docker)
- Multi-platform detection and validation
- Environment-specific testing with connectivity checks

```bash
# Usage
node scripts/deployment-config-verifier.js [environment]
npm run verify:deployment:prod
```

#### Comprehensive Config Verifier (`comprehensive-config-verifier.js`)
- Advanced verification combining all validation components
- Security, performance, and compatibility checks
- Exportable results for CI/CD integration

```bash
# Usage
node scripts/comprehensive-config-verifier.js [options]
npm run verify:comprehensive:export
```

### 2. Documentation

#### Environment Troubleshooting Guide (`docs/ENVIRONMENT_TROUBLESHOOTING.md`)
- Common issues and solutions
- Platform-specific troubleshooting
- Advanced debugging techniques
- Emergency recovery procedures

#### Deployment Migration Guide (`docs/DEPLOYMENT_MIGRATION_GUIDE.md`)
- Step-by-step migration instructions
- Platform-specific migration procedures
- Rollback strategies
- Best practices for future deployments

### 3. Test Suites

#### Deployment Configuration Scenarios (`src/__tests__/deployment/deployment-config-scenarios.test.ts`)
- End-to-end deployment configuration testing
- Environment-specific validation scenarios
- Error handling and reporting tests
- Real-world deployment simulations

#### Platform Integration Tests (`src/__tests__/deployment/platform-integration.test.ts`)
- Platform-specific configuration validation
- Multi-platform detection testing
- Security configuration validation
- Configuration file validation

## Environment Configuration

### Required Variables

#### All Environments
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

#### Test Environment (Additional)
```env
NODE_ENV=test
```

#### Production Environment (Additional)
```env
NODE_ENV=production
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXTAUTH_SECRET=your-32-character-secret
```

### Environment Files

- `.env.example` - Template with all required variables
- `.env.local` - Development environment variables
- `.env.test` - Test environment variables  
- `.env.production` - Production environment variables

## Platform Support

### Vercel
- Automatic detection via `VERCEL` environment variable or `vercel.json`
- Environment variable validation through Vercel CLI
- Build and runtime configuration checks

### Netlify
- Detection via `NETLIFY` environment variable or `netlify.toml`
- Build environment configuration validation
- Netlify CLI integration

### Docker
- Detection via `Dockerfile` or `docker-compose.yml`
- Container environment variable validation
- Multi-stage build support

### Generic/Self-hosted
- Fallback platform for any deployment environment
- Node.js version compatibility checks
- Dependency and configuration validation

## Validation Levels

### 1. Basic Validation
- Required environment variables present
- Basic format validation (HTTPS URLs, key lengths)
- File existence checks

### 2. Advanced Validation
- Platform-specific configuration validation
- Security configuration checks
- Performance optimization recommendations

### 3. Comprehensive Validation
- Multi-platform verification
- Security hardening validation
- Performance and compatibility analysis
- Exportable results for monitoring

## Usage Examples

### Development Workflow

```bash
# 1. Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# 2. Validate configuration
npm run validate:env:dev

# 3. Run comprehensive check
npm run verify:comprehensive

# 4. Test deployment scenarios
npm run test:deployment:scenarios
```

### CI/CD Integration

```yaml
# .github/workflows/config-validation.yml
name: Configuration Validation
on: [push, pull_request]

jobs:
  validate-config:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run validate:env:prod
      - run: npm run verify:comprehensive:export
      - run: npm run test:deployment
```

### Production Deployment

```bash
# 1. Pre-deployment validation
npm run validate:env:prod
npm run verify:deployment:prod

# 2. Run comprehensive verification
npm run verify:comprehensive:prod

# 3. Export results for monitoring
npm run verify:comprehensive:export

# 4. Deploy with confidence
# (Platform-specific deployment commands)
```

## Error Handling

### Error Categories

1. **Missing Required Variables**
   - Clear identification of missing variables
   - Environment-specific requirements
   - Step-by-step resolution guides

2. **Invalid Values**
   - Format validation (URLs, key lengths)
   - Security requirement validation
   - Platform compatibility checks

3. **Configuration Issues**
   - File security problems (.gitignore)
   - Platform configuration errors
   - Connectivity issues

### Troubleshooting Workflow

1. **Run Diagnostics**
   ```bash
   npm run verify:comprehensive --verbose
   ```

2. **Check Specific Issues**
   ```bash
   npm run check:config
   npm run validate:env:prod
   ```

3. **Review Documentation**
   - Check `docs/ENVIRONMENT_TROUBLESHOOTING.md`
   - Review platform-specific guides

4. **Test Fixes**
   ```bash
   npm run test:deployment:scenarios
   ```

## Best Practices

### 1. Environment Management
- Always use `.env.example` as a template
- Never commit actual environment files
- Use environment-specific files for different deployments
- Validate configuration before deployment

### 2. Security
- Use HTTPS for all URLs
- Generate strong secrets (32+ characters)
- Keep service role keys secure
- Regularly rotate secrets

### 3. Testing
- Test configuration changes locally first
- Use staging environments for validation
- Run comprehensive tests before production deployment
- Monitor configuration health in production

### 4. Documentation
- Document all required variables
- Maintain troubleshooting guides
- Keep migration procedures updated
- Share knowledge with team members

## Monitoring and Maintenance

### Health Checks
```javascript
// Add to your application
import { ConfigMonitor } from './lib/config-monitor';

// Check configuration health
const health = await ConfigMonitor.checkEnvironment();
if (!health.healthy) {
  // Handle configuration issues
}
```

### Automated Monitoring
```bash
# Set up automated checks
npm run verify:comprehensive:export
# Process results with monitoring tools
```

### Regular Maintenance
- Review configuration quarterly
- Update validation rules as needed
- Test disaster recovery procedures
- Keep documentation current

## Getting Help

### Quick Diagnostics
```bash
# Run all validation tools
npm run verify:comprehensive --verbose --export

# Check specific issues
npm run check:config
npm run validate:env:prod
```

### Documentation Resources
- `docs/ENVIRONMENT_TROUBLESHOOTING.md` - Detailed troubleshooting guide
- `docs/DEPLOYMENT_MIGRATION_GUIDE.md` - Migration procedures
- `scripts/` directory - All validation tools with inline documentation

### Support Workflow
1. Run comprehensive diagnostics
2. Export results for analysis
3. Check troubleshooting documentation
4. Test solutions in development environment
5. Contact team with diagnostic results if needed

## Advanced Features

### Custom Validation Rules
Extend validation by modifying the configuration objects in the validation scripts:

```javascript
// In validate-deployment-config.js
const ENVIRONMENT_CONFIGS = {
  production: {
    required: ['NEXT_PUBLIC_SUPABASE_URL', 'CUSTOM_REQUIRED_VAR'],
    validation: {
      'CUSTOM_REQUIRED_VAR': (value) => {
        // Custom validation logic
        return { valid: true };
      }
    }
  }
};
```

### Platform Extensions
Add new platform support by extending the platform handlers:

```javascript
// In deployment-config-verifier.js
const PLATFORM_HANDLERS = {
  'custom-platform': {
    name: 'Custom Platform',
    detect: () => process.env.CUSTOM_PLATFORM,
    verify: async function() {
      // Custom verification logic
      return [];
    }
  }
};
```

### Integration with Monitoring Tools
Export validation results for integration with monitoring systems:

```bash
# Export results as JSON
npm run verify:comprehensive:export

# Process with monitoring tools
cat config-verification-results.json | your-monitoring-tool
```

This comprehensive system ensures robust, secure, and maintainable deployment configurations across all environments and platforms.