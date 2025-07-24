/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '@/app/api/deployment-info/route';

// Mock environment variables
const mockEnv = {
  NEXT_PUBLIC_APP_VERSION: '1.0.0',
  NEXT_PUBLIC_BUILD_ID: 'build-123',
  NODE_ENV: 'test',
  VERCEL_GIT_COMMIT_SHA: 'abc123def456789',
  VERCEL_GIT_COMMIT_DATE: '2024-01-15T10:30:00Z',
  VERCEL_ENV: 'production',
  BUILD_TIME: '2024-01-15T10:30:00Z',
};

describe('/api/deployment-info', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv, ...mockEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET', () => {
    it('should return deployment info with correct structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('buildId');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('gitCommit');
      expect(data).toHaveProperty('buildTime');
      
      expect(typeof data.version).toBe('string');
      expect(typeof data.buildId).toBe('string');
      expect(typeof data.timestamp).toBe('number');
      expect(typeof data.environment).toBe('string');
    });

    it('should use environment variables when available', async () => {
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.version).toBe('1.0.0');
      expect(data.buildId).toBe('build-123');
      expect(data.environment).toBe('production');
      expect(data.gitCommit).toBe('abc123def456789');
      expect(data.buildTime).toBe('2024-01-15T10:30:00Z');
    });

    it('should set no-cache headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
    });

    it('should handle missing environment variables gracefully', async () => {
      // Remove all deployment-related env vars
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      delete process.env.npm_package_version;
      delete process.env.NEXT_PUBLIC_BUILD_ID;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
      delete process.env.VERCEL_ENV;
      delete process.env.BUILD_TIME;
      
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.version).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d{4}$/); // timestamp-based fallback
      expect(data.environment).toBe('test'); // from NODE_ENV
      expect(typeof data.timestamp).toBe('number');
    });

    it('should generate timestamp-based version when no version available', async () => {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      delete process.env.npm_package_version;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
      delete process.env.NEXT_PUBLIC_BUILD_ID;
      
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.version).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d{4}$/); // timestamp format
    });

    it('should detect different deployment environments', async () => {
      // Test Vercel environment
      delete process.env.NODE_ENV;
      process.env.VERCEL_ENV = 'preview';
      let request = new NextRequest('http://localhost:3000/api/deployment-info');
      let response = await GET(request);
      let data = await response.json();
      expect(data.environment).toBe('preview');

      // Test Netlify environment
      delete process.env.VERCEL_ENV;
      process.env.NETLIFY = 'true';
      process.env.CONTEXT = 'deploy-preview';
      request = new NextRequest('http://localhost:3000/api/deployment-info');
      response = await GET(request);
      data = await response.json();
      expect(data.environment).toBe('deploy-preview');

      // Test Railway environment
      delete process.env.NETLIFY;
      delete process.env.CONTEXT;
      process.env.RAILWAY_ENVIRONMENT = 'staging';
      request = new NextRequest('http://localhost:3000/api/deployment-info');
      response = await GET(request);
      data = await response.json();
      expect(data.environment).toBe('staging');
    });

    it('should handle errors and return fallback data', async () => {
      // Mock a scenario where getting deployment info fails
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Remove all environment variables to trigger fallback
      const originalProcessEnv = process.env;
      process.env = { NODE_ENV: 'test' }; // Keep minimal env

      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.version).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d{4}$/); // timestamp fallback
      expect(data.environment).toBe('test');

      // Restore
      process.env = originalProcessEnv;
      console.error = originalConsoleError;
    });

    it('should include build timestamp', async () => {
      // Remove BUILD_TIME to test timestamp generation
      delete process.env.BUILD_TIME;
      delete process.env.VERCEL_GIT_COMMIT_DATE;
      
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();
      
      expect(typeof data.timestamp).toBe('number');
      expect(data.timestamp).toBeGreaterThan(0);
      
      // Should be recent (within last hour for test purposes)
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);
      expect(data.timestamp).toBeGreaterThan(oneHourAgo);
      expect(data.timestamp).toBeLessThanOrEqual(now);
    });

    it('should handle different Git commit formats', async () => {
      // Test full commit hash
      process.env.VERCEL_GIT_COMMIT_SHA = 'abc123def456789012345678901234567890abcd';
      let request = new NextRequest('http://localhost:3000/api/deployment-info');
      let response = await GET(request);
      let data = await response.json();
      expect(data.gitCommit).toBe('abc123def456789012345678901234567890abcd');

      // Test GitHub SHA
      delete process.env.VERCEL_GIT_COMMIT_SHA;
      process.env.GITHUB_SHA = 'github123456789';
      request = new NextRequest('http://localhost:3000/api/deployment-info');
      response = await GET(request);
      data = await response.json();
      expect(data.gitCommit).toBe('github123456789');

      // Test generic GIT_COMMIT
      delete process.env.GITHUB_SHA;
      process.env.GIT_COMMIT = 'generic123456789';
      request = new NextRequest('http://localhost:3000/api/deployment-info');
      response = await GET(request);
      data = await response.json();
      expect(data.gitCommit).toBe('generic123456789');
    });
  });

  describe('OPTIONS', () => {
    it('should return CORS headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/deployment-info', {
        method: 'OPTIONS',
      });
      
      const response = await OPTIONS(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    });
  });

  describe('Version Generation', () => {
    it('should prioritize package version over generated version', async () => {
      process.env.npm_package_version = '2.1.0';
      
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.version).toBe('1.0.0'); // NEXT_PUBLIC_APP_VERSION takes precedence
    });

    it('should use commit SHA as version fallback', async () => {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      delete process.env.npm_package_version;
      process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef123456';
      
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.version).toBe('abcdef12'); // first 8 characters
    });

    it('should use build ID as version fallback', async () => {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      delete process.env.npm_package_version;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
      process.env.NEXT_PUBLIC_BUILD_ID = 'build-456';
      
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.version).toBe('build-456');
    });
  });

  describe('Build Time Handling', () => {
    it('should use BUILD_TIME environment variable', async () => {
      const buildTime = '2024-01-15T12:00:00Z';
      process.env.BUILD_TIME = buildTime;
      
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.buildTime).toBe(buildTime);
    });

    it('should use VERCEL_GIT_COMMIT_DATE as fallback', async () => {
      delete process.env.BUILD_TIME;
      const commitDate = '2024-01-15T11:00:00Z';
      process.env.VERCEL_GIT_COMMIT_DATE = commitDate;
      
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.buildTime).toBe(commitDate);
    });

    it('should generate current time as final fallback', async () => {
      delete process.env.BUILD_TIME;
      delete process.env.VERCEL_GIT_COMMIT_DATE;
      
      const beforeRequest = new Date().toISOString();
      const request = new NextRequest('http://localhost:3000/api/deployment-info');
      const response = await GET(request);
      const data = await response.json();
      const afterRequest = new Date().toISOString();
      
      expect(data.buildTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(data.buildTime >= beforeRequest).toBe(true);
      expect(data.buildTime <= afterRequest).toBe(true);
    });
  });
});