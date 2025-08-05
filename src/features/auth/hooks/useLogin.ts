'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MagicLinkLoginFormData } from '@/lib/validations/schemas';

export function useLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);


  const { signInWithMagicLink, signOut } = useAuth();

  const requestMagicLink = async (credentials: MagicLinkLoginFormData) => {
    setIsLoading(true);
    
    try {
      await signInWithMagicLink(credentials.email);

      toast.success('Magic Link 전송 완료', {
        description: '이메일을 확인하여 로그인 링크를 클릭해주세요.',
      });
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Magic Link 전송 중 오류가 발생했습니다.';
      
      toast.error('Magic Link 전송 실패', {
        description: errorMessage,
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();

      toast.success('로그아웃 완료', {
        description: '안전하게 로그아웃되었습니다.',
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // 에러가 있어도 로컬 상태는 정리
      toast.error('로그아웃 오류', {
        description: '로그아웃 중 오류가 발생했습니다.',
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
