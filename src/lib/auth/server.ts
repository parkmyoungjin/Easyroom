import { createClient } from '@/lib/supabase/server'
import { User } from '@supabase/supabase-js'
import { UserMetadata, UserProfile } from '@/types/auth'
import { AuthId } from '@/types/enhanced-types'
import { cache } from 'react'

/**
 * 서버에서 현재 인증된 사용자 정보 가져오기 (캐시됨)
 */
export const getUser = cache(async (): Promise<User | null> => {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    return user
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
})

/**
 * 📝 사용자의 프로필 정보 가져오기 (user_metadata에서 camelCase로)
 */
export const getUserProfile = cache(async (): Promise<UserProfile | null> => {
  const user = await getUser()
  
  if (!user) {
    return null
  }

  // user_metadata에서 camelCase로 데이터 추출
  const metadata = user.user_metadata as UserMetadata || {}
  
  return {
    id: user.id,  
    authId: user.id as AuthId, // 브랜드 타입으로 명시적 변환
    employeeId: undefined, // 선택사항으로 변경 (기존 호환성)
    email: user.email || '',
    name: metadata.fullName || '',
    department: metadata.department || '',
    role: metadata.role || 'employee',
    createdAt: user.created_at || '',
    updatedAt: user.updated_at
  }
})

/**
 * 사용자 권한 확인
 */
export async function checkUserRole(requiredRole: 'admin' | 'employee' = 'employee'): Promise<boolean> {
  const profile = await getUserProfile()
  
  if (!profile) {
    return false
  }

  if (requiredRole === 'admin') {
    return profile.role === 'admin'
  }

  return ['admin', 'employee'].includes(profile.role)
}

/**
 * 관리자 권한 확인 미들웨어
 */
export async function requireAdmin(): Promise<UserProfile> {
  const profile = await getUserProfile()
  
  if (!profile) {
    throw new Error('로그인이 필요합니다.')
  }
  
  if (profile.role !== 'admin') {
    throw new Error('관리자 권한이 필요합니다.')
  }
  
  return profile
}

/**
 * 로그인 사용자 확인 미들웨어
 */
export async function requireAuth(): Promise<UserProfile> {
  const profile = await getUserProfile()
  
  if (!profile) {
    throw new Error('로그인이 필요합니다.')
  }
  
  return profile
}

/**
 * 📝 사용자 프로필 업데이트 (camelCase)
 */
export async function updateUserProfile(updates: Partial<Pick<UserMetadata, 'fullName' | 'department' | 'role'>>) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.updateUser({
    data: updates
  })

  if (error) {
    throw error
  }

  return data
}

/**
 * 현재 사용자의 employeeId 가져오기
 */
export async function getCurrentEmployeeId(): Promise<string | null> {
  const profile = await getUserProfile()
  return profile?.employeeId || null
}

/**
 * 특정 사용자가 본인인지 또는 관리자인지 확인
 */
export async function canAccessUserData(targetEmployeeId: string): Promise<boolean> {
  const profile = await getUserProfile()
  
  if (!profile) {
    return false
  }
  
  // 본인이거나 관리자인 경우
  return profile.employeeId === targetEmployeeId || profile.role === 'admin'
}
