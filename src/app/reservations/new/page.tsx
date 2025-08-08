'use client';

import AppLayout from '@/components/layout/AppLayout';
import ReservationForm from '@/components/reservations/ReservationForm';

import { Container } from '@mantine/core';

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