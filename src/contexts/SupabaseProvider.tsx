// src/contexts/SupabaseProvider.tsx (SSR 최종 버전)
'use client';

import { createContext, useContext, useMemo } from 'react';
// ✅ [수정] ssr 라이브러리에서 createBrowserClient를 import
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 이제 Context는 SupabaseClient 인스턴스 자체만 제공하면 된다.
// SupabaseContextType의 이름을 더 명확하게 SupabaseClient | null 로 변경 가능
const SupabaseContext = createContext<SupabaseClient<Database> | null>(null);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  // ✅ [수정] 복잡한 상태 관리 로직을 useMemo를 사용한 단일 클라이언트 인스턴스 생성으로 대체
  const supabase = useMemo(() =>
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

// ✅ [수정] useSupabaseClient 훅을 단순화하고 기본 훅으로 사용
export function useSupabaseClient() {
  const context = useContext(SupabaseContext);
  
  if (context === undefined) {
    throw new Error('useSupabaseClient must be used within a SupabaseProvider');
  }
  
  return context;
}