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

  if (loading || authStatus === 'loading') {
    return (
      <Badge variant="secondary" className={`flex items-center gap-1 ${className}`}>
        <Clock className="h-3 w-3" />
        로딩 중
      </Badge>
    );
  }

  if (!userProfile || authStatus === 'unauthenticated') {
    return (
      <Badge variant="outline" className={`flex items-center gap-1 ${className}`}>
        <User className="h-3 w-3" />
        비로그인
      </Badge>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge 
        variant={userProfile.role === 'admin' ? 'default' : 'secondary'}
        className="flex items-center gap-1"
      >
        {userProfile.role === 'admin' ? (
          <Shield className="h-3 w-3" />
        ) : (
          <User className="h-3 w-3" />
        )}
        {userProfile.name}
      </Badge>
      {showRole && (
        <Badge variant="outline" className="text-xs">
          {userProfile.role === 'admin' ? '관리자' : '직원'}
        </Badge>
      )}
    </div>
  );
}