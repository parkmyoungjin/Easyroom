// src/lib/supabase/server.ts (SSR 최종 버전)

import "server-only";

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Database } from '@/types/database';

export type TypedSupabaseClient = Awaited<ReturnType<typeof createClient>>;

// cache를 사용하여 동일 요청 내에서 클라이언트 재사용을 최적화
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // 서버 컴포넌트에서 쿠키 set 시도 시 발생하는 오류를 무시 (읽기 전용)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // 서버 컴포넌트에서 쿠키 remove 시도 시 발생하는 오류를 무시 (읽기 전용)
          }
        },
      },
    }
  );
});

/**
 * Supabase admin 클라이언트를 생성합니다. (service_role 사용)
 * RLS를 우회하므로, 보안이 확보된 서버 환경에서만 사용해야 합니다.
 */
export const createAdminClient = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin client');
  }

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