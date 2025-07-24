'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  RefreshCw, 
  Shield, 
  TrendingUp, 
  XCircle,
  Zap,
  Server,
  Users,
  Globe
} from 'lucide-react';

/**
 * Monitoring Dashboard Component
 * Real-time system health metrics and monitoring visualization
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

const MonitoringDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/monitoring/dashboard', {
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDashboardData(data);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh
  const handleRefresh = async () => {
    await fetchDashboardData();
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchDashboardData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Get status color and icon
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'optimal':
      case 'secure':
        return { color: 'bg-green-500', icon: CheckCircle, text: 'Healthy' };
      case 'warning':
        return { color: 'bg-yellow-500', icon: AlertTriangle, text: 'Warning' };
      case 'critical':
      case 'error':
        return { color: 'bg-red-500', icon: XCircle, text: 'Critical' };
      default:
        return { color: 'bg-gray-500', icon: Clock, text: 'Unknown' };
    }
  };

  // Get trend display
  const getTrendDisplay = (trend: string) => {
    switch (trend) {
      case 'improving':
      case 'excellent':
      case 'stable':
        return { color: 'text-green-600', icon: TrendingUp };
      case 'degraded':
      case 'concerning':
        return { color: 'text-red-600', icon: AlertTriangle };
      default:
        return { color: 'text-gray-600', icon: Activity };
    }
  };

  // Format metric value
  const formatMetricValue = (value: number, unit?: string) => {
    if (unit === 'ms') {
      return `${value.toLocaleString()}ms`;
    } else if (unit === '%') {
      return `${value.toFixed(1)}%`;
    } else if (unit === 'count') {
      return value.toLocaleString();
    } else {
      return value.toLocaleString();
    }
  };

  // Generate security and performance report
  const generateReport = async () => {
    try {
      setGeneratingReport(true);
      const response = await fetch('/api/monitoring/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'security-performance',
          includeAlerts: true,
          includeTrends: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Download the generated report
      if (result.reportUrl) {
        const link = document.createElement('a');
        link.href = result.reportUrl;
        link.download = result.filename || 'security-performance-report.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      console.log('Report generated successfully:', result);
    } catch (err) {
      console.error('Failed to generate report:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch('/api/monitoring/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'acknowledge_alert',
          alertId,
          acknowledgedBy: 'dashboard_user'
        })
      });
      
      // Refresh data after acknowledging
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading monitoring dashboard...</span>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Dashboard Error</AlertTitle>
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const overallStatus = getStatusDisplay(dashboardData.status.overall);
  const OverallStatusIcon = overallStatus.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${overallStatus.color}`} />
          <h1 className="text-2xl font-bold">System Monitoring Dashboard</h1>
          <Badge variant={dashboardData.status.overall === 'healthy' ? 'default' : 'destructive'}>
            {overallStatus.text}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            Last updated: {new Date(dashboardData.lastUpdated).toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={generateReport}
            disabled={generatingReport}
          >
            <Database className={`h-4 w-4 mr-1 ${generatingReport ? 'animate-pulse' : ''}`} />
            {generatingReport ? 'Generating...' : 'Generate Report'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {dashboardData.alerts.critical.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Alerts ({dashboardData.alerts.critical.length})</AlertTitle>
          <AlertDescription>
            <div className="space-y-2 mt-2">
              {dashboardData.alerts.critical.slice(0, 3).map((alert, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">{alert.message}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => acknowledgeAlert(`critical_${index}`)}
                  >
                    Acknowledge
                  </Button>
                </div>
              ))}
              {dashboardData.alerts.critical.length > 3 && (
                <p className="text-sm">
                  ... and {dashboardData.alerts.critical.length - 3} more critical alerts
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getStatusDisplay(dashboardData.status.health).color}`} />
              <span className="text-2xl font-bold">{getStatusDisplay(dashboardData.status.health).text}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Trend: {dashboardData.trends.healthTrend}
            </p>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getStatusDisplay(dashboardData.status.performance).color}`} />
              <span className="text-2xl font-bold">{getStatusDisplay(dashboardData.status.performance).text}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Trend: {dashboardData.trends.performanceTrend}
            </p>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getStatusDisplay(dashboardData.status.security).color}`} />
              <span className="text-2xl font-bold">{getStatusDisplay(dashboardData.status.security).text}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Trend: {dashboardData.trends.securityTrend}
            </p>
          </CardContent>
        </Card>

        {/* Data Integrity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Integrity</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getStatusDisplay(dashboardData.status.dataIntegrity).color}`} />
              <span className="text-2xl font-bold">{getStatusDisplay(dashboardData.status.dataIntegrity).text}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Trend: {dashboardData.trends.integrityTrend}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Uptime Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <span>System Uptime</span>
          </CardTitle>
          <CardDescription>Service availability metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {dashboardData.uptime.current.toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground">Current</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {dashboardData.uptime.last24h.toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground">Last 24h</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {dashboardData.uptime.last7d.toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground">Last 7d</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {dashboardData.uptime.last30d.toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground">Last 30d</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="integrity">Data Integrity</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Real-time performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(dashboardData.metrics)
                  .filter(([key]) => key.startsWith('performance_') || key.startsWith('health_'))
                  .map(([key, metric]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {key.replace(/^(performance_|health_)/, '').replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatMetricValue(metric.value, metric.unit)}
                        </span>
                      </div>
                      {metric.unit === '%' && (
                        <Progress value={metric.value} className="h-2" />
                      )}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Metrics</CardTitle>
              <CardDescription>Security monitoring and threat detection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(dashboardData.metrics)
                  .filter(([key]) => key.startsWith('security_'))
                  .map(([key, metric]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {key.replace(/^security_/, '').replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {formatMetricValue(metric.value, metric.unit)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Integrity Metrics</CardTitle>
              <CardDescription>Database consistency and validation results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(dashboardData.metrics)
                  .filter(([key]) => key.startsWith('integrity_'))
                  .map(([key, metric]) => (
                    <div key={key} className="text-center">
                      <div className="text-2xl font-bold">
                        {formatMetricValue(metric.value, metric.unit)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {key.replace(/^integrity_/, '').replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Critical Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span>Critical Alerts ({dashboardData.alerts.critical.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData.alerts.critical.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No critical alerts</p>
                ) : (
                  <div className="space-y-2">
                    {dashboardData.alerts.critical.map((alert, index) => (
                      <div key={index} className="p-2 border rounded-md">
                        <div className="text-sm font-medium">{alert.message}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Warning Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <span>Warning Alerts ({dashboardData.alerts.warning.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData.alerts.warning.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No warning alerts</p>
                ) : (
                  <div className="space-y-2">
                    {dashboardData.alerts.warning.slice(0, 5).map((alert, index) => (
                      <div key={index} className="p-2 border rounded-md">
                        <div className="text-sm font-medium">{alert.message}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {dashboardData.alerts.warning.length > 5 && (
                      <p className="text-sm text-muted-foreground">
                        ... and {dashboardData.alerts.warning.length - 5} more warnings
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringDashboard;