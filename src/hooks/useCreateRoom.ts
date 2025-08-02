import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { roomKeys } from '@/hooks/useRooms';

import { RoomFormData } from '@/lib/validations/schemas';

interface CreateRoomData {
  name: string;
  capacity: number;
  description?: string;
}

type CreateRoomInput = Pick<RoomFormData, 'name' | 'capacity' | 'description'>;

export function useCreateRoom() {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  return useMutation({
    mutationFn: async (data: any) => {
      if (!supabase) throw new Error('Supabase client not available');
      const { error, data: room } = await supabase
        .from('rooms')
        .insert({
          ...data,
          is_active: true,
        })
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