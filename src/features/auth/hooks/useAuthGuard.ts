'use client';

import { useAuth } from '@/hooks/useAuth';

export function useAuthGuard() {
  const { user, userProfile, loading } = useAuth();
  
  return { 
    user: userProfile, // UserProfile 타입으로 반환
    isAuthenticated: !!userProfile, 
    isLoading: loading 
  };
}

export function useRequireAuth() {
  return useAuthGuard();
}
