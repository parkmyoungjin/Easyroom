'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { LoginFormData } from '@/lib/validations/schemas';

export function useLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { signIn, signOut } = useAuth();

  const login = async (credentials: LoginFormData) => {
    setIsLoading(true);
    
    try {
      const result = await signIn(credentials.email, credentials.password);
      
      if (result?.user) {
        const userMetadata = result.user.user_metadata;
        const userName = userMetadata?.fullName || result.user.email || '사용자';

        toast({
          title: '로그인 성공',
          description: `${userName}님, 환영합니다!`,
        });
        
        // 메인 페이지로 리디렉션
        router.push('/');
        return { success: true, user: result.user };
      }
      
      return { success: false, error: '로그인에 실패했습니다.' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.';
      
      toast({
        title: '로그인 실패',
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
    login,
    logout,
    isLoading,
  };
}
