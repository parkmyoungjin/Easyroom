// FILE: src/features/admin/components/ReservationList.tsx

'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { utcToKst } from '@/lib/utils/date';
import {
  Table,
  TextInput,
  ActionIcon,
  Group,
  Text,
  Badge,
  Stack,
  Select,
  UnstyledButton,
  Center,
  Pagination,
  Tooltip
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconSearch, IconChevronUp, IconChevronDown, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
// ✅ [핵심 수정] 모든 예약 관련 훅을 단일 파일에서 import 합니다.
import {
  useReservationsWithDetails,
  useCancelReservation
} from '@/hooks/useReservations';
import { useRooms } from '@/hooks/useRooms';
import { ReservationErrorHandler } from '@/lib/utils/error-handler';
import type { Reservation } from '@/types/database';

type ReservationWithDetails = Reservation & {
  user?: { name: string };
  room?: { name: string };
};

type SortableField = 'title' | 'user_name' | 'room_name' | 'start_time' | 'status';

export function ReservationList() {
  // 기존 상태
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string>('');

  // 새로운 상태 - 정렬 및 검색
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortableField | null>(null);
  const [reverseSortDirection, setReverseSortDirection] = useState(false);

  // 페이지네이션 상태
  const [activePage, setActivePage] = useState(1);
  const itemsPerPage = 10;

  const queryStartDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  const queryEndDate = queryStartDate;

  const { data: reservations, isLoading } = useReservationsWithDetails(
    queryStartDate,
    queryEndDate
  );
  const { data: rooms } = useRooms();
  const { mutate: cancelReservation } = useCancelReservation();

  // 데이터 처리 로직 - 필터링, 검색, 정렬
  const processedData = useMemo(() => {
    if (!reservations) return [];

    let filtered = reservations.filter((reservation) => {
      // 회의실 필터
      const isRoomMatch = selectedRoom ? reservation.room_id === selectedRoom : true;

      // 검색 필터
      const searchLower = searchQuery.toLowerCase();
      const isSearchMatch = searchQuery === '' ||
        reservation.title.toLowerCase().includes(searchLower) ||
        ((reservation as any).user?.name || '').toLowerCase().includes(searchLower);

      return isRoomMatch && isSearchMatch;
    });

    // 정렬
    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortBy) {
          case 'title':
            aValue = a.title;
            bValue = b.title;
            break;
          case 'user_name':
            aValue = (a as any).user?.name || '';
            bValue = (b as any).user?.name || '';
            break;
          case 'room_name':
            const roomA = rooms?.find(r => r.id === a.room_id);
            const roomB = rooms?.find(r => r.id === b.room_id);
            aValue = roomA?.name || '';
            bValue = roomB?.name || '';
            break;
          case 'start_time':
            aValue = new Date(a.start_time);
            bValue = new Date(b.start_time);
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return reverseSortDirection ? 1 : -1;
        if (aValue > bValue) return reverseSortDirection ? -1 : 1;
        return 0;
      });
    }

    return filtered;
  }, [reservations, selectedRoom, searchQuery, sortBy, reverseSortDirection, rooms]);

  // 페이지네이션 적용
  const paginatedData = useMemo(() => {
    const startIndex = (activePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return processedData.slice(startIndex, endIndex);
  }, [processedData, activePage, itemsPerPage]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage);

  // 정렬 핸들러
  const setSorting = (field: SortableField) => {
    const reversed = field === sortBy ? !reverseSortDirection : false;
    setReverseSortDirection(reversed);
    setSortBy(field);
    setActivePage(1); // 정렬 시 첫 페이지로 이동
  };

  // 정렬 아이콘 컴포넌트
  const getSortIcon = (field: SortableField) => {
    if (sortBy !== field) {
      return null;
    }
    return reverseSortDirection ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />;
  };

  // 테이블 헤더 컴포넌트
  const Th = ({ children, sorted, onSort }: {
    children: React.ReactNode;
    sorted?: boolean;
    onSort?: () => void;
  }) => (
    <Table.Th>
      {onSort ? (
        <UnstyledButton onClick={onSort} style={{ width: '100%' }}>
          <Group justify="space-between">
            <Text fw={500} fz="sm">
              {children}
            </Text>
            <Center>{sorted && getSortIcon(sortBy!)}</Center>
          </Group>
        </UnstyledButton>
      ) : (
        <Text fw={500} fz="sm">
          {children}
        </Text>
      )}
    </Table.Th>
  );

  const handleCancel = (reservation: Reservation) => {
    if (window.confirm('이 예약을 취소하시겠습니까?')) {
      cancelReservation(
        {
          id: reservation.id,
          reason: '관리자에 의한 취소',
        },
        {
          onSuccess: () => {
            toast.success('예약 취소 완료', {
              description: '예약이 취소되었습니다.',
            });
          },
          onError: (error) => {
            const reservationError = ReservationErrorHandler.handleReservationError(error, {
              action: 'cancel',
              reservationId: reservation.id,
              userRole: 'admin',
              timestamp: new Date().toISOString()
            });

            const userMessage = ReservationErrorHandler.getUserFriendlyMessage(reservationError, 'cancel');

            toast.error(userMessage.title, {
              description: userMessage.description,
            });
          },
        }
      );
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" gap="md">
        <Text>로딩 중...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* 필터 및 검색 영역 */}
      <Group gap="md">
        <DatePickerInput
          label="날짜 선택"
          placeholder="날짜를 선택하세요"
          value={selectedDate}
          onChange={(value) => setSelectedDate(value ? new Date(value) : undefined)}
          style={{ width: 200 }}
        />

        <Select
          label="회의실"
          placeholder="전체 회의실"
          value={selectedRoom}
          onChange={(value) => setSelectedRoom(value || '')}
          data={[
            { value: '', label: '전체 회의실' },
            ...(rooms?.map((room) => ({
              value: room.id,
              label: room.name
            })) || [])
          ]}
          style={{ width: 200 }}
        />

        <TextInput
          label="검색"
          placeholder="제목 또는 예약자명으로 검색"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          style={{ flex: 1, minWidth: 250 }}
        />
      </Group>

      {/* 결과 요약 */}
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          총 {processedData.length}개의 예약 ({paginatedData.length}개 표시)
        </Text>
      </Group>

      {/* 테이블 */}
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Th sorted={sortBy === 'room_name'} onSort={() => setSorting('room_name')}>
              회의실
            </Th>
            <Th sorted={sortBy === 'title'} onSort={() => setSorting('title')}>
              제목
            </Th>
            <Th sorted={sortBy === 'user_name'} onSort={() => setSorting('user_name')}>
              예약자
            </Th>
            <Th sorted={sortBy === 'start_time'} onSort={() => setSorting('start_time')}>
              시간
            </Th>
            <Th sorted={sortBy === 'status'} onSort={() => setSorting('status')}>
              상태
            </Th>
            <Th>
              작업
            </Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paginatedData.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text ta="center" c="dimmed" py="xl">
                  검색 결과가 없습니다.
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            paginatedData.map((reservation) => {
              const room = rooms?.find((r) => r.id === reservation.room_id);
              return (
                <Table.Tr key={reservation.id}>
                  <Table.Td>
                    <Text fw={500}>{room?.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text>{reservation.title}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text>{(reservation as any).user?.name || 'Unknown'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm">
                        {format(utcToKst(reservation.start_time), 'PPP EEEE', {
                          locale: ko,
                        })}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {format(utcToKst(reservation.start_time), 'p', { locale: ko })}
                        {' ~ '}
                        {format(utcToKst(reservation.end_time), 'p', { locale: ko })}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={reservation.status === 'confirmed' ? 'green' : 'red'}
                      variant="light"
                    >
                      {reservation.status === 'confirmed' ? '확정' : '취소됨'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {reservation.status === 'confirmed' && (
                      <Tooltip label="예약 삭제" withArrow position="top">
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => handleCancel(reservation)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })
          )}
        </Table.Tbody>
      </Table>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            total={totalPages}
            value={activePage}
            onChange={setActivePage}
            size="sm"
          />
        </Group>
      )}
    </Stack>
  );
}