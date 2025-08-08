// src/features/auth/components/SignupForm.tsx
'use client';

import { UserPlus, AlertCircle, RefreshCw } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, Text, Group, Stack, Divider, TextInput, Alert, Button } from '@mantine/core';
import { toast } from 'sonner';
import { signupSchema, type SignupFormData } from '@/lib/validations/schemas';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SignupFormProps {
  initialEmail?: string;
}

export function SignupForm({ initialEmail }: SignupFormProps = {}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { signUpDirectly } = useAuth();
  const router = useRouter();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: initialEmail || '',
      name: '',
      department: '',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    startTransition(async () => {
      try {
        setError(null);
        
        await signUpDirectly(data.email, data.name, data.department);
        
        toast.success('회원가입이 완료되었습니다!', {
          description: '이메일 인증을 완료해주세요.',
        });
        
        // Redirect to login with email parameter
        router.push(`/login?from=signup&email=${encodeURIComponent(data.email)}`);
      } catch (error) {
        console.error('Signup error:', error);
        const errorMessage = error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.';
        setError(errorMessage);
        
        toast.error('회원가입 실패', {
          description: errorMessage,
        });
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 헤더 섹션 - Dashboard 스타일 */}
      <Card
        shadow="lg"
        p="xl"
        radius="xl"
        mb="xl"
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white'
        }}
      >
        <Group justify="center" align="center">
          <Stack gap="xs" align="center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <UserPlus size={32} color="white" />
            </div>
            <Text fw={700} size="xl" c="white" ta="center">
              새로운 계정 만들기
            </Text>
            <Text size="sm" c="rgba(255,255,255,0.8)" ta="center">
              이메일, 이름, 부서를 입력하여 즉시 회원가입을 완료하세요
            </Text>
          </Stack>
        </Group>
      </Card>

      {/* 폼 섹션 - Dashboard 스타일 */}
      <Card
        shadow="lg"
        p="xl"
        radius="xl"
        style={{
          border: '2px solid #4f46e5'
        }}
      >
        <Stack gap="xl">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert color="red" title="회원가입 실패" icon={<AlertCircle size={16} />}>
                {error}
              </Alert>
            )}

            <Stack gap="md">
              <TextInput
                label="이메일"
                type="email"
                placeholder="user@example.com"
                disabled={isPending}
                autoComplete="email"
                {...form.register('email')}
                error={form.formState.errors.email?.message}
              />

              <TextInput
                label="이름"
                placeholder="홍길동"
                disabled={isPending}
                autoComplete="name"
                {...form.register('name')}
                error={form.formState.errors.name?.message}
              />

              <TextInput
                label="부서"
                placeholder="개발팀"
                disabled={isPending}
                autoComplete="organization"
                {...form.register('department')}
                error={form.formState.errors.department?.message}
              />

              <Button
                type="submit"
                fullWidth
                size="md"
                loading={isPending}
                leftSection={!isPending ? <UserPlus size={16} /> : undefined}
              >
                {isPending ? '가입 처리 중...' : '회원가입 완료하기'}
              </Button>
            </Stack>
          </form>

          <Divider label="또는" labelPosition="center" />

          <div className="text-center">
            <Text size="sm" c="dimmed">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                로그인
              </Link>
            </Text>
          </div>
        </Stack>
      </Card>
    </div>
  );
}