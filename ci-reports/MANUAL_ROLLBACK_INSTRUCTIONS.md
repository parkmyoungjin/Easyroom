# Manual Rollback Instructions

## Rollback Trigger Information
- **Timestamp:** 2025-07-22T22:58:54.503Z
- **Stage:** pre_deployment
- **Environment:** development
- **Reason:** Critical issues exceed threshold: 1 > 0
- **Critical Issues:** 1
- **Error Issues:** 3

## Recommended Actions

### 1. Assess the Situation
- Review the detailed data integrity reports in `ci-reports/`
- Determine the scope and impact of the issues
- Decide if immediate rollback is necessary

### 2. If Rollback is Required

#### Option A: Automated Rollback
```bash
# Execute immediate rollback
node scripts/rollback-trigger.js immediate

# Or execute graceful rollback
node scripts/rollback-trigger.js graceful
```

#### Option B: Manual Rollback Steps
1. **Enable maintenance mode:**
   ```bash
   echo '{"enabled": true, "message": "Maintenance in progress"}' > public/maintenance.json
   ```

2. **Revert to last stable commit:**
   ```bash
   git log --oneline -10  # Find last stable commit
   git revert <commit-hash> --no-edit
   ```

3. **Restore database (if needed):**
   ```bash
   # Run your database restore procedure
   npm run db:restore
   ```

4. **Restart services:**
   ```bash
   npm run restart
   ```

5. **Verify system health:**
   ```bash
   node scripts/ci-data-integrity-pipeline.js rollback_check
   ```

6. **Disable maintenance mode:**
   ```bash
   rm public/maintenance.json
   ```

### 3. Post-Rollback Actions
- Run full data integrity validation
- Investigate root cause of issues
- Implement fixes before next deployment
- Update monitoring and alerting if needed

## Emergency Contacts
- DevOps Team: [Contact Information]
- Database Administrator: [Contact Information]
- System Administrator: [Contact Information]

---
Generated: 2025-07-22T22:58:54.798Z
