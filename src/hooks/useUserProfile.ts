// src/hooks/useUserProfile.ts
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useUserProfile(userId: string) {
    return useQuery({
      queryKey: ['userProfile', userId],
      queryFn: async () => {
        const { data, error } = await createClient()
          .from('users')
          .select('name, department')
          .eq('id', userId)
          .single();
        if (error) throw error;
        return data;
      },
      enabled: Boolean(userId),
    });
  }
  