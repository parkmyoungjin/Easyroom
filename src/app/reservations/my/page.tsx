// src/app/reservations/my/page.tsx

'use client';

import { Box, LoadingOverlay } from '@mantine/core';
import { ReservationListView } from '@/features/reservation/components/ReservationListView';
import MobileAppLayout from '@/components/layout/MobileAppLayout';
import { useMyReservations } from '@/hooks/useReservations';
import { useAuth } from '@/hooks/useAuth';

export default function MyReservationsPage() {
  const { userProfile } = useAuth();
  // ✅ isLoading 상태를 페이지 레벨에서 직접 가져옵니다.
  const { data: reservations, isLoading, isError } = useMyReservations(userProfile?.dbId);

  return (
    <MobileAppLayout headerTitle="내 예약 관리">
      {/* ✅ Box 컴포넌트로 감싸고 position을 설정합니다. */}
      <Box style={{ position: 'relative', minHeight: '100vh' }} className="bg-background">
        {/* ✅ LoadingOverlay를 여기에 배치합니다. */}
        <LoadingOverlay
          visible={isLoading}
          zIndex={1000}
          overlayProps={{ radius: 'sm', blur: 2 }}
          loaderProps={{ children: '예약 정보를 불러오는 중...' }}
        />
        
        <main className="container mx-auto p-4 py-8">
          {/* ✅ ReservationListView에는 이제 data와 error 상태만 전달합니다. */}
          <ReservationListView
            reservations={reservations}
            isError={isError}
          />
        </main>
      </Box>
    </MobileAppLayout>
  );
}