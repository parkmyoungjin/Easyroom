import { createClient } from '@/lib/supabase/server';
import { checkEmailExists } from '@/lib/email-validation/email-validation-service';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

    const supabase = await createClient();

    // Use the enhanced email validation service with dependency injection
    const result = await checkEmailExists(supabase, email);

    if (result.error) {
      console.error('Email check error:', result.error);
      
      // Return appropriate error response based on error type
      if (result.error.type === 'validation_error') {
        return NextResponse.json(
          { error: result.error.userMessage },
          { status: 400 }
        );
      }
      
      // For other errors, return conservative response (assume email doesn't exist)
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({ 
      exists: result.exists 
    });

  } catch (error) {
    console.error('Check email API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}