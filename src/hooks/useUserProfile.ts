// src/hooks/useUserProfile.ts
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
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
  const supabase = useSupabaseClient();
  
  return useQuery(buildQueryOptions({
    queryKey: userProfileKeys.profile(userId),
    queryFn: createStandardFetch(
      async () => {
        if (!supabase) throw new Error('Supabase client not available');
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
    enabled: Boolean(userId) && !!supabase,
    dataType: 'static' // User profiles don't change frequently
  }));
}
  