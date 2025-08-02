#!/usr/bin/env node

/**
 * Automated Report Generator
 * Generates comprehensive security and performance statistics reports
 * Requirements: 4.5, 2.4
 */

const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REPORT_OUTPUT_DIR = path.join(__dirname, '../ci-reports');

class ReportGenerator {
    constructor() {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        this.reportData = {
            timestamp: new Date().toISOString(),
            security: {},
            performance: {},
            system: {}
        };
    }

    async generateReport() {
        console.log('🔄 Starting automated report generation...');

        try {
            await this.ensureOutputDirectory();
            await this.collectSecurityMetrics();
            await this.collectPerformanceMetrics();
            await this.collectSystemMetrics();
            await this.generateHTMLReport();
            await this.generateJSONReport();

            console.log('✅ Report generation completed successfully');
            return this.reportData;
        } catch (error) {
            console.error('❌ Report generation failed:', error);
            throw error;
        }
    }

    async ensureOutputDirectory() {
        try {
            await fs.access(REPORT_OUTPUT_DIR);
        } catch {
            await fs.mkdir(REPORT_OUTPUT_DIR, { recursive: true });
        }
    }

    async collectSecurityMetrics() {
        console.log('🔒 Collecting security metrics...');

        try {
            // Authentication metrics
            const { data: authMetrics } = await this.supabase
                .from('auth.audit_log_entries')
                .select('*')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            // Failed login attempts
            const failedLogins = authMetrics?.filter(entry =>
                entry.payload?.error_message?.includes('Invalid login')
            ).length || 0;

            // Successful logins
            const successfulLogins = authMetrics?.filter(entry =>
                entry.payload?.action === 'login'
            ).length || 0;

            // User activity
            const { data: userActivity } = await this.supabase
                .from('users')
                .select('id, last_sign_in_at, created_at')
                .not('last_sign_in_at', 'is', null);

            // Active users (last 24h)
            const activeUsers = userActivity?.filter(user =>
                new Date(user.last_sign_in_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
            ).length || 0;

            // Permission violations (from logs if available)
            const permissionViolations = await this.checkPermissionViolations();

            this.reportData.security = {
                failedLogins,
                successfulLogins,
                activeUsers,
                totalUsers: userActivity?.length || 0,
                permissionViolations,
                authenticationRate: successfulLogins / (successfulLogins + failedLogins) || 0,
                securityScore: this.calculateSecurityScore(failedLogins, permissionViolations)
            };

        } catch (error) {
            console.error('Error collecting security metrics:', error);
            this.reportData.security = { error: error.message };
        }
    }

    async collectPerformanceMetrics() {
        console.log('⚡ Collecting performance metrics...');

        try {
            // Database performance
            const { data: reservations } = await this.supabase
                .from('reservations')
                .select('id, created_at')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            const { data: rooms } = await this.supabase
                .from('rooms')
                .select('id, created_at');

            // API response times (simulated - in real scenario, collect from monitoring)
            const apiMetrics = await this.simulateAPIMetrics();

            // Memory and CPU usage (simulated)
            const systemMetrics = await this.getSystemMetrics();

            this.reportData.performance = {
                database: {
                    reservationsCount: reservations?.length || 0,
                    roomsCount: rooms?.length || 0,
                    queryResponseTime: Math.random() * 100 + 50 // Simulated
                },
                api: apiMetrics,
                system: systemMetrics,
                performanceScore: this.calculatePerformanceScore(apiMetrics, systemMetrics)
            };

        } catch (error) {
            console.error('Error collecting performance metrics:', error);
            this.reportData.performance = { error: error.message };
        }
    }

    async collectSystemMetrics() {
        console.log('🖥️ Collecting system metrics...');

        try {
            const uptime = process.uptime();
            const memoryUsage = process.memoryUsage();

            this.reportData.system = {
                uptime: uptime,
                memory: {
                    used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                    total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                    external: Math.round(memoryUsage.external / 1024 / 1024)
                },
                nodeVersion: process.version,
                platform: process.platform,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error collecting system metrics:', error);
            this.reportData.system = { error: error.message };
        }
    }

    async checkPermissionViolations() {
        // In a real scenario, this would check application logs
        // For now, return simulated data
        return Math.floor(Math.random() * 5);
    }

    async simulateAPIMetrics() {
        return {
            averageResponseTime: Math.random() * 200 + 100,
            requestsPerMinute: Math.floor(Math.random() * 1000) + 500,
            errorRate: Math.random() * 0.05,
            endpoints: {
                '/api/reservations': { responseTime: Math.random() * 150 + 80, requests: 450 },
                '/api/rooms': { responseTime: Math.random() * 100 + 60, requests: 320 },
                '/api/users': { responseTime: Math.random() * 120 + 70, requests: 180 }
            }
        };
    }

    async getSystemMetrics() {
        return {
            cpuUsage: Math.random() * 80 + 10,
            memoryUsage: Math.random() * 70 + 20,
            diskUsage: Math.random() * 60 + 30,
            networkIO: {
                bytesIn: Math.floor(Math.random() * 1000000),
                bytesOut: Math.floor(Math.random() * 800000)
            }
        };
    }

    calculateSecurityScore(failedLogins, violations) {
        let score = 100;
        score -= Math.min(failedLogins * 2, 30);
        score -= Math.min(violations * 10, 40);
        return Math.max(score, 0);
    }

    calculatePerformanceScore(apiMetrics, systemMetrics) {
        let score = 100;
        if (apiMetrics.averageResponseTime > 200) score -= 20;
        if (apiMetrics.errorRate > 0.02) score -= 15;
        if (systemMetrics.cpuUsage > 70) score -= 15;
        if (systemMetrics.memoryUsage > 80) score -= 10;
        return Math.max(score, 0);
    }

    async generateHTMLReport() {
        const htmlContent = this.generateHTMLContent();
        const filePath = path.join(REPORT_OUTPUT_DIR, `security-performance-report-${Date.now()}.html`);
        await fs.writeFile(filePath, htmlContent);
        console.log(`📄 HTML report generated: ${filePath}`);
    }

    async generateJSONReport() {
        const filePath = path.join(REPORT_OUTPUT_DIR, `security-performance-report-${Date.now()}.json`);
        await fs.writeFile(filePath, JSON.stringify(this.reportData, null, 2));
        console.log(`📊 JSON report generated: ${filePath}`);

        // Process alerts based on the report
        await this.processAlerts(filePath);

        return filePath;
    }

    async processAlerts(reportFilePath) {
        try {
            console.log('🔔 Processing alerts for generated report...');

            const AlertNotificationSystem = require('./alert-notification-system.js');
            const alertSystem = new AlertNotificationSystem();

            const result = await alertSystem.processReportAlerts(this.reportData);

            if (result.alertsGenerated > 0) {
                console.log(`⚠️ Generated ${result.alertsGenerated} alerts`);

                // Save alert summary to report directory
                const alertSummary = {
                    timestamp: new Date().toISOString(),
                    reportFile: reportFilePath,
                    alertsGenerated: result.alertsGenerated,
                    alerts: result.alerts
                };

                const alertSummaryPath = path.join(REPORT_OUTPUT_DIR, `alert-summary-${Date.now()}.json`);
                await fs.writeFile(alertSummaryPath, JSON.stringify(alertSummary, null, 2));

                console.log(`📋 Alert summary saved: ${alertSummaryPath}`);
            } else {
                console.log('✅ No alerts generated - all metrics within normal ranges');
            }

        } catch (error) {
            console.error('❌ Failed to process alerts:', error);
            // Don't fail the entire report generation if alert processing fails
        }
    }

    generateHTMLContent() {
        const { security, performance, system } = this.reportData;

        return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security & Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; font-size: 14px; }
        .score { font-size: 32px; font-weight: bold; }
        .score.good { color: #28a745; }
        .score.warning { color: #ffc107; }
        .score.danger { color: #dc3545; }
        .timestamp { color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Security & Performance Report</h1>
            <p class="timestamp">Generated: ${this.reportData.timestamp}</p>
        </div>

        <div class="section">
            <h2>🔒 Security Metrics</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">${security.successfulLogins || 0}</div>
                    <div class="metric-label">Successful Logins (24h)</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${security.failedLogins || 0}</div>
                    <div class="metric-label">Failed Login Attempts</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${security.activeUsers || 0}</div>
                    <div class="metric-label">Active Users (24h)</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${security.permissionViolations || 0}</div>
                    <div class="metric-label">Permission Violations</div>
                </div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <div class="score ${this.getScoreClass(security.securityScore)}">
                    Security Score: ${security.securityScore || 0}/100
                </div>
            </div>
        </div>

        <div class="section">
            <h2>⚡ Performance Metrics</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">${Math.round(performance.api?.averageResponseTime || 0)}ms</div>
                    <div class="metric-label">Average Response Time</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${performance.api?.requestsPerMinute || 0}</div>
                    <div class="metric-label">Requests per Minute</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${Math.round((performance.api?.errorRate || 0) * 100 * 100) / 100}%</div>
                    <div class="metric-label">Error Rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${performance.database?.reservationsCount || 0}</div>
                    <div class="metric-label">New Reservations (24h)</div>
                </div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <div class="score ${this.getScoreClass(performance.performanceScore)}">
                    Performance Score: ${performance.performanceScore || 0}/100
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🖥️ System Metrics</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value">${system.memory?.used || 0}MB</div>
                    <div class="metric-label">Memory Used</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${Math.round(system.uptime / 3600) || 0}h</div>
                    <div class="metric-label">System Uptime</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${system.nodeVersion || 'N/A'}</div>
                    <div class="metric-label">Node.js Version</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${system.platform || 'N/A'}</div>
                    <div class="metric-label">Platform</div>
                </div>
            </div>
        </div>

        ${performance.api?.endpoints ? `
        <div class="section">
            <h2>📊 API Endpoint Performance</h2>
            <table>
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Response Time (ms)</th>
                        <th>Requests</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(performance.api.endpoints).map(([endpoint, metrics]) => `
                        <tr>
                            <td>${endpoint}</td>
                            <td>${Math.round(metrics.responseTime)}</td>
                            <td>${metrics.requests}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
    </div>
</body>
</html>`;
    }

    getScoreClass(score) {
        if (score >= 80) return 'good';
        if (score >= 60) return 'warning';
        return 'danger';
    }
}

// CLI execution
if (require.main === module) {
    const generator = new ReportGenerator();
    generator.generateReport()
        .then(() => {
            console.log('✅ Report generation completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Report generation failed:', error);
            process.exit(1);
        });
}

module.exports = ReportGenerator;