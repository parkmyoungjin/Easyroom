// src/components/reservations/ReservationForm.tsx

'use client';

import { useMemo, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Stack, Card, Text } from '@mantine/core';
import { ControlledDateInput } from '@/components/forms/ControlledDateInput';
import { ControlledTextInput } from '@/components/forms/ControlledTextInput';
import { ControlledSelect } from '@/components/forms/ControlledSelect';
import { ControlledTextarea } from '@/components/forms/ControlledTextarea';

import { toast } from 'sonner';
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
import { useAuth } from '@/hooks/useAuth';
import { useTime } from '@/hooks/useTime';
import { newReservationFormSchema, type NewReservationFormValues } from "@/lib/validations/schemas";
import { formatDateTimeForDatabase2 } from "@/lib/utils/date";
import { handleAuthError } from '@/lib/utils/auth-error-handler';
import type { ReservationInsert, ReservationWithDetails } from '@/types/database';
import { canEditReservation, getPermissionErrorMessage } from '@/lib/utils/reservation-permissions';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import { useSupabaseClient } from '@/contexts/SupabaseProvider';
import { useNotificationStore } from '@/store/notificationStore';

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

    const { data: rooms, isLoading: isLoadingRooms } = useRooms();
    const { mutate: createReservation, isPending: isCreating } = useCreateReservation();
    const { mutate: updateReservation, isPending: isUpdating } = useUpdateReservation();
    const supabase = useSupabaseClient();
    const showNotification = useNotificationStore((state) => state.showNotification);

    // Edit 모드를 위한 상태
    const [isLoading, setIsLoading] = useState(mode === 'edit');
    const [reservation, setReservation] = useState<ReservationWithDetails | null>(null);
    // Phase 2: DI 패턴 적용 - userProfile에서 userId 추출하여 주입
    const { data: myReservationsData } = useMyReservations(userProfile?.dbId);
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
                    toast.error("예약을 찾을 수 없습니다", {
                        description: "해당 예약이 존재하지 않습니다.",
                    });
                    onCancel?.();
                    return;
                }

                // 권한 검증
                const permissionResult = canEditReservation(targetReservation, userProfile);

                if (!permissionResult.allowed) {
                    const errorMessage = getPermissionErrorMessage('edit', permissionResult.reason || 'unknown');
                    toast.error(errorMessage.title, {
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

    // ✅ [핵심 수정] Date 객체 안정화 - 무한 로딩 방지
    const stableSelectedDate = useMemo(() => {
        if (!selectedDate) return null;
        // Date 객체의 시간 부분을 정규화하여 참조 안정성 확보
        const normalized = new Date(selectedDate);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
    }, [selectedDate?.getTime()]); // getTime()을 사용하여 실제 날짜 값 기준으로 메모화

    const { data: bookedSlots = [], isLoading: isLoadingSlots } = useBookedSlots(
        selectedRoomId,
        stableSelectedDate
    );

    // 시간 충돌 계산 (Edit 모드에서는 현재 예약 제외)
    const timeSlotStatus = useMemo(() => {
        if (!stableSelectedDate || isLoadingSlots) return {};
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
            const slotStart = new Date(`${format(stableSelectedDate, 'yyyy-MM-dd')}T${slotTime}:00.000+09:00`).getTime();
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
    }, [stableSelectedDate, bookedSlots, isLoadingSlots, mode, reservation]);

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
            <Card withBorder shadow="sm" radius="md" p="lg">
                <Stack align="center" gap="md">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <Text c="dimmed">로딩 중...</Text>
                </Stack>
            </Card>
        );
    }

    async function onSubmit(data: NewReservationFormValues) {
        if (!userProfile?.dbId) {
            toast.error("사용자 정보 오류", {
                description: "다시 로그인해주세요."
            });
            return;
        }

        // 공통 검증 로직
        if (!data.title?.trim()) {
            toast.error("입력 오류", {
                description: "부서명을 입력해주세요.",
            });
            return;
        }

        if (!data.roomId) {
            toast.error("입력 오류", {
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
            toast.error("입력 오류", {
                description: "종료 시간은 시작 시간보다 늦어야 합니다.",
            });
            return;
        }

        // 과거 시간 예약 방지
        const now = new Date();
        if (startDateTime <= now) {
            toast.error("입력 오류", {
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
                    // 이전에 예약이 없었는지 확인 (첫 예약인지 체크)
                    const isFirstReservation = myReservations?.length === 0;
                    
                    if (isFirstReservation) {
                        showNotification(
                            '첫 예약을 축하합니다!',
                            '이제 "내 예약" 페이지에서 예약 내역을 확인하고 관리할 수 있습니다.',
                            'success'
                        );
                    } else {
                        toast.success("예약 완료", {
                            description: "회의실 예약이 성공적으로 완료되었습니다."
                        });
                    }
                    onSuccess?.();
                },
                onError: (error) => {
                    const friendlyError = handleAuthError(error);
                    toast.error(friendlyError.title, {
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
                    toast.success("예약이 수정되었습니다", {
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

                    toast.error(userMessage.title, {
                        description: userMessage.description,
                    });
                }
            });
        }
    }

    const isPending = isCreating || isUpdating;

    return (
        <Card withBorder shadow="sm" radius="md" p="lg">
            <Stack gap="lg">
                <div>
                    <Text size="xl" fw={600}>
                        {mode === 'create' ? '예약 정보 입력' : '예약 수정'}
                    </Text>
                    <Text size="sm" c="dimmed" mt="xs">
                        {mode === 'create'
                            ? '회의실 예약은 평일 오전 8시부터 오후 7시까지 가능합니다.'
                            : '예약 정보를 수정하세요'
                        }
                    </Text>
                </div>
                
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Stack gap="md">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <ControlledTextInput
                                control={form.control}
                                name="title"
                                label="부서명"
                                placeholder={userProfile?.department ? '' : "부서명을 입력하세요"}
                                disabled={!!userProfile?.department}
                                required
                                withAsterisk
                            />

                            <ControlledTextInput
                                control={form.control}
                                name="booker"
                                label="예약자"
                                placeholder={userProfile?.name ? '' : "예약자를 입력하세요"}
                                disabled={!!userProfile?.name}
                                required
                                withAsterisk
                            />
                        </div>

                        <ControlledSelect
                            control={form.control}
                            name="roomId"
                            label="회의실"
                            placeholder={isLoadingRooms ? "회의실 목록 로딩 중..." : "회의실을 선택하세요"}
                            data={rooms?.map((room) => ({
                                value: room.id,
                                label: `${room.name} (${room.capacity}인실)`
                            })) || []}
                            disabled={isLoadingRooms}
                            required
                            withAsterisk
                            onSelectionChange={(value) => {
                                form.setValue('startTime', '');
                                form.setValue('endTime', '');
                            }}
                        />
                        <ControlledDateInput
                            control={form.control}
                            name="date"
                            label="예약 날짜"
                            placeholder="날짜를 선택하세요"
                            minDate={new Date()}
                            excludeDate={(dateString) => {
                                // ✅ 문자열로 받은 날짜를 Date 객체로 변환하여 주말 체크
                                const dateObj = new Date(dateString);
                                return dateObj.getDay() === 0 || dateObj.getDay() === 6;
                            }}
                            required
                            withAsterisk
                            onDateChange={() => {
                                // 날짜 변경 시 시간 필드 초기화
                                form.setValue('startTime', '');
                                form.setValue('endTime', '');
                            }}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <ControlledSelect
                                control={form.control}
                                name="startTime"
                                label="시작 시간"
                                placeholder={
                                    isLoadingSlots ? "예약 현황 조회 중..."
                                        : !selectedRoomId || !selectedDate ? "회의실과 날짜를 선택하세요"
                                            : "시작 시간을 선택하세요"
                                }
                                data={START_TIME_SLOTS.map(time => {
                                    const status = timeSlotStatus[time];
                                    const isDisabled = status?.isBooked || false;
                                    return {
                                        value: time,
                                        label: `${time}${isDisabled ? ' (예약됨)' : ''}`,
                                        disabled: isDisabled
                                    };
                                })}
                                disabled={!selectedRoomId || !selectedDate || isLoadingSlots}
                                required
                                withAsterisk
                                onSelectionChange={() => {
                                    form.setValue('endTime', '');
                                }}
                            />

                            <ControlledSelect
                                control={form.control}
                                name="endTime"
                                label="종료 시간"
                                placeholder={
                                    !selectedStartTime ? "시작 시간을 먼저 선택하세요"
                                        : endTimeOptions.length === 0 ? "선택 가능한 시간이 없습니다"
                                            : "종료 시간을 선택하세요"
                                }
                                data={endTimeOptions.map(time => ({
                                    value: time,
                                    label: time
                                }))}
                                disabled={!selectedStartTime || endTimeOptions.length === 0}
                                required
                                withAsterisk
                            />
                        </div>

                        <ControlledTextarea
                            control={form.control}
                            name="purpose"
                            label="목적 (선택)"
                            placeholder="회의 목적을 입력하세요"
                            resize="none"
                            rows={4}
                        />

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                                style={{ flex: 1 }}
                            >
                                취소
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={isPending} 
                                loading={isPending}
                                style={{ flex: 1 }}
                            >
                                {mode === 'create' ? '예약하기' : '수정 완료'}
                            </Button>
                        </div>
                    </Stack>
                </form>
            </Stack>
        </Card>
    );
}