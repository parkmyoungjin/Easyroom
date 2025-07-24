'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { startOfToday } from 'date-fns';
import MobileHeader from '@/components/ui/mobile-header';
import { EnhancedLoadingState } from '@/components/ui/enhanced-loading-state';
import ErrorMessage from '@/components/ui/error-message';
import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRooms } from "@/hooks/useRooms";
import { useCreateReservation } from "@/hooks/useCreateReservation";
import { usePublicReservations } from "@/hooks/useReservations"; // 예약 현황 조회 추가
import type { ReservationInsert } from "@/types/database";
import { formatDateTimeForDatabase2 } from "@/lib/utils/date";
import { 
  newReservationFormSchema, 
  type NewReservationFormValues,
  timeSlots 
} from "@/lib/validations/schemas";
import { format } from "date-fns";
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';

export default function NewReservationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile: user } = useAuth();
  const { toast } = useToast();
  const { data: rooms } = useRooms();
  const { mutate: createReservation, isPending } = useCreateReservation();

  // 쿼리 파라미터 로딩 상태 추가
  const [isParamsReady, setIsParamsReady] = useState(false);

  // 쿼리 파라미터에서 날짜/시간 정보 가져오기
  const dateParam = searchParams.get('date');
  const hourParam = searchParams.get('hour');

  const form = useForm<NewReservationFormValues>({
    resolver: zodResolver(newReservationFormSchema),
    defaultValues: {
      title: "",
      booker: "",
      purpose: "",
      startTime: "",
      endTime: "",
      roomId: "",
    },
  });

  // 선택된 날짜의 예약 현황 조회
  const selectedDate = form.watch('date');
  const selectedRoomId = form.watch('roomId');
  
  // 선택된 날짜의 예약 데이터 가져오기 - 보안 강화된 버전
  const dateString = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const { data: reservations = [] } = usePublicReservations(
    dateString || '',
    dateString || '',
    !!user // 인증된 사용자이므로 true
  );

  // 선택된 날짜와 회의실의 예약된 시간 계산
  const bookedTimes = useMemo(() => {
    if (!selectedDate || !selectedRoomId || !reservations.length) {
      return { startTimes: new Set<string>(), endTimes: new Set<string>() };
    }

    const bookedStartTimes = new Set<string>();
    const bookedEndTimes = new Set<string>();
    
    // 선택된 회의실의 예약만 필터링
    const roomReservations = reservations.filter(reservation => reservation.room_id === selectedRoomId);
    
    // 선택된 시작 시간 가져오기
    const selectedStartTime = form.watch('startTime');
    
    // 시작 시간 충돌 검사
    timeSlots.forEach(timeSlot => {
      const [hour, minute] = timeSlot.split(':').map(Number);
      
      // 새 예약이 해당 시간에 시작한다고 가정
      const newStart = new Date(selectedDate);
      newStart.setHours(hour, minute, 0, 0);
      
      // 시작 시간 충돌 검사: 새 예약의 시작 시간이 기존 예약 구간 내부에 있는지 확인
      const hasStartConflict = roomReservations.some(reservation => {
        const reservationStart = new Date(reservation.start_time);
        const reservationEnd = new Date(reservation.end_time);
        
        // 새 예약의 시작 시간이 기존 예약 구간 내부에 있으면 충돌
        // 경계에서 정확히 만나는 경우(예: 기존 15:00 종료, 새 예약 15:00 시작)는 충돌 아님
        return newStart >= reservationStart && newStart < reservationEnd;
      });
      
      if (hasStartConflict) {
        bookedStartTimes.add(timeSlot);
      }
    });
    
    // 종료 시간 충돌 검사 (시작 시간이 선택된 경우에만)
    if (selectedStartTime) {
      const [startHour, startMinute] = selectedStartTime.split(':').map(Number);
      
      timeSlots.forEach(endTimeSlot => {
        const [endHour, endMinute] = endTimeSlot.split(':').map(Number);
        
        // 종료 시간이 시작 시간보다 빠르거나 같으면 비활성화
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        
        if (endMinutes <= startMinutes) {
          bookedEndTimes.add(endTimeSlot);
          return;
        }
        
        // 시작 시간부터 종료 시간까지의 전체 구간 검사
        const newReservationStart = new Date(selectedDate);
        newReservationStart.setHours(startHour, startMinute, 0, 0);
        const newReservationEnd = new Date(selectedDate);
        newReservationEnd.setHours(endHour, endMinute, 0, 0);
        
        // 전체 구간이 기존 예약과 겹치는지 확인
        const hasEndConflict = roomReservations.some(reservation => {
          const reservationStart = new Date(reservation.start_time);
          const reservationEnd = new Date(reservation.end_time);
          
          // 새 예약과 기존 예약이 겹치는지 확인
          // 경계에서 정확히 만나는 경우는 충돌 아님
          return newReservationStart < reservationEnd && newReservationEnd > reservationStart;
        });
        
        if (hasEndConflict) {
          bookedEndTimes.add(endTimeSlot);
        }
      });
    }
    
    return { startTimes: bookedStartTimes, endTimes: bookedEndTimes };
  }, [selectedDate, selectedRoomId, reservations, form.watch('startTime')]);

  // 쿼리 파라미터 로딩 감지
  useEffect(() => {
    // 약간의 지연을 두어 클라이언트 사이드 라우팅 완료 대기
    const timer = setTimeout(() => {
      setIsParamsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // 사용자 정보와 쿼리 파라미터 처리
  useEffect(() => {
    if (!isParamsReady) return;

    // 쿼리 파라미터가 있으면 폼에 자동 설정
    if (dateParam && hourParam) {
      try {
        const date = new Date(dateParam);
        const hour = parseInt(hourParam);
        
        // 유효한 날짜와 시간인지 확인
        if (!isNaN(date.getTime()) && hour >= 8 && hour <= 18) {
          const startTime = `${hour.toString().padStart(2, '0')}:00`;
          const endTime = hour < 18 ? `${(hour + 1).toString().padStart(2, '0')}:00` : "19:00";
          
          // reset으로 폼 전체를 새로 설정
          form.reset({
            title: user?.department || "",
            booker: user?.name || "",
            purpose: "",
            date: date,
            startTime: startTime,
            endTime: endTime,
            roomId: "",
          });
        }
      } catch (error) {
        console.error('Invalid query parameters:', error);
      }
    } else if (user) {
      // 쿼리 파라미터가 없을 때는 부서명과 예약자 설정
      if (user.department) {
        form.setValue('title', user.department);
      }
      if (user.name) {
        form.setValue('booker', user.name);
      }
    }
  }, [user, dateParam, hourParam, form, isParamsReady]);

  // 로딩 중일 때 (파라미터 준비 대기)
  if (!isParamsReady) {
    return (
      <EnhancedLoadingState
        isLoading={true}
        title="예약 폼을 준비하고 있습니다..."
        description="잠시만 기다려주세요"
        showNetworkStatus={true}
        className="min-h-screen flex items-center justify-center"
      />
    );
  }

  async function onSubmit(data: NewReservationFormValues) {
    // Middleware ensures user is authenticated, so user should be available
    if (!user) {
      toast({
        variant: "destructive",
        title: "사용자 정보 오류",
        description: "사용자 정보를 불러올 수 없습니다. 페이지를 새로고침해주세요.",
      });
      return;
    }
  
    try {
      console.log('=== 예약 생성 디버깅 시작 ===');
      console.log('1. 폼 데이터:', data);
      console.log('2. useAuth user:', user);
  
      // users 테이블에서 실제 ID 조회
      const supabase = await createClient();
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, auth_id, name, employee_id')
        .eq('auth_id', user.authId) // camelCase 프로퍼티 사용
        .single();
  
      console.log('3. users 테이블 조회 결과:', userData);
      console.log('4. users 테이블 조회 에러:', userError);
  
      if (userError || !userData) {
        console.error('사용자 정보 조회 실패:', userError);
        toast({
          variant: "destructive",
          title: "사용자 정보 오류",
          description: "사용자 정보를 찾을 수 없습니다.",
        });
        return;
      }
  
      const startTimeUTC = formatDateTimeForDatabase2(data.date, data.startTime);
      const endTimeUTC = formatDateTimeForDatabase2(data.date, data.endTime);
  
      console.log('5. 변환된 시간:', {
        original_date: data.date,
        original_start: data.startTime,
        original_end: data.endTime,
        utc_start: startTimeUTC,
        utc_end: endTimeUTC
      });
  
      if (startTimeUTC >= endTimeUTC) {
        console.error('시간 범위 오류:', { startTimeUTC, endTimeUTC });
        toast({
          variant: "destructive",
          title: "예약 실패",
          description: "종료 시간은 시작 시간보다 늦어야 합니다.",
        });
        return;
      }
  
      const reservationData: ReservationInsert = {
        title: data.title,
        room_id: data.roomId,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        purpose: data.purpose || undefined,
        status: "confirmed",
        user_id: userData.id,
      };
  
      console.log('6. 최종 예약 데이터:', reservationData);
      console.log('7. 예약 데이터 타입 확인:', {
        title: typeof reservationData.title,
        room_id: typeof reservationData.room_id,
        user_id: typeof reservationData.user_id,
        start_time: typeof reservationData.start_time,
        end_time: typeof reservationData.end_time,
        status: typeof reservationData.status,
        purpose: typeof reservationData.purpose
      });
  
      createReservation(reservationData, {
        onSuccess: () => {
          console.log('8. 예약 성공!');
          toast({
            title: "예약 완료",
            description: "회의실 예약이 성공적으로 완료되었습니다.",
          });
          router.push('/');
        },
        onError: (error: Error) => {
          const reservationError = ReservationErrorHandler.handleReservationError(error, {
            action: 'create',
            userId: user?.id,
            userDbId: userData?.id,
            timestamp: new Date().toISOString()
          });

          const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'create');

          console.error("9. 예약 실패:", error);
          console.error("9-1. 구조화된 오류:", reservationError);
          
          toast({
            variant: "destructive",
            title: userMessage.title,
            description: userMessage.description,
          });
        },
      });
    } catch (error) {
      console.error("10. onSubmit 전체 에러:", error);
      toast({
        variant: "destructive",
        title: "예약에 실패했습니다",
        description: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="새 예약" showBackButton />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>회의실 예약</CardTitle>
            <CardDescription>
              회의실 예약은 평일 오전 8시부터 오후 7시까지 가능합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>부서명</FormLabel>
                      <FormControl>
                        <Input placeholder="부서명을 입력하세요" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="booker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>예약자</FormLabel>
                      <FormControl>
                        <Input placeholder="예약자를 입력하세요" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                  control={form.control}
                  name="roomId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>회의실</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="회의실을 선택하세요" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rooms?.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {room.name} ({room.capacity}인실)
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
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>날짜</FormLabel>
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < startOfToday()}
                        className="rounded-md border"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>시작 시간</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="시작 시간" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {timeSlots.map((time) => {
                              const isBooked = bookedTimes.startTimes.has(time);
                              return (
                                <SelectItem 
                                  key={time} 
                                  value={time}
                                  disabled={isBooked}
                                  className={isBooked ? 'text-gray-400 cursor-not-allowed' : ''}
                                >
                                  {time} {isBooked && '(예약됨)'}
                                </SelectItem>
                              );
                            })}
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="종료 시간" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {timeSlots.map((time) => {
                              const isBooked = bookedTimes.endTimes.has(time);
                              return (
                                <SelectItem 
                                  key={time} 
                                  value={time}
                                  disabled={isBooked}
                                  className={isBooked ? 'text-gray-400 cursor-not-allowed' : ''}
                                >
                                  {time} {isBooked && '(예약됨)'}
                                </SelectItem>
                              );
                            })}
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
                      <FormLabel>목적 (선택)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="회의 목적을 입력하세요"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => router.back()}
                  >
                    취소
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isPending}>
                    {isPending ? "예약 중..." : "예약하기"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 