'use client';

// ✅ Lock 아이콘은 더 이상 필요 없으므로 제거합니다.
import { LogIn, Mail, UserPlus, AlertCircle } from 'lucide-react';
import { useState, useEffect, useTransition } from 'react';
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
// ✅ 새로 만든 Magic Link 스키마와 타입을 가져옵니다.
import { magicLinkLoginSchema, type MagicLinkLoginFormData } from '@/lib/validations/schemas'; 
import { handleAuthError } from '@/lib/utils/auth-error-handler';
import Link from 'next/link';

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // ✅ Magic Link 전송 성공 여부를 추적하는 상태를 추가합니다.
  const [isLinkSent, setIsLinkSent] = useState(false);

  const { toast } = useToast();
  // ✅ useAuth 훅에서 signIn 대신 signInWithMagicLink를 가져옵니다.
  const { signInWithMagicLink } = useAuth(); 

  const form = useForm<MagicLinkLoginFormData>({
    // ✅ zodResolver에 새로운 스키마를 적용합니다.
    resolver: zodResolver(magicLinkLoginSchema),
    // ✅ 기본값에서 password를 제거합니다.
    defaultValues: { email: '' },
  });

  // URL의 timeout 파라미터 확인 로직은 그대로 유지 (세션 만료 처리에 유용)
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

  // ✅ Magic Link 전송을 위한 onSubmit 함수
  const onSubmit = (data: MagicLinkLoginFormData) => {
    setError(null); // 이전 에러 메시지 초기화
    setIsLinkSent(false); // 링크 전송 상태 초기화

    startTransition(async () => {
      try {
        // ✅ signInWithMagicLink 함수를 호출합니다.
        await signInWithMagicLink(data.email);
        setIsLinkSent(true); // 링크 전송 성공!
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
          {/* ✅ isLinkSent 상태에 따라 다른 설명을 보여줍니다. */}
          <CardDescription>
            {isLinkSent 
              ? "메일함을 확인해주세요." 
              : "이메일 주소를 입력하시면 로그인 링크를 보내드립니다."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* ✅ isLinkSent가 true이면 폼 대신 안내 메시지를 보여줍니다. */}
          {isLinkSent ? (
            <Alert variant="default" className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
              <Mail className="h-4 w-4 !text-green-600 dark:!text-green-400" />
              <AlertTitle className="font-semibold">전송 완료!</AlertTitle>
              <AlertDescription>
                입력하신 이메일 주소로 로그인 링크를 보냈습니다. 받은편지함을 확인해주세요. 링크는 일정 시간 후 만료됩니다.
              </AlertDescription>
            </Alert>
          ) : (
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

                {/* ✅ 비밀번호 FormField는 완전히 제거되었습니다. */}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      전송 중...
                    </>
                  ) : (
                    '이메일로 로그인 링크 받기'
                  )}
                </Button>
              </form>
            </Form>
          )}
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