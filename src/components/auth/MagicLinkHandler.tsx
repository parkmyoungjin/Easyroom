'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MagicLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthStateChange = async () => {
      if (typeof window === 'undefined') return;

      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = await createClient();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('[MagicLinkHandler] Error setting up auth listener:', error);
      }
    };

    handleAuthStateChange();
  }, [router]);

  return null; // This component doesn't render anything
}