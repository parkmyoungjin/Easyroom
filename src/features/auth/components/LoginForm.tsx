// @/features/auth/components/LoginForm.tsx
'use client';

import { LogIn, Mail, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth'; // ✅ LoginForm이 직접 useAuth를 사용합니다.
import { magicLinkLoginSchema, type MagicLinkLoginFormData } from '@/lib/validations/schemas'; 
import Link from 'next/link';

// ✅ 더 이상 부모로부터 props를 받을 필요가 없습니다.
export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLinkSent, setIsLinkSent] = useState(false);

  const { toast } = useToast();
  // ✅ 리팩터링된 useAuth 훅에서 필요한 함수를 직접 가져옵니다.
  const { signInWithMagicLink } = useAuth(); 

  const form = useForm<MagicLinkLoginFormData>({
    resolver: zodResolver(magicLinkLoginSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = (data: MagicLinkLoginFormData) => {
    setError(null);
    setIsLinkSent(false);

    startTransition(async () => {
      try {
        await signInWithMagicLink(data.email);
        setIsLinkSent(true);
        toast({
          title: '로그인 링크 전송 완료',
          description: '이메일을 확인하여 로그인 링크를 클릭해주세요.',
        });
      } catch (err: any) {
        setError(err.message || '알 수 없는 오류가 발생했습니다.');
        console.error('Magic Link 로그인 에러:', err);
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
          <CardDescription>
            {isLinkSent 
              ? "메일함을 확인하고 인증 링크를 클릭해주세요." 
              : "이메일 주소를 입력하시면 로그인 링크를 보내드립니다."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ✅ 이메일이 전송된 후에는 간단한 안내 메시지만 보여줍니다. */}
          {/*    모든 인증 확인은 AuthProvider가 자동으로 처리합니다. */}
          {isLinkSent ? (
            <div className="text-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Mail className="h-8 w-8 mx-auto text-green-500" />
              <h3 className="font-bold text-lg mt-3">이메일을 확인해주세요</h3>
              <p className="text-sm text-muted-foreground mt-2">
                메일함의 링크를 클릭하면 자동으로 로그인됩니다.
              </p>
            </div>
          ) : (
            // --- 이메일 입력 폼 부분은 기존과 거의 동일 ---
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isPending ? '전송 중...' : '이메일로 로그인 링크 받기'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-4 pt-6">
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