'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, X } from 'lucide-react';
import { UniversalAuthStateManager } from '@/lib/auth/universal-auth-state-manager';

export interface SmartVerifiedPageProps {
  autoCloseDelay?: number; // default: 3000ms
  onAuthStateSet?: (success: boolean) => void;
}

export default function SmartVerifiedPage({
  autoCloseDelay = 3000,
  onAuthStateSet
}: SmartVerifiedPageProps) {
  const [countdown, setCountdown] = useState(Math.ceil(autoCloseDelay / 1000));
  const [authStateSet, setAuthStateSet] = useState(false);
  const [authStateManager] = useState(() => UniversalAuthStateManager.getInstance());

  // Set authentication state and notify other tabs
  const setAuthenticationState = useCallback(async () => {
    if (authStateSet) return;

    try {
      console.log('[SmartVerifiedPage] Setting authentication state...');

      // Get current session to store proper auth state
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = await createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Store authentication success state with proper user info
        const authState = {
          status: 'authenticated' as const,
          timestamp: Date.now(),
          userId: session.user.id,
          sessionToken: session.access_token,
          source: 'external_app' as const
        };
        
        console.log('[SmartVerifiedPage] 📝 Setting auth state:', authState);
        authStateManager.setAuthState(authState);

        // Verify the state was set
        const verifyState = authStateManager.getAuthState();
        console.log('[SmartVerifiedPage] 🔍 Verified auth state:', verifyState);

        console.log('[SmartVerifiedPage] ✅ Auth state set successfully with user:', session.user.id);
        setAuthStateSet(true);
        onAuthStateSet?.(true);
      } else {
        console.warn('[SmartVerifiedPage] ❌ No session found');
        onAuthStateSet?.(false);
      }
    } catch (error) {
      console.error('[SmartVerifiedPage] Failed to set auth state:', error);
      onAuthStateSet?.(false);
    }
  }, [authStateSet, authStateManager, onAuthStateSet]);

  // Set auth state immediately on mount
  useEffect(() => {
    setAuthenticationState();
  }, [setAuthenticationState]);

  // Countdown timer for auto-close
  useEffect(() => {
    if (countdown <= 0) {
      console.log('[SmartVerifiedPage] Auto-closing window...');
      window.close();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Manual close handler
  const handleClose = useCallback(() => {
    console.log('[SmartVerifiedPage] Manual close triggered');
    window.close();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <CardTitle className="mt-4 text-2xl font-bold tracking-tight">
            인증 완료!
          </CardTitle>
          <CardDescription className="mt-2">
            {authStateSet ? (
              <>인증이 성공적으로 완료되었습니다. {countdown}초 후 자동으로 창이 닫힙니다.</>
            ) : (
              <>인증 상태를 설정하는 중입니다...</>
            )}
          </CardDescription>
        </CardHeader>

        <CardFooter className="flex justify-center">
          <Button
            onClick={handleClose}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            창 닫기
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}