
// FILE: src/components/layout/SplashScreen.tsx

'use client';

import { motion } from 'framer-motion';
import { useComputedColorScheme } from '@mantine/core';
import { useEffect, useState } from 'react';

export function SplashScreen() {
  const computed = useComputedColorScheme('dark', { getInitialValueInEffect: true });
  const [mounted, setMounted] = useState(false);

  // 클라이언트에서만 colorScheme을 사용하도록 함
  useEffect(() => {
    setMounted(true);
  }, []);

  // 서버 사이드에서는 기본값(dark) 사용, 클라이언트에서는 실제 colorScheme 사용
  const actualColorScheme = mounted ? computed : 'dark';
  const titleText = "EasyRoom";

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,  // 글자 간격을 더 느리게 (0.1 → 0.15)
        delayChildren: 0.4,     // 시작 지연을 더 길게 (0.2 → 0.4)
      },
    },
  };

  // ✅ [핵심 수정] 각 글자의 애니메이션에서 y축 움직임을 제거합니다.
  const letterVariants = {
    hidden: {
      opacity: 0  // 1. 처음에는 완전히 투명한 상태
    },
    visible: {
      opacity: 1, // 2. 제자리에서 불투명한 상태로 변경
      transition: {
        ease: "linear", // 일정한 속도로 나타나도록
        duration: 0.5,  // 각 글자 등장을 더 느리게 (0.3 → 0.5)
      },
    },
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: actualColorScheme === 'dark'
          ? 'linear-gradient(135deg, #1a1b23 0%, #2d3748 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center">
        <motion.h1
          className="text-5xl font-bold mb-2 flex overflow-hidden"
          style={{
            color: actualColorScheme === 'dark' ? '#ffffff' : '#000000'
          }}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {titleText.split("").map((char, index) => (
            <motion.span key={index} variants={letterVariants} style={{ position: 'relative' }}>
              {char}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          className="text-xl"
          style={{
            color: actualColorScheme === 'dark' ? '#94a3b8' : '#64748b'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: titleText.length * 0.15 + 0.8,  // 부제목을 더 느리게 등장
            duration: 1.0,                          // 부제목 등장 속도도 느리게
          }}
        >
          회의실 예약 시스템
        </motion.p>
      </div>
    </motion.div>
  );
}