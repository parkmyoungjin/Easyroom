#!/usr/bin/env node

/**
 * Alert Notification System
 * Manages notifications for security and performance alerts
 * Requirements: 4.5, 2.4
 */

const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

class AlertNotificationSystem {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.config = {
      thresholds: {
        security: {
          critical: 60,
          warning: 80
        },
        performance: {
          critical: 60,
          warning: 80
        },
        failedLogins: {
          critical: 20,
          warning: 10
        },
        responseTime: {
          critical: 500,
          warning: 300
        }
      },
      notifications: {
        slack: {
          enabled: !!process.env.SLACK_WEBHOOK_URL,
          webhookUrl: process.env.SLACK_WEBHOOK_URL
        },
        github: {
          enabled: true,
          token: process.env.GITHUB_TOKEN
        },
        email: {
          enabled: false // Can be configured later
        }
      },
      alertHistory: path.join(__dirname, '../ci-reports/alert-history.json')
    };
  }

  async processReportAlerts(reportData) {
    console.log('🔔 Processing report alerts...');
    
    try {
      const alerts = await this.analyzeReport(reportData);
      
      if (alerts.length === 0) {
        console.log('✅ No alerts generated - all metrics within normal ranges');
        return { success: true, alertsGenerated: 0 };
      }
      
      console.log(`⚠️ Generated ${alerts.length} alerts`);
      
      // Process each alert
      for (const alert of alerts) {
        await this.processAlert(alert);
      }
      
      // Save alert history
      await this.saveAlertHistory(alerts);
      
      return { success: true, alertsGenerated: alerts.length, alerts };
      
    } catch (error) {
      console.error('❌ Failed to process report alerts:', error);
      throw error;
    }
  }

  async analyzeReport(reportData) {
    const alerts = [];
    const timestamp = new Date().toISOString();
    
    // Security alerts
    if (reportData.security) {
      const securityScore = reportData.security.securityScore || 0;
      const failedLogins = reportData.security.failedLogins || 0;
      const permissionViolations = reportData.security.permissionViolations || 0;
      
      if (securityScore < this.config.thresholds.security.critical) {
        alerts.push({
          id: `security-critical-${Date.now()}`,
          type: 'security',
          severity: 'critical',
          title: 'Critical Security Score Alert',
          message: `Security score has dropped to ${securityScore}/100 (threshold: ${this.config.thresholds.security.critical})`,
          metrics: { securityScore, failedLogins, permissionViolations },
          timestamp,
          recommendations: [
            'Review authentication logs immediately',
            'Check for suspicious login patterns',
            'Verify security configurations',
            'Consider implementing additional security measures'
          ]
        });
      } else if (securityScore < this.config.thresholds.security.warning) {
        alerts.push({
          id: `security-warning-${Date.now()}`,
          type: 'security',
          severity: 'warning',
          title: 'Security Score Warning',
          message: `Security score is ${securityScore}/100 (threshold: ${this.config.thresholds.security.warning})`,
          metrics: { securityScore, failedLogins, permissionViolations },
          timestamp,
          recommendations: [
            'Monitor authentication patterns',
            'Review recent security events',
            'Consider preventive security measures'
          ]
        });
      }
      
      if (failedLogins >= this.config.thresholds.failedLogins.critical) {
        alerts.push({
          id: `failed-logins-critical-${Date.now()}`,
          type: 'security',
          severity: 'critical',
          title: 'High Failed Login Attempts',
          message: `${failedLogins} failed login attempts detected in the last 24 hours (threshold: ${this.config.thresholds.failedLogins.critical})`,
          metrics: { failedLogins, securityScore },
          timestamp,
          recommendations: [
            'Investigate potential brute force attacks',
            'Review IP addresses of failed attempts',
            'Consider implementing rate limiting',
            'Enable account lockout policies'
          ]
        });
      } else if (failedLogins >= this.config.thresholds.failedLogins.warning) {
        alerts.push({
          id: `failed-logins-warning-${Date.now()}`,
          type: 'security',
          severity: 'warning',
          title: 'Elevated Failed Login Attempts',
          message: `${failedLogins} failed login attempts detected in the last 24 hours (threshold: ${this.config.thresholds.failedLogins.warning})`,
          metrics: { failedLogins, securityScore },
          timestamp,
          recommendations: [
            'Monitor login patterns',
            'Review authentication logs',
            'Consider security awareness training'
          ]
        });
      }
    }
    
    // Performance alerts
    if (reportData.performance) {
      const performanceScore = reportData.performance.performanceScore || 0;
      const avgResponseTime = reportData.performance.api?.averageResponseTime || 0;
      const errorRate = reportData.performance.api?.errorRate || 0;
      
      if (performanceScore < this.config.thresholds.performance.critical) {
        alerts.push({
          id: `performance-critical-${Date.now()}`,
          type: 'performance',
          severity: 'critical',
          title: 'Critical Performance Degradation',
          message: `Performance score has dropped to ${performanceScore}/100 (threshold: ${this.config.thresholds.performance.critical})`,
          metrics: { performanceScore, avgResponseTime, errorRate },
          timestamp,
          recommendations: [
            'Investigate system resource usage',
            'Check database performance',
            'Review application logs for errors',
            'Consider scaling resources'
          ]
        });
      } else if (performanceScore < this.config.thresholds.performance.warning) {
        alerts.push({
          id: `performance-warning-${Date.now()}`,
          type: 'performance',
          severity: 'warning',
          title: 'Performance Degradation Warning',
          message: `Performance score is ${performanceScore}/100 (threshold: ${this.config.thresholds.performance.warning})`,
          metrics: { performanceScore, avgResponseTime, errorRate },
          timestamp,
          recommendations: [
            'Monitor system performance trends',
            'Review recent changes',
            'Consider performance optimizations'
          ]
        });
      }
      
      if (avgResponseTime >= this.config.thresholds.responseTime.critical) {
        alerts.push({
          id: `response-time-critical-${Date.now()}`,
          type: 'performance',
          severity: 'critical',
          title: 'High Response Time Alert',
          message: `Average response time is ${Math.round(avgResponseTime)}ms (threshold: ${this.config.thresholds.responseTime.critical}ms)`,
          metrics: { avgResponseTime, performanceScore, errorRate },
          timestamp,
          recommendations: [
            'Investigate slow database queries',
            'Check API endpoint performance',
            'Review server resource utilization',
            'Consider caching strategies'
          ]
        });
      } else if (avgResponseTime >= this.config.thresholds.responseTime.warning) {
        alerts.push({
          id: `response-time-warning-${Date.now()}`,
          type: 'performance',
          severity: 'warning',
          title: 'Elevated Response Time',
          message: `Average response time is ${Math.round(avgResponseTime)}ms (threshold: ${this.config.thresholds.responseTime.warning}ms)`,
          metrics: { avgResponseTime, performanceScore, errorRate },
          timestamp,
          recommendations: [
            'Monitor response time trends',
            'Review API performance',
            'Consider optimization opportunities'
          ]
        });
      }
    }
    
    return alerts;
  }

  async processAlert(alert) {
    console.log(`🚨 Processing ${alert.severity} alert: ${alert.title}`);
    
    try {
      // Send notifications based on configuration
      const notifications = [];
      
      if (this.config.notifications.slack.enabled) {
        notifications.push(this.sendSlackNotification(alert));
      }
      
      if (this.config.notifications.github.enabled && alert.severity === 'critical') {
        notifications.push(this.createGitHubIssue(alert));
      }
      
      // Wait for all notifications to complete
      await Promise.allSettled(notifications);
      
      console.log(`✅ Alert processed: ${alert.id}`);
      
    } catch (error) {
      console.error(`❌ Failed to process alert ${alert.id}:`, error);
    }
  }

  async sendSlackNotification(alert) {
    if (!this.config.notifications.slack.webhookUrl) {
      console.log('⚠️ Slack webhook URL not configured, skipping Slack notification');
      return;
    }
    
    const color = alert.severity === 'critical' ? 'danger' : 'warning';
    const emoji = alert.severity === 'critical' ? ':rotating_light:' : ':warning:';
    
    const payload = {
      attachments: [{
        color,
        title: `${emoji} ${alert.title}`,
        text: alert.message,
        fields: [
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Type', value: alert.type, short: true },
          { title: 'Timestamp', value: alert.timestamp, short: true }
        ],
        actions: [{
          type: 'button',
          text: 'View Details',
          url: `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY || 'repo'}/actions`
        }]
      }]
    };
    
    // Add metrics as fields
    if (alert.metrics) {
      Object.entries(alert.metrics).forEach(([key, value]) => {
        payload.attachments[0].fields.push({
          title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          value: typeof value === 'number' ? value.toString() : value,
          short: true
        });
      });
    }
    
    // Add recommendations
    if (alert.recommendations && alert.recommendations.length > 0) {
      payload.attachments[0].fields.push({
        title: 'Recommendations',
        value: alert.recommendations.map(rec => `• ${rec}`).join('\n'),
        short: false
      });
    }
    
    try {
      const response = await fetch(this.config.notifications.slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }
      
      console.log(`✅ Slack notification sent for alert: ${alert.id}`);
      
    } catch (error) {
      console.error(`❌ Failed to send Slack notification for alert ${alert.id}:`, error);
    }
  }

  async createGitHubIssue(alert) {
    console.log(`📝 Creating GitHub issue for critical alert: ${alert.id}`);
    
    const title = `🚨 ${alert.title}`;
    const body = `## ${alert.severity === 'critical' ? '🚨 Critical Alert' : '⚠️ Warning Alert'}

**Alert ID:** ${alert.id}
**Type:** ${alert.type}
**Severity:** ${alert.severity.toUpperCase()}
**Timestamp:** ${alert.timestamp}

### Description
${alert.message}

### Metrics
${alert.metrics ? Object.entries(alert.metrics).map(([key, value]) => 
  `- **${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:** ${value}`
).join('\n') : 'No metrics available'}

### Recommendations
${alert.recommendations ? alert.recommendations.map(rec => `- ${rec}`).join('\n') : 'No recommendations available'}

### Next Steps
1. Review the alert details above
2. Investigate the root cause
3. Implement recommended actions
4. Monitor for improvement
5. Close this issue once resolved

---
*This issue was automatically generated by the Alert Notification System.*`;
    
    // In a real implementation, you would use GitHub API
    // For now, we'll save the issue data to a file
    const issueData = {
      title,
      body,
      labels: ['alert', alert.type, alert.severity, 'automated'],
      alert
    };
    
    const issueFile = path.join(__dirname, '../ci-reports', `github-issue-${alert.id}.json`);
    
    try {
      await fs.writeFile(issueFile, JSON.stringify(issueData, null, 2));
      console.log(`✅ GitHub issue data saved: ${issueFile}`);
    } catch (error) {
      console.error(`❌ Failed to save GitHub issue data for alert ${alert.id}:`, error);
    }
  }

  async saveAlertHistory(alerts) {
    try {
      let history = [];
      
      // Load existing history
      try {
        const historyData = await fs.readFile(this.config.alertHistory, 'utf8');
        history = JSON.parse(historyData);
      } catch {
        // File doesn't exist or is invalid, start with empty history
      }
      
      // Add new alerts to history
      history.push(...alerts.map(alert => ({
        ...alert,
        processed: true,
        processedAt: new Date().toISOString()
      })));
      
      // Keep only last 1000 alerts
      if (history.length > 1000) {
        history = history.slice(-1000);
      }
      
      // Save updated history
      await fs.writeFile(this.config.alertHistory, JSON.stringify(history, null, 2));
      
      console.log(`✅ Alert history updated with ${alerts.length} new alerts`);
      
    } catch (error) {
      console.error('❌ Failed to save alert history:', error);
    }
  }

  async getAlertHistory(limit = 50) {
    try {
      const historyData = await fs.readFile(this.config.alertHistory, 'utf8');
      const history = JSON.parse(historyData);
      
      return history.slice(-limit).reverse(); // Return most recent first
      
    } catch (error) {
      console.error('Failed to load alert history:', error);
      return [];
    }
  }

  async getAlertStatistics(days = 7) {
    try {
      const history = await this.getAlertHistory(1000);
      const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      
      const recentAlerts = history.filter(alert => 
        new Date(alert.timestamp) > cutoffDate
      );
      
      const stats = {
        total: recentAlerts.length,
        critical: recentAlerts.filter(a => a.severity === 'critical').length,
        warning: recentAlerts.filter(a => a.severity === 'warning').length,
        byType: {
          security: recentAlerts.filter(a => a.type === 'security').length,
          performance: recentAlerts.filter(a => a.type === 'performance').length
        },
        dailyBreakdown: {}
      };
      
      // Calculate daily breakdown
      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
        const dateStr = date.toISOString().split('T')[0];
        
        stats.dailyBreakdown[dateStr] = recentAlerts.filter(alert => 
          alert.timestamp.startsWith(dateStr)
        ).length;
      }
      
      return stats;
      
    } catch (error) {
      console.error('Failed to calculate alert statistics:', error);
      return null;
    }
  }
}

// CLI execution
if (require.main === module) {
  const alertSystem = new AlertNotificationSystem();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'process':
      const reportFile = process.argv[3];
      if (!reportFile) {
        console.error('Usage: node alert-notification-system.js process <report-file>');
        process.exit(1);
      }
      
      fs.readFile(reportFile, 'utf8')
        .then(data => JSON.parse(data))
        .then(reportData => alertSystem.processReportAlerts(reportData))
        .then(result => {
          console.log('Alert processing result:', result);
          process.exit(0);
        })
        .catch(error => {
          console.error('Failed to process alerts:', error);
          process.exit(1);
        });
      break;
      
    case 'history':
      const limit = parseInt(process.argv[3]) || 50;
      alertSystem.getAlertHistory(limit)
        .then(history => {
          console.log(JSON.stringify(history, null, 2));
          process.exit(0);
        })
        .catch(error => {
          console.error('Failed to get alert history:', error);
          process.exit(1);
        });
      break;
      
    case 'stats':
      const days = parseInt(process.argv[3]) || 7;
      alertSystem.getAlertStatistics(days)
        .then(stats => {
          console.log(JSON.stringify(stats, null, 2));
          process.exit(0);
        })
        .catch(error => {
          console.error('Failed to get alert statistics:', error);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Usage: node alert-notification-system.js [process|history|stats] [args...]');
      process.exit(1);
  }
}

module.exports = AlertNotificationSystem;