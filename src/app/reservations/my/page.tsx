// src/app/reservations/my/page.tsx

'use client';

import { ReservationListView } from '@/features/reservation/components/ReservationListView';
import AppLayout from '@/components/layout/AppLayout';
import { useMyReservations } from '@/hooks/useReservations';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@mantine/core';

export default function MyReservationsPage() {
  const { userProfile } = useAuth();
  
  const { data: reservations, isLoading, isError } = useMyReservations(userProfile?.dbId);

  return (
    <AppLayout headerTitle="내 예약 관리">
      <div className="min-h-screen bg-background">
        <main className="container mx-auto p-4 py-8">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton height={60} />
              <Skeleton height={120} />
              <Skeleton height={120} />
              <Skeleton height={120} />
            </div>
          ) : (
            <ReservationListView
              reservations={reservations}
              isError={isError}
            />
          )}
        </main>
      </div>
    </AppLayout>
  );
}