import { createClient } from '@/lib/supabase/server'
import { User } from '@supabase/supabase-js'
import { UserMetadata, UserProfile } from '@/types/auth'
import { AuthId, createAuthId, createDatabaseUserId } from '@/types/enhanced-types'
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
 * 📝 [수정됨] 사용자의 완전한 프로필 정보 가져오기 (DB 조회 포함)
 * auth.users와 public.users를 조인하여 완전한 UserProfile 객체를 반환합니다.
 */
export const getUserProfile = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  // ✅ 이제 public.users 테이블을 직접 조회하여 dbId를 가져옵니다.
  const { data: profileData, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (error || !profileData) {
    // 프로필이 아직 생성되지 않았을 수 있습니다.
    // 이 경우, auth 정보만으로 최소한의 프로필을 반환할 수도 있지만,
    // dbId가 없으면 위험하므로 null을 반환하는 것이 더 안전합니다.
    console.error('Failed to get user profile from DB:', error?.message);
    return null
  }
  
  // ✅ [수정] 새로운 UserProfile 타입에 맞게 객체를 반환합니다.
  return {
    // 💥 'id' 필드 제거
    authId: createAuthId(profileData.auth_id),
    dbId: createDatabaseUserId(profileData.id), // ⬅️ DB에서 가져온 실제 id
    employeeId: profileData.employee_id,
    email: profileData.email,
    name: profileData.name,
    department: profileData.department,
    role: profileData.role,
    createdAt: profileData.created_at,
    updatedAt: profileData.updated_at
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
