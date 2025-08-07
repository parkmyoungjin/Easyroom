'use client';

import { useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { reservationKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';

interface UpdateProfileData {
  name: string;
  department: string;
}

interface UpdateProfileResult {
  success: boolean;
  profile?: any;
  error?: string;
}

export function useUpdateProfile() {
  const [isLoading, setIsLoading] = useState(false);
  const { userProfile, refreshProfile } = useAuthContext();
  const queryClient = useQueryClient();

  const updateProfile = async (data: UpdateProfileData): Promise<UpdateProfileResult> => {
    if (!userProfile) {
      return { success: false, error: 'User not authenticated' };
    }

    setIsLoading(true);

    try {
      // 입력 데이터 검증
      if (!data.name.trim() || !data.department.trim()) {
        throw new Error('이름과 부서는 필수 입력 항목입니다.');
      }

      // API 호출
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name.trim(),
          department: data.department.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Profile update failed');
      }

      // AuthContext 프로필 새로고침
      await refreshProfile();

      // 성공 시 토스트 메시지
      toast.success('프로필이 업데이트되었습니다', {
        description: '변경사항이 성공적으로 저장되었습니다.',
      });

      return {
        success: true,
        profile: result.profile,
      };

    } catch (error) {
      console.error('Profile update error:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : '프로필 업데이트 중 오류가 발생했습니다.';

      // 에러 토스트 메시지
      toast.error('프로필 업데이트 실패', {
        description: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };

    } finally {
      setIsLoading(false);
    }
  };

  return {
    updateProfile,
    isLoading,
  };
}