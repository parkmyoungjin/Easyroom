// src/app/page.tsx

import { Suspense } from 'react';
import PageContent from '@/app/page-content';
import { Skeleton } from '@/components/ui/skeleton'; // ✅ Skeleton 로딩 컴포넌트 사용

// ✅ 스켈레톤 UI를 사용한 정교한 로딩 화면
const MainPageSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center mb-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Quick Actions Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>

      {/* Info Section Skeleton */}
      <Skeleton className="h-48 rounded-lg" />
    </div>
  </div>
);

export default function HomePage() {
  return (
    // ✅ Suspense의 fallback으로 스켈레톤 UI를 보여줍니다.
    <Suspense fallback={<MainPageSkeleton />}>
      <PageContent />
    </Suspense>
  );
}