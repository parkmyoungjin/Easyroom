/**
 * Supabase Auth user_metadata 구조 (이메일 기반 인증)
 */
export interface UserMetadata {
  fullName: string
  department: string
  role: 'admin' | 'employee'
}

/**
 * 클라이언트에서 사용하는 사용자 프로필 타입 (이메일 기반)
 */
export interface UserProfile {
  id: string          // Auth ID (auth.uid())
  authId: string      // Auth ID (중복, 호환성 유지)
  dbId?: string       // 데이터베이스 users 테이블 ID
  employeeId?: string // 선택사항 (기존 호환성)
  email: string
  name: string
  department: string
  role: 'admin' | 'employee'
  createdAt: string
  updatedAt?: string
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
