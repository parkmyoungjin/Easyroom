# Environment Configuration Troubleshooting Guide

This guide helps you diagnose and fix common environment configuration issues in the application.

## Quick Diagnosis

Run the environment validation script to get an immediate assessment:

```bash
# Check current environment
node scripts/validate-deployment-config.js

# Check specific environment
node scripts/validate-deployment-config.js production

# Comprehensive environment check
node scripts/environment-config-checker.js
```

## Common Issues and Solutions

### 1. "Required environment variable NEXT_PUBLIC_SUPABASE_URL is not set"

**Symptoms:**
- Application fails to start
- Supabase client initialization errors
- Email duplicate checking fails

**Causes:**
- Missing `.env.local` file
- Incorrect environment variable name
- Environment file not loaded properly

**Solutions:**

#### Step 1: Check Environment Files
```bash
# List all environment files
ls -la .env*

# Expected files:
# .env.example (template)
# .env.local (development)
# .env.production (production)
```

#### Step 2: Create Missing Environment File
```bash
# Copy example file
cp .env.example .env.local

# Or create manually
touch .env.local
```

#### Step 3: Add Required Variables
Add these to your `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

#### Step 4: Get Supabase Credentials
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to Settings → API
4. Copy the Project URL and anon/public key

### 2. "Supabase client initialization failed"

**Symptoms:**
- Client returns null or undefined
- Database queries fail
- Authentication doesn't work

**Causes:**
- Invalid Supabase URL format
- Incorrect API keys
- Network connectivity issues
- Supabase project is paused/deleted

**Solutions:**

#### Step 1: Validate URL Format
```bash
# URL should look like this:
https://abcdefghijklmnop.supabase.co
```

#### Step 2: Test Connectivity
```bash
# Test if Supabase endpoint is reachable
curl -I https://your-project.supabase.co/rest/v1/

# Should return HTTP 200 or 401 (both are good)
```

#### Step 3: Verify API Keys
```bash
# Check key length (should be ~100+ characters)
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY | wc -c

# Test API key
curl -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     https://your-project.supabase.co/rest/v1/
```

#### Step 4: Check Project Status
1. Go to Supabase Dashboard
2. Ensure project is active (not paused)
3. Check project settings for any issues

### 3. "Environment variables not loading in production"

**Symptoms:**
- Works locally but fails in deployment
- Environment variables are undefined in production
- Build succeeds but runtime fails

**Causes:**
- Platform-specific environment variable setup
- Build-time vs runtime variable confusion
- Incorrect deployment configuration

**Solutions:**

#### For Vercel:
1. Go to Project Settings → Environment Variables
2. Add all required variables
3. Set appropriate environments (Production, Preview, Development)
4. Redeploy the application

#### For Netlify:
1. Go to Site Settings → Environment Variables
2. Add variables in key-value format
3. Ensure variables are available at build time if needed

#### For Docker/Self-hosted:
```dockerfile
# In Dockerfile
ENV NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key

# Or use docker-compose.yml
environment:
  - NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  - NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

### 4. "Email duplicate checking fails"

**Symptoms:**
- Signup form shows generic errors
- Email validation doesn't work
- Users can register with duplicate emails

**Causes:**
- Supabase client not initialized
- Database connection issues
- RLS (Row Level Security) policies blocking access

**Solutions:**

#### Step 1: Test Supabase Connection
```javascript
// Test in browser console or Node.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Test query
const { data, error } = await supabase
  .from('auth.users')
  .select('email')
  .limit(1)

console.log({ data, error })
```

#### Step 2: Check Database Policies
```sql
-- Check if policies allow reading user emails
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Create policy if needed (run in Supabase SQL editor)
CREATE POLICY "Allow email checking" ON auth.users
FOR SELECT USING (true);
```

#### Step 3: Verify Table Structure
```sql
-- Check if users table exists and has email column
\d auth.users;

-- Or check in Supabase dashboard under Authentication → Users
```

### 5. "NEXTAUTH_SECRET is missing in production"

**Symptoms:**
- Authentication fails in production
- Session handling errors
- NextAuth.js warnings/errors

**Causes:**
- Missing NEXTAUTH_SECRET environment variable
- Weak or short secret
- Secret not set in production environment

**Solutions:**

#### Step 1: Generate Strong Secret
```bash
# Generate a secure random secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Step 2: Add to Environment
```env
# Add to .env.local (development)
NEXTAUTH_SECRET=your-generated-secret-here

# Add to production environment variables
```

#### Step 3: Verify Length
```bash
# Secret should be at least 32 characters
echo $NEXTAUTH_SECRET | wc -c
```

## Environment-Specific Troubleshooting

### Development Environment

**Common Issues:**
- Hot reload not working with environment changes
- Environment variables cached

**Solutions:**
```bash
# Restart development server after env changes
npm run dev

# Clear Next.js cache
rm -rf .next

# Verify environment loading
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

### Test Environment

**Common Issues:**
- Test database not configured
- Environment isolation problems

**Solutions:**
```bash
# Use separate test environment file
cp .env.local .env.test

# Set NODE_ENV for tests
NODE_ENV=test npm test

# Use test-specific Supabase project
```

### Production Environment

**Common Issues:**
- Build-time vs runtime variables
- Platform-specific configuration

**Solutions:**
```bash
# Test production build locally
npm run build
npm start

# Check environment in production build
NODE_ENV=production node -e "console.log(process.env)"
```

## Debugging Tools

### 1. Environment Variable Inspector
```javascript
// Add to your app for debugging (remove in production)
console.log('Environment Variables:', {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing',
  SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing',
  NODE_ENV: process.env.NODE_ENV,
  // Don't log actual values in production!
});
```

### 2. Supabase Connection Test
```javascript
// Test Supabase connection
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    console.log('Supabase connection:', error ? 'Failed' : 'Success');
    return !error;
  } catch (err) {
    console.error('Supabase test failed:', err.message);
    return false;
  }
}
```

### 3. Environment Validation Script
```bash
# Run comprehensive validation
node scripts/validate-deployment-config.js

# Check specific environment
node scripts/validate-deployment-config.js production

# Get detailed environment report
node scripts/environment-config-checker.js
```

## Prevention Best Practices

### 1. Use Environment Templates
```bash
# Always maintain .env.example
cp .env.local .env.example
# Remove sensitive values from .env.example
```

### 2. Validate on Startup
```javascript
// Add to your app startup
import { validateEnvironment } from './lib/environment-validator';

if (!validateEnvironment()) {
  throw new Error('Environment validation failed');
}
```

### 3. Use TypeScript for Environment
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

### 4. Implement Health Checks
```javascript
// pages/api/health.js
export default async function handler(req, res) {
  const checks = {
    environment: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase: await testSupabaseConnection(),
  };
  
  const healthy = Object.values(checks).every(Boolean);
  
  res.status(healthy ? 200 : 500).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks
  });
}
```

## Advanced Troubleshooting

### Platform-Specific Issues

#### Vercel Deployment Issues

**Issue: Environment variables work locally but not on Vercel**
```bash
# Check Vercel environment variables
vercel env ls

# Pull Vercel environment to local
vercel env pull .env.vercel

# Compare with local environment
diff .env.local .env.vercel
```

**Issue: Build succeeds but runtime fails**
```bash
# Check Vercel function logs
vercel logs

# Test with Vercel CLI locally
vercel dev
```

#### Netlify Deployment Issues

**Issue: Environment variables not available during build**
```bash
# Check Netlify environment variables
netlify env:list

# Test build locally with Netlify CLI
netlify build

# Check build logs
netlify open --site
```

#### Docker Deployment Issues

**Issue: Environment variables not passed to container**
```dockerfile
# Ensure ARG and ENV are properly set
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL

# Check container environment
docker exec -it container_name env | grep SUPABASE
```

### Database Connection Issues

#### RLS (Row Level Security) Problems

**Issue: Email checking fails with permission errors**
```sql
-- Check current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users';

-- Create policy for email checking
CREATE POLICY "Allow email checking" ON auth.users
FOR SELECT USING (true);

-- Or more restrictive policy
CREATE POLICY "Allow email checking" ON auth.users
FOR SELECT USING (auth.role() = 'anon');
```

#### Connection Pool Issues

**Issue: Too many connections or connection timeouts**
```javascript
// Check Supabase connection settings
const supabase = createClient(url, key, {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: { 'x-my-custom-header': 'my-app-name' },
  },
})

// Test connection with timeout
const testConnection = async () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    return { success: !error, error };
  } catch (err) {
    clearTimeout(timeoutId);
    return { success: false, error: err.message };
  }
};
```

### Performance Troubleshooting

#### Slow Environment Variable Loading

**Issue: Application startup is slow**
```javascript
// Optimize environment loading
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

// Cache validation results
let envValidationCache = null;

function validateEnvironmentCached() {
  if (envValidationCache === null) {
    envValidationCache = requiredEnvVars.every(varName => 
      process.env[varName] && process.env[varName].length > 0
    );
  }
  return envValidationCache;
}
```

#### Memory Usage Issues

**Issue: High memory usage in production**
```javascript
// Monitor environment variable usage
console.log('Environment variables count:', Object.keys(process.env).length);
console.log('Memory usage:', process.memoryUsage());

// Clean up unused environment variables
const cleanEnv = {};
const requiredVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
requiredVars.forEach(key => {
  if (process.env[key]) {
    cleanEnv[key] = process.env[key];
  }
});
```

### Security Troubleshooting

#### API Key Exposure

**Issue: API keys visible in client-side code**
```bash
# Check for exposed secrets in build
grep -r "supabase" .next/static/ || echo "No secrets found in static files"

# Verify environment variable prefixes
env | grep NEXT_PUBLIC_ | wc -l
```

#### CORS Issues

**Issue: Cross-origin requests blocked**
```javascript
// Check Supabase CORS settings
const testCORS = async () => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'apikey'
      }
    });
    
    console.log('CORS headers:', response.headers);
    return response.ok;
  } catch (error) {
    console.error('CORS test failed:', error);
    return false;
  }
};
```

## Automated Troubleshooting

### Diagnostic Scripts

Run comprehensive diagnostics:
```bash
# Full system check
node scripts/comprehensive-config-verifier.js

# Environment-specific check
node scripts/comprehensive-config-verifier.js --env=production

# Export results for analysis
node scripts/comprehensive-config-verifier.js --export

# Verbose output
node scripts/comprehensive-config-verifier.js --verbose
```

### Health Check Endpoint

Add to your application:
```javascript
// pages/api/health/config.js
export default async function handler(req, res) {
  const checks = {
    environment: {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV
    },
    connectivity: await testSupabaseConnection(),
    timestamp: new Date().toISOString()
  };
  
  const healthy = checks.environment.supabaseUrl && 
                  checks.environment.supabaseKey && 
                  checks.connectivity;
  
  res.status(healthy ? 200 : 500).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks
  });
}
```

### Monitoring Setup

```javascript
// lib/monitoring/config-monitor.js
export class ConfigMonitor {
  static checkEnvironment() {
    const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('Missing environment variables:', missing);
      // Send to monitoring service
      this.reportError('missing_env_vars', { missing });
    }
    
    return missing.length === 0;
  }
  
  static async testConnectivity() {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`);
      const success = response.ok || response.status === 401;
      
      if (!success) {
        this.reportError('connectivity_failed', { status: response.status });
      }
      
      return success;
    } catch (error) {
      this.reportError('connectivity_error', { error: error.message });
      return false;
    }
  }
  
  static reportError(type, details) {
    // Implement your monitoring/alerting logic here
    console.error(`Config Monitor: ${type}`, details);
  }
}
```

## Getting Help

If you're still experiencing issues after following this guide:

1. **Run comprehensive diagnostics**: `node scripts/comprehensive-config-verifier.js --verbose`
2. **Check platform-specific logs**: Review your deployment platform's logs
3. **Test connectivity**: Use the provided connectivity test scripts
4. **Verify security settings**: Ensure RLS policies and CORS are properly configured
5. **Monitor performance**: Check for memory leaks or slow startup times
6. **Export configuration**: Use `--export` flag to save diagnostic results
7. **Check documentation**: Review platform-specific deployment guides
8. **Seek support**: Contact your team with diagnostic results and error logs

### Emergency Recovery Checklist

```bash
# 1. Backup current state
cp .env.local .env.backup
git stash push -m "backup current config"

# 2. Reset to known good state
cp .env.example .env.local
# Edit .env.local with correct values

# 3. Validate configuration
node scripts/validate-deployment-config.js

# 4. Test locally
npm run dev

# 5. Deploy with verification
node scripts/deployment-config-verifier.js production
# Deploy to platform

# 6. Verify deployment
curl -f https://your-app.com/api/health/config
```

## Quick Reference

### Required Environment Variables
```env
# Always required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Production only
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXTAUTH_SECRET=your-32-char-secret

# Optional
NODE_ENV=development|test|production
```

### Validation Commands
```bash
# Quick validation
node scripts/validate-deployment-config.js

# Comprehensive check
node scripts/environment-config-checker.js

# Environment-specific validation
node scripts/validate-deployment-config.js production
```

### Emergency Recovery
```bash
# Reset environment configuration
cp .env.example .env.local
# Edit .env.local with correct values
# Restart application
npm run dev
```