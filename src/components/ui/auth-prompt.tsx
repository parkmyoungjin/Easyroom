'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, UserPlus, Info, Lock, AlertCircle, RefreshCw } from 'lucide-react';

interface AuthPromptProps {
  title?: string;
  description?: string;
  variant?: 'info' | 'warning' | 'error';
  showSignup?: boolean;
  showRetry?: boolean;
  className?: string;
  onLogin?: () => void;
  onSignup?: () => void;
  onRetry?: () => void;
}

export default function AuthPrompt({
  title = "로그인이 필요합니다",
  description = "이 기능을 사용하려면 로그인해주세요.",
  variant = 'info',
  showSignup = true,
  showRetry = false,
  className = "",
  onLogin,
  onSignup,
  onRetry
}: AuthPromptProps) {
  const router = useRouter();


  const handleLogin = () => {
    if (onLogin) {
      onLogin();
    } else {
      router.push('/login');
    }
  };

  const handleSignup = () => {
    if (onSignup) {
      onSignup();
    } else {
      router.push('/signup');
    }
  };

  const handleRetry = async () => {
    if (onRetry) {
      onRetry();
    } else {
      // Default retry behavior - refresh page
      window.location.reload();
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          cardClass: 'border-yellow-200 bg-yellow-50',
          iconClass: 'text-yellow-600',
          titleClass: 'text-yellow-900',
          descClass: 'text-yellow-700',
          icon: AlertCircle
        };
      case 'error':
        return {
          cardClass: 'border-red-200 bg-red-50',
          iconClass: 'text-red-600',
          titleClass: 'text-red-900',
          descClass: 'text-red-700',
          icon: Lock
        };
      default:
        return {
          cardClass: 'border-blue-200 bg-blue-50',
          iconClass: 'text-blue-600',
          titleClass: 'text-blue-900',
          descClass: 'text-blue-700',
          icon: Info
        };
    }
  };

  const { cardClass, iconClass, titleClass, descClass, icon: Icon } = getVariantStyles();

  return (
    <Card className={`${cardClass} ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconClass}`} />
          <CardTitle className={`text-lg ${titleClass}`}>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className={`${descClass} mb-4`}>
          {description}
        </CardDescription>
        <div className="flex gap-2">
          <Button onClick={handleLogin} className="flex items-center gap-2">
            <LogIn className="h-4 w-4" />
            로그인
          </Button>
          {showSignup && (
            <Button variant="outline" onClick={handleSignup} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              회원가입
            </Button>
          )}
          {showRetry && (
            <Button variant="outline" onClick={handleRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              재시도
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}