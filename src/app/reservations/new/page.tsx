'use client';

import AppLayout from '@/components/layout/AppLayout';
import ReservationForm from '@/components/reservations/ReservationForm';

export default function NewReservationPage() {
  return (
    <AppLayout headerTitle="새 예약">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <ReservationForm
            mode="create"
            onSuccess={() => window.history.back()}
            onCancel={() => window.history.back()}
          />
        </div>
      </div>
    </AppLayout>
  );
}