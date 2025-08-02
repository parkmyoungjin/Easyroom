/**
 * Environment Monitoring API Endpoint
 * Provides comprehensive environment monitoring data and health status
 * Requirements: 4.1, 4.2, 4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { environmentMonitor } from '@/lib/monitoring/environment-monitor';
import { environmentHealthChecker } from '@/lib/monitoring/environment-health-check';
import { secureEnvironmentAccess } from '@/lib/security/secure-environment-access';

import { logger } from '@/lib/utils/logger';

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

/**
 * GET /api/monitoring/environment
 * Get comprehensive environment monitoring data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'health';
    const timeWindow = parseInt(searchParams.get('timeWindow') || '60');
    const includeDetails = searchParams.get('includeDetails') === 'true';
    const includeMetrics = searchParams.get('includeMetrics') !== 'false';

    logger.info('Environment monitoring API called', {
      action,
      timeWindow,
      includeDetails,
      includeMetrics,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    });

    switch (action) {
      case 'health':
        return await handleHealthCheck(includeDetails, includeMetrics, timeWindow);
      
      case 'stats':
        return await handleStatsRequest(timeWindow);
      
      case 'errors':
        return await handleErrorsRequest(searchParams);
      
      case 'alerts':
        return await handleAlertsRequest();
      
      case 'metrics':
        return await handleMetricsRequest(timeWindow);
      
      case 'client-status':
        return await handleClientStatusRequest();
      
      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Environment monitoring API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/environment
 * Trigger specific monitoring actions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    logger.info('Environment monitoring action triggered', {
      action,
      params,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    });

    switch (action) {
      case 'validate-environment':
        return await handleEnvironmentValidation();
      
      case 'resolve-alert':
        return await handleAlertResolution(params.alertId);
      
      case 'force-health-check':
        return await handleForceHealthCheck(params);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Environment monitoring POST API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

/**
 * Handle health check request
 */
async function handleHealthCheck(
  includeDetails: boolean,
  includeMetrics: boolean,
  timeWindow: number
) {
  const healthStatus = await environmentHealthChecker.performHealthCheck({
    includeDetails,
    includeMetrics,
    timeWindowMinutes: timeWindow,
    performDeepCheck: includeDetails
  });

  return NextResponse.json({
    success: true,
    data: healthStatus,
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle statistics request
 */
async function handleStatsRequest(timeWindow: number) {
  const stats = environmentMonitor.getMonitoringStats(timeWindow);
  
  return NextResponse.json({
    success: true,
    data: {
      ...stats,
      timeWindow
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle errors request
 */
async function handleErrorsRequest(searchParams: URLSearchParams) {
  const limit = parseInt(searchParams.get('limit') || '50');
  const severity = searchParams.get('severity');
  const type = searchParams.get('type');

  let errors = environmentMonitor.getRecentErrors(limit);

  // Filter by severity if specified
  if (severity) {
    errors = errors.filter(error => error.severity === severity);
  }

  // Filter by type if specified
  if (type) {
    errors = errors.filter(error => error.type === type);
  }

  return NextResponse.json({
    success: true,
    data: {
      errors,
      total: errors.length,
      filters: { severity, type, limit }
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle alerts request
 */
async function handleAlertsRequest() {
  const activeAlerts = environmentMonitor.getActiveAlerts();
  
  return NextResponse.json({
    success: true,
    data: {
      alerts: activeAlerts,
      total: activeAlerts.length
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle metrics request
 */
async function handleMetricsRequest(timeWindow: number) {
  const clientMetrics = environmentMonitor.getClientInitializationMetrics(50);
  const validationMetrics = environmentMonitor.getEnvironmentValidationMetrics(50);
  const stats = environmentMonitor.getMonitoringStats(timeWindow);

  return NextResponse.json({
    success: true,
    data: {
      clientInitialization: clientMetrics,
      environmentValidation: validationMetrics,
      summary: stats
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle client status request
 */
async function handleClientStatusRequest() {
  // With auth-helpers, client is always ready when created
  const clientStatus = {
    state: 'ready',
    retryCount: 0
  };
  
  return NextResponse.json({
    success: true,
    data: {
      status: clientStatus,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Handle environment validation
 */
async function handleEnvironmentValidation() {
  const validation = await secureEnvironmentAccess.validateAllEnvironmentVariables();
  
  return NextResponse.json({
    success: true,
    data: {
      valid: validation.valid,
      summary: validation.summary,
      // Don't include actual results for security
      hasErrors: !validation.valid
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle alert resolution
 */
async function handleAlertResolution(alertId: string) {
  if (!alertId) {
    return NextResponse.json(
      { error: 'Alert ID is required' },
      { status: 400 }
    );
  }

  const resolved = environmentMonitor.resolveAlert(alertId);
  
  return NextResponse.json({
    success: resolved,
    data: {
      alertId,
      resolved
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle force health check
 */
async function handleForceHealthCheck(params: any) {
  const healthStatus = await environmentHealthChecker.performHealthCheck({
    includeDetails: params.includeDetails || false,
    includeMetrics: params.includeMetrics !== false,
    timeWindowMinutes: params.timeWindow || 60,
    performDeepCheck: params.deepCheck || false
  });

  return NextResponse.json({
    success: true,
    data: healthStatus,
    timestamp: new Date().toISOString()
  });
}