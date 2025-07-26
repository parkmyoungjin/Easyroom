'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { signupSchema, type SignupFormData } from '@/lib/validations/schemas';
import { UserPlus, ArrowLeft, Mail, Lock, User, Briefcase, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
// handleAuthError는 여전히 유용하므로 유지합니다.
import { handleAuthError } from '@/lib/utils/auth-error-handler';

export function SignupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  // ✅ 이제 signUp 함수만 필요합니다.
  const { signUp } = useAuth();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', name: '', department: '' },
  });

  const onSubmit = (data: SignupFormData) => {
    setError(null);

    startTransition(async () => {
      try {
        // ✅ 1. 회원가입 요청을 바로 보냅니다.
        //    useAuth의 signUp 함수가 내부적으로 이메일 중복을 처리하고 에러를 던집니다.
        await signUp(
          data.email,
          data.password,
          data.name,
          data.department
        );

        // 2. 성공 처리
        toast({
          title: '회원가입 성공!',
          description: '이메일 인증 링크가 발송되었습니다. 메일을 확인해주세요.',
          duration: 5000,
        });
        
        // ✅ 3. 로그인 페이지로 이동하며, 방금 가입했다는 표시(쿼리 파라미터)를 추가합니다.
        router.push('/login?from=signup');

      } catch (err) {
        // signUp 함수에서 던진 에러를 처리합니다.
        const userFriendlyError = handleAuthError(err);
        setError(userFriendlyError.message);

        // ✅ 만약 에러 메시지가 이메일 중복 관련이면, react-hook-form 에러 상태와 연결합니다.
        if (userFriendlyError.message.includes('이미 가입된') || userFriendlyError.message.includes('사용 중인 이메일')) {
            form.setError("email", { 
                type: "manual", 
                message: userFriendlyError.message
            });
        }
        console.error('회원가입 에러:', err);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="mt-4 text-2xl font-bold tracking-tight">새로운 계정 만들기</CardTitle>
          <CardDescription>필수 정보를 입력하여 회원가입을 완료하세요.</CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>회원가입 실패</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* ... (폼 필드들은 기존과 동일) ... */}
              <FormField control={form.control} name="email" render={({ field }) => ( <FormItem> <FormLabel>이메일</FormLabel> <FormControl> <div className="relative"> <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Input {...field} type="email" placeholder="user@example.com" className="pl-10" disabled={isPending} /> </div> </FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="password" render={({ field }) => ( <FormItem> <FormLabel>비밀번호</FormLabel> <FormControl> <div className="relative"> <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Input {...field} type="password" placeholder="대/소문자, 숫자를 포함한 8자 이상" className="pl-10" disabled={isPending} /> </div> </FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>이름</FormLabel> <FormControl> <div className="relative"> <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Input {...field} placeholder="홍길동" className="pl-10" disabled={isPending} /> </div> </FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="department" render={({ field }) => ( <FormItem> <FormLabel>부서</FormLabel> <FormControl> <div className="relative"> <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> <Input {...field} placeholder="예: 신사업추진팀" className="pl-10" disabled={isPending} /> </div> </FormControl> <FormMessage /> </FormItem> )} />

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? '가입 처리 중...' : '인증 이메일 받고 가입하기'}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex flex-col items-center gap-4 pt-6">
          <Separator />
          <p className="text-sm text-muted-foreground">
            이미 계정이 있으신가요?
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              로그인으로 돌아가기
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}