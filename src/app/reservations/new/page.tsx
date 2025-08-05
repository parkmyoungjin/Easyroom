'use client';

import { useRouter } from 'next/navigation';
import MobileAppLayout from '@/components/layout/MobileAppLayout';
import ReservationForm from '@/components/reservations/ReservationForm';

export default function NewReservationPage() {
  const router = useRouter();

  return (
    <MobileAppLayout headerTitle="새 예약" showBackButton>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <ReservationForm
            mode="create"
            onSuccess={() => router.push('/dashboard')}
            onCancel={() => router.back()}
          />
        </div>
      </div>
    </MobileAppLayout>
  );
}