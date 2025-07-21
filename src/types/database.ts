// Database Types for Meeting Room Booking System
// Generated from Supabase schema

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
          employee_id: string
          name: string
          email: string
          department: string
          role: 'employee' | 'admin'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          auth_id: string
          employee_id: string
          name: string
          email: string
          department: string
          role?: 'employee' | 'admin'
          is_active?: boolean
        }
        Update: {
          auth_id?: string
          employee_id?: string
          name?: string
          email?: string
          department?: string
          role?: 'employee' | 'admin'
          is_active?: boolean
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
      get_public_reservations: {
        Args: {
          start_date: string;
          end_date: string;
        };
        Returns: PublicReservation[];
      }
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