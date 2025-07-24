'use client';

import { Lock, LogIn, Mail, UserPlus } from 'lucide-react';
import { useState, useEffect } from 'react';
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
// ✅ useNavigationController는 더 이상 이 컴포넌트에서 필요하지 않습니다.
// import { useNavigationController } from '@/hooks/useNavigationController';
import { loginSchema, type LoginFormData } from '@/lib/validations/schemas';
import { handleAuthError } from '@/lib/utils/auth-error-handler';
import Link from 'next/link';

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();
  // ✅ signIn 함수만 필요합니다. 로그인 상태 확인은 상위 페이지(LoginPage)가 담당합니다.
  const { signIn } = useAuth(); 

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // ✅ URL의 timeout 파라미터를 확인하는 로직은 유용하므로 유지합니다.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('timeout') === 'true') {
        toast({
          title: '세션 만료',
          description: '인증 세션이 만료되어 로그인 페이지로 이동했습니다. 다시 로그인해주세요.',
          variant: 'destructive',
        });
        
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('timeout');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
  }, [toast]);

  // ✅ 로그인 시도 로직을 단순화합니다.
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      // 1. 로그인 시도
      await signIn(data.email, data.password);

      // 2. 성공 토스트 메시지 표시
      toast({
        title: '로그인 성공',
        description: '환영합니다! 잠시 후 페이지가 이동됩니다.',
      });

      // 3. 끝! 리디렉션은 다른 곳에서 처리합니다.
      // 이 컴포넌트는 로딩 상태를 해제할 필요도 없습니다. 
      // 페이지가 곧 이동되어 컴포넌트 자체가 사라질 것이기 때문입니다.

    } catch (error) {
      // ✅ 에러 핸들링은 유지합니다.
      console.error('로그인 에러:', error);
      const userFriendlyError = handleAuthError(error);

      toast({
        title: userFriendlyError.title,
        description: userFriendlyError.message,
        variant: 'destructive',
      });
      
      // 에러 발생 시 로딩 상태를 풀어주어 다시 시도할 수 있게 합니다.
      setIsLoading(false);
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
                          placeholder="이메일을 입력하세요"
                          className="pl-10"
                          disabled={isLoading}
                          autoComplete="email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
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
                          disabled={isLoading}
                          autoComplete="current-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    로그인 중...
                  </>
                ) : (
                  '로그인'
                )}
              </Button>
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