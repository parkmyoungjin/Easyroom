'use client';

import { useParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import ReservationForm from '@/components/reservations/ReservationForm';

export default function EditReservationPage() {
  const params = useParams();
  const reservationId = params.id as string;

  return (
    <AppLayout headerTitle="예약 수정">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <ReservationForm 
          mode="edit" 
          reservationId={reservationId}
          onSuccess={() => window.history.back()}
          onCancel={() => window.history.back()}
        />
      </div>
    </AppLayout>
  );
} 