'use client';

import { useAuth } from '@/hooks/useAuth';
import { User, Shield, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AuthStateIndicatorProps {
  showRole?: boolean;
  className?: string;
}

export default function AuthStateIndicator({ 
  showRole = true,
  className = "" 
}: AuthStateIndicatorProps) {
  const { userProfile, loading, authStatus } = useAuth();

  // Show loading state with improved message
  if (loading || authStatus === 'loading') {
    return (
      <Badge variant="secondary" className={`flex items-center gap-1 ${className}`}>
        <Clock className="h-3 w-3 animate-spin" />
        인증 확인 중...
      </Badge>
    );
  }

  // Show unauthenticated state
  if (!userProfile || authStatus === 'unauthenticated') {
    return (
      <Badge variant="outline" className={`flex items-center gap-1 ${className}`}>
        <User className="h-3 w-3" />
        비로그인
      </Badge>
    );
  }

  // Show authenticated state with user info
  // ✅ [방탄화] userProfile의 모든 속성에 안전하게 접근
  const isAdmin = userProfile?.role === 'admin';
  const userName = userProfile?.name || '알 수 없는 사용자';
  const userRole = userProfile?.role || 'employee';
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant={isAdmin ? 'default' : 'secondary'}
        className="flex items-center gap-1"
      >
        {isAdmin ? (
          <Shield className="h-3 w-3" />
        ) : (
          <User className="h-3 w-3" />
        )}
        {userName}
      </Badge>
      {showRole && (
        <Badge variant="outline" className="text-xs">
          {isAdmin ? '관리자' : '직원'}
        </Badge>
      )}
    </div>
  );
}