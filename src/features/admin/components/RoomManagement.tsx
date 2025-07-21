'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useRooms } from '@/hooks/useRooms';
import { useCreateRoom } from '@/hooks/useCreateRoom';
import { useUpdateRoom } from '@/hooks/useUpdateRoom';
import type { Room } from '@/types/database';

const roomFormSchema = z.object({
  name: z.string().min(1, '회의실 이름을 입력해주세요'),
  capacity: z.number().min(1, '수용 인원을 입력해주세요'),
  description: z.string().optional(),
});

type RoomFormValues = z.infer<typeof roomFormSchema>;

export function RoomManagement() {
  const { toast } = useToast();
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
        toast({
          title: '회의실 추가 완료',
          description: '새로운 회의실이 추가되었습니다.',
        });
        setIsAdding(false);
        form.reset();
      },
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: '회의실 추가 실패',
          description: error.message,
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
          toast({
            title: '회의실 상태 변경',
            description: `${room.name}이(가) ${
              room.is_active ? '비활성화' : '활성화'
            } 되었습니다.`,
          });
        },
        onError: (error) => {
          toast({
            variant: 'destructive',
            title: '상태 변경 실패',
            description: error.message,
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>회의실 이름</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="회의실 이름을 입력하세요" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>수용 인원</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>설명 (선택)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="회의실 설명을 입력하세요" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">추가</Button>
          </form>
        </Form>
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={room.is_active}
                  onCheckedChange={() => handleToggleActive(room)}
                />
                <span className="text-sm">
                  {room.is_active ? '활성화' : '비활성화'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 