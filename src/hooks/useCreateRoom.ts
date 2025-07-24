import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { roomKeys } from './useRooms';

import { RoomFormData } from '@/lib/validations/schemas';

interface CreateRoomData {
  name: string;
  capacity: number;
  description?: string;
}

type CreateRoomInput = Pick<RoomFormData, 'name' | 'capacity' | 'description'>;

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const supabase = await createClient();
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