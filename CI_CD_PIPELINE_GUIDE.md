# CI/CD Pipeline with Safety Checks

This document describes the comprehensive CI/CD pipeline implemented for the application, featuring automated validation stages, database migration application, deployment notifications, and continuous monitoring systems.

## Overview

The CI/CD pipeline provides a robust, multi-stage deployment process with mandatory safety checks to ensure code quality, data integrity, and system security before and after deployments.

## Pipeline Stages

### 1. Code Quality & Security Validation
- **ESLint** with security rules
- **TypeScript** type checking
- **Security audit** (npm audit)
- **Environment variable leak detection**
- **API route security pattern validation**

### 2. Comprehensive Testing Suite
- **Unit tests** with coverage requirements
- **Infrastructure tests**
- **Data integrity tests**
- **Security and performance tests**
- **API validation tests**
- **Performance benchmark tests**

### 3. Database Migration Validation
- **Migration syntax validation**
- **Migration dependency checking**
- **Dry run migrations** (staging)
- **Migration backup point creation**

### 4. Data Integrity Validation
- **Comprehensive data integrity analysis**
- **Automated consistency checks**
- **Legacy validation reports**
- **Rollback trigger evaluation**

### 5. Database Migration Application
- **Pre-migration backup creation**
- **Supabase project linking**
- **Migration status checking**
- **Automated migration application**
- **Post-migration integrity verification**
- **Migration metadata updates**

### 6. Deployment Notification
- **Deployment status determination**
- **GitHub issue creation**
- **Slack notifications** (if configured)
- **Deployment information generation**

### 7. Post-Deployment Validation & Monitoring
- **Post-deployment integrity checks**
- **System health verification**
- **Performance validation**

### 8. Continuous Monitoring Setup
- **Monitoring configuration creation**
- **Scheduled monitoring jobs**
- **Dashboard data generation**

## Triggers

The pipeline is triggered by:

- **Push to main/develop branches**: Full pipeline execution
- **Pull requests to main**: Validation stages only
- **Scheduled runs**: Daily integrity checks at 2 AM UTC
- **Manual dispatch**: Configurable stage execution

## Configuration

### Required Secrets

Add these secrets to your GitHub repository:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ACCESS_TOKEN=your_supabase_access_token
SUPABASE_PROJECT_ID=your_project_id
SLACK_WEBHOOK_URL=your_slack_webhook_url (optional)
```

### Environment Variables

The pipeline supports these input parameters:

- `stage`: Pipeline stage to run (pre_deployment, post_deployment, rollback_check, scheduled_check)
- `environment`: Target environment (production, staging, development)
- `skip_migration`: Skip database migration (true/false)

## Usage

### Automatic Deployment

1. **Push to main branch**: Triggers full deployment pipeline
2. **Create pull request**: Triggers validation stages only
3. **Scheduled runs**: Automatic daily integrity checks

### Manual Execution

Use GitHub Actions workflow dispatch:

```bash
# Run specific stage
gh workflow run "CI/CD Pipeline with Safety Checks" \
  --field stage=pre_deployment \
  --field environment=staging

# Skip migrations
gh workflow run "CI/CD Pipeline with Safety Checks" \
  --field skip_migration=true
```

### Local Testing

Test pipeline components locally:

```bash
# Run data integrity pipeline
npm run integrity:pre-deploy

# Validate migration syntax
npm run migration:validate-syntax

# Check deployment readiness
npm run migration:deployment-readiness

# Run monitoring checks
npm run monitor:all
```

## Safety Checks

### Mandatory Gates

The pipeline includes these mandatory safety checks:

1. **Code Quality Gate**: All linting and type checking must pass
2. **Test Coverage Gate**: Minimum 80% coverage required
3. **Migration Validation Gate**: All migrations must pass syntax validation
4. **Data Integrity Gate**: Zero critical issues allowed
5. **Security Validation Gate**: No security vulnerabilities allowed

### Rollback Triggers

Automatic rollback is triggered when:

- **Critical data integrity issues** detected
- **Migration failures** occur
- **Post-deployment validation** fails
- **Security vulnerabilities** found

### Thresholds

Default thresholds (configurable):

```json
{
  "maxCriticalIssues": 0,
  "maxErrorIssues": 0,
  "maxWarningIssues": 5,
  "testCoverageThreshold": 80,
  "performanceDegradationThreshold": 20
}
```

## Monitoring & Alerting

### Continuous Monitoring

The pipeline sets up continuous monitoring with:

- **Daily integrity checks** at 2:00 AM UTC
- **Weekly performance checks** on Sundays at 3:00 AM UTC
- **Monthly security audits** on the 1st at 4:00 AM UTC

### Notification Channels

Alerts are sent via:

- **GitHub Issues**: Automatic issue creation for failures
- **Slack**: Real-time notifications (if webhook configured)
- **Dashboard**: Web-based monitoring dashboard

### Monitoring Scripts

Available monitoring commands:

```bash
# Health monitoring
npm run monitor:health

# Performance monitoring
npm run monitor:performance

# Security auditing
npm run monitor:security

# Complete monitoring suite
npm run monitor:all
```

## Migration Management

### Migration Validation

```bash
# Validate migration syntax
npm run migration:validate-syntax

# Check deployment readiness
npm run migration:deployment-readiness

# Create deployment backup
npm run migration:create-backup
```

### Migration Metadata

The pipeline automatically tracks:

- **Deployment history**
- **Migration application status**
- **Rollback points**
- **Performance metrics**

### Backup Strategy

Automatic backups are created:

- **Before migrations**: Pre-migration state
- **After deployments**: Post-deployment state
- **On failures**: Rollback points

## Troubleshooting

### Common Issues

1. **Migration Validation Failures**
   ```bash
   # Check migration syntax
   npm run migration:validate-syntax
   
   # Validate dependencies
   node scripts/migration-manager.js conflicts
   ```

2. **Data Integrity Issues**
   ```bash
   # Run integrity check
   npm run integrity:pre-deploy
   
   # Check specific issues
   node scripts/data-integrity-validation.js
   ```

3. **Test Coverage Issues**
   ```bash
   # Run tests with coverage
   npm run test:coverage
   
   # Check coverage report
   open coverage/index.html
   ```

### Pipeline Debugging

View pipeline logs:

1. Go to **Actions** tab in GitHub
2. Select the failed workflow run
3. Expand the failed step
4. Review logs and artifacts

### Rollback Procedures

If rollback is required:

```bash
# Check rollback status
npm run rollback:check

# Trigger immediate rollback
npm run rollback:immediate

# Graceful rollback
npm run rollback:graceful
```

## Best Practices

### Development Workflow

1. **Create feature branch** from develop
2. **Write tests** for new functionality
3. **Run local validation** before pushing
4. **Create pull request** to trigger validation
5. **Address any issues** found by pipeline
6. **Merge to develop** for staging deployment
7. **Merge to main** for production deployment

### Migration Best Practices

1. **Test migrations** in development first
2. **Use descriptive names** for migration files
3. **Add proper comments** and documentation
4. **Consider rollback scenarios**
5. **Test with realistic data volumes**

### Monitoring Best Practices

1. **Review daily reports** from scheduled checks
2. **Set up Slack notifications** for immediate alerts
3. **Monitor dashboard** for trends
4. **Address warnings** before they become critical
5. **Keep backup retention** policies updated

## Security Considerations

### Environment Variables

- **Never commit** secrets to repository
- **Use GitHub Secrets** for sensitive data
- **Rotate keys** regularly
- **Monitor access** to secrets

### Database Security

- **Use service role keys** with minimal permissions
- **Enable RLS** on all tables
- **Audit database access** regularly
- **Monitor for suspicious activity**

### Pipeline Security

- **Restrict workflow permissions**
- **Use pinned action versions**
- **Audit pipeline changes**
- **Monitor for unauthorized access**

## Performance Optimization

### Pipeline Performance

- **Parallel job execution** where possible
- **Cached dependencies** for faster builds
- **Optimized test suites** for speed
- **Efficient artifact handling**

### Application Performance

- **Performance benchmarks** in tests
- **Monitoring thresholds** for degradation
- **Database query optimization**
- **Resource usage tracking**

## Support

### Getting Help

1. **Check this documentation** first
2. **Review pipeline logs** in GitHub Actions
3. **Check monitoring dashboard** for system status
4. **Create GitHub issue** for bugs or feature requests

### Maintenance

The pipeline requires periodic maintenance:

- **Update dependencies** monthly
- **Review and adjust thresholds** quarterly
- **Clean up old artifacts** regularly
- **Update documentation** as needed

---

For more information about specific components, see:

- [Data Integrity Pipeline Guide](DATA_INTEGRITY_PIPELINE_GUIDE.md)
- [Database Migration Guide](DATABASE_MIGRATION_GUIDE.md)
- [Deployment Security Guide](DEPLOYMENT_SECURITY.md)