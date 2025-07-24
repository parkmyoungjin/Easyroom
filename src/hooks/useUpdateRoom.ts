import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { roomKeys } from './useRooms';

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

  return useMutation({
    mutationFn: async ({ id, data }: UpdateRoomData) => {
      const supabase = await createClient();
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