'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface MobileHeaderProps {
  title: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
  subtitle?: string;
}

export default function MobileHeader({ 
  title, 
  showBackButton = true,
  showHomeButton = false,
  onBack,
  rightContent,
  subtitle
}: MobileHeaderProps) {
  const router = useRouter();
  const { toast } = useToast();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      // 더 안전한 뒤로가기 처리
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    }
  };

  const handleHome = () => {
    router.push('/');
    toast({
      title: '홈으로 이동',
      description: '메인 페이지로 이동했습니다.',
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-1">
          {showBackButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-8 w-8 p-0"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          
          {showHomeButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHome}
              className="h-8 w-8 p-0"
              aria-label="홈으로"
            >
              <Home className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex-1 ml-2">
          <h1 className="text-lg font-semibold truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">
              {subtitle}
            </p>
          )}
        </div>
        
        {rightContent && (
          <div className="flex items-center gap-2">
            {rightContent}
          </div>
        )}
      </div>
    </header>
  );
} 