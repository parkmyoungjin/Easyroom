'use client';

import { Suspense } from 'react';
import NewReservationForm from './NewReservationForm';

export default function NewReservationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <NewReservationForm />
    </Suspense>
  );
}