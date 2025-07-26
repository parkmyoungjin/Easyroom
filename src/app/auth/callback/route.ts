// app/auth/callback/route.ts

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// 캐싱을 방지하여 매번 서버에서 동적으로 실행되도록 합니다.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    // 서버용 Supabase 클라이언트를 생성합니다.
    const supabase = createRouteHandlerClient({ cookies });
    // 전달받은 code를 사용하여 서버에서 세션을 생성하고, 브라우저에 쿠키를 설정합니다.
    await supabase.auth.exchangeCodeForSession(code);
  }

  // 인증이 완료되면 사용자를 홈페이지('/')로 리디렉션합니다.
  // 다른 페이지(예: /dashboard)로 보내고 싶다면 requestUrl.origin 뒤에 경로를 추가하세요.
  return NextResponse.redirect(requestUrl.origin);
}