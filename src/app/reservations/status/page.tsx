'use client';

import { useAuth } from '@/hooks/useAuth';
import ReservationCalendarView from '@/features/reservation/components/ReservationCalendarView';
import MobileHeader from '@/components/ui/mobile-header';
import AuthPrompt from '@/components/ui/auth-prompt';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default function ReservationStatusPage() {
  const { userProfile: user, loading } = useAuth();
  const router = useRouter();

  // 빈 셀 클릭 시 처리 - 예약 페이지로 이동 (middleware가 인증 처리)
  const handleCellClick = (date: Date, hour: number) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const url = `/reservations/new?date=${dateString}&hour=${hour}`;
    
    console.log('Cell clicked:', { 
      date: date.toISOString(), 
      hour, 
      dateString, 
      url 
    });
    
    router.push(url);
  };

  const navigateToLogin = () => {
    router.push('/login');
  };

  const navigateToSignup = () => {
    router.push('/signup');
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="예약 현황을 불러오고 있습니다..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="회의실 예약 현황" />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Authentication prompt for non-authenticated users */}
        {!user && (
          <AuthPrompt
            title="더 많은 기능을 이용하세요"
            description="로그인하시면 회의실 예약, 내 예약 관리, 상세 정보 확인 등의 기능을 이용할 수 있습니다."
            onLogin={navigateToLogin}
            onSignup={navigateToSignup}
            className="mb-6"
          />
        )}

        {/* Calendar view - available for both authenticated and non-authenticated users */}
        <ReservationCalendarView 
          onCellClick={handleCellClick}
          readOnly={!user} // Pass read-only mode for non-authenticated users
        />

        {/* Information section for non-authenticated users */}
        {!user && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                예약 현황 안내
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">현재 보기</h3>
                  <p className="text-sm text-gray-600">
                    실시간 회의실 예약 현황을 확인할 수 있습니다. 
                    예약된 시간대는 색상으로 표시됩니다.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">로그인 후 이용 가능</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 회의실 예약하기</li>
                    <li>• 예약 상세 정보 확인</li>
                    <li>• 내 예약 관리</li>
                    <li>• 예약 수정 및 취소</li>
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