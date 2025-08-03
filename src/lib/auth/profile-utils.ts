// src/lib/auth/profile-utils.ts
// 서버와 클라이언트에서 공통으로 사용할 프로필 변환 유틸리티

import { UserProfile } from '@/types/auth';
import { createAuthId, createDatabaseUserId } from '@/types/enhanced-types';

/**
 * RPC 결과 타입 정의
 * SQL 함수의 RETURNS TABLE과 정확히 일치해야 함
 */
export type ProfileRpcResult = {
  authId: string;
  dbId: string;
  employeeId: string | null;
  email: string;
  name: string;
  department: string;
  role: 'admin' | 'employee';
  createdAt: string;
  updatedAt: string | null;
};

/**
 * RPC 결과를 UserProfile 타입으로 변환
 * 서버와 클라이언트에서 동일한 변환 로직 사용
 */
export function convertRpcResultToUserProfile(data: ProfileRpcResult): UserProfile {
  return {
    authId: createAuthId(data.authId),
    dbId: createDatabaseUserId(data.dbId),
    
    // employeeId는 null일 수 있으므로 명시적으로 유지
    employeeId: data.employeeId || undefined,
    
    // email은 non-nullable로 가정하지만 방어적으로 처리
    email: (data.email && typeof data.email === 'string') 
      ? data.email 
      : 'unknown@example.com',
    
    // [핵심 보증] name은 절대 null이나 빈 문자열이 아님을 보증
    name: (data.name && typeof data.name === 'string' && data.name.trim()) 
      ? data.name.trim() 
      : '알 수 없는 사용자',
    
    // [핵심 보증] department는 절대 null이나 빈 문자열이 아님을 보증
    department: (data.department && typeof data.department === 'string' && data.department.trim()) 
      ? data.department.trim() 
      : '소속 없음',
    
    // [핵심 보증] role은 절대 null이 아니며 유효한 값임을 보증
    role: (data.role === 'admin' || data.role === 'employee') 
      ? data.role 
      : 'employee',
    
    createdAt: data.createdAt,
    updatedAt: data.updatedAt || undefined,
  };
}