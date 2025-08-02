# Deployment Migration Guide

This guide helps you migrate existing deployments to use the new environment configuration system with improved error handling and validation.

## Overview

The new environment configuration system provides:
- ✅ Robust environment variable validation
- ✅ Better error handling and user feedback
- ✅ Platform-specific deployment verification
- ✅ Comprehensive troubleshooting tools
- ✅ Automated configuration checks

## Pre-Migration Checklist

Before starting the migration, ensure you have:

- [ ] Access to your current deployment platform (Vercel, Netlify, etc.)
- [ ] Current environment variables documented
- [ ] Backup of your current configuration
- [ ] Access to your Supabase project dashboard
- [ ] Local development environment working

## Migration Steps

### Step 1: Backup Current Configuration

#### For Vercel:
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# List current environment variables
vercel env ls > backup-vercel-env.txt

# Download current deployment
vercel pull
```

#### For Netlify:
```bash
# Install Netlify CLI if not already installed
npm i -g netlify-cli

# Login to Netlify
netlify login

# List current environment variables
netlify env:list > backup-netlify-env.txt
```

#### For Docker/Self-hosted:
```bash
# Backup current environment files
cp .env .env.backup
cp docker-compose.yml docker-compose.yml.backup

# Export current environment variables
env | grep -E "(SUPABASE|NEXTAUTH|NODE_ENV)" > backup-env-vars.txt
```

### Step 2: Update Local Environment

1. **Pull the latest code** with the new environment configuration system:
```bash
git pull origin main
npm install
```

2. **Run the environment validation** to check your current setup:
```bash
# Check current environment
node scripts/validate-deployment-config.js

# Run comprehensive check
node scripts/environment-config-checker.js
```

3. **Fix any issues** identified by the validation scripts:
```bash
# If validation fails, check the troubleshooting guide
cat docs/ENVIRONMENT_TROUBLESHOOTING.md
```

### Step 3: Update Environment Variables

#### Required Variables (All Environments):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

#### Additional Variables (Production):
```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXTAUTH_SECRET=your-32-character-secret
NODE_ENV=production
```

#### Get Missing Variables:
1. **Supabase Variables:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project → Settings → API
   - Copy Project URL and anon/public key

2. **Generate NEXTAUTH_SECRET:**
```bash
# Generate a secure secret
openssl rand -base64 32
```

### Step 4: Platform-Specific Migration

#### Vercel Migration:

1. **Update environment variables in Vercel dashboard:**
   - Go to your project settings
   - Navigate to Environment Variables
   - Add/update all required variables
   - Set appropriate environments (Production, Preview, Development)

2. **Update vercel.json** (if exists):
```json
{
  "env": {
    "CUSTOM_KEY": "value"
  },
  "build": {
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

3. **Redeploy:**
```bash
vercel --prod
```

#### Netlify Migration:

1. **Update environment variables in Netlify dashboard:**
   - Go to Site Settings → Environment Variables
   - Add all required variables

2. **Update netlify.toml** (if exists):
```toml
[build.environment]
  NODE_ENV = "production"
  
[context.production.environment]
  NODE_ENV = "production"
```

3. **Redeploy:**
```bash
netlify deploy --prod
```

#### Docker Migration:

1. **Update Dockerfile:**
```dockerfile
# Add environment variable handling
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXTAUTH_SECRET

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NODE_ENV=production
```

2. **Update docker-compose.yml:**
```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NODE_ENV=production
    env_file:
      - .env.production
```

3. **Rebuild and deploy:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Step 5: Verify Migration

1. **Run deployment verification:**
```bash
# Verify configuration for your platform
node scripts/deployment-config-verifier.js production
```

2. **Test critical functionality:**
```bash
# Test environment loading
node -e "console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗')"

# Test Supabase connectivity
curl -I https://your-project.supabase.co/rest/v1/
```

3. **Check application health:**
   - Visit your deployed application
   - Test user registration (email duplicate checking)
   - Verify authentication flows work
   - Check for any console errors

### Step 6: Monitor and Validate

1. **Set up monitoring:**
```bash
# Add health check endpoint (if not already present)
# This should be done in your application code
```

2. **Enable logging:**
   - Check your platform's logging dashboard
   - Look for environment-related errors
   - Monitor Supabase connection success rates

3. **Create alerts:**
   - Set up alerts for environment configuration failures
   - Monitor application startup errors
   - Track authentication success rates

## Rollback Plan

If the migration encounters issues, you can rollback:

### Immediate Rollback:

1. **Revert environment variables:**
```bash
# For Vercel
vercel env rm VARIABLE_NAME

# For Netlify
netlify env:unset VARIABLE_NAME

# For Docker
# Restore backup files
cp .env.backup .env
cp docker-compose.yml.backup docker-compose.yml
```

2. **Redeploy previous version:**
```bash
# Revert to previous git commit
git revert HEAD
git push origin main

# Or deploy specific commit
vercel --prod --force
```

### Full Rollback:

1. **Restore from backup:**
```bash
# Restore environment variables from backup
# Use the backup files created in Step 1
```

2. **Revert code changes:**
```bash
git reset --hard <previous-commit-hash>
git push --force origin main
```

## Common Migration Issues

### Issue 1: Environment Variables Not Loading

**Symptoms:**
- Application starts but Supabase client fails
- "Environment variable not set" errors

**Solutions:**
1. Check variable names are exactly correct
2. Ensure variables are set in the right environment (production/preview)
3. Redeploy after setting variables
4. Check platform-specific documentation

### Issue 2: Build Failures

**Symptoms:**
- Deployment fails during build
- TypeScript errors about environment variables

**Solutions:**
1. Add environment variable types:
```typescript
// types/environment.d.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_SUPABASE_URL: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
      NEXTAUTH_SECRET: string;
    }
  }
}
```

2. Update build configuration if needed

### Issue 3: Runtime Errors

**Symptoms:**
- Application builds but fails at runtime
- Supabase connection errors

**Solutions:**
1. Verify environment variables are available at runtime
2. Check Supabase project status
3. Test connectivity from deployment environment
4. Review application logs

## Post-Migration Checklist

After successful migration:

- [ ] All environment variables are properly set
- [ ] Application deploys successfully
- [ ] User registration works (email duplicate checking)
- [ ] Authentication flows work correctly
- [ ] No console errors related to environment configuration
- [ ] Monitoring and alerts are configured
- [ ] Documentation is updated
- [ ] Team is informed of changes

## Validation Scripts

Use these scripts to validate your migration:

```bash
# Pre-migration validation
node scripts/validate-deployment-config.js

# Platform-specific verification
node scripts/deployment-config-verifier.js production

# Comprehensive environment check
node scripts/environment-config-checker.js

# Test Supabase connectivity
curl -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     https://your-project.supabase.co/rest/v1/
```

## Getting Help

If you encounter issues during migration:

1. **Check the logs** in your deployment platform
2. **Run validation scripts** to identify specific issues
3. **Review troubleshooting guide** at `docs/ENVIRONMENT_TROUBLESHOOTING.md`
4. **Test locally first** before deploying to production
5. **Use rollback plan** if critical issues occur

## Advanced Migration Scenarios

### Multi-Environment Setup

For complex deployments with multiple environments:

```bash
# Create environment-specific configurations
cp .env.example .env.development
cp .env.example .env.staging  
cp .env.example .env.production

# Validate each environment
node scripts/validate-deployment-config.js development
node scripts/validate-deployment-config.js staging
node scripts/validate-deployment-config.js production

# Test environment switching
NODE_ENV=staging node scripts/comprehensive-config-verifier.js --env=staging
```

### Database Migration Coordination

When migrating with database changes:

```bash
# 1. Backup database
# (Platform-specific backup commands)

# 2. Run database migrations
npx supabase db push

# 3. Update environment configuration
node scripts/validate-deployment-config.js production

# 4. Deploy application
# (Platform-specific deployment)

# 5. Verify database connectivity
node -e "
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
client.from('users').select('count').limit(1).then(console.log);
"
```

### Zero-Downtime Migration

For production systems requiring zero downtime:

```bash
# 1. Deploy to staging with new configuration
vercel --target staging

# 2. Run comprehensive verification on staging
node scripts/comprehensive-config-verifier.js --env=production

# 3. Gradually migrate traffic (if supported by platform)
# Vercel: Use deployment aliases
# Netlify: Use branch deploys

# 4. Monitor health during migration
watch -n 30 'curl -s https://your-app.com/api/health/config | jq'

# 5. Complete migration or rollback based on metrics
```

### Configuration Drift Detection

Prevent configuration drift between environments:

```javascript
// scripts/config-drift-detector.js
const fs = require('fs');

class ConfigDriftDetector {
  static compareEnvironments(env1, env2) {
    const config1 = this.loadConfig(env1);
    const config2 = this.loadConfig(env2);
    
    const differences = [];
    const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)]);
    
    allKeys.forEach(key => {
      if (config1[key] !== config2[key]) {
        differences.push({
          key,
          env1: config1[key] ? 'set' : 'missing',
          env2: config2[key] ? 'set' : 'missing'
        });
      }
    });
    
    return differences;
  }
  
  static loadConfig(environment) {
    const envFile = `.env.${environment}`;
    if (!fs.existsSync(envFile)) return {};
    
    const content = fs.readFileSync(envFile, 'utf8');
    const config = {};
    
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        config[match[1]] = match[2];
      }
    });
    
    return config;
  }
}

// Usage
const differences = ConfigDriftDetector.compareEnvironments('staging', 'production');
if (differences.length > 0) {
  console.log('Configuration drift detected:', differences);
}
```

## Best Practices for Future Deployments

### 1. Configuration Management

```bash
# Use configuration templates
cp .env.example .env.local
# Always update .env.example when adding new variables

# Validate before committing
git add .env.example
node scripts/validate-deployment-config.js
git commit -m "Update environment configuration"
```

### 2. Automated Validation

Add to your CI/CD pipeline:

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
      - run: node scripts/validate-deployment-config.js development
      - run: node scripts/comprehensive-config-verifier.js --env=production
```

### 3. Environment Documentation

```markdown
# docs/ENVIRONMENT_VARIABLES.md
## Required Variables

| Variable | Environment | Description | Example |
|----------|-------------|-------------|---------|
| NEXT_PUBLIC_SUPABASE_URL | All | Supabase project URL | https://abc.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | All | Supabase anon key | eyJhbGciOiJIUzI1... |
| NEXTAUTH_SECRET | Production | NextAuth secret | 32+ character string |

## Environment-Specific Requirements

### Development
- Minimal configuration for local development
- Can use test/demo Supabase project

### Production  
- All security variables required
- Must use production Supabase project
- HTTPS enforced
```

### 4. Monitoring and Alerting

```javascript
// lib/config-monitoring.js
export class ConfigMonitoring {
  static setupHealthChecks() {
    // Check configuration every 5 minutes
    setInterval(async () => {
      const health = await this.checkConfigHealth();
      if (!health.healthy) {
        this.alertConfigIssue(health);
      }
    }, 5 * 60 * 1000);
  }
  
  static async checkConfigHealth() {
    const checks = {
      environmentVars: this.checkEnvironmentVars(),
      supabaseConnectivity: await this.checkSupabaseConnectivity(),
      timestamp: new Date().toISOString()
    };
    
    return {
      healthy: Object.values(checks).every(check => 
        typeof check === 'boolean' ? check : check.success
      ),
      checks
    };
  }
  
  static alertConfigIssue(health) {
    // Send to monitoring service (Sentry, DataDog, etc.)
    console.error('Configuration health check failed:', health);
  }
}
```

### 5. Testing Strategy

```javascript
// __tests__/config/deployment-readiness.test.js
describe('Deployment Readiness', () => {
  test('all required environment variables are set', () => {
    const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    required.forEach(varName => {
      expect(process.env[varName]).toBeDefined();
      expect(process.env[varName].length).toBeGreaterThan(0);
    });
  });
  
  test('supabase connectivity works', async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`);
    expect(response.ok || response.status === 401).toBe(true);
  });
  
  test('configuration passes comprehensive verification', async () => {
    const { ComprehensiveConfigVerifier } = require('../../scripts/comprehensive-config-verifier');
    const verifier = new ComprehensiveConfigVerifier();
    const results = await verifier.runComprehensiveCheck();
    expect(results.ready).toBe(true);
  });
});
```

### 6. Backup and Recovery

```bash
# Create configuration backup script
#!/bin/bash
# scripts/backup-config.sh

BACKUP_DIR="config-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup environment files (without sensitive values)
cp .env.example "$BACKUP_DIR/"

# Backup platform configurations
cp vercel.json "$BACKUP_DIR/" 2>/dev/null || true
cp netlify.toml "$BACKUP_DIR/" 2>/dev/null || true
cp docker-compose.yml "$BACKUP_DIR/" 2>/dev/null || true

# Export environment variable names (not values)
env | grep -E "(NEXT_PUBLIC_|NODE_ENV)" | cut -d= -f1 > "$BACKUP_DIR/env-vars.txt"

echo "Configuration backed up to $BACKUP_DIR"
```

### 7. Security Hardening

```bash
# Security checklist script
#!/bin/bash
# scripts/security-check.sh

echo "🔒 Security Configuration Check"

# Check .gitignore
if ! grep -q ".env" .gitignore; then
  echo "❌ .env files not in .gitignore"
  exit 1
fi

# Check for exposed secrets in code
if grep -r "supabase.*key" src/ --exclude-dir=node_modules; then
  echo "❌ Potential secret exposure in source code"
  exit 1
fi

# Check HTTPS usage
if [[ "$NEXT_PUBLIC_SUPABASE_URL" != https://* ]]; then
  echo "❌ Supabase URL must use HTTPS"
  exit 1
fi

echo "✅ Security checks passed"
```

## Migration Timeline

**Recommended migration schedule:**

1. **Week 1:** Prepare and test locally
2. **Week 2:** Migrate staging/preview environments
3. **Week 3:** Migrate production (during low-traffic period)
4. **Week 4:** Monitor and optimize

**For urgent migrations:**
- Can be completed in 1-2 hours for simple deployments
- Allow 4-6 hours for complex multi-environment setups
- Always have rollback plan ready