// In Next.js, this file would be called: app/providers.tsx
"use client";

// Since QueryClientProvider relies on useContext under the hood, we have to put 'use client' on top
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from 'next-themes';
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // 🔧 2분으로 재조정 (실시간성 개선)
            gcTime: 10 * 60 * 1000, // 🔧 10분으로 재조정 (캐시 유지)
            refetchOnWindowFocus: false,
            refetchOnMount: true, // 🔥 마운트시 새 데이터 가져오기 (중요!)
            refetchOnReconnect: true, // 🔥 재연결시 새 데이터 가져오기
            retry: 2, // 재시도 2회로 복원
            refetchInterval: false, // 자동 간격 refetch는 비활성화 유지
            refetchIntervalInBackground: false, // 백그라운드 refetch는 비활성화 유지
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="room-booking-theme"
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
