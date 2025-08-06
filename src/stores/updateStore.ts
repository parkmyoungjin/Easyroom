// FILE: src/stores/updateStore.ts
// 작전명: 중앙 업데이트 관제소 (Operation: Central Update Control)
// 목표: 앱 전체의 업데이트 상태를 단일 진실의 원천에서 관리

import { create } from 'zustand';

interface UpdateState {
  // 새 버전이 사용 가능한지 여부
  isUpdateAvailable: boolean;
  
  // 업데이트를 트리거할 서비스 워커 등록 객체
  registration: ServiceWorkerRegistration | null;
  
  // 마지막 업데이트 확인 시간 (중복 알림 방지용)
  lastUpdateCheck: number;
  
  // 사용자가 업데이트를 거부했는지 여부 (세션 동안 재알림 방지)
  userDismissed: boolean;
}

interface UpdateActions {
  // 업데이트 가능 상태 설정 (서비스 워커에서 호출)
  setUpdateAvailable: (registration: ServiceWorkerRegistration | null) => void;
  
  // 업데이트 상태 초기화 (업데이트 완료 후 호출)
  resetUpdateState: () => void;
  
  // 사용자가 업데이트를 거부했음을 표시
  dismissUpdate: () => void;
  
  // 업데이트 확인 시간 갱신
  updateLastCheck: () => void;
}

type UpdateStore = UpdateState & UpdateActions;

// 초기 상태
const initialState: UpdateState = {
  isUpdateAvailable: false,
  registration: null,
  lastUpdateCheck: 0,
  userDismissed: false,
};

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  ...initialState,
  
  // 새 버전 발견 시 호출되는 핵심 액션
  setUpdateAvailable: (registration: ServiceWorkerRegistration | null) => {
    const now = Date.now();
    const { lastUpdateCheck, userDismissed } = get();
    
    // 중복 알림 방지: 5분 이내 재알림 차단
    const COOLDOWN_TIME = 5 * 60 * 1000; // 5분
    if (now - lastUpdateCheck < COOLDOWN_TIME) {
      console.log('[UpdateStore] Update notification blocked by cooldown');
      return;
    }
    
    // 사용자가 이미 거부한 경우 세션 동안 재알림 차단
    if (userDismissed) {
      console.log('[UpdateStore] Update notification blocked by user dismissal');
      return;
    }
    
    console.log('[UpdateStore] New update available, setting state');
    set({
      isUpdateAvailable: true,
      registration,
      lastUpdateCheck: now,
    });
  },
  
  // 업데이트 완료 후 상태 초기화
  resetUpdateState: () => {
    console.log('[UpdateStore] Resetting update state');
    set({
      isUpdateAvailable: false,
      registration: null,
      userDismissed: false, // 새 세션에서는 다시 알림 허용
    });
  },
  
  // 사용자가 업데이트를 거부했을 때
  dismissUpdate: () => {
    console.log('[UpdateStore] User dismissed update');
    set({
      isUpdateAvailable: false,
      userDismissed: true, // 세션 동안 재알림 방지
    });
  },
  
  // 업데이트 확인 시간 갱신
  updateLastCheck: () => {
    set({
      lastUpdateCheck: Date.now(),
    });
  },
}));

// 개발자 도구용 디버깅 헬퍼
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__updateStore = useUpdateStore;
  console.log('[UpdateStore] Debug helper attached to window.__updateStore');
}