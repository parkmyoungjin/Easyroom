// @/features/auth/components/LoginForm.tsx
'use client';

import { LogIn, Mail, UserPlus, AlertCircle, Loader2, ArrowLeft, Clock } from 'lucide-react';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, TextInput, Card, Text, Group, Stack, Divider, Alert, PinInput } from '@mantine/core';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { 
  magicLinkLoginSchema, 
  otpVerificationSchema,
  type MagicLinkLoginFormData,
  type OTPVerificationFormData 
} from '@/lib/validations/schemas'; 
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

  const isOnline = useOfflineStatus();
  const { 
    requestOTP, 
    verifyOTP,
    authStatus 
  } = useAuth();
  const { showMigrationMessage: shouldShowMigrationMessage } = useMigrationMessage();
  const searchParams = useSearchParams();

  // Email form
  const emailForm = useForm<MagicLinkLoginFormData>({
    resolver: zodResolver(magicLinkLoginSchema),
    defaultValues: {
      email: initialEmail || '',
    },
  });

  // OTP form
  const otpForm = useForm<OTPVerificationFormData>({
    resolver: zodResolver(otpVerificationSchema),
    defaultValues: {
      email: '',
      otp: '',
    },
  });

  // Timer for OTP expiration
  useEffect(() => {
    if (currentStep === 'otp' && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0) {
      setCanResend(true);
    }
  }, [currentStep, timeRemaining]);

  // Show migration message on mount
  useEffect(() => {
    if (shouldShowMigrationMessage('auth-method-changed')) {
      setShowMigrationMessage('auth-method-changed');
    }
  }, [shouldShowMigrationMessage]);

  const onEmailSubmit = useCallback(async (data: MagicLinkLoginFormData) => {
    if (!isOnline) {
      setError('인터넷 연결을 확인해주세요.');
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        
        await requestOTP(data.email);
        
        // If no error thrown, assume success
        setUserEmail(data.email);
        setCurrentStep('otp');
        setTimeRemaining(300); // Reset timer
        setCanResend(false);
        setOtpAttempts(0);
        
        // Set email for OTP form
        otpForm.setValue('email', data.email);
        
        toast.success('OTP 코드가 발송되었습니다', {
          description: `${data.email}로 인증 코드를 보냈습니다.`,
        });
      } catch (error) {
        console.error('OTP request error:', error);
        setError('OTP 요청 중 오류가 발생했습니다.');
      }
    });
  }, [isOnline, requestOTP, otpForm]);

  const onOTPSubmit = useCallback(async (data: OTPVerificationFormData) => {
    if (!isOnline) {
      setError('인터넷 연결을 확인해주세요.');
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        
        await verifyOTP(userEmail, data.otp);
        
        // If no error thrown, assume success
        setCurrentStep('success');
        toast.success('로그인 성공!', {
          description: '잠시 후 메인 페이지로 이동합니다.',
        });
      } catch (error) {
        console.error('OTP verification error:', error);
        setError('OTP 인증 중 오류가 발생했습니다.');
      }
    });
  }, [isOnline, verifyOTP, userEmail, otpAttempts]);

  const handleResendOTP = useCallback(async () => {
    if (!canResend || !userEmail) return;

    startTransition(async () => {
      try {
        setError(null);
        
        await requestOTP(userEmail);
        
        // If no error thrown, assume success
        setTimeRemaining(300);
        setCanResend(false);
        setOtpAttempts(0);
        
        toast.success('새로운 OTP 코드가 발송되었습니다');
      } catch (error) {
        console.error('OTP resend error:', error);
        setError('OTP 재발송 중 오류가 발생했습니다.');
      }
    });
  }, [canResend, userEmail, requestOTP]);

  const handleBackToEmail = () => {
    setCurrentStep('email');
    setError(null);
    setUserEmail('');
    setTimeRemaining(300);
    setCanResend(false);
    setOtpAttempts(0);
    otpForm.reset();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderEmailStep = () => (
    <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-6">
      {error && (
        <Alert color="red" title="오류" icon={<AlertCircle size={16} />}>
          {error}
        </Alert>
      )}
      
      {!isOnline && (
        <Alert color="red" title="오프라인 상태" icon={<AlertCircle size={16} />}>
          인터넷 연결을 확인해주세요. OTP 요청을 위해서는 온라인 상태가 필요합니다.
        </Alert>
      )}

      <TextInput
        label="이메일"
        type="email"
        placeholder="user@example.com"
        leftSection={<Mail size={16} />}
        disabled={isPending || !isOnline}
        autoComplete="email"
        {...emailForm.register('email')}
        error={emailForm.formState.errors.email?.message}
      />

      <Button
        type="submit"
        fullWidth
        size="md"
        loading={isPending}
        disabled={!isOnline}
        leftSection={!isPending ? <LogIn size={16} /> : undefined}
      >
        {isPending ? 'OTP 코드 발송 중...' : 'OTP 코드 받기'}
      </Button>

      <Divider label="또는" labelPosition="center" />

      <div className="text-center">
        <Text size="sm" c="dimmed">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            회원가입
          </Link>
        </Text>
      </div>
    </form>
  );

  const renderOTPStep = () => (
    <form onSubmit={otpForm.handleSubmit(onOTPSubmit)} className="space-y-6">
      <div className="text-center">
        <Button
          variant="subtle"
          size="compact-sm"
          onClick={handleBackToEmail}
          leftSection={<ArrowLeft size={16} />}
          className="mb-4"
        >
          이메일 변경
        </Button>
        
        <Text fw={600} size="lg">OTP 코드 입력</Text>
        <Text size="sm" c="dimmed" mt="xs">
          <strong>{userEmail}</strong>로 발송된 6자리 코드를 입력해주세요
        </Text>
      </div>

      {error && (
        <Alert color="red" title="인증 실패" icon={<AlertCircle size={16} />}>
          {error}
        </Alert>
      )}

      <div className="text-center">
        <PinInput
          length={6}
          type="number"
          size="lg"
          disabled={isPending}
          onChange={(value) => otpForm.setValue('otp', value)}
        />
        {otpForm.formState.errors.otp && (
          <Text size="sm" c="red" mt="xs">
            {otpForm.formState.errors.otp.message}
          </Text>
        )}
      </div>

      <Button
        type="submit"
        fullWidth
        size="md"
        loading={isPending}
        disabled={!isOnline}
      >
        {isPending ? '인증 중...' : '로그인'}
      </Button>

      <div className="text-center space-y-2">
        <Group justify="center" gap="xs">
          <Clock size={16} className="text-muted-foreground" />
          <Text size="sm" c={timeRemaining <= 60 ? 'red' : 'dimmed'}>
            {timeRemaining > 0 ? `${formatTime(timeRemaining)} 후 만료` : '코드가 만료되었습니다'}
          </Text>
        </Group>
        
        <Button
          variant="subtle"
          size="compact-sm"
          onClick={handleResendOTP}
          disabled={!canResend || isPending}
        >
          새 코드 받기
        </Button>
      </div>

      {otpAttempts > 0 && (
        <Text size="sm" c="orange" ta="center">
          {otpAttempts}/3회 시도 실패
        </Text>
      )}
    </form>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <LogIn className="w-8 h-8 text-green-600" />
      </div>
      <div>
        <Text fw={600} size="lg">로그인 성공!</Text>
        <Text size="sm" c="dimmed" mt="xs">
          잠시 후 메인 페이지로 이동합니다...
        </Text>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto">
      {showMigrationMessage && (
        <div className="mb-6">
          <MigrationMessage
            type={showMigrationMessage}
            onDismiss={() => setShowMigrationMessage(null)}
          />
        </div>
      )}

      <Card withBorder shadow="sm" p="xl">
        <Stack gap="md">
          <div className="text-center">
            <Text fw={700} size="xl">로그인</Text>
            <Text size="sm" c="dimmed" mt="xs">
              이메일로 OTP 코드를 받아 로그인하세요
            </Text>
          </div>

          {currentStep === 'email' && renderEmailStep()}
          {currentStep === 'otp' && renderOTPStep()}
          {currentStep === 'success' && renderSuccessStep()}
        </Stack>
      </Card>
    </div>
  );
}