// src/components/monitoring/MonitoringDashboard.tsx

import { useState, useEffect } from 'react';
import { Card, Badge, Button, Alert, Tabs, Progress, Text, Group, Stack } from '@mantine/core';
import { 
  Activity, 
  AlertTriangle, 
  Shield, 
  Database, 
  Globe, 
  Zap,
  RefreshCw
} from 'lucide-react';

interface DashboardData {
  status: {
    health: 'healthy' | 'warning' | 'critical';
    performance: 'good' | 'degraded' | 'poor';
    security: 'secure' | 'warning' | 'breach';
    dataIntegrity: 'intact' | 'issues' | 'corrupted';
  };
  alerts: {
    critical: Array<{
      title: string;
      message: string;
      timestamp: string;
      severity: string;
    }>;
  };
  metrics: Record<string, any>;
  trends: {
    healthTrend: string;
    performanceTrend: string;
    securityTrend: string;
    integrityTrend: string;
  };
}

export default function MonitoringDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Mock data for now
      const mockData: DashboardData = {
        status: {
          health: 'healthy',
          performance: 'good',
          security: 'secure',
          dataIntegrity: 'intact'
        },
        alerts: {
          critical: []
        },
        metrics: {},
        trends: {
          healthTrend: 'stable',
          performanceTrend: 'improving',
          securityTrend: 'stable',
          integrityTrend: 'stable'
        }
      };
      
      setDashboardData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const acknowledgeAlert = (alertId: string) => {
    console.log('Acknowledging alert:', alertId);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'good':
      case 'secure':
      case 'intact':
        return { color: 'bg-green-500', label: 'Good' };
      case 'warning':
      case 'degraded':
      case 'issues':
        return { color: 'bg-yellow-500', label: 'Warning' };
      case 'critical':
      case 'poor':
      case 'breach':
      case 'corrupted':
        return { color: 'bg-red-500', label: 'Critical' };
      default:
        return { color: 'bg-gray-500', label: 'Unknown' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Stack align="center">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <Text>Loading dashboard...</Text>
        </Stack>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <Alert color="red" title="Dashboard Error" icon={<AlertTriangle size={16} />}>
        {error}
        <Button 
          variant="outline" 
          size="compact-sm" 
          onClick={handleRefresh}
          className="ml-2"
        >
          Retry
        </Button>
      </Alert>
    );
  }

  if (!dashboardData) {
    return (
      <Alert color="blue" title="No Data" icon={<Activity size={16} />}>
        No monitoring data available.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">System Monitoring Dashboard</h1>
          <Text size="sm" c="dimmed">Real-time system health and performance metrics</Text>
        </div>
        <Button onClick={handleRefresh} leftSection={<RefreshCw size={16} />}>
          Refresh
        </Button>
      </div>

      {/* Critical Alerts */}
      {dashboardData.alerts.critical.length > 0 && (
        <Alert 
          color="red" 
          title={`Critical Alerts (${dashboardData.alerts.critical.length})`}
          icon={<AlertTriangle size={16} />}
        >
          <div className="space-y-2 mt-2">
            {dashboardData.alerts.critical.slice(0, 3).map((alert, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm">{alert.message}</span>
                <Button
                  variant="outline"
                  size="compact-sm"
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
        </Alert>
      )}

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Health */}
        <Card withBorder>
          <Card.Section withBorder inheritPadding py="xs" className="flex flex-row items-center justify-between">
            <Text size="sm" fw={500}>System Health</Text>
            <Activity size={16} className="text-muted-foreground" />
          </Card.Section>
          <Card.Section inheritPadding py="md">
            <Group gap="xs" align="center">
              <div className={`w-2 h-2 rounded-full ${getStatusDisplay(dashboardData.status.health).color}`} />
              <Text size="lg" fw={600}>{getStatusDisplay(dashboardData.status.health).label}</Text>
            </Group>
            <Text size="xs" c="dimmed">
              Trend: {dashboardData.trends.healthTrend}
            </Text>
          </Card.Section>
        </Card>

        {/* Performance */}
        <Card withBorder>
          <Card.Section withBorder inheritPadding py="xs" className="flex flex-row items-center justify-between">
            <Text size="sm" fw={500}>Performance</Text>
            <Zap size={16} className="text-muted-foreground" />
          </Card.Section>
          <Card.Section inheritPadding py="md">
            <Group gap="xs" align="center">
              <div className={`w-2 h-2 rounded-full ${getStatusDisplay(dashboardData.status.performance).color}`} />
              <Text size="lg" fw={600}>{getStatusDisplay(dashboardData.status.performance).label}</Text>
            </Group>
            <Text size="xs" c="dimmed">
              Trend: {dashboardData.trends.performanceTrend}
            </Text>
          </Card.Section>
        </Card>

        {/* Security */}
        <Card withBorder>
          <Card.Section withBorder inheritPadding py="xs" className="flex flex-row items-center justify-between">
            <Text size="sm" fw={500}>Security</Text>
            <Shield size={16} className="text-muted-foreground" />
          </Card.Section>
          <Card.Section inheritPadding py="md">
            <Group gap="xs" align="center">
              <div className={`w-2 h-2 rounded-full ${getStatusDisplay(dashboardData.status.security).color}`} />
              <Text size="lg" fw={600}>{getStatusDisplay(dashboardData.status.security).label}</Text>
            </Group>
            <Text size="xs" c="dimmed">
              Trend: {dashboardData.trends.securityTrend}
            </Text>
          </Card.Section>
        </Card>

        {/* Data Integrity */}
        <Card withBorder>
          <Card.Section withBorder inheritPadding py="xs" className="flex flex-row items-center justify-between">
            <Text size="sm" fw={500}>Data Integrity</Text>
            <Database size={16} className="text-muted-foreground" />
          </Card.Section>
          <Card.Section inheritPadding py="md">
            <Group gap="xs" align="center">
              <div className={`w-2 h-2 rounded-full ${getStatusDisplay(dashboardData.status.dataIntegrity).color}`} />
              <Text size="lg" fw={600}>{getStatusDisplay(dashboardData.status.dataIntegrity).label}</Text>
            </Group>
            <Text size="xs" c="dimmed">
              Trend: {dashboardData.trends.integrityTrend}
            </Text>
          </Card.Section>
        </Card>
      </div>

      {/* Uptime Metrics */}
      <Card withBorder>
        <Card.Section withBorder inheritPadding py="xs">
          <Group gap="xs">
            <Globe size={20} />
            <Text fw={600}>System Uptime</Text>
          </Group>
          <Text size="sm" c="dimmed">Service availability metrics</Text>
        </Card.Section>
        <Card.Section inheritPadding py="md">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Text size="xl" fw={700} c="green">99.9%</Text>
              <Text size="sm" c="dimmed">Last 24h</Text>
            </div>
            <div className="text-center">
              <Text size="xl" fw={700} c="green">99.8%</Text>
              <Text size="sm" c="dimmed">Last 7d</Text>
            </div>
            <div className="text-center">
              <Text size="xl" fw={700} c="green">99.7%</Text>
              <Text size="sm" c="dimmed">Last 30d</Text>
            </div>
            <div className="text-center">
              <Text size="xl" fw={700} c="green">99.5%</Text>
              <Text size="sm" c="dimmed">Last 90d</Text>
            </div>
          </div>
        </Card.Section>
      </Card>

      {/* Detailed Metrics Tabs */}
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'overview')}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="performance">Performance</Tabs.Tab>
          <Tabs.Tab value="security">Security</Tabs.Tab>
          <Tabs.Tab value="integrity">Data Integrity</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Card withBorder>
            <Card.Section withBorder inheritPadding py="xs">
              <Text fw={600}>System Overview</Text>
              <Text size="sm" c="dimmed">General system health indicators</Text>
            </Card.Section>
            <Card.Section inheritPadding py="md">
              <Text>All systems operational. No critical issues detected.</Text>
            </Card.Section>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="performance" pt="md">
          <Card withBorder>
            <Card.Section withBorder inheritPadding py="xs">
              <Text fw={600}>Performance Metrics</Text>
              <Text size="sm" c="dimmed">Real-time performance indicators</Text>
            </Card.Section>
            <Card.Section inheritPadding py="md">
              <Text>Performance metrics will be displayed here.</Text>
            </Card.Section>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="security" pt="md">
          <Card withBorder>
            <Card.Section withBorder inheritPadding py="xs">
              <Text fw={600}>Security Metrics</Text>
              <Text size="sm" c="dimmed">Security monitoring and threat detection</Text>
            </Card.Section>
            <Card.Section inheritPadding py="md">
              <Text>Security metrics will be displayed here.</Text>
            </Card.Section>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="integrity" pt="md">
          <Card withBorder>
            <Card.Section withBorder inheritPadding py="xs">
              <Text fw={600}>Data Integrity Metrics</Text>
              <Text size="sm" c="dimmed">Database consistency and validation results</Text>
            </Card.Section>
            <Card.Section inheritPadding py="md">
              <Text>Data integrity metrics will be displayed here.</Text>
            </Card.Section>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}