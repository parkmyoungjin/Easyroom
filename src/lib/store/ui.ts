import { create } from 'zustand';
import { createSafeZustandStore } from '@/lib/utils/third-party-wrapper';

interface UIState {
  // Modal states
  isReservationModalOpen: boolean;
  isEditReservationModalOpen: boolean;
  isRoomModalOpen: boolean;
  isLoginModalOpen: boolean;
  
  // Loading states
  isPageLoading: boolean;
  isSubmitting: boolean;
  
  // Selected items
  selectedReservationId: string | null;
  selectedRoomId: string | null;
  selectedDate: Date | null;
  
  // View states
  currentView: 'calendar' | 'list' | 'my-reservations';
  calendarView: 'month' | 'week' | 'day';
  
  // Actions
  setReservationModalOpen: (open: boolean) => void;
  setEditReservationModalOpen: (open: boolean) => void;
  setRoomModalOpen: (open: boolean) => void;
  setLoginModalOpen: (open: boolean) => void;
  
  setPageLoading: (loading: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  
  setSelectedReservationId: (id: string | null) => void;
  setSelectedRoomId: (id: string | null) => void;
  setSelectedDate: (date: Date | null) => void;
  
  setCurrentView: (view: 'calendar' | 'list' | 'my-reservations') => void;
  setCalendarView: (view: 'month' | 'week' | 'day') => void;
  
  // Utility actions
  closeAllModals: () => void;
  resetSelections: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial modal states
  isReservationModalOpen: false,
  isEditReservationModalOpen: false,
  isRoomModalOpen: false,
  isLoginModalOpen: false,
  
  // Initial loading states
  isPageLoading: false,
  isSubmitting: false,
  
  // Initial selected items
  selectedReservationId: null,
  selectedRoomId: null,
  selectedDate: null,
  
  // Initial view states
  currentView: 'calendar',
  calendarView: 'month',
  
  // Modal actions
  setReservationModalOpen: (open) => set({ isReservationModalOpen: open }),
  setEditReservationModalOpen: (open) => set({ isEditReservationModalOpen: open }),
  setRoomModalOpen: (open) => set({ isRoomModalOpen: open }),
  setLoginModalOpen: (open) => set({ isLoginModalOpen: open }),
  
  // Loading actions
  setPageLoading: (loading) => set({ isPageLoading: loading }),
  setSubmitting: (submitting) => set({ isSubmitting: submitting }),
  
  // Selection actions
  setSelectedReservationId: (id) => set({ selectedReservationId: id }),
  setSelectedRoomId: (id) => set({ selectedRoomId: id }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  
  // View actions
  setCurrentView: (view) => set({ currentView: view }),
  setCalendarView: (view) => set({ calendarView: view }),
  
  // Utility actions
  closeAllModals: () => set({
    isReservationModalOpen: false,
    isEditReservationModalOpen: false,
    isRoomModalOpen: false,
    isLoginModalOpen: false,
  }),
  
  resetSelections: () => set({
    selectedReservationId: null,
    selectedRoomId: null,
    selectedDate: null,
  }),
})); 