/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import * as migrationCompatibility from '../../../../lib/auth/migration-compatibility';

// Mock migration compatibility functions
jest.mock('../../../../lib/auth/migration-compatibility', () => ({
  isMagicLinkCallback: jest.fn(),
  generateOTPRedirectUrl: jest.fn(),
  extractMagicLinkParams: jest.fn()
}));

const mockIsMagicLinkCallback = migrationCompatibility.isMagicLinkCallback as jest.MockedFunction<typeof migrationCompatibility.isMagicLinkCallback>;
const mockGenerateOTPRedirectUrl = migrationCompatibility.generateOTPRedirectUrl as jest.MockedFunction<typeof migrationCompatibility.generateOTPRedirectUrl>;
const mockExtractMagicLinkParams = migrationCompatibility.extractMagicLinkParams as jest.MockedFunction<typeof migrationCompatibility.extractMagicLinkParams>;

// Mock environment variables
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Auth Callback Route Handler Tests', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.log for all tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  describe('Normal Auth Callback Flow', () => {
    it('should return HTML response for normal auth callback', async () => {
      mockIsMagicLinkCallback.mockReturnValue(false);
      
      const request = new NextRequest('https://example.com/auth/callback?code=test-code');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      
      const html = await response.text();
      expect(html).toContain('인증 처리 중...');
      expect(html).toContain('supabase.createClient');
      expect(html).toContain('https://test.supabase.co');
      expect(html).toContain('test-anon-key');
    });

    it('should include migration context check in HTML', async () => {
      mockIsMagicLinkCallback.mockReturnValue(false);
      
      const request = new NextRequest('https://example.com/auth/callback');
      const response = await GET(request);
      
      const html = await response.text();
      expect(html).toContain('checkMigrationRedirect');
      expect(html).toContain('Magic link detected');
    });
  });

  describe('Magic Link Callback with Error', () => {
    it('should redirect to OTP login when magic link has error', async () => {
      mockIsMagicLinkCallback.mockReturnValue(true);
      mockExtractMagicLinkParams.mockReturnValue({
        error: 'invalid_request',
        error_description: 'Invalid magic link'
      });
      mockGenerateOTPRedirectUrl.mockReturnValue('https://example.com/login?migration=magic-link&message=auth-method-changed&error=invalid_request');
      
      const request = new NextRequest('https://example.com/auth/callback?error=invalid_request');
      const response = await GET(request);
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/login?migration=magic-link&message=auth-method-changed&error=invalid_request');
      expect(mockExtractMagicLinkParams).toHaveBeenCalledWith('https://example.com/auth/callback?error=invalid_request');
      expect(mockGenerateOTPRedirectUrl).toHaveBeenCalledWith('https://example.com', 'https://example.com/auth/callback?error=invalid_request');
    });

    it('should continue normal flow for successful magic link', async () => {
      mockIsMagicLinkCallback.mockReturnValue(true);
      mockExtractMagicLinkParams.mockReturnValue({
        code: 'valid-code'
      });
      
      const request = new NextRequest('https://example.com/auth/callback?code=valid-code');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
      
      const html = await response.text();
      expect(html).toContain('Processing magic link with migration context');
    });
  });

  describe('HTML Content Validation', () => {
    it('should include proper error handling states in HTML', async () => {
      mockIsMagicLinkCallback.mockReturnValue(false);
      
      const request = new NextRequest('https://example.com/auth/callback');
      const response = await GET(request);
      
      const html = await response.text();
      expect(html).toContain('loading-state');
      expect(html).toContain('success-state');
      expect(html).toContain('error-state');
      expect(html).toContain('인증이 완료되었습니다');
      expect(html).toContain('인증에 실패했습니다');
    });

    it('should include session synchronization logic', async () => {
      mockIsMagicLinkCallback.mockReturnValue(false);
      
      const request = new NextRequest('https://example.com/auth/callback?sync=true');
      const response = await GET(request);
      
      const html = await response.text();
      expect(html).toContain('Session synchronization requested');
      expect(html).toContain('_syncRequested');
      expect(html).toContain('_callbackTimestamp');
    });
  });
});