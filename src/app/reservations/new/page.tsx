'use client';

import { useRouter } from 'next/navigation';
import MobileHeader from '@/components/ui/mobile-header';
import ReservationForm from '@/components/reservations/ReservationForm';

export default function NewReservationPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="새 예약" showBackButton />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ReservationForm
          mode="create"
          onSuccess={() => router.push('/')}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}