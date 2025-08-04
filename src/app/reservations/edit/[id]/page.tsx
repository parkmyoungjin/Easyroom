'use client';

import { useRouter, useParams } from 'next/navigation';
import MobileHeader from '@/components/ui/mobile-header';
import ReservationForm from '@/components/reservations/ReservationForm';

export default function EditReservationPage() {
  const router = useRouter();
  const params = useParams();
  const reservationId = params.id as string;

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="예약 수정" showBackButton />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ReservationForm 
          mode="edit" 
          reservationId={reservationId}
          onSuccess={() => router.push('/reservations/my')}
          onCancel={() => router.push('/reservations/my')}
        />
      </div>
    </div>
  );
} 