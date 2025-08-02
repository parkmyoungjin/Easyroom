// @/features/auth/components/LoginForm.tsx
'use client';

import { LogIn, Mail, UserPlus, AlertCircle, Loader2, ArrowLeft, Clock } from 'lucide-react';
import { useState, useTransition, useEffect, useCallback } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import { 
  magicLinkLoginSchema, 
  otpVerificationSchema,
  type MagicLinkLoginFormData,
  type OTPVerificationFormData 
} from '@/lib/validations/schemas'; 
import { OTPInput } from '@/components/ui/otp-input';
import { useOfflineStatus } from '@/components/pwa/OfflineHandler';
import { MigrationMessage, useMigrationMessage } from '@/components/auth/MigrationMessage';
import { type MigrationMessageType } from '@/lib/auth/migration-compatibility';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// Authentication flow states
type AuthStep = 'email' | 'otp' | 'success';

interface LoginFormProps {
  initialEmail?: string;
}

export function LoginForm({ initialEmail }: LoginFormProps = {}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<AuthStep>('email');
  const [userEmail, setUserEmail] = useState<string>('');
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [showMigrationMessage, setShowMigrationMessage] = useState<MigrationMessageType | null>(null);

  const { toast } = useToast();
  const isOnline = useOfflineStatus();
  const { 
    requestOTP, 
    verifyOTP
  } = useAuth();
  const searchParams = useSearchParams();
  const { showMigrationMessage: shouldShowMessage, dismissMigrationMessage } = useMigrationMessage(); 

  const emailForm = useForm<MagicLinkLoginFormData>({
    resolver: zodResolver(magicLinkLoginSchema),
    defaultValues: { email: initialEmail || '' },
  });

  const otpForm = useForm<OTPVerificationFormData>({
    resolver: zodResolver(otpVerificationSchema),
    defaultValues: { email: '', otp: '' },
  });

  // Check for migration messages from URL parameters
  useEffect(() => {
    const migration = searchParams.get('migration');
    const message = searchParams.get('message') as MigrationMessageType;
    
    if (migration === 'magic-link' && message && shouldShowMessage(message)) {
      setShowMigrationMessage(message);
    }
  }, [searchParams, shouldShowMessage]);

  // OTP countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentStep === 'otp' && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStep, timeRemaining]);

  // Reset timer when OTP is sent
  const resetTimer = useCallback(() => {
    setTimeRemaining(300);
    setCanResend(false);
  }, []);

  const onEmailSubmit = (data: MagicLinkLoginFormData) => {
    if (!isOnline) {
      setError('인터넷 연결을 확인해주세요. OTP 요청을 위해서는 온라인 상태가 필요합니다.');
      return;
    }

    setError(null);
    setUserEmail(data.email);

    startTransition(async () => {
      try {
        await requestOTP(data.email);
        setCurrentStep('otp');
        resetTimer();
        otpForm.setValue('email', data.email);
        toast({
          title: 'OTP 코드 전송 완료',
          description: '이메일을 확인하여 6자리 인증 코드를 입력해주세요.',
        });
      } catch (err: any) {
        console.error('OTP 요청 에러:', err);
        
        if (err.message?.includes('For security purposes') || err.message?.includes('Too Many Requests')) {
          setError('보안을 위해 잠시 후 다시 시도해주세요. (약 30초 후)');
        } else if (err.message?.includes('인터넷 연결')) {
          setError('인터넷 연결을 확인해주세요.');
        } else if (err.message?.includes('등록되지 않은')) {
          setError('등록되지 않은 이메일입니다. 회원가입을 먼저 진행해주세요.');
        } else {
          setError(err.message || 'OTP 요청 중 오류가 발생했습니다.');
        }
      }
    });
  };

  const onOTPSubmit = (data: OTPVerificationFormData) => {
    if (!isOnline) {
      setError('인터넷 연결을 확인해주세요. OTP 인증을 위해서는 온라인 상태가 필요합니다.');
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        await verifyOTP(data.email, data.otp);
        
        // Show login success
        toast({
          title: '로그인 성공',
          description: '인증이 완료되었습니다.',
        });
        
        setCurrentStep('success');
      } catch (err: any) {
        console.error('OTP 인증 에러:', err);
        
        const newAttempts = otpAttempts + 1;
        setOtpAttempts(newAttempts);

        if (err.message?.includes('잘못된 OTP') || err.message?.includes('만료된')) {
          if (newAttempts >= 3) {
            setError('OTP 인증 시도 횟수를 초과했습니다. 새로운 코드를 요청해주세요.');
            setCanResend(true);
          } else {
            setError(`잘못된 OTP 코드입니다. (${3 - newAttempts}회 남음)`);
          }
        } else if (err.message?.includes('인터넷 연결')) {
          setError('인터넷 연결을 확인해주세요.');
        } else {
          setError(err.message || 'OTP 인증 중 오류가 발생했습니다.');
        }
        
        // Clear OTP input on error
        otpForm.setValue('otp', '');
      }
    });
  };

  const handleOTPComplete = (otp: string) => {
    otpForm.setValue('otp', otp);
    onOTPSubmit({ email: userEmail, otp });
  };

  const handleResendOTP = () => {
    if (!canResend || !isOnline) {
      if (!isOnline) {
        setError('인터넷 연결을 확인해주세요.');
      }
      return;
    }

    setError(null);
    setOtpAttempts(0);

    startTransition(async () => {
      try {
        await requestOTP(userEmail);
        resetTimer();
        toast({
          title: 'OTP 코드 재전송 완료',
          description: '새로운 6자리 인증 코드를 이메일로 전송했습니다.',
        });
      } catch (err: any) {
        console.error('OTP 재전송 에러:', err);
        setError(err.message || 'OTP 재전송 중 오류가 발생했습니다.');
      }
    });
  };

  const handleBackToEmail = () => {
    setCurrentStep('email');
    setError(null);
    setOtpAttempts(0);
    setUserEmail('');
    otpForm.reset();
    emailForm.reset();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderEmailStep = () => (
    <Form {...emailForm}>
      <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {!isOnline && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>오프라인 상태</AlertTitle>
            <AlertDescription>
              인터넷 연결을 확인해주세요. OTP 요청을 위해서는 온라인 상태가 필요합니다.
            </AlertDescription>
          </Alert>
        )}

        <FormField
          control={emailForm.control}
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
                    disabled={isPending || !isOnline}
                    autoComplete="email"
                    onBlur={(e) => {
                      field.onBlur();
                      const email = e.target.value.trim();
                      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        emailForm.setError('email', { 
                          type: 'manual', 
                          message: '올바른 이메일 형식이 아닙니다' 
                        });
                      }
                    }}
                    onChange={(e) => {
                      const cleanEmail = e.target.value.trim();
                      field.onChange(cleanEmail);
                      if (emailForm.formState.errors.email && cleanEmail) {
                        emailForm.clearErrors('email');
                      }
                    }}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending || !isOnline}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? '전송 중...' : 'OTP 코드 받기'}
        </Button>
      </form>
    </Form>
  );

  const renderOTPStep = () => (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>인증 오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isOnline && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오프라인 상태</AlertTitle>
          <AlertDescription>
            인터넷 연결을 확인해주세요. OTP 인증을 위해서는 온라인 상태가 필요합니다.
          </AlertDescription>
        </Alert>
      )}



      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          <strong>{userEmail}</strong>로 전송된 6자리 인증 코드를 입력해주세요.
        </p>
        
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            {timeRemaining > 0 ? `${formatTime(timeRemaining)} 후 만료` : '코드가 만료되었습니다'}
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <OTPInput
          length={6}
          onComplete={handleOTPComplete}
          loading={isPending}
          error={error || undefined}
          disabled={!isOnline}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleResendOTP}
          disabled={!canResend || isPending || !isOnline}
          className="w-full"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {canResend ? 'OTP 코드 재전송' : `재전송 가능 (${formatTime(timeRemaining)})`}
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={handleBackToEmail}
          disabled={isPending}
          className="w-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          이메일 변경
        </Button>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center p-4 sm:p-6 bg-green-50 dark:bg-green-900 rounded-lg">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-800">
        <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="font-bold text-lg mt-3 text-green-800 dark:text-green-200">로그인 성공</h3>
      <p className="text-sm text-green-600 dark:text-green-300 mt-2">
        인증이 완료되었습니다. 잠시 후 메인 페이지로 이동합니다.
      </p>
    </div>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 'email':
        return '이메일 주소를 입력하시면 OTP 코드를 보내드립니다.';
      case 'otp':
        return '이메일로 전송된 6자리 인증 코드를 입력해주세요.';
      case 'success':
        return '인증이 완료되었습니다.';
      default:
        return '';
    }
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
            {getStepTitle()}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {showMigrationMessage && (
            <div className="mb-4">
              <MigrationMessage 
                type={showMigrationMessage}
                onDismiss={() => {
                  dismissMigrationMessage(showMigrationMessage);
                  setShowMigrationMessage(null);
                }}
              />
            </div>
          )}
          
          {currentStep === 'email' && renderEmailStep()}
          {currentStep === 'otp' && renderOTPStep()}
          {currentStep === 'success' && renderSuccessStep()}
        </CardContent>

        {currentStep === 'email' && (
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
        )}
      </Card>
    </div>
  );
}