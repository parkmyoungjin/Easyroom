'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { signupSchema, type SignupFormData } from '@/lib/validations/schemas';
import { UserPlus, ArrowLeft, CheckCircle, XCircle, Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export function SignupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressStatus, setProgressStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [progressMessage, setProgressMessage] = useState('회원가입을 처리하고 있습니다...');
  const { toast } = useToast();
  const { user, signUp, checkEmailExists } = useAuth();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      department: '',
    },
  });

  // 이미 로그인된 사용자는 메인 페이지로 리디렉션
  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  // 프로그레스바와 실제 API 호출을 동시에 실행
  const handleSignupWithProgress = async (data: SignupFormData) => {
    setShowProgressModal(true);
    setProgressValue(0);
    setProgressStatus('loading');
    setProgressMessage('회원가입을 처리하고 있습니다...');

    // 프로그레스 애니메이션 Promise
    const progressPromise = new Promise<void>((resolve) => {
      const duration = 2000; // 2초
      const interval = 50; // 50ms마다 업데이트
      const steps = duration / interval;
      const increment = 100 / steps;
      
      let currentStep = 0;
      
      const timer = setInterval(() => {
        currentStep++;
        const newValue = Math.min(currentStep * increment, 100);
        setProgressValue(newValue);
        
        if (currentStep >= steps) {
          clearInterval(timer);
          resolve();
        }
      }, interval);
    });

    // 실제 API 호출 Promise (이메일 기반)
    const apiPromise = signUp(
      data.email,
      data.password,
      data.name,
      data.department
    );

    try {
      // 두 작업을 동시에 실행하되, 최소 2초는 보장
      await Promise.all([progressPromise, apiPromise]);
      
      // 성공 처리 (이메일 인증 대기 상태)
      setProgressStatus('success');
      setProgressMessage('회원가입이 완료되었습니다! 이메일을 확인하여 인증을 완료해주세요.');
      setProgressValue(100);
      
      toast({
        title: '회원가입 성공',
        description: '이메일 인증 링크가 발송되었습니다. 이메일을 확인해주세요.',
      });
      
      // 3초 후 로그인 페이지로 이동 (이메일 인증 안내 시간 확보)
      setTimeout(() => {
        setShowProgressModal(false);
        router.push('/login');
      }, 3000);
      
    } catch (error) {
      // 실패 처리
      const errorMessage = error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.';
      
      // 이미 가입된 이메일인 경우 특별 처리
      if (errorMessage.includes('이미 가입된 이메일입니다')) {
        setProgressStatus('error');
        setProgressMessage('이미 가입된 이메일입니다. 로그인 페이지로 이동합니다.');
        setProgressValue(100);
        
        toast({
          title: '이미 가입된 계정',
          description: '해당 이메일로 이미 가입된 계정이 있습니다. 로그인해주세요.',
          variant: 'destructive',
        });
        
        // 3초 후 로그인 페이지로 이동
        setTimeout(() => {
          setShowProgressModal(false);
          router.push('/login');
        }, 3000);
      } else {
        setProgressStatus('error');
        setProgressMessage('회원가입 중 오류가 발생했습니다.');
        setProgressValue(100);
        
        toast({
          title: '회원가입 실패',
          description: errorMessage,
          variant: 'destructive',
        });
        
        // 2초 후 모달 닫기
        setTimeout(() => {
          setShowProgressModal(false);
          setIsLoading(false);
        }, 2000);
      }
    }
  };

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">대시보드로 이동 중...</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    
    try {
      // 1. 먼저 이메일 중복 체크
      const emailExists = await checkEmailExists(data.email);
      if (emailExists) {
        toast({
          title: '이미 가입된 이메일',
          description: '해당 이메일로 이미 가입된 계정이 있습니다. 로그인해주세요.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return; // 여기서 중단
      }
      
      // 2. 중복이 아니면 기존 회원가입 진행
      await handleSignupWithProgress(data);
    } catch (error) {
      console.error('이메일 중복 체크 오류:', error);
      toast({
        title: '오류 발생',
        description: '이메일 확인 중 오류가 발생했습니다. 다시 시도해주세요.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-100 rounded-full">
                <UserPlus className="h-6 w-6 text-green-600" aria-hidden="true" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
            <CardDescription>
              이메일, 비밀번호, 이름, 부서를 입력하여 회원가입을 완료해주세요
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="email">이메일</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" aria-hidden="true" />
                          <Input 
                            {...field} 
                            id="email"
                            type="email"
                            inputMode="email"
                            placeholder="이메일을 입력하세요" 
                            className="pl-10"
                            disabled={isLoading}
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
                      <FormLabel htmlFor="password">비밀번호</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" aria-hidden="true" />
                          <Input 
                            {...field} 
                            id="password"
                            type="password"
                            placeholder="비밀번호를 입력하세요" 
                            className="pl-10"
                            disabled={isLoading}
                            autoComplete="new-password"
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
                        <Input {...field} placeholder="이름을 입력하세요" disabled={isLoading} />
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
                        <Input {...field} placeholder="부서를 입력하세요" disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? '처리 중...' : '가입하기'}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 mb-2">
                이미 계정이 있으신가요?
              </p>
              <Link href="/login">
                <Button variant="outline" type="button" className="w-full hover:bg-gray-400 hover:text-white" disabled={isLoading}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  로그인하기
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 프로그레스 모달 */}
      <Dialog open={showProgressModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" >
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-2">
              {progressStatus === 'loading' && (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  회원가입 처리 중
                </>
              )}
              {progressStatus === 'success' && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  회원가입 완료
                </>
              )}
              {progressStatus === 'error' && (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  회원가입 실패
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {progressMessage}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>진행률</span>
                <span>{Math.round(progressValue)}%</span>
              </div>
              <Progress 
                value={progressValue} 
                className={`w-full ${
                  progressStatus === 'success' ? 'bg-green-100' : 
                  progressStatus === 'error' ? 'bg-red-100' : ''
                }`}
              />
            </div>
            
            {progressStatus === 'success' && (
              <div className="text-center space-y-2">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium">
                    📧 이메일 인증이 필요합니다
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    발송된 이메일의 인증 링크를 클릭하여 계정을 활성화해주세요
                  </p>
                </div>
                <p className="text-sm text-green-600">
                  잠시 후 로그인 페이지로 이동합니다...
                </p>
              </div>
            )}
            
            {progressStatus === 'error' && (
              <div className="text-center">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowProgressModal(false);
                    setIsLoading(false);
                  }}
                  className="mt-2"
                >
                  다시 시도
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}