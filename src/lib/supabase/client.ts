/**
 * Supabase 클라이언트 사이드 클라이언트
 * 브라우저에서 사용되는 Supabase 클라이언트
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 기본 export도 제공 (호환성을 위해)
export default createClient