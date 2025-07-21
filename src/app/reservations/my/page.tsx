'use client';

import { useRouter } from 'next/navigation';
import { ReservationListView } from '@/features/reservation/components/ReservationListView';
import MobileHeader from '@/components/ui/mobile-header';

export default function MyReservationsPage() {
  const router = useRouter();
  const handleBack = () => {
    router.push('/'); // 명시적으로 메인페이지로 이동
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="내 예약" onBack={handleBack} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ReservationListView />
      </div>
    </div>
  );
} 