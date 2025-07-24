/**
 * Health Check API Route
 * Provides health status including environment validation
 * Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateServerStartup, validateCriticalRequirements } from '@/lib/startup/server-startup-validator';
import { quickEnvironmentCheck } from '@/lib/config/environment-validator';

// ============================================================================
// HEALTH CHECK INTERFACES
// ============================================================================

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version?: string;
  uptime: number;
  checks: {
    environment: HealthCheckResult;
    database: HealthCheckResult;
    auth: HealthCheckResult;
    secrets: HealthCheckResult;
  };
  details?: {
    validationResult?: any;
    criticalRequirements?: any;
  };
}

interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration?: number;
  lastChecked: string;
}

// ============================================================================
// HEALTH CHECK HANDLERS
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  const showDetails = request.nextUrl.searchParams.get('details') === 'true';
  
  try {
    // Quick environment check
    const quickCheckStart = Date.now();
    const quickCheck = await quickEnvironmentCheck();
    const quickCheckDuration = Date.now() - quickCheckStart;

    // Critical requirements check
    const criticalCheckStart = Date.now();
    const criticalRequirements = await validateCriticalRequirements('health_check');
    const criticalCheckDuration = Date.now() - criticalCheckStart;

    // Full server validation (if needed)
    let serverValidation = null;
    if (!quickCheck || !criticalRequirements.overall) {
      const validationStart = Date.now();
      serverValidation = await validateServerStartup({
        strictMode: environment === 'production',
        includeOptional: false,
        caller: 'health_check'
      });
    }

    // Build health check results
    const checks = {
      environment: {
        status: quickCheck ? 'pass' : 'fail',
        message: quickCheck 
          ? 'Environment configuration is valid' 
          : 'Environment configuration has issues',
        duration: quickCheckDuration,
        lastChecked: timestamp
      } as HealthCheckResult,
      
      database: {
        status: criticalRequirements.database ? 'pass' : 'fail',
        message: criticalRequirements.database 
          ? 'Database configuration is valid' 
          : 'Database configuration is missing or invalid',
        duration: criticalCheckDuration,
        lastChecked: timestamp
      } as HealthCheckResult,
      
      auth: {
        status: criticalRequirements.auth ? 'pass' : 'fail',
        message: criticalRequirements.auth 
          ? 'Authentication configuration is valid' 
          : 'Authentication configuration is missing or invalid',
        duration: criticalCheckDuration,
        lastChecked: timestamp
      } as HealthCheckResult,
      
      secrets: {
        status: criticalRequirements.secrets ? 'pass' : 'fail',
        message: criticalRequirements.secrets 
          ? 'Required secrets are configured' 
          : 'Required secrets are missing or invalid',
        duration: criticalCheckDuration,
        lastChecked: timestamp
      } as HealthCheckResult
    };

    // Determine overall status
    const allPassed = Object.values(checks).every(check => check.status === 'pass');
    const anyFailed = Object.values(checks).some(check => check.status === 'fail');
    
    const overallStatus = allPassed ? 'healthy' : anyFailed ? 'unhealthy' : 'degraded';

    // Build response
    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp,
      environment,
      version: process.env.npm_package_version,
      uptime: process.uptime ? process.uptime() * 1000 : Date.now() - startTime,
      checks
    };

    // Add details if requested (development only for security)
    if (showDetails && environment === 'development') {
      response.details = {
        validationResult: serverValidation,
        criticalRequirements
      };
    }

    // Return appropriate HTTP status
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(response, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown health check error';
    
    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp,
      environment,
      uptime: 0,
      checks: {
        environment: {
          status: 'fail',
          message: `Health check failed: ${errorMessage}`,
          lastChecked: timestamp
        },
        database: {
          status: 'fail',
          message: 'Unable to check database status',
          lastChecked: timestamp
        },
        auth: {
          status: 'fail',
          message: 'Unable to check auth status',
          lastChecked: timestamp
        },
        secrets: {
          status: 'fail',
          message: 'Unable to check secrets status',
          lastChecked: timestamp
        }
      }
    };

    return NextResponse.json(errorResponse, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  }
}

// ============================================================================
// ADDITIONAL HEALTH CHECK ENDPOINTS
// ============================================================================

export async function HEAD(request: NextRequest) {
  // Simple HEAD request for basic health check
  try {
    const quickCheck = await quickEnvironmentCheck();
    return new NextResponse(null, { 
      status: quickCheck ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}