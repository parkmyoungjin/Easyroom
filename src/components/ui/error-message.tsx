'use client';

import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface ErrorMessageProps {
  title?: string;
  description?: string;
  showRetry?: boolean;
  showHome?: boolean;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorMessage({
  title = "오류가 발생했습니다",
  description = "잠시 후 다시 시도해주세요.",
  showRetry = true,
  showHome = true,
  onRetry,
  className = ""
}: ErrorMessageProps) {
  const router = useRouter();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <Card className={`border-red-200 bg-red-50 ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <CardTitle className="text-lg text-red-900">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-red-700 mb-4">
          {description}
        </CardDescription>
        <div className="flex gap-2">
          {showRetry && (
            <Button onClick={handleRetry} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              다시 시도
            </Button>
          )}
          {showHome && (
            <Button onClick={handleGoHome} className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              홈으로
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}