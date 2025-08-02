import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient<Database>({ cookies });

    // 새로운 check_email_exists 함수 사용
    const { data, error } = await supabase
      .rpc('check_email_exists', { p_email: email });

    if (error) {
      console.error('Email check error:', error);
      // 에러가 있어도 진행 (보수적 접근)
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({ 
      exists: data === true 
    });

  } catch (error) {
    console.error('Check email API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}