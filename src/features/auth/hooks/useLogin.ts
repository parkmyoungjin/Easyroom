'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { MagicLinkLoginFormData } from '@/lib/validations/schemas';

export function useLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { signInWithMagicLink, signOut } = useAuth();

  const requestMagicLink = async (credentials: MagicLinkLoginFormData) => {
    setIsLoading(true);
    
    try {
      await signInWithMagicLink(credentials.email);

      toast({
        title: 'Magic Link 전송 완료',
        description: '이메일을 확인하여 로그인 링크를 클릭해주세요.',
      });
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Magic Link 전송 중 오류가 발생했습니다.';
      
      toast({
        title: 'Magic Link 전송 실패',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();

      toast({
        title: '로그아웃 완료',
        description: '안전하게 로그아웃되었습니다.',
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // 에러가 있어도 로컬 상태는 정리
      toast({
        title: '로그아웃 오류',
        description: '로그아웃 중 오류가 발생했습니다.',
        variant: 'destructive',
      });

      router.push('/login');
    }
  };

  return {
    requestMagicLink,
    logout,
    isLoading,
  };
}
