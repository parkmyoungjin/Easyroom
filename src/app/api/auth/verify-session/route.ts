/**
 * Session Verification Endpoint
 * 
 * Lightweight endpoint for testing cookie parsing and middleware compatibility
 * without complex logic or database queries.
 * 
 * Requirements: 2.4, 3.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Create server client for session verification
    const supabase = await createClient();

    // Test both cookie parsing (getSession) and secure verification (getUser)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    const session = sessionData?.session;
    const user = userData?.user;

    const responseTime = Date.now() - startTime;

    // Analyze cookie compatibility and security
    const cookieCompatibility = {
      canParseSession: !sessionError && !!session,
      sessionValid: !sessionError && !!session && !!session.user,
      tokenPresent: !sessionError && !!session && !!session.access_token,
      userDataPresent: !sessionError && !!session && !!session.user && !!session.user.id,
      // 🔒 보안 검증 추가
      secureVerification: !userError && !!user,
      tokenAuthentic: !userError && !!user && session?.user?.id === user.id
    };

    // Determine overall success (보안 검증 포함)
    const success = cookieCompatibility.canParseSession &&
      cookieCompatibility.sessionValid &&
      cookieCompatibility.tokenPresent &&
      cookieCompatibility.userDataPresent &&
      cookieCompatibility.secureVerification &&
      cookieCompatibility.tokenAuthentic;

    return NextResponse.json({
      success,
      hasSession: !!session,
      hasSecureUser: !!user,
      responseTime,
      timestamp: new Date().toISOString(),
      cookieCompatibility,
      error: sessionError?.message || userError?.message || null,
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
      hasSecureUser: false,
      responseTime,
      timestamp: new Date().toISOString(),
      cookieCompatibility: {
        canParseSession: false,
        sessionValid: false,
        tokenPresent: false,
        userDataPresent: false,
        secureVerification: false,
        tokenAuthentic: false
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