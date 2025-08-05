'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal, Button, TextInput, Stack, Text } from '@mantine/core';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { signupSchema, type SignupFormData } from '@/lib/validations/schemas';

interface SignupDialogProps {
  trigger?: React.ReactNode;
}

export function SignupDialog({ trigger }: SignupDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUpDirectly } = useAuth();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      name: '',
      department: '',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      await signUpDirectly(data.email, data.name, data.department);
      toast.success('회원가입이 완료되었습니다!', {
        description: '이메일 인증을 완료해주세요.',
      });
      setIsOpen(false);
      form.reset();
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)}>{trigger}</div>
      ) : (
        <Button variant="outline" onClick={() => setIsOpen(true)} className="w-full mt-2">
          새로운 계정 만들기
        </Button>
      )}
      
      <Modal opened={isOpen} onClose={() => setIsOpen(false)} title="회원가입" size="md">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            이메일, 이름, 부서를 입력하여 즉시 회원가입을 완료하세요.
          </Text>
          
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Stack gap="md">
              <TextInput
                label="이메일"
                type="email"
                placeholder="이메일을 입력하세요"
                disabled={isLoading}
                {...form.register('email')}
                error={form.formState.errors.email?.message}
              />
              
              <TextInput
                label="이름"
                placeholder="이름을 입력하세요"
                disabled={isLoading}
                {...form.register('name')}
                error={form.formState.errors.name?.message}
              />
              
              <TextInput
                label="부서"
                placeholder="부서를 입력하세요"
                disabled={isLoading}
                {...form.register('department')}
                error={form.formState.errors.department?.message}
              />
              
              <Button type="submit" fullWidth loading={isLoading}>
                {isLoading ? '가입 처리 중...' : '회원가입 완료하기'}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Modal>
    </>
  );
}