// src/lib/queryKeys.ts
// Phase 3: 쿼리 캐시 관리 시스템 중앙화
// 모든 React Query 키를 중앙에서 관리하는 팩토리

/**
 * 예약(Reservation) 관련 쿼리 키 팩토리
 */
export const reservationKeys = {
  all: ['reservations'] as const,
  lists: () => [...reservationKeys.all, 'list'] as const,
  list: (filters: string) => [...reservationKeys.lists(), filters] as const,
  my: (userId: string | undefined) => [...reservationKeys.all, 'my', userId] as const,
  public: (startDate: string, endDate: string, isAuthenticated?: boolean) =>
    [...reservationKeys.all, 'public', startDate, endDate, 'auth', isAuthenticated] as const,
  withDetails: (startDate: string, endDate: string) =>
    [...reservationKeys.all, 'withDetails', startDate, endDate] as const,
  statistics: (startDate: string, endDate: string) =>
    [...reservationKeys.all, 'statistics', startDate, endDate] as const,
  detail: (id: string) => [...reservationKeys.all, 'detail', id] as const,
};

/**
 * 회의실(Room) 관련 쿼리 키 팩토리
 */
export const roomKeys = {
  all: ['rooms'] as const,
  lists: () => [...roomKeys.all, 'list'] as const,
  list: (filters: string) => [...roomKeys.lists(), filters] as const,
  detail: (id: string) => [...roomKeys.all, 'detail', id] as const,
  active: () => [...roomKeys.all, 'active'] as const,
  inactive: () => [...roomKeys.all, 'inactive'] as const,
  search: (query: string) => [...roomKeys.all, 'search', query] as const,
  capacity: (minCapacity: number) => [...roomKeys.all, 'capacity', minCapacity] as const,
  availability: (roomId: string, startDate: string, endDate: string) =>
    [...roomKeys.all, 'availability', roomId, startDate, endDate] as const,
  advancedSearch: (params: any) => [...roomKeys.all, 'advancedSearch', params] as const,
  availableSlots: (roomId: string, dateKey: string) =>
    [...roomKeys.all, 'available-slots', roomId, dateKey] as const,
  bookedSlots: (roomId: string, dateKey: string) =>
    [...roomKeys.all, 'booked-slots', roomId, dateKey] as const,
};

/**
 * 사용자(User) 관련 쿼리 키 팩토리
 */
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: string) => [...userKeys.lists(), filters] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
  profile: (id: string) => [...userKeys.all, 'profile', id] as const,
};

/**
 * 관리자(Admin) 관련 쿼리 키 팩토리
 */
export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  rooms: () => [...adminKeys.all, 'rooms'] as const,
  reservations: () => [...adminKeys.all, 'reservations'] as const,
  statistics: () => [...adminKeys.all, 'statistics'] as const,
};