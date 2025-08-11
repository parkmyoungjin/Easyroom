'use client';

import {
  MantineProvider,
  createTheme,
  localStorageColorSchemeManager,
} from '@mantine/core';
import { ThemeSync } from '@/components/theme/ThemeSync';

// Mantine v8 테마 설정
const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, sans-serif',
});

// 라이트/다크 모드 상태를 LocalStorage에 저장하여 일관성 보장
const colorSchemeManager = localStorageColorSchemeManager({
  key: 'easyroom-color-scheme',
});

export default function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme="auto"
      colorSchemeManager={colorSchemeManager}
    >
      <ThemeSync />
      {children}
    </MantineProvider>
  );
}