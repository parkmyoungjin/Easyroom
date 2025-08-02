// src/lib/supabase/server.ts (최종 권장 코드)

import "server-only";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from 'react';
import { Database } from "@/types/database";
import type { SupabaseClient } from '@supabase/supabase-js';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * 서버 컴포넌트용 Supabase 클라이언트를 생성합니다. (최신 권장 방식 적용)
 * React의 `cache`를 사용하여 동일 요청 내에서 클라이언트 재사용을 최적화합니다.
 * @supabase/auth-helpers-nextjs가 쿠키 처리를 자동으로 관리합니다.
 */
export const createClient = cache(() => {
  // cookies() 함수 자체를 전달하면 auth-helpers가 내부적으로 최적의 방법으로 처리합니다.
  // 수동으로 get/set/remove를 구현할 필요가 없습니다.
  const cookieStore = cookies();
  return createServerComponentClient<Database>({ cookies: () => cookieStore });
});


/**
 * Supabase admin 클라이언트를 생성합니다. (service_role 사용)
 * RLS를 우회하므로, 보안이 확보된 서버 환경에서만 사용해야 합니다.
 */
export const createAdminClient = () => {
  // 이 함수는 매번 호출되어도 비용이 크지 않으므로 cache를 필수로 사용하진 않습니다.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client');
  }

  // createAdminClient는 async일 필요가 없습니다.
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};