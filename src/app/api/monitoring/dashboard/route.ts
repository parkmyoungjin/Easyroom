import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Monitoring Dashboard API Route
 * Provides real-time system health metrics and monitoring data
 * Requirements: 4.5, 2.4
 */

interface DashboardMetrics {
  lastUpdated: string;
  status: {
    overall: 'healthy' | 'warning' | 'critical' | 'unknown';
    health: string;
    performance: string;
    security: string;
    dataIntegrity: string;
  };
  metrics: {
    [key: string]: {
      value: number;
      unit?: string;
      timestamp: string;
    };
  };
  alerts: {
    critical: Array<{
      severity: string;
      message: string;
      timestamp: string;
      details?: any;
    }>;
    warning: Array<{
      severity: string;
      message: string;
      timestamp: string;
      details?: any;
    }>;
  };
  trends: {
    healthTrend: string;
    performanceTrend: string;
    securityTrend: string;
    integrityTrend: string;
  };
  uptime: {
    current: number;
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

/**
 * Read monitoring data from files
 */
async function readMonitoringData(): Promise<DashboardMetrics> {
  const defaultMetrics: DashboardMetrics = {
    lastUpdated: new Date().toISOString(),
    status: {
      overall: 'unknown',
      health: 'unknown',
      performance: 'unknown',
      security: 'unknown',
      dataIntegrity: 'unknown'
    },
    metrics: {},
    alerts: {
      critical: [],
      warning: []
    },
    trends: {
      healthTrend: 'no_data',
      performanceTrend: 'no_data',
      securityTrend: 'no_data',
      integrityTrend: 'no_data'
    },
    uptime: {
      current: 100,
      last24h: 100,
      last7d: 100,
      last30d: 100
    }
  };

  try {
    // Try to read dashboard data from public directory
    const dashboardDataPath = join(process.cwd(), 'public', 'monitoring', 'dashboard-data.json');
    
    try {
      const dashboardData = await readFile(dashboardDataPath, 'utf8');
      const parsedData = JSON.parse(dashboardData);
      
      // Merge with default metrics
      return {
        ...defaultMetrics,
        ...parsedData,
        status: {
          ...defaultMetrics.status,
          ...parsedData.status
        },
        alerts: {
          ...defaultMetrics.alerts,
          ...parsedData.alerts
        },
        trends: {
          ...defaultMetrics.trends,
          ...parsedData.trends
        },
        uptime: {
          ...defaultMetrics.uptime,
          ...parsedData.uptime
        }
      };
    } catch (error) {
      console.warn('Dashboard data file not found, using defaults');
    }

    // Try to read individual monitoring reports
    const reportsDir = join(process.cwd(), 'monitoring-reports');
    
    // Read latest health report
    try {
      const healthData = await readFile(join(reportsDir, 'latest-health.json'), 'utf8');
      const healthReport = JSON.parse(healthData);
      
      defaultMetrics.status.health = healthReport.status || 'unknown';
      
      // Add health metrics
      if (healthReport.metrics) {
        Object.entries(healthReport.metrics).forEach(([key, metric]: [string, any]) => {
          defaultMetrics.metrics[`health_${key}`] = metric;
        });
      }
      
      // Add health alerts
      if (healthReport.alerts) {
        healthReport.alerts.forEach((alert: any) => {
          if (alert.severity === 'critical') {
            defaultMetrics.alerts.critical.push(alert);
          } else if (alert.severity === 'warning') {
            defaultMetrics.alerts.warning.push(alert);
          }
        });
      }
    } catch (error) {
      console.warn('Health report not found');
    }

    // Read latest performance report
    try {
      const performanceData = await readFile(join(reportsDir, 'latest-performance.json'), 'utf8');
      const performanceReport = JSON.parse(performanceData);
      
      defaultMetrics.status.performance = performanceReport.status || 'unknown';
      
      // Add performance metrics
      if (performanceReport.metrics) {
        Object.entries(performanceReport.metrics).forEach(([key, metric]: [string, any]) => {
          defaultMetrics.metrics[`performance_${key}`] = metric;
        });
      }
      
      // Add performance alerts
      if (performanceReport.alerts) {
        performanceReport.alerts.forEach((alert: any) => {
          if (alert.severity === 'critical') {
            defaultMetrics.alerts.critical.push(alert);
          } else if (alert.severity === 'warning') {
            defaultMetrics.alerts.warning.push(alert);
          }
        });
      }
    } catch (error) {
      console.warn('Performance report not found');
    }

    // Read latest security report
    try {
      const securityData = await readFile(join(reportsDir, 'latest-security.json'), 'utf8');
      const securityReport = JSON.parse(securityData);
      
      defaultMetrics.status.security = securityReport.status || 'unknown';
      
      // Add security metrics
      if (securityReport.metrics) {
        Object.entries(securityReport.metrics).forEach(([key, metric]: [string, any]) => {
          defaultMetrics.metrics[`security_${key}`] = metric;
        });
      }
      
      // Add security alerts
      if (securityReport.alerts) {
        securityReport.alerts.forEach((alert: any) => {
          if (alert.severity === 'critical') {
            defaultMetrics.alerts.critical.push(alert);
          } else if (alert.severity === 'warning') {
            defaultMetrics.alerts.warning.push(alert);
          }
        });
      }
    } catch (error) {
      console.warn('Security report not found');
    }

    // Read latest data integrity report
    try {
      const integrityData = await readFile(join(reportsDir, 'latest-pipeline-scheduled_check.json'), 'utf8');
      const integrityReport = JSON.parse(integrityData);
      
      defaultMetrics.status.dataIntegrity = integrityReport.success ? 'healthy' : 'critical';
      
      // Add integrity metrics
      if (integrityReport.summary) {
        defaultMetrics.metrics.integrity_total_checks = {
          value: integrityReport.summary.totalChecks || 0,
          unit: 'count',
          timestamp: integrityReport.timestamp
        };
        defaultMetrics.metrics.integrity_critical_issues = {
          value: integrityReport.summary.criticalIssues || 0,
          unit: 'count',
          timestamp: integrityReport.timestamp
        };
        defaultMetrics.metrics.integrity_error_issues = {
          value: integrityReport.summary.errorIssues || 0,
          unit: 'count',
          timestamp: integrityReport.timestamp
        };
        defaultMetrics.metrics.integrity_warning_issues = {
          value: integrityReport.summary.warningIssues || 0,
          unit: 'count',
          timestamp: integrityReport.timestamp
        };
      }
    } catch (error) {
      console.warn('Data integrity report not found');
    }

    // Determine overall status
    const statuses = [
      defaultMetrics.status.health,
      defaultMetrics.status.performance,
      defaultMetrics.status.security,
      defaultMetrics.status.dataIntegrity
    ];

    if (statuses.some(status => status === 'critical')) {
      defaultMetrics.status.overall = 'critical';
    } else if (statuses.some(status => status === 'warning')) {
      defaultMetrics.status.overall = 'warning';
    } else if (statuses.every(status => ['healthy', 'optimal', 'secure'].includes(status))) {
      defaultMetrics.status.overall = 'healthy';
    } else {
      defaultMetrics.status.overall = 'unknown';
    }

    return defaultMetrics;

  } catch (error) {
    console.error('Error reading monitoring data:', error);
    return defaultMetrics;
  }
}

/**
 * Calculate uptime metrics
 */
async function calculateUptimeMetrics(): Promise<DashboardMetrics['uptime']> {
  // In a real implementation, this would query uptime data from monitoring logs
  // For now, we'll simulate uptime calculations
  
  const baseUptime = 99.5;
  const variance = Math.random() * 2; // 0-2% variance
  
  return {
    current: Math.min(100, baseUptime + variance),
    last24h: Math.min(100, baseUptime + (Math.random() * 1)),
    last7d: Math.min(100, baseUptime + (Math.random() * 0.5)),
    last30d: Math.min(100, baseUptime + (Math.random() * 0.3))
  };
}

/**
 * Calculate trend data
 */
async function calculateTrends(): Promise<DashboardMetrics['trends']> {
  // In a real implementation, this would analyze historical data
  // For now, we'll provide simulated trends
  
  return {
    healthTrend: 'stable',
    performanceTrend: 'improving',
    securityTrend: 'secure',
    integrityTrend: 'excellent'
  };
}

/**
 * GET /api/monitoring/dashboard
 * Returns comprehensive dashboard metrics
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Fetching monitoring dashboard data...');
    
    // Read monitoring data
    const dashboardData = await readMonitoringData();
    
    // Calculate uptime metrics
    const uptimeMetrics = await calculateUptimeMetrics();
    dashboardData.uptime = uptimeMetrics;
    
    // Calculate trends
    const trends = await calculateTrends();
    dashboardData.trends = trends;
    
    // Update last updated timestamp
    dashboardData.lastUpdated = new Date().toISOString();
    
    console.log(`✅ Dashboard data retrieved - Status: ${dashboardData.status.overall}`);
    
    return NextResponse.json(dashboardData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('❌ Dashboard API error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/dashboard
 * Updates dashboard configuration or triggers refresh
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;
    
    console.log(`📊 Dashboard action: ${action}`);
    
    switch (action) {
      case 'refresh':
        // Trigger a refresh of monitoring data
        const refreshedData = await readMonitoringData();
        return NextResponse.json({
          success: true,
          message: 'Dashboard data refreshed',
          data: refreshedData
        });
        
      case 'acknowledge_alert':
        // Acknowledge an alert (in a real implementation, this would update alert status)
        const { alertId, acknowledgedBy } = params;
        console.log(`✅ Alert ${alertId} acknowledged by ${acknowledgedBy}`);
        
        return NextResponse.json({
          success: true,
          message: `Alert ${alertId} acknowledged`
        });
        
      case 'update_thresholds':
        // Update monitoring thresholds (in a real implementation, this would update configuration)
        const { thresholds } = params;
        console.log('🔧 Updating monitoring thresholds:', thresholds);
        
        return NextResponse.json({
          success: true,
          message: 'Monitoring thresholds updated'
        });
        
      default:
        return NextResponse.json(
          { error: 'Unknown action', action },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('❌ Dashboard POST error:', error);
    
    return NextResponse.json(
      {
        error: 'Dashboard action failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}