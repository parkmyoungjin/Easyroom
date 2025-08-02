import { NextRequest, NextResponse } from 'next/server';
import { DeploymentInfo } from '@/lib/pwa/deployment-integration';

/**
 * Deployment Info API Endpoint
 * Provides current deployment version and build information
 */

interface ExtendedDeploymentInfo extends DeploymentInfo {
  buildTime?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get deployment information from various sources
    const deploymentInfo: ExtendedDeploymentInfo = {
      version: getVersion(),
      buildId: getBuildId(),
      timestamp: getBuildTimestamp(),
      environment: getEnvironment() as 'development' | 'production' | 'staging',
      gitCommit: getGitCommit(),
      gitBranch: undefined, // Can be added later if needed
      buildTime: getBuildTime()
    };

    // Set cache headers to prevent caching of deployment info
    const response = NextResponse.json(deploymentInfo);
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('Failed to get deployment info:', error);
    
    // Return fallback deployment info
    return NextResponse.json({
      version: '1.0.0',
      buildId: Date.now().toString(),
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'production',
      error: 'Failed to retrieve complete deployment info'
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}

/**
 * Get application version
 */
function getVersion(): string {
  // Try multiple sources for version information
  const sources = [
    () => process.env.NEXT_PUBLIC_APP_VERSION,
    () => process.env.npm_package_version,
    () => process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8),
    () => process.env.NEXT_PUBLIC_BUILD_ID,
    () => generateVersionFromTimestamp()
  ];

  for (const source of sources) {
    try {
      const version = source();
      if (version && typeof version === 'string') {
        return version;
      }
    } catch (error) {
      console.warn('Failed to get version from source:', error);
    }
  }

  return '1.0.0';
}

/**
 * Get build ID
 */
function getBuildId(): string {
  return process.env.NEXT_PUBLIC_BUILD_ID || 
         process.env.VERCEL_GIT_COMMIT_SHA || 
         Date.now().toString();
}

/**
 * Get build timestamp
 */
function getBuildTimestamp(): number {
  // Try to get from environment variables
  const buildTime = process.env.BUILD_TIME || process.env.VERCEL_GIT_COMMIT_DATE;
  
  if (buildTime) {
    const timestamp = new Date(buildTime).getTime();
    if (!isNaN(timestamp)) {
      return timestamp;
    }
  }

  // Fallback to current time
  return Date.now();
}

/**
 * Get environment
 */
function getEnvironment(): string {
  // Check various environment indicators
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV;
  }
  
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  // Check for common deployment platforms
  if (process.env.NETLIFY) {
    return process.env.CONTEXT || 'production';
  }

  if (process.env.RAILWAY_ENVIRONMENT) {
    return process.env.RAILWAY_ENVIRONMENT;
  }

  return 'production';
}

/**
 * Get Git commit hash
 */
function getGitCommit(): string | undefined {
  return process.env.VERCEL_GIT_COMMIT_SHA || 
         process.env.GITHUB_SHA ||
         process.env.GIT_COMMIT ||
         undefined;
}

/**
 * Get build time
 */
function getBuildTime(): string | undefined {
  return process.env.BUILD_TIME || 
         process.env.VERCEL_GIT_COMMIT_DATE ||
         new Date().toISOString();
}

/**
 * Generate version from timestamp (fallback)
 */
function generateVersionFromTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}.${month}.${day}.${hour}${minute}`;
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}