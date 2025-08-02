import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { roomKeys } from '@/hooks/useRooms';

interface UpdateRoomData {
  id: string;
  data: {
    name?: string;
    capacity?: number;
    description?: string;
    is_active?: boolean;
  };
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateRoomData) => {
      if (!supabase) throw new Error('Supabase client not available');
      const { error, data: room } = await supabase
        .from('rooms')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return room;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomKeys.all });
    },
  });
} 