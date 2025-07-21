'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Info, ArrowRight } from 'lucide-react';

interface NavigationFeedbackProps {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
  autoHide?: boolean;
  duration?: number;
  className?: string;
}

export default function NavigationFeedback({
  type,
  title,
  description,
  actionLabel,
  actionPath,
  autoHide = false,
  duration = 5000,
  className = ""
}: NavigationFeedbackProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration]);

  const handleAction = () => {
    if (actionPath) {
      router.push(actionPath);
    }
  };

  const getVariantStyles = () => {
    switch (type) {
      case 'success':
        return {
          cardClass: 'border-green-200 bg-green-50',
          iconClass: 'text-green-600',
          titleClass: 'text-green-900',
          descClass: 'text-green-700',
          icon: CheckCircle
        };
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
          icon: AlertCircle
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

  if (!isVisible) return null;

  const { cardClass, iconClass, titleClass, descClass, icon: Icon } = getVariantStyles();

  return (
    <Card className={`${cardClass} ${className} transition-all duration-300`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${iconClass}`} />
          <CardTitle className={`text-lg ${titleClass}`}>{title}</CardTitle>
        </div>
        {autoHide && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(false)}
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <CardDescription className={`${descClass} mb-4`}>
          {description}
        </CardDescription>
        {actionLabel && actionPath && (
          <Button onClick={handleAction} className="flex items-center gap-2">
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Hook for managing navigation feedback
export function useNavigationFeedback() {
  const { toast } = useToast();
  const { userProfile, authStatus } = useAuth();

  const showAuthRequiredFeedback = (targetPath?: string) => {
    toast({
      title: '로그인이 필요합니다',
      description: '이 기능을 사용하려면 로그인해주세요.',
      variant: 'destructive',
    });
  };

  const showAdminRequiredFeedback = () => {
    toast({
      title: '권한이 없습니다',
      description: '관리자만 접근할 수 있는 페이지입니다.',
      variant: 'destructive',
    });
  };

  const showSuccessFeedback = (message: string) => {
    toast({
      title: '성공',
      description: message,
    });
  };

  const showErrorFeedback = (message: string) => {
    toast({
      title: '오류',
      description: message,
      variant: 'destructive',
    });
  };

  const showNavigationSuccess = (destination: string) => {
    toast({
      title: '페이지 이동',
      description: `${destination}로 이동했습니다.`,
    });
  };

  return {
    showAuthRequiredFeedback,
    showAdminRequiredFeedback,
    showSuccessFeedback,
    showErrorFeedback,
    showNavigationSuccess,
    isAuthenticated: authStatus === 'authenticated',
    isAdmin: userProfile?.role === 'admin'
  };
}