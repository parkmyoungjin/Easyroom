/**
 * Web Push 설정 및 초기화
 */

import webpush from 'web-push';

// 환경 변수 검증
const requiredEnvVars = {
  VAPID_EMAIL: process.env.VAPID_EMAIL,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY
};

// 서버 사이드에서만 실행되는 초기화
if (typeof window === 'undefined') {
  // 환경 변수 존재 여부 확인
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('Missing required environment variables for web-push:', missingVars);
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // VAPID 키 설정
  try {
    webpush.setVapidDetails(
      `mailto:${requiredEnvVars.VAPID_EMAIL}`,
      requiredEnvVars.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      requiredEnvVars.VAPID_PRIVATE_KEY!
    );
    
    console.log('Web Push VAPID keys configured successfully');
  } catch (error) {
    console.error('Failed to configure VAPID keys:', error);
    throw error;
  }
}

export { webpush };

// 클라이언트에서 사용할 공개키 내보내기
export const getVapidPublicKey = () => {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    throw new Error('VAPID public key not configured');
  }
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
};

// 서버에서 환경 변수 유효성 검사
export const validatePushConfig = () => {
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  return {
    isValid: missingVars.length === 0,
    missingVars,
    config: missingVars.length === 0 ? requiredEnvVars : null
  };
};