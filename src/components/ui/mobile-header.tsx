'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
// ✅ useToast는 더 이상 헤더 자체에서는 필요하지 않습니다.

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

export default function MobileHeader({ 
  title, 
  subtitle,
  showBackButton = true,
  showHomeButton = false,
  onBack,
  rightContent,
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    // onBack prop이 있으면 그것을 우선 실행
    if (onBack) {
      onBack();
    } else {
      // ✅ 뒤로 갈 페이지가 있는지 확인하고, 없으면 홈으로 이동
      if (window.history.length > 1) {
        router.back();
      } else {
        router.replace('/'); // replace를 사용하여 히스토리에 남기지 않음
      }
    }
  };

  const handleHome = () => {
    router.push('/');
  };

  return (
    // ✅ 'sticky top-0'으로 스크롤 시 상단 고정
    // ✅ 'bg-background/95 backdrop-blur'로 반투명 블러 효과 적용
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        
        {/* 왼쪽 영역: 뒤로가기 또는 홈 버튼 */}
        <div className="flex items-center">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon" // ✅ 아이콘 버튼에 최적화된 크기
              onClick={handleBack}
              aria-label="뒤로 가기"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          
          {showHomeButton && !showBackButton && ( // 뒤로가기 버튼이 없을 때만 홈 버튼 표시
            <Button
              variant="ghost"
              size="icon"
              onClick={handleHome}
              aria-label="홈으로 이동"
            >
              <Home className="h-5 w-5" />
            </Button>
          )}
        </div>
        
        {/* 중앙 영역: 제목과 부제목 */}
        {/* ✅ sm:left-1/2 sm:-translate-x-1/2: 모바일에서는 약간 왼쪽에, 태블릿부터는 중앙 정렬 */}
        <div className="absolute left-16 sm:left-1/2 sm:-translate-x-1/2 text-center sm:text-left">
          <h1 className="text-base font-semibold truncate sm:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
        
        {/* 오른쪽 영역: 추가적인 버튼이나 액션 */}
        <div className="flex items-center justify-end">
          {rightContent}
        </div>
      </div>
    </header>
  );
}