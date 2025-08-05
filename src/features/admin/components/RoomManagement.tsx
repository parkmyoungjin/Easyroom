'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, TextInput, Switch, Group, Stack, Text } from '@mantine/core';
import { toast } from 'sonner';
import { useRooms } from '@/hooks/useRooms';
import { useCreateRoom } from '@/hooks/useCreateRoom';
import { useUpdateRoom } from '@/hooks/useUpdateRoom';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import type { Room } from '@/types/database';

const roomFormSchema = z.object({
  name: z.string().min(1, '회의실 이름을 입력해주세요'),
  capacity: z.number().min(1, '수용 인원을 입력해주세요'),
  description: z.string().optional(),
});

type RoomFormValues = z.infer<typeof roomFormSchema>;

export function RoomManagement() {

  const { data: rooms, isLoading } = useRooms();
  const { mutate: createRoom } = useCreateRoom();
  const { mutate: updateRoom } = useUpdateRoom();
  const [isAdding, setIsAdding] = useState(false);

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: {
      name: '',
      capacity: 1,
      description: '',
    },
  });

  const onSubmit = (data: RoomFormValues) => {
    createRoom(data, {
      onSuccess: () => {
        toast.success('회의실 추가 완료', {
          description: '새로운 회의실이 추가되었습니다.',
        });
        setIsAdding(false);
        form.reset();
      },
      onError: (error) => {
        const reservationError = ReservationErrorHandler.handleReservationError(error, {
          action: 'create_room',
          timestamp: new Date().toISOString()
        });

        const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'create');

        toast.error(userMessage.title, {
          description: userMessage.description,
        });
      },
    });
  };

  const handleToggleActive = (room: Room) => {
    updateRoom(
      {
        id: room.id,
        data: { is_active: !room.is_active },
      },
      {
        onSuccess: () => {
          toast.success('회의실 상태 변경', {
            description: `${room.name}이(가) ${
              room.is_active ? '비활성화' : '활성화'
            } 되었습니다.`,
          });
        },
        onError: (error) => {
          const reservationError = ReservationErrorHandler.handleReservationError(error, {
            action: 'update_room',
            roomId: room.id,
            timestamp: new Date().toISOString()
          });

          const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'update');

          toast.error(userMessage.title, {
            description: userMessage.description,
          });
        },
      }
    );
  };

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">회의실 목록</h3>
        <Button onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? '취소' : '회의실 추가'}
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Stack gap="md">
            <TextInput
              label="회의실 이름"
              placeholder="회의실 이름을 입력하세요"
              {...form.register('name')}
              error={form.formState.errors.name?.message}
            />

            <TextInput
              label="수용 인원"
              type="number"
              {...form.register('capacity', { valueAsNumber: true })}
              error={form.formState.errors.capacity?.message}
            />

            <TextInput
              label="설명 (선택)"
              placeholder="회의실 설명을 입력하세요"
              {...form.register('description')}
              error={form.formState.errors.description?.message}
            />

            <Button type="submit">추가</Button>
          </Stack>
        </form>
      )}

      <div className="space-y-4">
        {rooms?.map((room) => (
          <div
            key={room.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div>
              <h4 className="font-medium">{room.name}</h4>
              <p className="text-sm text-muted-foreground">
                수용 인원: {room.capacity}명
                {room.description && ` • ${room.description}`}
              </p>
            </div>
            <Group gap="md">
              <Group gap="xs">
                <Switch
                  checked={room.is_active}
                  onChange={() => handleToggleActive(room)}
                />
                <Text size="sm">
                  {room.is_active ? '활성화' : '비활성화'}
                </Text>
              </Group>
            </Group>
          </div>
        ))}
      </div>
    </div>
  );
} 