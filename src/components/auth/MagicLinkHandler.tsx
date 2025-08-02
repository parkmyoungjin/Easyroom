'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { useAuthContext } from '@/contexts/AuthContext';

export default function MagicLinkHandler() {
  const router = useRouter();
  const supabase = useSupabaseClient();


  // Memoized handler for auth state changes
  const handleAuthStateChange = useCallback(async (event: AuthChangeEvent, session: Session | null) => {
    console.log('[MagicLinkHandler] Auth state change:', event, session?.user?.id);

    if (event === 'SIGNED_IN' && session?.user) {
      // Check if this is from a Magic Link (URL hash will contain tokens)
      const hash = window.location.hash;
      if (hash.includes('access_token') && hash.includes('type=magiclink')) {
        console.log('[MagicLinkHandler] Magic Link sign-in detected, redirecting to verified page...');
        
        // Clear the hash
        window.history.replaceState(null, '', window.location.pathname);
        
        // Redirect to verified page
        router.push('/auth/callback/verified');
      }
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Skip if supabase client is not available (SSR safety)
    if (!supabase) {
      console.log('[MagicLinkHandler] Supabase client not available, skipping auth listener setup');
      return;
    }



    try {
      // Listen for auth state changes using centralized client
      const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('[MagicLinkHandler] Error setting up auth listener:', error);
    }
  }, [supabase, handleAuthStateChange]);

  return null; // This component doesn't render anything
}