// In Next.js, this file would be called: app/providers.tsx
"use client";

// Since QueryClientProvider relies on useContext under the hood, we have to put 'use client' on top
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider, createTheme } from '@mantine/core';
import { useState } from "react";


// Import Mantine styles
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

// Mantine 테마 설정
const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, sans-serif',
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1 * 60 * 1000, // 1분으로 단축 (탭 전환 시 빠른 갱신)
            gcTime: 10 * 60 * 1000, // 10분으로 캐시 유지
            refetchOnWindowFocus: true, // 탭 전환 시 자동 갱신 활성화
            refetchOnMount: true, // 마운트시 새 데이터 가져오기
            refetchOnReconnect: true, // 재연결시 새 데이터 가져오기
            retry: 2, 
            refetchInterval: false, 
            refetchIntervalInBackground: false,
          },
        },
      })
  );

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </MantineProvider>
  );
}
