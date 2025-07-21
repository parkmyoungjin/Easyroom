import { Suspense } from 'react';
import { EnhancedLoadingState } from '@/components/ui/enhanced-loading-state';
import PageContent from './page-content';

export default function HomePage() {
  return (
    <Suspense fallback={
      <EnhancedLoadingState 
        isLoading={true}
        title="시스템을 준비하고 있습니다..."
        description="잠시만 기다려주세요"
        showNetworkStatus={true}
        className="min-h-screen flex items-center justify-center"
      />
    }>
      <PageContent />
    </Suspense>
  );
}
