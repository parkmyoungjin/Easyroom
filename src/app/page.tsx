import { Suspense } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';
import PageContent from './page-content';

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen text="시스템을 준비하고 있습니다..." />}>
      <PageContent />
    </Suspense>
  );
}
