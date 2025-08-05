// src/app/page.tsx
'use client';

import { Center, Loader, Text } from '@mantine/core';

/**
 * 루트 페이지 - 라우팅 허브
 * 실제 콘텐츠는 middleware에서 적절한 경로로 리디렉션됩니다.
 */
export default function HomePage() {
  return (
    <Center mih="100vh">
      <div className="text-center">
        <Loader size="lg" />
        <Text size="lg" fw={600} mt="md">EasyRoom</Text>
        <Text size="sm" c="dimmed" mt="xs">페이지를 준비하고 있습니다...</Text>
      </div>
    </Center>
  );
}