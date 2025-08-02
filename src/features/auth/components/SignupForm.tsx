'use client';

import { useState, useTransition, useEffect } from 'react';
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
import { UserPlus, ArrowLeft, Mail, User, Briefcase, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
// handleAuthError는 여전히 유용하므로 유지합니다.
import { handleAuthError } from '@/lib/utils/auth-error-handler';
import { 
  getPWASignupState, 
  checkSignupCompatibility, 
  handleSignupError,
  getSignupToOtpGuidance,
  createSignupNetworkMonitor
} from '@/lib/utils/pwa-signup-utils';

export function SignupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pwState, setPwState] = useState(getPWASignupState());
  
  const { toast } = useToast();
  const { 
    signUpDirectly
  } = useAuth();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', name: '', department: '' },
  });

  // Monitor network status for PWA
  useEffect(() => {
    const cleanup = createSignupNetworkMonitor(
      () => setPwState(getPWASignupState()),
      () => setPwState(getPWASignupState())
    );
    return cleanup;
  }, []);

  const onSubmit = (data: SignupFormData) => {
    setError(null);

    // Check PWA compatibility before proceeding
    const compatibilityCheck = checkSignupCompatibility();
    if (!compatibilityCheck.canProceed) {
      setError(compatibilityCheck.suggestedAction || '회원가입을 진행할 수 없습니다.');
      return;
    }

    startTransition(async () => {
      try {
        // 즉시 회원가입 완료
        await signUpDirectly(
          data.email,
          data.name,
          data.department
        );

        // Get OTP transition guidance
        const guidance = getSignupToOtpGuidance(data.email);
        
        // 성공 처리 - OTP 로그인 안내로 업데이트
        toast({
          title: guidance.title,
          description: `${guidance.message} 이제 OTP 코드로 로그인할 수 있습니다.`,
          duration: 7000,
        });
        
        // 로그인 페이지로 이동 (OTP 로그인 안내와 함께)
        router.push(`/login?from=signup&email=${encodeURIComponent(data.email)}`);

      } catch (err) {
        // PWA-aware error handling
        const pwError = handleSignupError(err);
        setError(pwError.message);

        // 이메일 중복 에러 처리
        if (pwError.message.includes('이미 가입된') || pwError.message.includes('사용 중인 이메일')) {
            form.setError("email", { 
                type: "manual", 
                message: pwError.message
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
          <CardDescription>이메일, 이름, 부서를 입력하여 즉시 회원가입을 완료하세요.</CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* PWA Offline Warning */}
              {!pwState.canSignup && pwState.offlineMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>인터넷 연결 필요</AlertTitle>
                  <AlertDescription>{pwState.offlineMessage}</AlertDescription>
                </Alert>
              )}

              {/* PWA Environment Info */}
              {pwState.isPWA && pwState.canSignup && (
                <Alert variant="default" className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>PWA 환경 감지</AlertTitle>
                  <AlertDescription>
                    PWA 앱에서 회원가입 후 OTP 로그인을 사용할 수 있습니다.
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>회원가입 실패</AlertTitle>
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
                          onBlur={(e) => {
                            field.onBlur();
                            // 이메일 형식 실시간 검증
                            const email = e.target.value.trim();
                            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                              form.setError('email', { 
                                type: 'manual', 
                                message: '올바른 이메일 형식이 아닙니다' 
                              });
                            }
                          }}
                          onChange={(e) => {
                            // 공백 제거
                            const cleanEmail = e.target.value.trim();
                            field.onChange(cleanEmail);
                            // 에러 클리어
                            if (form.formState.errors.email && cleanEmail) {
                              form.clearErrors('email');
                            }
                          }}
                        /> 
                      </div> 
                    </FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )} 
              />
              
              <FormField 
                control={form.control} 
                name="name" 
                render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel>이름</FormLabel> 
                    <FormControl> 
                      <div className="relative"> 
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> 
                        <Input {...field} placeholder="홍길동" className="pl-10" disabled={isPending} autoComplete="name" /> 
                      </div> 
                    </FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )} 
              />
              
              <FormField 
                control={form.control} 
                name="department" 
                render={({ field }) => ( 
                  <FormItem> 
                    <FormLabel>부서</FormLabel> 
                    <FormControl> 
                      <div className="relative"> 
                        <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> 
                        <Input {...field} placeholder="예: 신사업추진팀" className="pl-10" disabled={isPending} autoComplete="organization" /> 
                      </div> 
                    </FormControl> 
                    <FormMessage /> 
                  </FormItem> 
                )} 
              />

              <Button type="submit" className="w-full" disabled={isPending || !pwState.canSignup}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? '가입 처리 중...' : 
                 !pwState.canSignup ? '인터넷 연결 필요' : 
                 '회원가입 완료하기'}
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