import type { AuthId, DatabaseUserId } from './enhanced-types';

/**
 * Supabase Auth user_metadata 구조 (이메일 기반 인증)
 */
export interface UserMetadata {
  fullName: string
  department: string
  employeeId: string
  role: 'admin' | 'employee'
}

/**
 * 클라이언트에서 사용하는 사용자 프로필 타입 (이메일 기반)
 * Enhanced with branded types for type safety
 */
export interface UserProfile {
  id: string          // Auth ID (auth.uid()) - legacy string for compatibility
  authId: AuthId      // Enhanced branded AuthId type
  dbId?: DatabaseUserId // Enhanced branded DatabaseUserId type
  employeeId?: string // 선택사항 (기존 호환성)
  email: string
  name: string
  department: string
  role: 'admin' | 'employee'
  createdAt: string
  updatedAt?: string
}

/**
 * Enhanced user profile with full type safety
 */
export interface EnhancedUserProfile {
  authId: AuthId
  databaseId: DatabaseUserId
  email: string
  name: string
  department: string
  role: 'admin' | 'employee'
  isActive: boolean
  createdAt: Date
  updatedAt?: Date
  lastValidated?: Date
}

/**
 * 로그인 요청 타입 (이메일 기반)
 */
export interface LoginRequest {
  email: string
  password: string
}

/**
 * 회원가입 요청 타입 (이메일 기반)
 */
export interface SignupRequest {
  email: string
  password: string
  fullName: string
  department: string
  role?: 'admin' | 'employee'
}

export interface CreateUserData {
  email: string
  fullName: string
  department: string
  role?: 'employee' | 'admin'
}
