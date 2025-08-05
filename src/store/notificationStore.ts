import { create } from 'zustand';

interface NotificationState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  showNotification: (title: string, message: string, type?: NotificationState['type']) => void;
  hideNotification: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'info',
  showNotification: (title, message, type = 'info') => 
    set({ isOpen: true, title, message, type }),
  hideNotification: () => 
    set({ isOpen: false, title: '', message: '' }),
}));