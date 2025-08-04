// src/components/reservations/ReservationForm.tsx

'use client';

import { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useRooms, useBookedSlots } from '@/hooks/useRooms';
import type { BookedSlot } from '@/lib/services/rooms';

// 예약 간격 타입 정의
interface BookedInterval {
    start: number;
    end: number;
    title: string;
}
import { useCreateReservation, useUpdateReservation, useMyReservations } from '@/hooks/useReservations';
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from '@/hooks/useAuth';
import { useTime } from '@/hooks/useTime';
import { newReservationFormSchema, type NewReservationFormValues } from "@/lib/validations/schemas";
import { formatDateTimeForDatabase2 } from "@/lib/utils/date";
import { handleAuthError } from '@/lib/utils/auth-error-handler';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReservationInsert, ReservationWithDetails } from '@/types/database';
import { logger } from '@/lib/utils/logger';
import { debugUserIdMapping, debugPermissionCheck } from '@/lib/utils/debug';
import { canEditReservation, getPermissionErrorMessage } from '@/lib/utils/reservation-permissions';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';

// 시간 슬롯 상수 정의 (컴포넌트 외부)
const START_TIME_SLOTS = Array.from({ length: (18.5 - 8) * 2 + 1 }, (_, i) => {
    const hours = 8 + Math.floor(i / 2);
    const minutes = (i % 2) * 30;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

const END_TIME_SLOTS = Array.from({ length: (19 - 8.5) * 2 + 1 }, (_, i) => {
    const hours = 8 + Math.floor((i + 1) / 2);
    const minutes = ((i + 1) % 2) * 30;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

// Props 인터페이스 정의
interface ReservationFormProps {
    mode: 'create' | 'edit';
    reservationId?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function ReservationForm({
    mode,
    reservationId,
    onSuccess,
    onCancel
}: ReservationFormProps) {
    const { userProfile } = useAuth();
    const { isDateInPast, isDateWeekend } = useTime();
    const { toast } = useToast();
    const { data: rooms, isLoading: isLoadingRooms } = useRooms();
    const { mutate: createReservation, isPending: isCreating } = useCreateReservation();
    const { mutate: updateReservation, isPending: isUpdating } = useUpdateReservation();
    const supabase = useSupabaseClient();

    // Edit 모드를 위한 상태
    const [isLoading, setIsLoading] = useState(mode === 'edit');
    const [reservation, setReservation] = useState<ReservationWithDetails | null>(null);
    const { data: myReservationsData } = useMyReservations();
    const myReservations: ReservationWithDetails[] = myReservationsData || [];

    const form = useForm<NewReservationFormValues>({
        resolver: zodResolver(newReservationFormSchema),
        defaultValues: {
            title: "",
            booker: "",
            purpose: "",
            date: new Date(),
            startTime: "",
            endTime: "",
            roomId: "",
        },
    });

    // Edit 모드일 때 예약 데이터 로딩
    useEffect(() => {
        if (mode === 'edit' && reservationId && myReservations.length > 0) {
            const loadReservationData = async () => {
                if (!userProfile) return;

                // 내 예약 중에서 해당 ID 찾기
                const targetReservation = myReservations.find((r: ReservationWithDetails) => r.id === reservationId);

                if (!targetReservation) {
                    toast({
                        variant: "destructive",
                        title: "예약을 찾을 수 없습니다",
                        description: "해당 예약이 존재하지 않습니다.",
                    });
                    onCancel?.();
                    return;
                }

                // 권한 검증
                const permissionResult = canEditReservation(targetReservation, userProfile);

                if (!permissionResult.allowed) {
                    const errorMessage = getPermissionErrorMessage('edit', permissionResult.reason || 'unknown');
                    toast({
                        variant: "destructive",
                        title: errorMessage.title,
                        description: errorMessage.description,
                    });
                    onCancel?.();
                    return;
                }

                setReservation(targetReservation);

                // 폼에 예약 데이터 설정
                const startDate = new Date(targetReservation.start_time);
                const endDate = new Date(targetReservation.end_time);

                const startTime = format(startDate, 'HH:mm');
                const endTime = format(endDate, 'HH:mm');

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
        }
    }, [mode, reservationId, myReservations, userProfile, form, toast, onCancel]);

    // Create 모드일 때 사용자 프로필로 초기화
    useEffect(() => {
        if (mode === 'create' && userProfile) {
            form.reset({
                ...form.getValues(),
                title: userProfile.department || '',
                booker: userProfile.name || '',
            });
        }
    }, [mode, userProfile, form]);

    const selectedDate = form.watch('date');
    const selectedRoomId = form.watch('roomId');
    const selectedStartTime = form.watch('startTime');

    const { data: bookedSlots = [], isLoading: isLoadingSlots } = useBookedSlots(
        selectedRoomId,
        selectedDate
    );

    // 시간 충돌 계산 (Edit 모드에서는 현재 예약 제외)
    const timeSlotStatus = useMemo(() => {
        if (!selectedDate || isLoadingSlots) return {};
        const statusMap: { [time: string]: { isBooked: boolean; title: string } } = {};

        // Edit 모드에서는 현재 수정 중인 예약을 제외한 예약 슬롯만 고려
        const filteredBookedSlots = mode === 'edit' && reservation
            ? bookedSlots.filter((slot: BookedSlot) => slot.start_time !== reservation.start_time || slot.end_time !== reservation.end_time)
            : bookedSlots;

        const bookedIntervals: BookedInterval[] = filteredBookedSlots.map((slot: BookedSlot) => ({
            start: new Date(slot.start_time).getTime(),
            end: new Date(slot.end_time).getTime(),
            title: slot.is_mine ? `(내 예약: ${slot.title})` : '(예약됨)',
        }));

        START_TIME_SLOTS.forEach(slotTime => {
            const slotStart = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${slotTime}:00.000+09:00`).getTime();
            const slotEnd = slotStart + 30 * 60 * 1000;

            const conflictingReservation = bookedIntervals.find((interval: BookedInterval) =>
                slotStart < interval.end && slotEnd > interval.start
            );

            statusMap[slotTime] = {
                isBooked: !!conflictingReservation,
                title: conflictingReservation ? conflictingReservation.title : ''
            };
        });
        return statusMap;
    }, [selectedDate, bookedSlots, isLoadingSlots, mode, reservation]);

    // 종료 시간 옵션 계산
    const endTimeOptions = useMemo(() => {
        if (!selectedStartTime) return [];

        const options: string[] = [];
        const possibleEndTimes = END_TIME_SLOTS.filter(time => time > selectedStartTime);

        for (const currentTime of possibleEndTimes) {
            const prevTime = options.length > 0 ? options[options.length - 1] : selectedStartTime;

            if (timeSlotStatus[prevTime]?.isBooked) {
                break;
            }
            options.push(currentTime);
        }
        return options;
    }, [selectedStartTime, timeSlotStatus]);

    // 로딩 중일 때 (Edit 모드)
    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-gray-600">로딩 중...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    async function onSubmit(data: NewReservationFormValues) {
        if (!userProfile?.dbId) {
            toast({
                variant: "destructive",
                title: "사용자 정보 오류",
                description: "다시 로그인해주세요."
            });
            return;
        }

        // 공통 검증 로직
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

        // 과거 시간 예약 방지
        const now = new Date();
        if (startDateTime <= now) {
            toast({
                variant: "destructive",
                title: "입력 오류",
                description: "과거 시간으로는 예약할 수 없습니다.",
            });
            return;
        }

        if (mode === 'create') {
            // 새 예약 생성
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
                    toast({
                        title: "예약 완료",
                        description: "회의실 예약이 성공적으로 완료되었습니다."
                    });
                    onSuccess?.();
                },
                onError: (error) => {
                    const friendlyError = handleAuthError(error);
                    toast({
                        variant: "destructive",
                        title: friendlyError.title,
                        description: friendlyError.message
                    });
                },
            });
        } else if (mode === 'edit' && reservation) {
            // 예약 수정
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
                    toast({
                        title: "예약이 수정되었습니다",
                        description: "예약 정보가 성공적으로 업데이트되었습니다."
                    });
                    onSuccess?.();
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

                    toast({
                        variant: "destructive",
                        title: userMessage.title,
                        description: userMessage.description,
                    });
                }
            });
        }
    }

    const isPending = isCreating || isUpdating;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{mode === 'create' ? '예약 정보 입력' : '예약 수정'}</CardTitle>
                <CardDescription>
                    {mode === 'create'
                        ? '회의실 예약은 평일 오전 8시부터 오후 7시까지 가능합니다.'
                        : '예약 정보를 수정하세요'
                    }
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
                                            <Input
                                                placeholder={userProfile?.department ? '' : "부서명을 입력하세요"}
                                                {...field}
                                                disabled={!!userProfile?.department}
                                            />
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
                                            <Input
                                                placeholder={userProfile?.name ? '' : "예약자를 입력하세요"}
                                                {...field}
                                                disabled={!!userProfile?.name}
                                            />
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
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            form.setValue('startTime', '');
                                            form.setValue('endTime', '');
                                        }}
                                        value={field.value}
                                        disabled={isLoadingRooms}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={isLoadingRooms ? "회의실 목록 로딩 중..." : "회의실을 선택하세요"} />
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
            {/* ✅ [핵심 수정] 조건부 렌더링을 제거하고, 항상 펼쳐진 캘린더만 사용하도록 통일합니다. */}
            <Calendar
                mode="single"
                selected={field.value}
                onSelect={(date) => {
                    // 캘린더 자동 닫기 로직은 더 이상 필요 없으므로 제거합니다.
                    if (date) field.onChange(date);
                    form.setValue('startTime', '');
                    form.setValue('endTime', '');
                }}
                disabled={(date) => isDateInPast(date) || isDateWeekend(date)}
                className="rounded-md border" // 모든 모드에서 테두리 스타일 적용
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
                                        <Select
                                            onValueChange={(value) => {
                                                field.onChange(value);
                                                form.setValue('endTime', '');
                                            }}
                                            value={field.value}
                                            disabled={!selectedRoomId || !selectedDate || isLoadingSlots}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={
                                                        isLoadingSlots ? "예약 현황 조회 중..."
                                                            : !selectedRoomId || !selectedDate ? "회의실과 날짜를 선택하세요"
                                                                : "시작 시간을 선택하세요"
                                                    } />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {START_TIME_SLOTS.map(time => {
                                                    const status = timeSlotStatus[time];
                                                    const isDisabled = status?.isBooked || false;
                                                    return (
                                                        <SelectItem
                                                            key={time}
                                                            value={time}
                                                            disabled={isDisabled}
                                                            className={isDisabled ? 'text-gray-400 cursor-not-allowed' : ''}
                                                        >
                                                            {time} {isDisabled && '(예약됨)'}
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
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            disabled={!selectedStartTime || endTimeOptions.length === 0}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={
                                                        !selectedStartTime ? "시작 시간을 먼저 선택하세요"
                                                            : endTimeOptions.length === 0 ? "선택 가능한 시간이 없습니다"
                                                                : "종료 시간을 선택하세요"
                                                    } />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {endTimeOptions.map(time => (
                                                    <SelectItem key={time} value={time}>
                                                        {time}
                                                    </SelectItem>
                                                ))}
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
                                onClick={onCancel}
                                className="flex-1"
                            >
                                취소
                            </Button>
                            <Button type="submit" disabled={isPending} className="flex-1">
                                {isPending && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                )}
                                {isPending
                                    ? (mode === 'create' ? '예약 중...' : '수정 중...')
                                    : (mode === 'create' ? '예약하기' : '수정 완료')
                                }
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}