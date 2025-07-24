// src/hooks/useUserProfile.ts
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { 
  createQueryKeyFactory, 
  buildQueryOptions, 
  createStandardFetch 
} from '@/lib/utils/query-optimization';

// Optimized query keys using factory pattern
const userProfileKeyFactory = createQueryKeyFactory<{
  userId?: string;
}>('userProfile');

export const userProfileKeys = {
  ...userProfileKeyFactory,
  profile: (userId: string) => userProfileKeyFactory.custom('profile', userId),
};

export function useUserProfile(userId: string) {
  return useQuery(buildQueryOptions({
    queryKey: userProfileKeys.profile(userId),
    queryFn: createStandardFetch(
      async () => {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from('users')
          .select('name, department')
          .eq('id', userId)
          .single();
        if (error) throw error;
        return data;
      },
      {
        operation: 'fetch user profile',
        params: { userId }
      }
    ),
    enabled: Boolean(userId),
    dataType: 'static' // User profiles don't change frequently
  }));
}
  