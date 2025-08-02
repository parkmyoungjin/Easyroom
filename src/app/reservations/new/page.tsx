'use client'; // ✅ 페이지 전체가 클라이언트 로직에 의존하므로 선언이 필요할 수 있습니다.

import { Suspense } from 'react';
import MobileHeader from '@/components/ui/mobile-header';
// ✅ ReservationForm 컴포넌트의 실제 경로로 수정합니다.
import NewReservationForm from '@/app/reservations/new/NewReservationForm';
import { Skeleton } from '@/components/ui/skeleton';

// ✅ 폼 로딩 중에 보여줄 스켈레톤 UI (페이지의 레이아웃을 유지)
const FormSkeleton = () => (
  <div className="space-y-6 p-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-24 w-full" />
    </div>
    <div className="flex gap-4 pt-4">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 flex-1" />
    </div>
  </div>
);

export default function NewReservationPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 1. 헤더는 Suspense 바깥에 둡니다. */}
      <MobileHeader 
        title="새 예약 만들기" 
        subtitle="원하는 시간과 회의실을 선택하세요."
      />
      
      <main className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          {/* 2. 동적인 폼 부분만 Suspense로 감쌉니다. */}
          <Suspense fallback={<FormSkeleton />}>
            <NewReservationForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}