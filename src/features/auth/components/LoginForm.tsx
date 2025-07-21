'use client';

import { Lock, LogIn, Mail, UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigationController } from '@/hooks/useNavigationController';
import { EnhancedLoadingState, useEnhancedLoadingState } from '@/components/ui/enhanced-loading-state';
import { loginSchema, type LoginFormData } from '@/lib/validations/schemas';
import { handleAuthError } from '@/lib/utils/auth-error-handler';
import Link from 'next/link';

export function LoginForm() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const { toast } = useToast();
  const { userProfile, signIn, loading } = useAuth();
  const { handlePostLoginRedirect, isRedirecting: navIsRedirecting } = useNavigationController();
  const loadingState = useEnhancedLoadingState();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // 클라이언트 마운트 확인
  useEffect(() => {
    setMounted(true);
    
    // Check for timeout parameter in URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('timeout') === 'true') {
        toast({
          title: '세션 만료',
          description: '인증 세션이 만료되어 로그인 페이지로 이동했습니다. 다시 로그인해주세요.',
          variant: 'destructive',
        });
        
        // Clean up URL parameter
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('timeout');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
  }, [toast]);



  // 이미 로그인된 사용자는 메인 페이지로 리디렉션 (한 번만)
  useEffect(() => {
    if (mounted && userProfile && !loading && !loadingState.isLoading && !navIsRedirecting) {
      console.log('이미 로그인된 사용자, 메인 페이지로 이동:', userProfile.name);
      loadingState.setLoading(true);
      handlePostLoginRedirect();
    }
  }, [userProfile, loading, mounted, loadingState, navIsRedirecting, handlePostLoginRedirect]);

  // 마운트되지 않았거나 로딩 중일 때
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 이미 로그인된 사용자 또는 리디렉션 중
  if (userProfile || loadingState.isLoading || navIsRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <EnhancedLoadingState
          isLoading={true}
          title="페이지 이동 중"
          description={navIsRedirecting ? '페이지 이동 중...' : '메인 페이지로 이동 중...'}
          showNetworkStatus={true}
        />
      </div>
    );
  }

  const onSubmit = async (data: LoginFormData) => {
    loadingState.setLoading(true);
    setLoginError(null);

    try {
      console.log('로그인 시도:', data.email);

      await signIn(data.email, data.password);

      toast({
        title: '로그인 성공',
        description: '환영합니다!',
      });

      console.log('로그인 성공, 리디렉션 처리');
      
      // 중앙화된 리디렉션 로직 사용
      await handlePostLoginRedirect();

    } catch (error) {
      console.error('로그인 에러:', error);

      // Use centralized error handler for better error handling
      const userFriendlyError = handleAuthError(error);

      // Set error state for enhanced loading component
      setLoginError(userFriendlyError.message);
      loadingState.setError(userFriendlyError.message);

      // Show user-friendly error message
      toast({
        title: userFriendlyError.title,
        description: userFriendlyError.message,
        variant: userFriendlyError.severity === 'error' ? 'destructive' : 'default',
      });

      // Handle timeout errors specifically
      if (error instanceof Error && error.name === 'AuthTimeoutError') {
        // Show recovery options for timeout errors
        const timeoutError = error as any;
        if (timeoutError.type === 'login_timeout') {
          // Additional timeout-specific handling could go here
          console.warn('Login timeout detected, user can retry');
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <LogIn className="h-6 w-6 text-blue-600" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">회의실 예약 시스템</CardTitle>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="email">이메일</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" aria-hidden="true" />
                        <Input
                          {...field}
                          id="email"
                          type="email"
                          inputMode="email"
                          placeholder="이메일을 입력하세요"
                          className="pl-10"
                          disabled={loadingState.isLoading}
                          autoComplete="email"
                          aria-describedby={form.formState.errors.email ? "email-error" : undefined}
                        />
                      </div>
                    </FormControl>
                    <FormMessage id="email-error" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="password">비밀번호</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" aria-hidden="true" />
                        <Input
                          {...field}
                          id="password"
                          type="password"
                          placeholder="비밀번호를 입력하세요"
                          className="pl-10"
                          disabled={loadingState.isLoading}
                          autoComplete="current-password"
                          aria-describedby={form.formState.errors.password ? "password-error" : undefined}
                        />
                      </div>
                    </FormControl>
                    <FormMessage id="password-error" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={loadingState.isLoading}
                aria-describedby="login-description"
              >
                {loadingState.isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    로그인 중...
                  </>
                ) : (
                  '로그인'
                )}
              </Button>

              <div id="login-description" className="sr-only">
                이메일과 비밀번호를 입력하여 회의실 예약 시스템에 로그인합니다
              </div>
            </form>
          </Form>

          <Separator className="my-6" />

          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              처음 사용하시나요?
            </p>
            <Link href="/signup">
              <Button variant="outline" type="button" className="w-full hover:bg-gray-400 hover:text-white">
                <UserPlus className="h-4 w-4 mr-2" />
                새로운 계정 만들기
              </Button>
            </Link>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-center text-gray-600">
            RoomBook은 부산대학교병원 회의실 예약 시스템입니다.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
