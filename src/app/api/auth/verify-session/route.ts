/**
 * Session Verification Endpoint
 * 
 * Lightweight endpoint for testing cookie parsing and middleware compatibility
 * without complex logic or database queries.
 * 
 * Requirements: 2.4, 3.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Create middleware client for cookie parsing test
    const response = NextResponse.next();
    const supabase = createMiddlewareClient<Database>({ req: request, res: response });

    // Only test cookie parsing - no database queries or complex logic
    const { data, error } = await supabase.auth.getSession();
    const session = data?.session;

    const responseTime = Date.now() - startTime;

    // Analyze cookie compatibility
    const cookieCompatibility = {
      canParseSession: !error && !!session,
      sessionValid: !error && !!session && !!session.user,
      tokenPresent: !error && !!session && !!session.access_token,
      userDataPresent: !error && !!session && !!session.user && !!session.user.id
    };

    // Determine overall success
    const success = cookieCompatibility.canParseSession &&
      cookieCompatibility.sessionValid &&
      cookieCompatibility.tokenPresent &&
      cookieCompatibility.userDataPresent;

    return NextResponse.json({
      success,
      hasSession: !!session,
      responseTime,
      timestamp: new Date().toISOString(),
      cookieCompatibility,
      error: error?.message || null,
      // Debug information (only in development)
      debug: process.env.NODE_ENV === 'development' ? {
        sessionId: session?.user?.id || null,
        tokenLength: session?.access_token?.length || 0,
        userEmail: session?.user?.email || null,
        expiresAt: session?.expires_at || null
      } : undefined
    }, {
      status: success ? 200 : 401,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[verify-session] Middleware compatibility test failed:', {
      error: errorMessage,
      responseTime,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: false,
      hasSession: false,
      responseTime,
      timestamp: new Date().toISOString(),
      cookieCompatibility: {
        canParseSession: false,
        sessionValid: false,
        tokenPresent: false,
        userDataPresent: false
      },
      error: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? {
        errorStack: error instanceof Error ? error.stack : null
      } : undefined
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}

// Also support POST method for consistency
export async function POST(request: NextRequest) {
  return GET(request);
}