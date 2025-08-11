'use client';

import { useEffect } from 'react';
import { useComputedColorScheme } from '@mantine/core';

// Mantine의 color scheme을 Tailwind의 .dark 클래스에 동기화
export function ThemeSync() {
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', computed === 'dark');
  }, [computed]);

  return null;
}


