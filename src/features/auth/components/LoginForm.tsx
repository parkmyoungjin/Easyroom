'use client';

import { Lock, LogIn, Mail, UserPlus, AlertCircle } from 'lucide-react';
import { useState, useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription, // ✅ CardDescription 추가
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // ✅ Alert 추가
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginFormData } from '@/lib/validations/schemas';
import { handleAuthError } from '@/lib/utils/auth-error-handler';
import Link from 'next/link';

export function LoginForm() {
  // ✅ useTransition으로 로딩 상태를 더 부드럽게 관리
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const { signIn } = useAuth(); 

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // URL의 timeout 파라미터 확인 로직은 그대로 유지
  useEffect(() => {
    // ... (이전 코드와 동일) ...
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


  const onSubmit = (data: LoginFormData) => {
    setError(null); // 이전 에러 메시지 초기화
    
    startTransition(async () => {
      try {
        await signIn(data.email, data.password);
        toast({
          title: '로그인 성공',
          description: '환영합니다! 잠시 후 페이지가 이동됩니다.',
        });
      } catch (err) {
        const userFriendlyError = handleAuthError(err);
        setError(userFriendlyError.message);
        console.error('로그인 에러:', err);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LogIn className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="mt-4 text-2xl font-bold tracking-tight">회의실 예약 시스템</CardTitle>
          {/* ✅ CardDescription으로 부가 설명 추가 */}
          <CardDescription>계정 정보를 입력하여 로그인하세요.</CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* ✅ 에러 메시지를 폼 상단에 명확하게 표시 */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>로그인 실패</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이메일</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="user@example.com"
                          className="pl-10"
                          disabled={isPending}
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
                    <FormLabel>비밀번호</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="●●●●●●●●"
                          className="pl-10"
                          disabled={isPending}
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
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    로그인 중...
                  </>
                ) : (
                  '로그인'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-4">
          <Separator />
          <p className="text-sm text-muted-foreground">
            아직 계정이 없으신가요?
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/signup">
              <UserPlus className="mr-2 h-4 w-4" />
              새로운 계정 만들기
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}