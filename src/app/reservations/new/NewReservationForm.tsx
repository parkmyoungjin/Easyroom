// src/app/reservations/new/NewReservationForm.tsx

'use client';

import { useMemo, useEffect } from 'react'; // useEffect를 import에 추가합니다.
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRooms } from '@/hooks/useRooms';
import { useCreateReservation, usePublicReservations } from '@/hooks/useReservations';
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from '@/hooks/useAuth';
import { newReservationFormSchema, type NewReservationFormValues, timeSlots } from "@/lib/validations/schemas";
import { formatDateTimeForDatabase2 } from "@/lib/utils/date";
import { handleAuthError } from '@/lib/utils/auth-error-handler';
import { CalendarIcon } from 'lucide-react'; // AlertCircle는 사용되지 않으므로 제거
import { cn } from '@/lib/utils';
import type { ReservationInsert } from '@/types/database';

export default function NewReservationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { data: rooms, isLoading: isLoadingRooms } = useRooms();
  const { mutate: createReservation, isPending } = useCreateReservation();

  const form = useForm<NewReservationFormValues>({
    resolver: zodResolver(newReservationFormSchema),
    // ✨ defaultValues는 userProfile이 로드되기 전 초기 상태를 정의합니다.
    // ✨ useEffect에서 userProfile이 로드된 후 값을 다시 설정해 줄 것입니다.
    defaultValues: {
      title: "",
      booker: "",
      purpose: "",
      date: searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date(),
      startTime: searchParams.get('startTime') || "",
      endTime: "",
      roomId: "",
    },
  });

  // ✨ userProfile 정보가 변경될 때마다 폼의 기본값을 안전하게 업데이트합니다.
  // ✨ 이 로직 덕분에 페이지에 처음 진입했을 때 사용자 정보가 자동으로 채워집니다.
  useEffect(() => {
    if (userProfile) {
      // form.reset을 사용하여 폼의 여러 값을 한 번에 업데이트합니다.
      // 이렇게 하면 불필요한 리렌더링을 방지할 수 있습니다.
      form.reset({
        ...form.getValues(), // 사용자가 이미 입력했을 수 있는 다른 필드 값은 유지합니다.
        title: userProfile.department || '', // 부서 정보가 있으면 채우고, 없으면 빈 문자열
        booker: userProfile.name || '',      // 이름 정보가 있으면 채우고, 없으면 빈 문자열
      });
    }
  }, [userProfile, form]);


  const selectedDate = form.watch('date');
  const selectedRoomId = form.watch('roomId');
  const selectedStartTime = form.watch('startTime');

  const dateString = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  const { data: reservationsOnDate = [] } = usePublicReservations(
    dateString!,
    dateString!,
    !!userProfile
  );

  const bookedSlots = useMemo(() => {
    if (!selectedDate || !selectedRoomId) return new Set<string>();
    const roomReservations = reservationsOnDate.filter(r => r.room_id === selectedRoomId);
    const booked = new Set<string>();
    roomReservations.forEach(res => {
      const start = new Date(res.start_time);
      const end = new Date(res.end_time);
      for (const slotTime of timeSlots) {
        const [hour, minute] = slotTime.split(':').map(Number);
        const slotDateTime = new Date(selectedDate);
        slotDateTime.setHours(hour, minute, 0, 0);
        if (slotDateTime >= start && slotDateTime < end) {
          booked.add(slotTime);
        }
      }
    });
    return booked;
  }, [selectedDate, selectedRoomId, reservationsOnDate]);

  const endTimeOptions = useMemo(() => {
    if (!selectedStartTime) return [];
    const startIndex = timeSlots.indexOf(selectedStartTime);
    const availableEndTimes = [];
    for (let i = startIndex + 1; i < timeSlots.length; i++) {
      const slot = timeSlots[i];
      if (bookedSlots.has(slot)) break;
      availableEndTimes.push(slot);
    }
    const finalSlot = "19:00";
    if (!bookedSlots.has(finalSlot) && !availableEndTimes.includes(finalSlot)) {
      availableEndTimes.push(finalSlot);
    }
    return availableEndTimes;
  }, [selectedStartTime, bookedSlots]);

  async function onSubmit(data: NewReservationFormValues) {
    if (!userProfile?.dbId) {
      toast({ variant: "destructive", title: "사용자 정보 오류", description: "다시 로그인해주세요." });
      return;
    }

    const startTimeUTC = formatDateTimeForDatabase2(data.date, data.startTime);
    const endTimeUTC = formatDateTimeForDatabase2(data.date, data.endTime);

    const reservationData: ReservationInsert = {
      room_id: data.roomId,
      user_id: userProfile.dbId,
      title: data.title,
      purpose: data.purpose,
      start_time: startTimeUTC,
      end_time: endTimeUTC,
    };

    createReservation(reservationData, {
      onSuccess: () => {
        toast({ title: "예약 완료", description: "회의실 예약이 성공적으로 완료되었습니다." });
        router.push('/');
      },
      onError: (error) => {
        const friendlyError = handleAuthError(error);
        toast({ variant: "destructive", title: friendlyError.title, description: friendlyError.message });
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>예약 정보 입력</CardTitle>
        <CardDescription>
          회의실 예약은 평일 오전 8시부터 오후 7시까지 가능합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title" // 예약 제목 (부서명)
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>예약 제목 (부서명)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={userProfile?.department ? '' : "부서명을 직접 입력해주세요"}
                        {...field}
                        // ✨ 핵심 로직 1: userProfile에 부서명이 있으면 비활성화
                        disabled={!!userProfile?.department}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="booker" // 예약자명
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>예약자명</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={userProfile?.name ? '' : "이름을 직접 입력해주세요"}
                        {...field}
                        // ✨ 핵심 로직 2: userProfile에 이름이 있으면 비활성화
                        disabled={!!userProfile?.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ... 이하 다른 폼 필드들은 기존과 동일합니다 ... */}

            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>회의실 선택</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingRooms}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingRooms ? "회의실 목록 로딩 중..." : "회의실을 선택하세요"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rooms?.map((room) => (
                        <SelectItem key={room.id} value={room.id}>{room.name} ({room.capacity}인실)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>날짜 선택</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(field.value, "PPP (eee)", { locale: ko }) : <span>날짜를 선택하세요</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>시작 시간</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedRoomId || !selectedDate}>
                      <FormControl><SelectTrigger><SelectValue placeholder="시작 시간" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {timeSlots.map(time => (
                          <SelectItem key={time} value={time} disabled={bookedSlots.has(time)}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>종료 시간</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedStartTime}>
                      <FormControl><SelectTrigger><SelectValue placeholder="종료 시간" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {endTimeOptions.map(time => (
                          <SelectItem key={time} value={time}>{time}</SelectItem>
                        ))}
                        {endTimeOptions.length === 0 && <div className="p-2 text-sm text-muted-foreground">시작 시간을 먼저 선택하세요.</div>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>회의 목적 (선택)</FormLabel>
                  <FormControl><Textarea placeholder="간단한 회의 목적을 입력하세요." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => router.back()}>취소</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>}
                예약하기
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}