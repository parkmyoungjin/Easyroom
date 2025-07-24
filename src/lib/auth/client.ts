'use client'

import { createClient } from '@/lib/supabase/client'
import { UserMetadata, UserProfile } from '@/types/auth'

/**
 * 📝 클라이언트에서 user_metadata를 camelCase로 변환
 */
export function createUserProfile(user: any): UserProfile | null {
  if (!user) return null
  
  const metadata = user.user_metadata as UserMetadata || {}
  
  return {
    id: user.id,
    authId: user.id, // camelCase로 수정
    employeeId: undefined, // 선택사항으로 변경 (기존 호환성)
    email: user.email || '',
    name: metadata.fullName || '',
    department: metadata.department || '',
    role: metadata.role || 'employee',
    createdAt: user.created_at || '',
    updatedAt: user.updated_at
  }
}

/**
 * 현재 로그인된 사용자 프로필 가져오기 (클라이언트)
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    return createUserProfile(user)
  } catch (error) {
    console.error('Error getting user profile:', error)
    return null
  }
}

/**
 * 클라이언트에서 사용자 권한 확인
 */
export async function checkClientUserRole(requiredRole: 'admin' | 'employee' = 'employee'): Promise<boolean> {
  const profile = await getCurrentUserProfile()
  
  if (!profile) {
    return false
  }

  if (requiredRole === 'admin') {
    return profile.role === 'admin'
  }

  return ['admin', 'employee'].includes(profile.role)
}

/**
 * 클라이언트에서 프로필 업데이트
 */
export async function updateClientUserProfile(updates: Partial<Pick<UserMetadata, 'fullName' | 'department' | 'role'>>) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.updateUser({
    data: updates
  })

  if (error) {
    throw error
  }

  return data
}
