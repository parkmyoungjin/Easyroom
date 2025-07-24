# Automated Report Generation System

## Overview

The Automated Report Generation System provides comprehensive security and performance monitoring with automated report generation, alert notifications, and scheduled monitoring tasks.

## Features

### 1. Automated Report Generation
- **Security Metrics**: Authentication logs, failed logins, permission violations, security scores
- **Performance Metrics**: API response times, database performance, system resource usage
- **System Metrics**: Memory usage, uptime, platform information
- **Alert Processing**: Automatic alert generation based on configurable thresholds

### 2. Report Formats
- **HTML Reports**: Interactive web-based reports with charts and visualizations
- **JSON Reports**: Machine-readable data for integration with other systems
- **Alert Summaries**: Detailed alert information with recommendations

### 3. Scheduling and Automation
- **Daily Reports**: Automated generation at 3 AM UTC
- **Weekly Deep Scans**: Comprehensive security and performance analysis
- **Monthly Audits**: Full system audit with cleanup of old reports

### 4. Alert Notification System
- **Slack Integration**: Real-time notifications to Slack channels
- **GitHub Issues**: Automatic issue creation for critical alerts
- **Configurable Thresholds**: Customizable alert levels and criteria

## Components

### Core Scripts

#### 1. `scripts/automated-report-generator.js`
Main report generation script that collects metrics and generates reports.

```bash
# Generate a report manually
npm run report:generate

# Or run directly
node scripts/automated-report-generator.js
```

#### 2. `scripts/daily-integrity-scheduler.js`
Scheduler for automated report generation and monitoring tasks.

```bash
# Start the scheduler (runs continuously)
npm run report:schedule

# Trigger daily report manually
npm run report:daily

# Trigger weekly scan manually
npm run report:weekly
```

#### 3. `scripts/alert-notification-system.js`
Processes reports and sends notifications based on alert thresholds.

```bash
# Process alerts from a report file
npm run alerts:process ci-reports/security-performance-report-123456.json

# View alert history
npm run alerts:history

# Get alert statistics
npm run alerts:stats
```

### API Endpoints

#### 1. Generate Report
```
POST /api/monitoring/generate-report
```

Request body:
```json
{
  "reportType": "security-performance",
  "includeAlerts": true,
  "includeTrends": true
}
```

#### 2. Serve Reports
```
GET /api/monitoring/reports/{filename}
```

Serves generated HTML and JSON reports.

#### 3. Delete Reports
```
DELETE /api/monitoring/reports/{filename}
```

Removes old or unwanted report files.

## Configuration

### Environment Variables

```bash
# Required for database access
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional for notifications
SLACK_WEBHOOK_URL=your_slack_webhook_url
GITHUB_TOKEN=your_github_token
```

### Alert Thresholds

Default thresholds can be configured in `scripts/alert-notification-system.js`:

```javascript
thresholds: {
  security: {
    critical: 60,  // Security score below 60 triggers critical alert
    warning: 80    // Security score below 80 triggers warning
  },
  performance: {
    critical: 60,  // Performance score below 60 triggers critical alert
    warning: 80    // Performance score below 80 triggers warning
  },
  failedLogins: {
    critical: 20,  // More than 20 failed logins triggers critical alert
    warning: 10    // More than 10 failed logins triggers warning
  },
  responseTime: {
    critical: 500, // Response time above 500ms triggers critical alert
    warning: 300   // Response time above 300ms triggers warning
  }
}
```

### Scheduling Configuration

Modify schedules in `scripts/daily-integrity-scheduler.js`:

```javascript
schedules: {
  dailyReport: '0 3 * * *',      // 3 AM daily
  weeklyDeepScan: '0 4 * * 0',   // 4 AM every Sunday
  monthlyAudit: '0 5 1 * *'      // 5 AM first day of month
}
```

## Usage

### Manual Report Generation

1. **From Command Line**:
   ```bash
   npm run report:generate
   ```

2. **From Monitoring Dashboard**:
   - Navigate to the monitoring dashboard
   - Click "Generate Report" button
   - Report will be automatically downloaded

3. **Via API**:
   ```bash
   curl -X POST http://localhost:3000/api/monitoring/generate-report \
     -H "Content-Type: application/json" \
     -d '{"reportType": "security-performance"}'
   ```

### Automated Scheduling

1. **Start the Scheduler**:
   ```bash
   npm run report:schedule
   ```

2. **Run as Background Service** (Linux/macOS):
   ```bash
   nohup npm run report:schedule > scheduler.log 2>&1 &
   ```

3. **Docker Deployment**:
   ```dockerfile
   # Add to your Dockerfile
   CMD ["npm", "run", "report:schedule"]
   ```

### CI/CD Integration

The system is integrated into the CI/CD pipeline in `.github/workflows/data-integrity-pipeline.yml`:

- **Automated Report Generation**: Runs after deployment validation
- **Alert Processing**: Processes reports and sends notifications
- **Artifact Upload**: Stores reports as workflow artifacts

## Report Structure

### HTML Report Sections

1. **Header**: Timestamp, overall status, navigation
2. **Security Metrics**: Authentication stats, security score, violations
3. **Performance Metrics**: Response times, throughput, system resources
4. **System Metrics**: Memory usage, uptime, platform info
5. **API Endpoint Performance**: Detailed endpoint statistics
6. **Alerts and Recommendations**: Action items and suggestions

### JSON Report Structure

```json
{
  "timestamp": "2025-01-23T10:30:00.000Z",
  "security": {
    "securityScore": 85,
    "failedLogins": 3,
    "successfulLogins": 127,
    "activeUsers": 45,
    "permissionViolations": 0
  },
  "performance": {
    "performanceScore": 92,
    "api": {
      "averageResponseTime": 145,
      "requestsPerMinute": 850,
      "errorRate": 0.012
    },
    "database": {
      "queryResponseTime": 67,
      "reservationsCount": 23,
      "roomsCount": 15
    }
  },
  "system": {
    "uptime": 86400,
    "memory": {
      "used": 256,
      "total": 512
    },
    "nodeVersion": "v18.17.0",
    "platform": "linux"
  }
}
```

## Monitoring and Maintenance

### Log Files

- **Scheduler Logs**: `ci-reports/scheduler-logs/`
- **Health Status**: `ci-reports/scheduler-logs/health-status.json`
- **Alert History**: `ci-reports/alert-history.json`

### Cleanup

Old reports are automatically cleaned up:
- **HTML Reports**: Deleted after 30 days
- **JSON Reports**: Kept for 90 days
- **Alert History**: Limited to 1000 entries

### Health Checks

The scheduler performs health checks every 5 minutes:
- Memory usage monitoring
- Process uptime tracking
- Job status verification

## Troubleshooting

### Common Issues

1. **Report Generation Fails**:
   ```bash
   # Check environment variables
   npm run check-env
   
   # Test database connection
   npm run test-connection
   
   # Check logs
   tail -f ci-reports/scheduler-logs/*.log
   ```

2. **Alerts Not Sending**:
   ```bash
   # Verify Slack webhook
   curl -X POST $SLACK_WEBHOOK_URL -d '{"text": "Test message"}'
   
   # Check alert configuration
   node scripts/alert-notification-system.js stats
   ```

3. **Scheduler Not Running**:
   ```bash
   # Check process
   ps aux | grep daily-integrity-scheduler
   
   # Check health status
   cat ci-reports/scheduler-logs/health-status.json
   ```

### Debug Mode

Enable debug logging:
```bash
DEBUG=true npm run report:generate
```

## Security Considerations

1. **Report Access**: Reports may contain sensitive information
2. **API Authentication**: Consider adding authentication to report endpoints
3. **File Permissions**: Ensure proper permissions on report directories
4. **Data Retention**: Configure appropriate retention policies

## Integration Examples

### Slack Bot Integration

```javascript
// Custom Slack bot for report requests
app.command('/generate-report', async ({ command, ack, respond }) => {
  await ack();
  
  const response = await fetch('/api/monitoring/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportType: 'security-performance' })
  });
  
  const result = await response.json();
  await respond(`Report generated: ${result.reportUrl}`);
});
```

### Grafana Dashboard

```javascript
// Custom Grafana data source
const reportData = await fetch('/api/monitoring/reports/latest.json');
const metrics = await reportData.json();

// Display metrics in Grafana panels
```

## Future Enhancements

1. **Custom Report Templates**: User-defined report layouts
2. **Real-time Streaming**: WebSocket-based live metrics
3. **Machine Learning**: Anomaly detection and predictive alerts
4. **Multi-tenant Support**: Organization-specific reports
5. **Export Formats**: PDF, CSV, Excel export options

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review log files in `ci-reports/scheduler-logs/`
3. Run diagnostic commands
4. Create GitHub issues for bugs or feature requests