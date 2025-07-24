'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAuthNavigation } from '@/hooks/useAuthNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, Clock, Settings, LogOut, BarChart3, LogIn, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PageContent() {
  const router = useRouter();
  const { userProfile, loading, authStatus, signOut } = useAuth();
  const { navigateWithAuth, handlePostLogout } = useAuthNavigation();
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const { toast } = useToast();

  // Handle component mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Enhanced loading state management
  useEffect(() => {
    if (!mounted) {
      return;
    }

    const isLoadingInProgress = loading || (authStatus === 'authenticated' && userProfile === null);

    if (isLoadingInProgress) {
      setIsReady(false);
      // Force ready after 5 seconds to prevent infinite loading
      const forceReadyTimeout = setTimeout(() => {
        console.log('Force ready timeout - setting ready state');
        setIsReady(true);
      }, 5000);
      
      return () => {
        clearTimeout(forceReadyTimeout);
      };
    } else {
      setIsReady(true);
    }
  }, [mounted, loading, authStatus, userProfile]);

  // Debug current state
  console.log('PageContent: Render decision', {
    mounted,
    loading,
    isReady,
    authStatus,
    hasUserProfile: !!userProfile,
    shouldShowLoading: !mounted || loading || !isReady
  });

  // Show loading state only when actually loading
  if (!mounted || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white rounded-lg p-6 shadow-sm text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            </div>
            <h2 className="text-lg font-semibold text-blue-800 mb-2">시스템 준비 중</h2>
            <p className="text-blue-600 mb-4">
              {!mounted ? '페이지를 준비하고 있습니다...' :
               authStatus === 'loading' ? '사용자 인증을 확인하고 있습니다...' :
               userProfile === null && authStatus === 'authenticated' ? '사용자 프로필을 불러오고 있습니다...' :
               '시스템을 준비하고 있습니다...'}
            </p>
            <div className="text-xs text-gray-500 mb-4">
              Debug: mounted={mounted.toString()}, loading={loading.toString()}, isReady={isReady.toString()}, authStatus={authStatus}
            </div>
            <button
              onClick={() => {
                toast({
                  title: '새로고침',
                  description: '페이지를 새로고침합니다.',
                });
                window.location.reload();
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log('PageContent: Showing main content');

  const handleLogout = async () => {
    try {
      await signOut();
      handlePostLogout();
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: '로그아웃 오류',
        description: '로그아웃 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const navigateToLogin = () => {
    router.push('/login');
  };

  const navigateToSignup = () => {
    router.push('/signup');
  };

  const navigateToNewReservation = () => {
    console.log('navigateToNewReservation clicked', { userProfile, authStatus });
    if (!userProfile) {
      toast({
        title: '로그인이 필요합니다',
        description: '예약하려면 로그인해주세요.',
        variant: 'destructive',
      });
      router.push('/login');
      return;
    }
    router.push('/reservations/new');
  };

  const navigateToMyReservations = () => {
    console.log('navigateToMyReservations clicked', { userProfile, authStatus });
    if (!userProfile) {
      toast({
        title: '로그인이 필요합니다',
        description: '내 예약을 보려면 로그인해주세요.',
        variant: 'destructive',
      });
      router.push('/login');
      return;
    }
    router.push('/reservations/my');
  };

  const navigateToReservationStatus = () => {
    console.log('navigateToReservationStatus clicked');
    router.push('/reservations/status');
  };

  const navigateToDashboard = () => {
    console.log('navigateToDashboard clicked');
    router.push('/dashboard');
  };

  const navigateToAdmin = () => {
    console.log('navigateToAdmin clicked', { userProfile, authStatus });
    if (!userProfile) {
      toast({
        title: '로그인이 필요합니다',
        description: '관리자 기능을 사용하려면 로그인해주세요.',
        variant: 'destructive',
      });
      router.push('/login');
      return;
    }
    if (userProfile.role !== 'admin') {
      toast({
        title: '권한이 없습니다',
        description: '관리자만 접근할 수 있습니다.',
        variant: 'destructive',
      });
      return;
    }
    router.push('/admin');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-sm xs:text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 whitespace-nowrap">
              회의실 예약 시스템
            </h1>
            {userProfile ? (
              <>
                <p className="mt-2 text-gray-600">
                  안녕하세요, <span className="font-semibold">{userProfile.name}</span>님!
                </p>
                <p className="text-sm text-gray-500">
                  {userProfile.department} · {userProfile.role === 'admin' ? '관리자' : '직원'}
                </p>
              </>
            ) : (
              <p className="mt-2 text-gray-600">
                회의실 예약 시스템에 오신 것을 환영합니다
              </p>
            )}
          </div>
          {userProfile ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <p className="text-sm text-gray-600">{userProfile.name}</p>
                <p className="text-xs text-gray-500">
                  {userProfile.role === 'admin' ? '관리자' : '직원'}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={navigateToLogin}
                className="flex items-center gap-2"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">로그인</span>
              </Button>
              <Button
                onClick={navigateToSignup}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">회원가입</span>
              </Button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-lg hover:border-orange-400 transition-shadow" onClick={navigateToNewReservation}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">새 예약</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">예약하기</div>
              <p className="text-xs text-muted-foreground">회의실을 예약합니다</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg hover:border-orange-400 transition-shadow" onClick={navigateToMyReservations}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">내 예약</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">예약 관리</div>
              <p className="text-xs text-muted-foreground">내 예약을 확인하고 관리합니다</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg hover:border-orange-400 transition-shadow" onClick={navigateToReservationStatus}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">예약 현황</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">현황 보기</div>
              <p className="text-xs text-muted-foreground">전체 예약 현황을 확인합니다</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg hover:border-orange-400 transition-shadow" onClick={navigateToDashboard}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">예약 대시보드</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">대시보드</div>
              <p className="text-xs text-muted-foreground">실시간 예약 현황을 확인합니다</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Section */}
        {userProfile?.role === 'admin' && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">관리자 메뉴</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={navigateToAdmin}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">시스템 관리</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">관리자 패널</div>
                  <p className="text-xs text-muted-foreground">회의실 및 사용자 관리</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">이용 안내</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">예약 시간</h3>
              <p className="text-sm text-gray-600">오전 8시부터 오후 7시까지 예약 가능합니다.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">예약 규칙</h3>
              <p className="text-sm text-gray-600">에약 시간을 지켜주세요. 미사용 예약을 취소해 주세요.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}