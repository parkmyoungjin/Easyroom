// src/app/page.tsx
'use client';

import { Center, Loader, Text } from '@mantine/core';

/**
 * 순수한 콘텐츠 페이지 - HomePage
 * 오직 / 경로의 콘텐츠 표시만 책임진다.
 * 
 * AuthGatekeeper가 라우팅 결정을 내리기 전까지 잠시 보여주는 대기실 역할
 */
export default function HomePage() {
  // 라우팅 로직은 모두 AuthGatekeeper로 이관
  // 이 페이지는 단순한 대기 UI만 표시
  return (
    <Center mih="100vh">
      <div className="text-center">
        <Loader size="lg" />
        <Text size="lg" fw={600} mt="md">페이지를 준비하고 있습니다...</Text>
      </div>
    </Center>
  );
}