// FILE: src/components/pwa/UpdateNotification.tsx
// 작전명: 지능형 업데이트 알림 시스템 (Operation: Intelligent Update Notification)
// 목표: 중복 없이 깔끔한 단일 업데이트 알림 제공

'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useUpdateStore } from '@/stores/updateStore';
import { RefreshCw, Download } from 'lucide-react';

/**
 * 업데이트 알림을 관리하는 전용 컴포넌트
 * - zustand 스토어의 상태 변화를 감지
 * - 중복 알림 방지 로직 내장
 * - 사용자 친화적인 업데이트 프로세스 제공
 */
export function UpdateNotification() {
  const { 
    isUpdateAvailable, 
    registration, 
    setUpdateAvailable, 
    resetUpdateState, 
    dismissUpdate 
  } = useUpdateStore();
  
  // 중복 토스트 방지를 위한 ref
  const toastShownRef = useRef(false);
  const currentToastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    // 업데이트가 사용 가능하고, 아직 토스트를 보여주지 않았을 때만 실행
    if (isUpdateAvailable && registration && !toastShownRef.current) {
      console.log('[UpdateNotification] Showing update notification');
      
      // 중복 방지 플래그 설정
      toastShownRef.current = true;
      
      // 🎯 핵심: sonner를 사용한 업데이트 알림
      const toastId = toast.info(
        '새로운 버전이 있습니다!', 
        {
          description: '더 나은 기능과 성능 개선이 포함되어 있습니다.',
          duration: Infinity, // 사용자가 직접 액션을 취할 때까지 유지
          icon: <Download className="h-4 w-4" />,
          action: {
            label: '업데이트',
            onClick: () => handleUpdateClick(registration, toastId),
          },
          cancel: {
            label: '나중에',
            onClick: () => handleDismissClick(toastId),
          },
          onDismiss: () => {
            // 토스트가 자동으로 사라질 때 (X 버튼 클릭 등)
            handleDismissClick(toastId);
          },
          // 추가 스타일링
          className: 'update-notification-toast',
          style: {
            border: '1px solid #3b82f6',
            backgroundColor: '#eff6ff',
          },
        }
      );
      
      // 현재 토스트 ID 저장
      currentToastIdRef.current = toastId;
      
      console.log('[UpdateNotification] Update toast displayed with ID:', toastId);
    }
    
    // 업데이트가 더 이상 사용 불가능할 때 토스트 정리
    if (!isUpdateAvailable && toastShownRef.current && currentToastIdRef.current) {
      console.log('[UpdateNotification] Dismissing update toast');
      toast.dismiss(currentToastIdRef.current);
      toastShownRef.current = false;
      currentToastIdRef.current = null;
    }
  }, [isUpdateAvailable, registration]);

  /**
   * 사용자가 "업데이트" 버튼을 클릭했을 때 처리
   */
  const handleUpdateClick = async (reg: ServiceWorkerRegistration, toastId: string | number) => {
    try {
      console.log('[UpdateNotification] User clicked update button');
      
      // 로딩 토스트로 교체
      toast.dismiss(toastId);
      const loadingToastId = toast.loading(
        '업데이트를 적용하고 있습니다...', 
        {
          description: '잠시만 기다려주세요.',
          icon: <RefreshCw className="h-4 w-4 animate-spin" />,
          duration: Infinity,
        }
      );
      
      // 🚀 핵심: 대기 중인 서비스 워커에게 즉시 활성화 메시지 전송
      if (reg.waiting) {
        console.log('[UpdateNotification] Sending SKIP_WAITING message to service worker');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // 서비스 워커가 제어권을 가져갈 때까지 대기
        const controllerChangePromise = new Promise<void>((resolve) => {
          const handleControllerChange = () => {
            console.log('[UpdateNotification] Service worker took control');
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            resolve();
          };
          navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
          
          // 타임아웃 설정 (10초 후 강제 진행)
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            resolve();
          }, 10000);
        });
        
        await controllerChangePromise;
        
        // 성공 토스트 표시
        toast.dismiss(loadingToastId);
        toast.success(
          '업데이트가 완료되었습니다!', 
          {
            description: '새로운 기능을 사용할 수 있습니다.',
            duration: 3000,
          }
        );
        
        // 상태 초기화
        resetUpdateState();
        toastShownRef.current = false;
        currentToastIdRef.current = null;
        
        // 페이지 새로고침 (새 버전 적용)
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
      } else {
        // waiting 서비스 워커가 없는 경우
        console.warn('[UpdateNotification] No waiting service worker found');
        toast.dismiss(loadingToastId);
        toast.error(
          '업데이트 적용에 실패했습니다', 
          {
            description: '페이지를 새로고침해 주세요.',
            duration: 5000,
          }
        );
      }
      
    } catch (error) {
      console.error('[UpdateNotification] Error during update process:', error);
      toast.error(
        '업데이트 중 오류가 발생했습니다', 
        {
          description: '페이지를 새로고침해 주세요.',
          duration: 5000,
        }
      );
    }
  };

  /**
   * 사용자가 "나중에" 버튼을 클릭하거나 토스트를 닫았을 때 처리
   */
  const handleDismissClick = (toastId: string | number) => {
    console.log('[UpdateNotification] User dismissed update notification');
    
    // 토스트 제거
    toast.dismiss(toastId);
    
    // 상태 업데이트 (세션 동안 재알림 방지)
    dismissUpdate();
    
    // 플래그 초기화
    toastShownRef.current = false;
    currentToastIdRef.current = null;
    
    // 사용자에게 나중에 업데이트할 수 있음을 알림
    toast.info(
      '업데이트를 나중에 진행합니다', 
      {
        description: '페이지를 새로고침하면 언제든 업데이트할 수 있습니다.',
        duration: 3000,
      }
    );
  };

  // 이 컴포넌트는 UI를 직접 렌더링하지 않음
  // 모든 알림은 sonner 토스트를 통해 표시됨
  return null;
}

// 개발자 도구용 디버깅 헬퍼
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__triggerUpdateNotification = () => {
    const { setUpdateAvailable } = useUpdateStore.getState();
    // 가짜 registration 객체로 테스트
    const mockRegistration = {
      waiting: {
        postMessage: (msg: any) => console.log('Mock postMessage:', msg)
      }
    } as any;
    setUpdateAvailable(mockRegistration);
    console.log('[UpdateNotification] Debug: Triggered update notification');
  };
}