'use client';

import dynamic from 'next/dynamic';
import AppLayout from '@/components/layout/AppLayout';
import { Container, Skeleton } from '@mantine/core';

const ReservationForm = dynamic(() => import('@/components/reservations/ReservationForm'), {
  loading: () => <Skeleton height={600} />,
  ssr: false
});

export default function NewReservationPage() {
  return (
    <AppLayout headerTitle="새 예약">
      <Container my="xl" size="md">
        <ReservationForm
          mode="create"
          onSuccess={() => { }} // 예약 완료 후 페이지에 그대로 머물기
          onCancel={() => window.history.back()}
        />
      </Container>
    </AppLayout>
  );
}