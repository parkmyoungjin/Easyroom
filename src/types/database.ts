import type { AuthId, DatabaseUserId } from './enhanced-types';

// Database Types for Meeting Room Booking System
// Generated from Supabase schema
// Enhanced with branded types for type safety


export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_id: string
          employee_id: string | null
          name: string
          email: string
          department: string
          role: 'employee' | 'admin'
          created_at: string
          updated_at: string
        }
        Insert: {
          auth_id: string
          employee_id?: string | null
          name: string
          email: string
          department: string
          role?: 'employee' | 'admin'
        }
        Update: {
          auth_id?: string
          employee_id?: string | null
          name?: string
          email?: string
          department?: string
          role?: 'employee' | 'admin'
          updated_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          name: string
          description?: string
          capacity: number
          location?: string
          amenities: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          description?: string
          capacity: number
          location?: string
          amenities?: Json
          is_active?: boolean
        }
        Update: {
          name?: string
          description?: string
          capacity?: number
          location?: string
          amenities?: Json
          is_active?: boolean
        }
      }
      reservations: {
        Row: {
          id: string
          room_id: string
          user_id: string
          title: string
          purpose?: string
          start_time: string
          end_time: string
          status: 'confirmed' | 'cancelled' | 'checked_in' | 'completed' | 'overtime' | 'no_show'
          checked_in_at: string | null
          checked_out_at: string | null
          cancellation_reason?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          room_id: string
          user_id: string
          title: string
          purpose?: string
          start_time: string
          end_time: string
          status?: 'confirmed' | 'cancelled' | 'checked_in' | 'completed' | 'overtime' | 'no_show'
          cancellation_reason?: string
        }
        Update: {
          room_id?: string
          user_id?: string
          title?: string
          purpose?: string
          start_time?: string
          end_time?: string
          status?: 'confirmed' | 'cancelled' | 'checked_in' | 'completed' | 'overtime' | 'no_show'
          cancellation_reason?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_email_exists: {
        Args: {
          p_email: string;
        };
        Returns: boolean;
      };

      get_current_user_info: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          auth_id: string;
          email: string;
          name: string;
          department: string;
          role: string;
        }[];
      };
      get_public_reservations: {
        Args: {
          start_date: string;
          end_date: string;
          page_limit?: number;
          page_offset?: number;
        };
        Returns: PublicReservation[];
      };
      get_public_reservations_paginated: {
        Args: {
          start_date: string;
          end_date: string;
          page_limit: number;
          page_offset: number;
        };
        Returns: PublicReservationPaginated[];
      };
      get_public_reservations_anonymous: {
        Args: {
          start_date: string;
          end_date: string;
          page_limit?: number;
          page_offset?: number;
        };
        Returns: PublicReservationAnonymous[];
      };
      get_public_reservations_anonymous_paginated: {
        Args: {
          start_date: string;
          end_date: string;
          page_limit: number;
          page_offset: number;
        };
        Returns: PublicReservationAnonymousPaginated[];
      };
    }
    Enums: {
      user_role: 'employee' | 'admin'
      reservation_status: 'confirmed' | 'cancelled' | 'checked_in' | 'completed' | 'overtime' | 'no_show'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type User = Tables<'users'>
export type Room = Tables<'rooms'>
export type Reservation = Tables<'reservations'>

// Application Types
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type RoomInsert = Database['public']['Tables']['rooms']['Insert']
export type RoomUpdate = Database['public']['Tables']['rooms']['Update']

export type ReservationInsert = Database['public']['Tables']['reservations']['Insert']
export type ReservationUpdate = Database['public']['Tables']['reservations']['Update']

// ✅ PublicReservation 타입 명확한 정의 (get_public_reservations_with_room 함수 반환값과 일치)
export type PublicReservation = {
  id: string
  room_id: string
  user_id: string
  title: string
  purpose: string | null
  start_time: string
  end_time: string
  department: string
  user_name: string // 예약자 이름
  room_name: string // 회의실 이름 추가
  is_mine: boolean
}

// Paginated version with metadata
export type PublicReservationPaginated = PublicReservation & {
  total_count: number
  has_more: boolean
}

// Anonymous public reservation type
export type PublicReservationAnonymous = {
  id: string
  room_id: string
  title: string
  start_time: string
  end_time: string
  room_name: string
  is_mine: boolean
}

// Anonymous paginated version with metadata
export type PublicReservationAnonymousPaginated = PublicReservationAnonymous & {
  total_count: number
  has_more: boolean
}

// Pagination metadata type
export type PaginationMetadata = {
  limit: number
  offset: number
  total_count: number
  has_more: boolean
  current_page: number
  total_pages: number
}

// Enums
export type UserRole = Database['public']['Enums']['user_role']
export type ReservationStatus = Database['public']['Enums']['reservation_status']

// Extended types with relations
export type ReservationWithDetails = Reservation & {
  room: Room
  user: User
}

export type RoomAmenities = {
  projector?: boolean
  whiteboard?: boolean
  wifi?: boolean
  tv?: boolean
  microphone?: boolean
  speakers?: boolean
  [key: string]: boolean | undefined
}

// ============================================================================
// ENHANCED TYPES WITH BRANDED TYPE SAFETY
// ============================================================================

/**
 * Enhanced User type with branded IDs for type safety
 */
export interface EnhancedUser {
  id: DatabaseUserId
  auth_id: AuthId
  employee_id: string | null
  name: string
  email: string
  department: string
  role: 'employee' | 'admin'
  created_at: Date
  updated_at: Date
}

/**
 * Enhanced Reservation type with branded user_id for type safety
 */
export interface EnhancedReservation {
  id: string
  room_id: string
  user_id: DatabaseUserId
  title: string
  purpose?: string
  start_time: Date
  end_time: Date
  status: ExtendedReservationStatus
  cancellation_reason?: string
  created_at: Date
  updated_at: Date
}

/**
 * Enhanced PublicReservation with branded types
 */
export interface EnhancedPublicReservation {
  id: string
  room_id: string
  user_id: DatabaseUserId
  title: string
  purpose: string | null
  department: string
  user_name: string
  start_time: Date
  end_time: Date
  is_mine: boolean
}

/**
 * Enhanced reservation insert type with branded user_id
 */
export interface EnhancedReservationInsert {
  room_id: string
  user_id: DatabaseUserId
  title: string
  purpose?: string
  start_time: string
  end_time: string
  status?: ExtendedReservationStatus
  cancellation_reason?: string
}

/**
 * Enhanced reservation update type with branded user_id
 */
export interface EnhancedReservationUpdate {
  room_id?: string
  user_id?: DatabaseUserId
  title?: string
  purpose?: string
  start_time?: string
  end_time?: string
  status?: ExtendedReservationStatus
  cancellation_reason?: string
}

/**
 * Type conversion utilities for database operations
 */
export interface DatabaseTypeConverters {
  // Convert enhanced types to database-compatible types
  reservationToInsert: (reservation: EnhancedReservationInsert) => ReservationInsert
  reservationToUpdate: (reservation: EnhancedReservationUpdate) => ReservationUpdate
  
  // Convert database types to enhanced types
  userFromDatabase: (user: User) => EnhancedUser
  reservationFromDatabase: (reservation: Reservation) => EnhancedReservation
  publicReservationFromDatabase: (reservation: PublicReservation) => EnhancedPublicReservation
}
/**
 * Validated reservation data with enhanced type safety
 * Used for reservation creation and validation
 */
export interface ValidatedReservationData {
  room_id: string;
  user_id: string;
  title: string;
  purpose?: string;
  start_time: string;
  end_time: string;
  status?: 'confirmed' | 'cancelled';
}

// ============================================================================
// CHECK-IN/CHECK-OUT SYSTEM TYPES
// ============================================================================

/**
 * Extended reservation status including check-in/check-out states
 */
export type ExtendedReservationStatus = 
  | 'confirmed'     // 예약 확정 (기본값)
  | 'checked_in'    // 사용자가 체크인하여 사용 중
  | 'completed'     // 사용자가 정상적으로 사용 완료 (체크아웃)
  | 'overtime'      // 예약 시간을 초과하여 사용 중
  | 'no_show'       // 사용자가 나타나지 않음
  | 'cancelled';    // 사용자가 예약을 취소함

/**
 * Check-in/Check-out API response types
 */
export interface CheckInResponse {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  data?: {
    reservation_id: string;
    room_name: string;
    checked_in_at: string;
    start_time: string;
    end_time: string;
  };
}

export interface CheckOutResponse {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  data?: {
    reservation_id: string;
    room_name: string;
    checked_in_at: string;
    checked_out_at: string;
    actual_duration_minutes: number;
    scheduled_duration_minutes: number;
    was_overtime: boolean;
  };
}

export interface ReservationStatusResponse {
  success: boolean;
  error?: string;
  code?: string;
  data?: {
    reservation_id: string;
    room_name: string;
    current_status: ExtendedReservationStatus;
    can_checkin: boolean;
    can_checkout: boolean;
    status_message: string;
    start_time: string;
    end_time: string;
    checked_in_at: string | null;
    checked_out_at: string | null;
    is_overtime: boolean;
  };
}

/**
 * Enhanced reservation with check-in/check-out data
 */
export interface ReservationWithCheckInOut extends Reservation {
  checked_in_at: string | null;
  checked_out_at: string | null;
  status: ExtendedReservationStatus;
}

/**
 * Room status for real-time display
 */
export interface RoomStatus {
  room_id: string;
  room_name: string;
  location: string;
  capacity: number;
  current_status: 'available' | 'occupied' | 'reserved_soon' | 'reserved';
  current_reservation_id: string | null;
  current_reservation_title: string | null;
  current_start_time: string | null;
  current_end_time: string | null;
  current_user_name: string | null;
  current_user_department: string | null;
}

/**
 * Statistics and analytics types
 */
export interface ReservationStatistics {
  total_reservations: number;
  completed_reservations: number;
  no_show_reservations: number;
  currently_in_use: number;
  completion_rate: number;
  no_show_rate: number;
}

export interface RoomUsageStatistics extends ReservationStatistics {
  room_id: string;
  room_name: string;
  location: string;
}

/**
 * Automation job result types
 */
export interface AutomationResult {
  execution_time: string;
  overtime_updated: number;
  no_shows_marked: number;
  auto_checkouts: number;
  total_processed: number;
  success?: boolean;
  error?: string;
}

/**
 * Room usage statistics from database view
 */
export interface RoomUsageStatistics {
  room_id: string;
  room_name: string;
  location: string;
  total_reservations: number;
  completed_reservations: number;
  no_show_reservations: number;
  currently_in_use: number;
  completion_rate: number;
  no_show_rate: number;
}

/**
 * No-show reservation data from database view
 */
export interface NoShowReservation {
  id: string;
  title: string;
  room_name: string;
  user_name: string;
  department: string;
  start_time: string;
  end_time: string;
  location: string;
  created_at: string;
}

/**
 * Cron job status data
 */
export interface CronJobStatus {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  nodename: string;
  nodeport: number;
  database: string;
  username: string;
  active: boolean;
}

/**
 * Room status for real-time display (enhanced)
 */
export interface RoomStatusData {
  room_id: string;
  room_name: string;
  location: string;
  capacity: number;
  current_status: 'available' | 'occupied' | 'reserved_soon' | 'reserved';
  current_reservation_id: string | null;
  current_reservation_title: string | null;
  current_start_time: string | null;
  current_end_time: string | null;
  current_user_name: string | null;
  current_user_department: string | null;
}