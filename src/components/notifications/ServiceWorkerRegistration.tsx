'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully:', registration);

      // 업데이트 확인
      registration.addEventListener('updatefound', () => {
        console.log('Service Worker update found');
      });

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };

  return null; // 이 컴포넌트는 UI를 렌더링하지 않음
}