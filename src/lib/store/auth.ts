import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfile } from '@/types/auth';
import { safeBrowserUtils } from '@/lib/utils/third-party-wrapper';
import { environment } from '@/lib/polyfills/server-isolation';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  isAdmin: () => boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,

      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      isAdmin: () => {
        const { user } = get();
        return user?.role === 'admin';
      },

      setHasHydrated: (hasHydrated) => {
        set({ hasHydrated });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => {
        // Use safer environment detection
        if (environment.isServer) {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        
        // Use safe browser API access
        try {
          return localStorage;
        } catch (error) {
          console.warn('localStorage not available:', error);
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
      }),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state, error) => {
        // hydration 완료 플래그 설정
        if (state && !error) {
          state.setHasHydrated(true);
        }
      },
    }
  )
);
