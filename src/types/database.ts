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
          status: 'confirmed' | 'cancelled'
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
          status?: 'confirmed' | 'cancelled'
          cancellation_reason?: string
        }
        Update: {
          room_id?: string
          user_id?: string
          title?: string
          purpose?: string
          start_time?: string
          end_time?: string
          status?: 'confirmed' | 'cancelled'
          cancellation_reason?: string
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
      reservation_status: 'confirmed' | 'cancelled'
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

// ✅ PublicReservation 타입 명확한 정의 (get_public_reservations 함수 반환값과 일치)
export type PublicReservation = {
  id: string
  room_id: string
  user_id: string
  title: string
  purpose: string | null
  department: string
  user_name: string // 예약자 이름 추가
  start_time: string
  end_time: string
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
  status: 'confirmed' | 'cancelled'
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
  status?: 'confirmed' | 'cancelled'
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
  status?: 'confirmed' | 'cancelled'
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