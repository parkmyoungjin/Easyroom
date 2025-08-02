'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import ReservationDashboard from '@/features/reservation/components/ReservationDashboard';
import MobileHeader from '@/components/ui/mobile-header';
import AuthPrompt from '@/components/ui/auth-prompt';
import { EnhancedLoadingState } from '@/components/ui/enhanced-loading-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { userProfile, loading } = useAuth();

  const navigateToLogin = () => {
    router.push('/login');
  };

  const navigateToSignup = () => {
    router.push('/signup');
  };

  const handleGoBack = () => {
    router.push('/');
  };

  // 로딩 중인 경우
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <EnhancedLoadingState
          isLoading={true}
          title="대시보드 로딩 중"
          description="사용자 정보와 대시보드 데이터를 불러오고 있습니다..."
          showNetworkStatus={true}
          className="w-full max-w-md"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="예약 대시보드" onBack={handleGoBack} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Authentication prompt for non-authenticated users */}
        {!userProfile && (
          <AuthPrompt
            title="더 자세한 정보를 확인하세요"
            description="로그인하시면 개인화된 대시보드, 내 예약 정보, 상세 통계 등을 확인할 수 있습니다."
            onLogin={navigateToLogin}
            onSignup={navigateToSignup}
            className="mb-6"
          />
        )}

        {/* Header section */}
        <div className="mb-4">
          {userProfile ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">
                안녕하세요, {userProfile?.name || '사용자'}님!
              </h1>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">
                예약 대시보드
              </h1>
              <p className="text-gray-600">실시간 회의실 예약 현황을 확인하세요.</p>
            </>
          )}
        </div>

        {/* Dashboard component - available for both authenticated and non-authenticated users */}
        <ReservationDashboard readOnly={!userProfile} />

        {/* Information section for non-authenticated users */}
        {!userProfile && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                대시보드 기능 안내
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">현재 이용 가능</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 실시간 회의실 사용 현황</li>
                    <li>• 오늘의 전체 예약 일정</li>
                    <li>• 회의실 이용률 확인</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">로그인 후 추가 기능</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 개인화된 대시보드</li>
                    <li>• 내 예약 상세 정보</li>
                    <li>• 예약 통계 및 분석</li>
                    <li>• 빠른 예약 기능</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
