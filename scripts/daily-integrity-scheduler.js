#!/usr/bin/env node

/**
 * Daily Integrity Scheduler
 * Schedules and manages automated security and performance report generation
 * Requirements: 4.5, 2.4
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');

class DailyIntegrityScheduler {
  constructor() {
    this.config = {
      schedules: {
        dailyReport: '0 3 * * *', // 3 AM daily
        weeklyDeepScan: '0 4 * * 0', // 4 AM every Sunday
        monthlyAudit: '0 5 1 * *' // 5 AM first day of month
      },
      logDir: path.join(__dirname, '../ci-reports/scheduler-logs'),
      maxLogFiles: 30
    };
    
    this.isRunning = false;
    this.currentJobs = new Map();
  }

  async initialize() {
    console.log('🚀 Initializing Daily Integrity Scheduler...');
    
    try {
      await this.ensureLogDirectory();
      await this.setupSchedules();
      await this.startHealthCheck();
      
      console.log('✅ Scheduler initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize scheduler:', error);
      throw error;
    }
  }

  async ensureLogDirectory() {
    try {
      await fs.access(this.config.logDir);
    } catch {
      await fs.mkdir(this.config.logDir, { recursive: true });
    }
  }

  async setupSchedules() {
    console.log('📅 Setting up scheduled tasks...');

    // Daily security and performance report
    const dailyTask = cron.schedule(this.config.schedules.dailyReport, async () => {
      await this.runScheduledTask('daily-report', async () => {
        console.log('🔄 Running daily security and performance report...');
        await this.executeScript('automated-report-generator.js');
        await this.executeScript('ci-data-integrity-pipeline.js', ['scheduled_check', 'production']);
      });
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Weekly deep security scan
    const weeklyTask = cron.schedule(this.config.schedules.weeklyDeepScan, async () => {
      await this.runScheduledTask('weekly-scan', async () => {
        console.log('🔍 Running weekly deep security scan...');
        await this.executeScript('automated-report-generator.js');
        await this.runSecurityAudit();
        await this.runPerformanceBenchmark();
      });
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Monthly comprehensive audit
    const monthlyTask = cron.schedule(this.config.schedules.monthlyAudit, async () => {
      await this.runScheduledTask('monthly-audit', async () => {
        console.log('📊 Running monthly comprehensive audit...');
        await this.executeScript('automated-report-generator.js');
        await this.runComprehensiveAudit();
        await this.cleanupOldReports();
      });
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.currentJobs.set('daily', dailyTask);
    this.currentJobs.set('weekly', weeklyTask);
    this.currentJobs.set('monthly', monthlyTask);

    // Start all scheduled tasks
    dailyTask.start();
    weeklyTask.start();
    monthlyTask.start();

    console.log('✅ All scheduled tasks configured and started');
  }

  async runScheduledTask(taskName, taskFunction) {
    const startTime = new Date();
    const logFile = path.join(this.config.logDir, `${taskName}-${startTime.toISOString().split('T')[0]}.log`);
    
    try {
      console.log(`🚀 Starting scheduled task: ${taskName}`);
      await this.logMessage(logFile, `Task started: ${taskName} at ${startTime.toISOString()}`);
      
      await taskFunction();
      
      const endTime = new Date();
      const duration = endTime - startTime;
      
      await this.logMessage(logFile, `Task completed: ${taskName} in ${duration}ms`);
      console.log(`✅ Scheduled task completed: ${taskName} (${duration}ms)`);
      
      // Send success notification
      await this.sendNotification('success', taskName, { duration, startTime, endTime });
      
    } catch (error) {
      const endTime = new Date();
      const duration = endTime - startTime;
      
      await this.logMessage(logFile, `Task failed: ${taskName} after ${duration}ms - ${error.message}`);
      console.error(`❌ Scheduled task failed: ${taskName}`, error);
      
      // Send failure notification
      await this.sendNotification('failure', taskName, { duration, startTime, endTime, error });
    }
  }

  async executeScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, scriptName);
      const child = spawn('node', [scriptPath, ...args], {
        stdio: 'pipe',
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Script executed successfully: ${scriptName}`);
          resolve({ stdout, stderr, code });
        } else {
          console.error(`❌ Script failed: ${scriptName} (exit code: ${code})`);
          reject(new Error(`Script ${scriptName} failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        console.error(`❌ Failed to execute script: ${scriptName}`, error);
        reject(error);
      });
    });
  }

  async runSecurityAudit() {
    console.log('🔒 Running security audit...');
    
    try {
      // Run npm audit
      await this.executeScript('../node_modules/.bin/npm', ['audit', '--audit-level=moderate']);
      
      // Check for security vulnerabilities in dependencies
      const auditResult = await this.executeScript('security-audit-checker.js');
      
      console.log('✅ Security audit completed');
      return auditResult;
    } catch (error) {
      console.error('❌ Security audit failed:', error);
      throw error;
    }
  }

  async runPerformanceBenchmark() {
    console.log('⚡ Running performance benchmark...');
    
    try {
      // Run performance tests
      await this.executeScript('../node_modules/.bin/jest', ['--testPathPattern=performance', '--runInBand']);
      
      console.log('✅ Performance benchmark completed');
    } catch (error) {
      console.error('❌ Performance benchmark failed:', error);
      throw error;
    }
  }

  async runComprehensiveAudit() {
    console.log('📊 Running comprehensive audit...');
    
    try {
      // Run all test suites
      await this.executeScript('../node_modules/.bin/jest', ['--coverage', '--runInBand']);
      
      // Run data integrity checks
      await this.executeScript('ci-data-integrity-pipeline.js', ['comprehensive_audit', 'production']);
      
      // Generate comprehensive report
      await this.executeScript('automated-report-generator.js');
      
      console.log('✅ Comprehensive audit completed');
    } catch (error) {
      console.error('❌ Comprehensive audit failed:', error);
      throw error;
    }
  }

  async cleanupOldReports() {
    console.log('🧹 Cleaning up old reports...');
    
    try {
      const reportsDir = path.join(__dirname, '../ci-reports');
      const files = await fs.readdir(reportsDir);
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(reportsDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < thirtyDaysAgo && file.endsWith('.html')) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }
      
      console.log(`✅ Cleaned up ${deletedCount} old report files`);
    } catch (error) {
      console.error('❌ Failed to cleanup old reports:', error);
    }
  }

  async logMessage(logFile, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  async sendNotification(type, taskName, details) {
    const notification = {
      type,
      taskName,
      timestamp: new Date().toISOString(),
      details
    };
    
    // Save notification to file for external processing
    const notificationFile = path.join(this.config.logDir, `notification-${Date.now()}.json`);
    
    try {
      await fs.writeFile(notificationFile, JSON.stringify(notification, null, 2));
      
      // If webhook URL is available, send notification
      if (process.env.SLACK_WEBHOOK_URL) {
        await this.sendSlackNotification(notification);
      }
      
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async sendSlackNotification(notification) {
    const { type, taskName, details } = notification;
    
    const color = type === 'success' ? 'good' : 'danger';
    const emoji = type === 'success' ? ':white_check_mark:' : ':x:';
    
    const payload = {
      attachments: [{
        color,
        title: `${emoji} Scheduled Task ${type === 'success' ? 'Completed' : 'Failed'}`,
        text: `Task: ${taskName}`,
        fields: [
          { title: 'Duration', value: `${details.duration}ms`, short: true },
          { title: 'Start Time', value: details.startTime.toISOString(), short: true }
        ]
      }]
    };
    
    if (type === 'failure' && details.error) {
      payload.attachments[0].fields.push({
        title: 'Error',
        value: details.error.message,
        short: false
      });
    }
    
    try {
      const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Slack notification failed: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  async startHealthCheck() {
    console.log('💓 Starting health check monitor...');
    
    // Health check every 5 minutes
    setInterval(async () => {
      await this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  async performHealthCheck() {
    try {
      const healthStatus = {
        timestamp: new Date().toISOString(),
        scheduler: {
          running: this.isRunning,
          activeJobs: this.currentJobs.size,
          uptime: process.uptime()
        },
        system: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        }
      };
      
      // Save health status
      const healthFile = path.join(this.config.logDir, 'health-status.json');
      await fs.writeFile(healthFile, JSON.stringify(healthStatus, null, 2));
      
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  async start() {
    console.log('🚀 Starting Daily Integrity Scheduler...');
    
    try {
      await this.initialize();
      this.isRunning = true;
      
      console.log('✅ Scheduler is now running');
      console.log('📅 Scheduled tasks:');
      console.log(`  - Daily reports: ${this.config.schedules.dailyReport}`);
      console.log(`  - Weekly scans: ${this.config.schedules.weeklyDeepScan}`);
      console.log(`  - Monthly audits: ${this.config.schedules.monthlyAudit}`);
      
      // Keep the process running
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
      
    } catch (error) {
      console.error('❌ Failed to start scheduler:', error);
      process.exit(1);
    }
  }

  async stop() {
    console.log('🛑 Stopping Daily Integrity Scheduler...');
    
    this.isRunning = false;
    
    // Stop all scheduled tasks
    for (const [name, job] of this.currentJobs) {
      job.stop();
      console.log(`✅ Stopped scheduled task: ${name}`);
    }
    
    console.log('✅ Scheduler stopped gracefully');
    process.exit(0);
  }

  // Manual trigger methods for testing
  async triggerDailyReport() {
    console.log('🔄 Manually triggering daily report...');
    await this.runScheduledTask('manual-daily-report', async () => {
      await this.executeScript('automated-report-generator.js');
    });
  }

  async triggerWeeklyScan() {
    console.log('🔍 Manually triggering weekly scan...');
    await this.runScheduledTask('manual-weekly-scan', async () => {
      await this.executeScript('automated-report-generator.js');
      await this.runSecurityAudit();
    });
  }
}

// CLI execution
if (require.main === module) {
  const scheduler = new DailyIntegrityScheduler();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      scheduler.start();
      break;
    case 'daily':
      scheduler.triggerDailyReport().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'weekly':
      scheduler.triggerWeeklyScan().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    default:
      console.log('Usage: node daily-integrity-scheduler.js [start|daily|weekly]');
      process.exit(1);
  }
}

module.exports = DailyIntegrityScheduler;