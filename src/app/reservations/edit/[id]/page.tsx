'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import MobileHeader from '@/components/ui/mobile-header';
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
import { useUpdateReservation } from "@/hooks/useUpdateReservation";
import { useMyReservations, usePublicReservations } from "@/hooks/useReservations";
import { format } from "date-fns";
import type { ReservationWithDetails } from "@/types/database";
import { 
  newReservationFormSchema, 
  type NewReservationFormValues,
  timeSlots 
} from "@/lib/validations/schemas";
import { logger } from '@/lib/utils/logger';
import { debugUserIdMapping, debugPermissionCheck } from '@/lib/utils/debug';
import { canEditReservation, getPermissionErrorMessage } from '@/lib/utils/reservation-permissions';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';

export default function EditReservationPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { data: rooms } = useRooms();
  const { mutate: updateReservation, isPending } = useUpdateReservation();

  // 사용자 정보 가져오기
  const { userProfile } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [reservation, setReservation] = useState<ReservationWithDetails | null>(null);

  const reservationId = params.id as string;

  // 예약 정보 가져오기 - 내 예약 목록에서 찾기
  const { data: myReservationsData } = useMyReservations();
  const myReservations: ReservationWithDetails[] = myReservationsData || [];

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
    !!userProfile // 인증된 사용자이므로 true
  );

  // 선택된 날짜와 회의실의 예약된 시간 계산 (현재 수정 중인 예약은 제외)
  const bookedTimes = useMemo(() => {
    if (!selectedDate || !selectedRoomId || !reservations.length || !reservation) {
      return { startTimes: new Set<string>(), endTimes: new Set<string>() };
    }

    const bookedStartTimes = new Set<string>();
    const bookedEndTimes = new Set<string>();
    
    // 선택된 회의실의 예약만 필터링하고, 현재 수정 중인 예약은 제외
    const roomReservations = reservations.filter(res => 
      res.room_id === selectedRoomId && res.id !== reservation.id
    );
    
    // 선택된 시작 시간 가져오기
    const selectedStartTime = form.watch('startTime');
    
    // 시작 시간 충돌 검사
    timeSlots.forEach(timeSlot => {
      const [hour, minute] = timeSlot.split(':').map(Number);
      
      // 새 예약이 해당 시간에 시작한다고 가정
      const newStart = new Date(selectedDate);
      newStart.setHours(hour, minute, 0, 0);
      
      // 시작 시간 충돌 검사: 새 예약의 시작 시간이 기존 예약 구간 내부에 있는지 확인
      const hasStartConflict = roomReservations.some(existingReservation => {
        const reservationStart = new Date(existingReservation.start_time);
        const reservationEnd = new Date(existingReservation.end_time);
        
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
        const hasEndConflict = roomReservations.some(existingReservation => {
          const reservationStart = new Date(existingReservation.start_time);
          const reservationEnd = new Date(existingReservation.end_time);
          
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
  }, [selectedDate, selectedRoomId, reservations, form.watch('startTime'), reservation]);

  // 예약 정보 로딩 및 폼 설정
  useEffect(() => {
    const loadReservationData = async () => {
      if (!userProfile || !myReservations || !reservationId) return;

      // 내 예약 중에서 해당 ID 찾기
      const targetReservation = myReservations.find((r: ReservationWithDetails) => r.id === reservationId);
      
      if (!targetReservation) {
        toast({
          variant: "destructive",
          title: "예약을 찾을 수 없습니다",
          description: "해당 예약이 존재하지 않습니다.",
        });
        router.push('/reservations/my');
        return;
      }

      // ✅ 디버깅: 사용자 ID 매핑 상태 확인
      const mappingDebugInfo = await debugUserIdMapping(userProfile, targetReservation);

     // ✅ [수정] profileId를 authId로 변경
     logger.debug('사용자 ID 매핑 상태', {
      authId: userProfile.authId,
      dbId: userProfile.dbId,
      profileId: userProfile.authId, // ⬅️ 여기를 수정
      mappingSuccess: mappingDebugInfo.issues.length === 0,
      issues: mappingDebugInfo.issues,
    });

    // ✅ 개선된 권한 검증 로직 사용
    const permissionResult = canEditReservation(targetReservation, userProfile);
    
    // ✅ [수정] currentUserId를 authId로 변경 (또는 dbId를 사용하는 것이 더 명확할 수 있음)
    //    canEditReservation 함수가 내부적으로 dbId를 사용하므로, dbId로 통일하는 것이 좋습니다.
    logger.debug('권한 검증 결과', {
      action: 'edit',
      allowed: permissionResult.allowed,
      reservationId: targetReservation.id,
      reservationUserId: targetReservation.user_id,
      currentUserId: userProfile.dbId, // ⬅️ 여기를 dbId로 수정
      userRole: userProfile.role,
      reason: permissionResult.reason,
    });

    // ✅ 디버깅: 권한 검증 과정 시각화
    debugPermissionCheck('edit', userProfile, targetReservation, permissionResult.allowed);

    // ✅ 잘못된 user_id 자동 수정 로직
    if (permissionResult.allowed && permissionResult.details.isOwnerByAuthId && !permissionResult.details.isOwnerByDbId && userProfile.dbId) {
      logger.debug('잘못된 user_id 감지, 자동 수정 시도', {
        reservationId: targetReservation.id,
        currentUserId: targetReservation.user_id,
        correctDbId: userProfile.dbId
      });
      
      // 백그라운드에서 user_id 수정 (실패해도 페이지 로딩은 계속)
      import('@/lib/utils/reservation-permissions').then(({ fixReservationUserId }) => {
        fixReservationUserId(targetReservation.id, userProfile.dbId!).then(success => {
          if (success) {
            logger.debug('예약 user_id 자동 수정 완료', {
              reservationId: targetReservation.id,
              newUserId: userProfile.dbId
            });
          }
        });
      });
    }

    if (!permissionResult.allowed) {
      logger.warn('예약 수정 권한 거부', {
        action: 'edit',
        status: 'permission_denied',
        reservationId: targetReservation.id,
        success: false,
        reason: permissionResult.reason,
        details: permissionResult.details,
        mappingIssues: mappingDebugInfo.issues
      });
      
      const errorMessage = getPermissionErrorMessage('edit', permissionResult.reason || 'unknown');
      toast({
        variant: "destructive",
        title: errorMessage.title,
        description: errorMessage.description,
      });
      router.push('/reservations/my');
      return;
    }

    setReservation(targetReservation);

    // 폼에 예약 데이터 설정
    const startDate = new Date(targetReservation.start_time);
    const endDate = new Date(targetReservation.end_time);
    
    const startTime = format(startDate, 'HH:mm');
    const endTime = format(endDate, 'HH:mm');

    logger.debug('Setting up reservation edit form');

    form.reset({
      title: targetReservation.title,
      booker: userProfile?.name ?? '',
      purpose: targetReservation.purpose || '',
      date: startDate,
      startTime: startTime,
      endTime: endTime,
      roomId: targetReservation.room_id,
    });

      setIsLoading(false);
    };

    loadReservationData();
  }, [userProfile, myReservations, reservationId, form, toast, router]);

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 예약 데이터가 없는 경우 null 반환
  if (!reservation) {
    return null;
  }

  async function onSubmit(data: NewReservationFormValues) {
    // Middleware ensures user is authenticated, so userProfile should be available
    if (!userProfile || !reservation) {
      toast({
        variant: "destructive",
        title: "데이터 오류",
        description: "필요한 정보를 불러올 수 없습니다. 페이지를 새로고침해주세요.",
      });
      return;
    }

    // ✅ 권한 재검증 (폼 제출 시점에서)
    const permissionResult = canEditReservation(reservation, userProfile);
    if (!permissionResult.allowed) {
      const errorMessage = getPermissionErrorMessage('edit', permissionResult.reason || 'unknown');
      toast({
        variant: "destructive",
        title: errorMessage.title,
        description: errorMessage.description,
      });
      return;
    }

    try {
      // ✅ 입력 데이터 검증 강화
      if (!data.title?.trim()) {
        toast({
          variant: "destructive",
          title: "입력 오류",
          description: "부서명을 입력해주세요.",
        });
        return;
      }

      if (!data.roomId) {
        toast({
          variant: "destructive",
          title: "입력 오류",
          description: "회의실을 선택해주세요.",
        });
        return;
      }

      // 날짜와 시간을 조합하여 Date 객체 생성
      const startDateTime = new Date(data.date);
      const [startHour, startMinute] = data.startTime.split(':').map(Number);
      startDateTime.setHours(startHour, startMinute, 0, 0);
      
      const endDateTime = new Date(data.date);
      const [endHour, endMinute] = data.endTime.split(':').map(Number);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      if (endDateTime <= startDateTime) {
        toast({
          variant: "destructive",
          title: "입력 오류",
          description: "종료 시간은 시작 시간보다 늦어야 합니다.",
        });
        return;
      }

      // ✅ 과거 시간 예약 방지
      const now = new Date();
      if (startDateTime <= now) {
        toast({
          variant: "destructive",
          title: "입력 오류",
          description: "과거 시간으로는 예약할 수 없습니다.",
        });
        return;
      }

      logger.debug('예약 수정 폼 제출', {
        reservationId: reservation.id,
        userId: userProfile.authId,
        userDbId: userProfile.dbId,
        updateData: {
          room_id: data.roomId,
          title: data.title.trim(),
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
        }
      });

      const updateData = {
        room_id: data.roomId,
        title: data.title.trim(),
        purpose: data.purpose?.trim() || undefined,
        start_time: startDateTime,
        end_time: endDateTime
      };

      updateReservation({
        id: reservation.id,
        data: updateData
      }, {
        onSuccess: () => {
          logger.info('예약 수정 완료', { reservationId: reservation.id, success: true });
          toast({
            title: "예약이 수정되었습니다",
            description: "예약 정보가 성공적으로 업데이트되었습니다."
          });
          router.replace('/reservations/my');
        },
        onError: (error) => {
          const reservationError = ReservationErrorHandler.handleReservationError(error, {
            action: 'edit',
            reservationId: reservation.id,
            userId: userProfile.authId,
            userDbId: userProfile.dbId,
            timestamp: new Date().toISOString()
          });

          const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'edit');

          logger.error('예약 수정 실패', {
            reservationId: reservation.id,
            structuredError: reservationError,
            originalError: error instanceof Error ? error.message : 'Unknown error',
            userId: userProfile.authId,
            userDbId: userProfile.dbId
          });
          
          toast({
            variant: "destructive",
            title: userMessage.title,
            description: userMessage.description,
          });
        }
      });
    } catch (error) {
      logger.error('예약 수정 폼 제출 오류', {
        reservationId: reservation.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        userId: userProfile.authId
      });
      
      toast({
        variant: "destructive",
        title: "예약 수정에 실패했습니다",
        description: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="예약 수정" showBackButton />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>예약 수정</CardTitle>
            <CardDescription>
              예약 정보를 수정하세요
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
                        disabled={(date) => date < new Date()}
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
                    onClick={() => router.push('/reservations/my')}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button type="submit" disabled={isPending} className="flex-1">
                    {isPending && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    )}
                    {isPending ? '수정 중...' : '수정 완료'}
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