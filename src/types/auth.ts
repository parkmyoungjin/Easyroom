import type { AuthId, DatabaseUserId } from './enhanced-types';

/**
 * Supabase Auth user_metadata 구조 (Magic Link 이메일 기반 인증)
 */
export interface UserMetadata {
  fullName: string
  department: string
  role?: 'admin' | 'employee'
}

/**
 * 클라이언트에서 사용하는 사용자 프로필 타입 (이메일 기반)
 * Enhanced with branded types for type safety
 */
export interface UserProfile {
  authId: AuthId;      // Branded AuthId
  dbId: DatabaseUserId; // Branded DatabaseUserId (이제 필수)
  employeeId?: string;
  email: string;
  name: string;
  department: string;
  role: 'admin' | 'employee';
  createdAt: string;
  updatedAt?: string;
  // id: string;
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
 * 회원가입 요청 타입 (Magic Link 이메일 기반)
 */
export interface SignupRequest {
  email: string
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
