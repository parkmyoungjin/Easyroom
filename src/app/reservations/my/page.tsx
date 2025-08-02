// src/app/reservations/my/page.tsx

'use client';

import { useRouter } from 'next/navigation';
import { ReservationListView } from '@/features/reservation/components/ReservationListView';
import MobileHeader from '@/components/ui/mobile-header';

export default function MyReservationsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title="내 예약 관리" />
      <main className="container mx-auto p-4 py-8">
        {/* ✅ Props 없이 호출합니다. 이제 이 컴포넌트가 모든 것을 알아서 처리합니다. */}
        <ReservationListView />
      </main>
    </div>
  );
}