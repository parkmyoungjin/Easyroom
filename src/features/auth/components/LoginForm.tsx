// @/features/auth/components/LoginForm.tsx

'use client';

import { LogIn, Mail, UserPlus, AlertCircle, Loader2 } from 'lucide-react'; // ✅ Loader2 아이콘 추가
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { magicLinkLoginSchema, type MagicLinkLoginFormData } from '@/lib/validations/schemas'; 
import { handleAuthError } from '@/lib/utils/auth-error-handler';
import Link from 'next/link';

// ✅ 1. 컴포넌트가 부모(login/page.tsx)로부터 받을 Props의 타입을 정의합니다.
interface LoginFormProps {
  onManualCheck: () => void;
  isChecking: boolean;
}

// ✅ 2. 컴포넌트 선언부에서 props를 받도록 수정합니다.
export function LoginForm({ onManualCheck, isChecking }: LoginFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLinkSent, setIsLinkSent] = useState(false);

  const { toast } = useToast();
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
      } catch (err) {
        const userFriendlyError = handleAuthError(err);
        setError(userFriendlyError.message);
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
              ? "메일함을 확인해주세요." 
              : "이메일 주소를 입력하시면 로그인 링크를 보내드립니다."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ✅ 3. 이메일이 전송된 후, 기존의 정적 Alert 대신 '인증 확인' 버튼을 포함한 UI를 보여줍니다. */}
          {isLinkSent ? (
            <div className="text-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <Mail className="h-8 w-8 mx-auto text-green-500" />
              <h3 className="font-bold text-lg mt-3">이메일을 확인해주세요</h3>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                다른 창이나 메일 앱에서 인증을 완료한 후, 아래 버튼을 눌러 로그인을 완료하세요.
              </p>
              {/* ✅ 4. 부모로부터 전달받은 props를 실제 버튼에 연결합니다. */}
              <Button
                onClick={onManualCheck}
                disabled={isChecking}
                className="w-full"
                size="lg"
              >
                {isChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isChecking ? '확인 중...' : '인증 완료 및 로그인'}
              </Button>
            </div>
          ) : (
            // --- 이메일 입력 폼 부분은 기존 코드와 동일합니다. ---
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
                  {isPending && <Loader2 className="mr-2 h-4 w-4 border-b-2 border-current" />}
                  {isPending ? '전송 중...' : '이메일로 로그인 링크 받기'}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>

        {/* ✅ '새로운 계정 만들기' 버튼은 이메일 전송 전/후 모두 보여주는 것이 좋으므로 CardFooter는 유지합니다. */}
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