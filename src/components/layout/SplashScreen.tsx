
// FILE: src/components/layout/SplashScreen.tsx

'use client';

import { motion } from 'framer-motion';

export function SplashScreen() {
  const titleText = "EasyRoom";

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
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
        duration: 0.3,  // 나타나는 속도
      },
    },
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center">
        <motion.h1
          className="text-5xl font-bold text-blue-600 mb-2 flex overflow-hidden"
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
          className="text-xl text-gray-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: titleText.length * 0.1 + 0.5,
            duration: 0.8,
          }}
        >
          회의실 예약 시스템
        </motion.p>
      </div>
    </motion.div>
  );
}