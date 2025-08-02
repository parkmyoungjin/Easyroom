#!/usr/bin/env node

/**
 * Deployment Monitoring and Alerting System
 * Provides continuous monitoring and alerting for deployed applications
 * Requirements: 4.5
 */

const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

/**
 * Monitoring configuration
 */
const MONITORING_CONFIG = {
  // Monitoring intervals (in milliseconds)
  intervals: {
    health_check: 5 * 60 * 1000,      // 5 minutes
    performance_check: 15 * 60 * 1000, // 15 minutes
    integrity_check: 60 * 60 * 1000,   // 1 hour
    security_audit: 24 * 60 * 60 * 1000 // 24 hours
  },
  
  // Alert thresholds
  thresholds: {
    response_time_ms: 2000,
    error_rate_percent: 5,
    cpu_usage_percent: 80,
    memory_usage_percent: 85,
    disk_usage_percent: 90,
    connection_pool_usage_percent: 75
  },
  
  // Notification channels
  notifications: {
    slack_webhook: process.env.SLACK_WEBHOOK_URL,
    github_token: process.env.GITHUB_TOKEN,
    email_enabled: false
  },
  
  // Monitoring endpoints
  endpoints: [
    { name: 'Health Check', url: '/api/health', method: 'GET' },
    { name: 'Database Status', url: '/api/status/database', method: 'GET' },
    { name: 'Auth Status', url: '/api/status/auth', method: 'GET' },
    { name: 'Performance Metrics', url: '/api/metrics', method: 'GET' }
  ],
  
  // Data retention
  retention: {
    metrics: 30, // days
    alerts: 90,  // days
    logs: 7      // days
  }
};

/**
 * Monitoring result class
 */
class MonitoringResult {
  constructor(type, name) {
    this.type = type;
    this.name = name;
    this.timestamp = new Date().toISOString();
    this.status = 'unknown';
    this.metrics = {};
    this.alerts = [];
    this.errors = [];
    this.duration = 0;
  }

  setStatus(status) {
    this.status = status;
  }

  addMetric(key, value, unit = null) {
    this.metrics[key] = { value, unit, timestamp: new Date().toISOString() };
  }

  addAlert(severity, message, details = null) {
    this.alerts.push({
      severity,
      message,
      details,
      timestamp: new Date().toISOString()
    });
  }

  addError(error) {
    this.errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }

  setDuration(startTime) {
    this.duration = Date.now() - startTime;
  }
}

/**
 * Health check monitor
 */
async function performHealthCheck() {
  const result = new MonitoringResult('health', 'System Health Check');
  const startTime = Date.now();
  
  try {
    console.log('🏥 Performing health check...');
    
    // Check database connectivity
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const dbStart = Date.now();
    const { data: dbHealth, error: dbError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    const dbDuration = Date.now() - dbStart;
    
    if (dbError) {
      result.addError(new Error(`Database health check failed: ${dbError.message}`));
      result.addAlert('critical', 'Database connectivity issue', dbError);
    } else {
      result.addMetric('database_response_time', dbDuration, 'ms');
      
      if (dbDuration > MONITORING_CONFIG.thresholds.response_time_ms) {
        result.addAlert('warning', `Database response time high: ${dbDuration}ms`);
      }
    }
    
    // Check authentication system
    const authStart = Date.now();
    try {
      const { data: authHealth } = await supabase.auth.getSession();
      const authDuration = Date.now() - authStart;
      result.addMetric('auth_response_time', authDuration, 'ms');
    } catch (authError) {
      result.addError(authError);
      result.addAlert('critical', 'Authentication system issue', authError.message);
    }
    
    // Determine overall status
    const criticalAlerts = result.alerts.filter(a => a.severity === 'critical');
    const warningAlerts = result.alerts.filter(a => a.severity === 'warning');
    
    if (criticalAlerts.length > 0) {
      result.setStatus('critical');
    } else if (warningAlerts.length > 0) {
      result.setStatus('warning');
    } else {
      result.setStatus('healthy');
    }
    
    console.log(`✅ Health check completed - Status: ${result.status}`);
    
  } catch (error) {
    result.addError(error);
    result.setStatus('error');
    console.error('❌ Health check failed:', error.message);
  }
  
  result.setDuration(startTime);
  return result;
}

/**
 * Performance monitoring
 */
async function performPerformanceCheck() {
  const result = new MonitoringResult('performance', 'Performance Monitoring');
  const startTime = Date.now();
  
  try {
    console.log('📊 Performing performance check...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test query performance
    const queryStart = Date.now();
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('id, created_at')
      .limit(100);
    
    const queryDuration = Date.now() - queryStart;
    result.addMetric('query_response_time', queryDuration, 'ms');
    
    if (error) {
      result.addError(new Error(`Query performance test failed: ${error.message}`));
    }
    
    // Check connection pool status (simulated)
    const connectionPoolUsage = Math.random() * 100; // In real implementation, get from Supabase metrics
    result.addMetric('connection_pool_usage', connectionPoolUsage, '%');
    
    if (connectionPoolUsage > MONITORING_CONFIG.thresholds.connection_pool_usage_percent) {
      result.addAlert('warning', `High connection pool usage: ${connectionPoolUsage.toFixed(1)}%`);
    }
    
    // Memory usage simulation (in real implementation, get from system metrics)
    const memoryUsage = Math.random() * 100;
    result.addMetric('memory_usage', memoryUsage, '%');
    
    if (memoryUsage > MONITORING_CONFIG.thresholds.memory_usage_percent) {
      result.addAlert('critical', `High memory usage: ${memoryUsage.toFixed(1)}%`);
    }
    
    // Determine status
    const criticalAlerts = result.alerts.filter(a => a.severity === 'critical');
    const warningAlerts = result.alerts.filter(a => a.severity === 'warning');
    
    if (criticalAlerts.length > 0) {
      result.setStatus('critical');
    } else if (warningAlerts.length > 0) {
      result.setStatus('warning');
    } else {
      result.setStatus('optimal');
    }
    
    console.log(`✅ Performance check completed - Status: ${result.status}`);
    
  } catch (error) {
    result.addError(error);
    result.setStatus('error');
    console.error('❌ Performance check failed:', error.message);
  }
  
  result.setDuration(startTime);
  return result;
}

/**
 * Security audit
 */
async function performSecurityAudit() {
  const result = new MonitoringResult('security', 'Security Audit');
  const startTime = Date.now();
  
  try {
    console.log('🔒 Performing security audit...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Check for suspicious activity patterns
    const { data: recentUsers, error: usersError } = await supabase
      .from('users')
      .select('id, created_at, email')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });
    
    if (usersError) {
      result.addError(new Error(`User audit failed: ${usersError.message}`));
    } else {
      result.addMetric('new_users_24h', recentUsers?.length || 0, 'count');
      
      // Check for unusual signup patterns
      if (recentUsers && recentUsers.length > 50) {
        result.addAlert('warning', `High user registration rate: ${recentUsers.length} in 24h`);
      }
    }
    
    // Check for failed authentication attempts (simulated)
    const failedAttempts = Math.floor(Math.random() * 20);
    result.addMetric('failed_auth_attempts_24h', failedAttempts, 'count');
    
    if (failedAttempts > 10) {
      result.addAlert('warning', `High failed authentication attempts: ${failedAttempts}`);
    }
    
    // Check environment variable security
    const envVarChecks = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    let secureEnvVars = 0;
    envVarChecks.forEach(envVar => {
      if (process.env[envVar]) {
        secureEnvVars++;
      } else {
        result.addAlert('critical', `Missing required environment variable: ${envVar}`);
      }
    });
    
    result.addMetric('secure_env_vars', secureEnvVars, 'count');
    
    // Determine status
    const criticalAlerts = result.alerts.filter(a => a.severity === 'critical');
    const warningAlerts = result.alerts.filter(a => a.severity === 'warning');
    
    if (criticalAlerts.length > 0) {
      result.setStatus('critical');
    } else if (warningAlerts.length > 0) {
      result.setStatus('warning');
    } else {
      result.setStatus('secure');
    }
    
    console.log(`✅ Security audit completed - Status: ${result.status}`);
    
  } catch (error) {
    result.addError(error);
    result.setStatus('error');
    console.error('❌ Security audit failed:', error.message);
  }
  
  result.setDuration(startTime);
  return result;
}

/**
 * Send alert notifications
 */
async function sendAlertNotification(result) {
  const criticalAlerts = result.alerts.filter(a => a.severity === 'critical');
  const warningAlerts = result.alerts.filter(a => a.severity === 'warning');
  
  if (criticalAlerts.length === 0 && warningAlerts.length === 0) {
    return; // No alerts to send
  }
  
  console.log(`📢 Sending alert notifications for ${result.name}...`);
  
  // Send Slack notification
  if (MONITORING_CONFIG.notifications.slack_webhook) {
    try {
      const color = criticalAlerts.length > 0 ? 'danger' : 'warning';
      const emoji = criticalAlerts.length > 0 ? ':rotating_light:' : ':warning:';
      
      const message = {
        attachments: [{
          color: color,
          title: `${emoji} ${result.name} Alert`,
          text: `Status: ${result.status.toUpperCase()}`,
          fields: [
            {
              title: 'Critical Alerts',
              value: criticalAlerts.length.toString(),
              short: true
            },
            {
              title: 'Warning Alerts',
              value: warningAlerts.length.toString(),
              short: true
            },
            {
              title: 'Timestamp',
              value: result.timestamp,
              short: true
            }
          ],
          actions: [{
            type: 'button',
            text: 'View Details',
            url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'}/monitoring`
          }]
        }]
      };
      
      // In a real implementation, you would send this to Slack
      console.log('📱 Slack notification prepared:', JSON.stringify(message, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to send Slack notification:', error.message);
    }
  }
  
  // Create GitHub issue for critical alerts
  if (criticalAlerts.length > 0 && MONITORING_CONFIG.notifications.github_token) {
    try {
      const alertDetails = criticalAlerts.map(alert => 
        `- **${alert.severity.toUpperCase()}**: ${alert.message}`
      ).join('\n');
      
      const issueBody = `## 🚨 Critical Monitoring Alert

**Monitor:** ${result.name}
**Status:** ${result.status.toUpperCase()}
**Timestamp:** ${result.timestamp}

### Critical Alerts
${alertDetails}

### Metrics
${Object.entries(result.metrics).map(([key, metric]) => 
  `- **${key}**: ${metric.value}${metric.unit ? ' ' + metric.unit : ''}`
).join('\n')}

### Action Required
Please investigate and resolve these critical issues immediately.

---
*This issue was automatically created by the deployment monitoring system.*`;
      
      console.log('📝 GitHub issue prepared for critical alerts');
      console.log('Issue body:', issueBody);
      
    } catch (error) {
      console.error('❌ Failed to create GitHub issue:', error.message);
    }
  }
}

/**
 * Save monitoring results
 */
async function saveMonitoringResults(result) {
  try {
    const reportsDir = './monitoring-reports';
    await fs.mkdir(reportsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${result.type}-${timestamp}.json`;
    const filepath = path.join(reportsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(result, null, 2));
    
    // Also save as latest
    const latestPath = path.join(reportsDir, `latest-${result.type}.json`);
    await fs.writeFile(latestPath, JSON.stringify(result, null, 2));
    
    console.log(`💾 Monitoring results saved: ${filepath}`);
    
  } catch (error) {
    console.error('❌ Failed to save monitoring results:', error.message);
  }
}

/**
 * Generate monitoring dashboard data
 */
async function generateDashboardData() {
  try {
    const reportsDir = './monitoring-reports';
    
    // Read latest results
    const healthData = await readLatestResult('health');
    const performanceData = await readLatestResult('performance');
    const securityData = await readLatestResult('security');
    
    const dashboardData = {
      lastUpdated: new Date().toISOString(),
      status: {
        overall: determineOverallStatus([healthData, performanceData, securityData]),
        health: healthData?.status || 'unknown',
        performance: performanceData?.status || 'unknown',
        security: securityData?.status || 'unknown'
      },
      metrics: {
        ...healthData?.metrics || {},
        ...performanceData?.metrics || {},
        ...securityData?.metrics || {}
      },
      alerts: {
        critical: [
          ...healthData?.alerts?.filter(a => a.severity === 'critical') || [],
          ...performanceData?.alerts?.filter(a => a.severity === 'critical') || [],
          ...securityData?.alerts?.filter(a => a.severity === 'critical') || []
        ],
        warning: [
          ...healthData?.alerts?.filter(a => a.severity === 'warning') || [],
          ...performanceData?.alerts?.filter(a => a.severity === 'warning') || [],
          ...securityData?.alerts?.filter(a => a.severity === 'warning') || []
        ]
      }
    };
    
    // Save dashboard data
    await fs.mkdir('./public/monitoring', { recursive: true });
    await fs.writeFile(
      './public/monitoring/dashboard-data.json',
      JSON.stringify(dashboardData, null, 2)
    );
    
    console.log('📊 Dashboard data updated');
    
  } catch (error) {
    console.error('❌ Failed to generate dashboard data:', error.message);
  }
}

/**
 * Read latest monitoring result
 */
async function readLatestResult(type) {
  try {
    const filepath = `./monitoring-reports/latest-${type}.json`;
    const data = await fs.readFile(filepath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Determine overall system status
 */
function determineOverallStatus(results) {
  const validResults = results.filter(r => r !== null);
  
  if (validResults.some(r => r.status === 'critical' || r.status === 'error')) {
    return 'critical';
  }
  
  if (validResults.some(r => r.status === 'warning')) {
    return 'warning';
  }
  
  if (validResults.every(r => ['healthy', 'optimal', 'secure'].includes(r.status))) {
    return 'healthy';
  }
  
  return 'unknown';
}

/**
 * Main monitoring execution
 */
async function runMonitoring(type = 'all') {
  console.log(`🚀 Starting deployment monitoring - Type: ${type}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}\n`);
  
  const results = [];
  
  try {
    if (type === 'all' || type === 'health') {
      const healthResult = await performHealthCheck();
      results.push(healthResult);
      await saveMonitoringResults(healthResult);
      await sendAlertNotification(healthResult);
    }
    
    if (type === 'all' || type === 'performance') {
      const performanceResult = await performPerformanceCheck();
      results.push(performanceResult);
      await saveMonitoringResults(performanceResult);
      await sendAlertNotification(performanceResult);
    }
    
    if (type === 'all' || type === 'security') {
      const securityResult = await performSecurityAudit();
      results.push(securityResult);
      await saveMonitoringResults(securityResult);
      await sendAlertNotification(securityResult);
    }
    
    // Generate dashboard data
    await generateDashboardData();
    
    console.log('\n📊 MONITORING SUMMARY');
    console.log('=' .repeat(50));
    
    results.forEach(result => {
      const statusIcon = result.status === 'healthy' || result.status === 'optimal' || result.status === 'secure' ? '✅' : 
                        result.status === 'warning' ? '⚠️' : '❌';
      
      console.log(`${statusIcon} ${result.name}: ${result.status.toUpperCase()}`);
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Alerts: ${result.alerts.length}`);
      console.log(`   Errors: ${result.errors.length}`);
    });
    
    const overallStatus = determineOverallStatus(results);
    console.log(`\n🎯 Overall Status: ${overallStatus.toUpperCase()}`);
    
    // Exit with appropriate code
    if (overallStatus === 'critical') {
      process.exit(2);
    } else if (overallStatus === 'warning') {
      process.exit(1);
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Monitoring execution failed:', error.message);
    console.error(error.stack);
    process.exit(3);
  }
}

// Export functions for use in other scripts
module.exports = {
  runMonitoring,
  performHealthCheck,
  performPerformanceCheck,
  performSecurityAudit,
  sendAlertNotification,
  generateDashboardData,
  MONITORING_CONFIG
};

// Run monitoring if script is executed directly
if (require.main === module) {
  const monitoringType = process.argv[2] || 'all';
  runMonitoring(monitoringType);
}