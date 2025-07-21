'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// 동적 import로 Hydration 문제 방지
const DynamicLoginForm = dynamic(
  () => import('@/features/auth/components/LoginForm').then(mod => ({ default: mod.LoginForm })),
  {
    ssr: false, // 서버 사이드 렌더링 비활성화
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }
);

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return <DynamicLoginForm />;
}
