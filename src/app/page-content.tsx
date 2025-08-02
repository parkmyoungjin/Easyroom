// src/app/page-content.tsx
'use client';

import { useEffect } from 'react'; // ✅ 이제 useEffect는 필요 없습니다. 하지만 다른 용도로 남겨둘 수 있습니다.
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Calendar, Users, Clock, Settings, LogOut, BarChart3, LogIn, UserPlus, ArrowRight 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// ✅ 임시 테스트 컴포넌트 추가 (Operation: Atomic Profile)
import AtomicProfileTest from '@/components/test/AtomicProfileTest';

// ✅ 재사용 가능한 ActionCard 컴포넌트 (기존과 동일)
interface ActionCardProps { title: string; description: string; icon: React.ElementType; onClick: () => void; disabled?: boolean; }
function ActionCard({ title, description, icon: Icon, onClick, disabled = false }: ActionCardProps) {
  const handleClick = () => {
    console.log('[ActionCard] Click attempt:', { title, disabled });
    if (!disabled) {
      onClick();
    } else {
      console.log('[ActionCard] Click ignored - card is disabled');
    }
  };
  
  return (
    <Card 
      className={`cursor-pointer transition-all duration-300 ${ disabled ? 'bg-muted/50 cursor-not-allowed' : 'hover:shadow-lg hover:border-primary' }`}
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{description}</div>
        <p className={`text-xs text-muted-foreground ${disabled ? 'line-through' : ''}`}>{title} 페이지로 이동</p>
      </CardContent>
    </Card>
  );
}

export default function PageContent() {
  const router = useRouter();
  // ✅ 수정된 useAuth 훅을 사용합니다.
  const { userProfile, signOut, isAuthenticated, isLoading, authStatus } = useAuth();
  const { toast } = useToast();

  // ✅ [핵심 수정] Magic Link 토큰을 직접 처리하는 useEffect 로직을 완전히 제거합니다.
  // 이 모든 복잡한 과정은 이제 AuthProvider와 app/auth/callback/route.ts가
  // 백그라운드에서 자동으로 처리합니다. 이 컴포넌트는 그저 결과(인증 상태)만 받아서 보여주면 됩니다.

  // ✅ 로딩 상태는 이제 'isLoading' 함수를 직접 호출하여 확인합니다.
  if (isLoading()) {
    // page.tsx의 Suspense가 처리하므로 이 부분은 거의 보이지 않지만,
    // 만약을 위한 안전장치로 빈 화면(혹은 스켈레톤 UI)을 반환할 수 있습니다.
    return null; 
  }

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: '로그아웃 완료',
        description: '안전하게 로그아웃되었습니다.',
      });
      // AuthProvider가 상태를 변경하면 화면이 자동으로 업데이트되므로,
      // router.refresh()는 필수는 아니지만, 깨끗한 상태를 위해 유지할 수 있습니다.
      router.refresh(); 
    } catch (error) {
      toast({
        title: '로그아웃 오류',
        description: '로그아웃 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const navigateWithAuth = (path: string, requiresAdmin = false) => {
    console.log('[PageContent] Navigation attempt:', { 
      path, 
      requiresAdmin, 
      isAuthenticated: isAuthenticated(), 
      userProfile: userProfile?.name,
      authStatus: authStatus 
    });
    
    // ✅ isAuthenticated는 이제 함수입니다. ()를 붙여 호출합니다.
    if (!isAuthenticated()) {
      console.log('[PageContent] Not authenticated, redirecting to login');
      toast({
        title: '로그인이 필요합니다',
        description: '이 기능을 사용하려면 로그인해주세요.',
        variant: 'destructive',
      });
      router.push('/login');
      return;
    }
    if (requiresAdmin && userProfile?.role !== 'admin') {
      console.log('[PageContent] Admin required but user is not admin');
      toast({
        title: '권한이 없습니다',
        description: '관리자만 접근할 수 있습니다.',
        variant: 'destructive',
      });
      return;
    }
    console.log('[PageContent] Navigation authorized, pushing to:', path);
    router.push(path);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Easyroom</h1>
            <p className="mt-2 text-muted-foreground">
              {/* ✅ [데이터 보증 완료] AuthContext가 userProfile.name의 안전성을 100% 보증하므로 단순화 */}
              {isAuthenticated() && userProfile
                ? <>안녕하세요, <span className="font-semibold text-primary">{userProfile.name}</span>님!</>
                : '회의실 예약 시스템에 오신 것을 환영합니다.'
              }
            </p>
          </div>
          {/* ✅ isAuthenticated() 호출로 변경 */}
          {isAuthenticated() ? (
            <div className="flex items-center gap-3">
              {/* ✅ [데이터 보증 완료] AuthContext가 모든 속성의 안전성을 보증하므로 단순화 */}
              {userProfile && (
                <div className="text-right hidden sm:block">
                  {/* ✅ [공급자 신뢰] 이제 userProfile.name과 department는 절대 null이 아님이 보증됨 */}
                  <p className="font-semibold">{userProfile.name}</p>
                  <p className="text-sm text-muted-foreground">{userProfile.department}</p>
                </div>
              )}
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">로그아웃</span>
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" asChild><Link href="/login"><LogIn className="mr-2 h-4 w-4" />로그인</Link></Button>
              <Button asChild><Link href="/signup"><UserPlus className="mr-2 h-4 w-4" />회원가입</Link></Button>
            </div>
          )}
        </header>

        {/* Quick Actions */}
        <main className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">바로가기</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <ActionCard 
                title="새 예약" description="예약하기" icon={Calendar}
                onClick={() => navigateWithAuth('/reservations/new')}
                disabled={!isAuthenticated()} // ✅ () 호출
              />
              <ActionCard 
                title="내 예약" description="예약 관리" icon={Users}
                onClick={() => navigateWithAuth('/reservations/my')}
                disabled={!isAuthenticated()} // ✅ () 호출
              />
              <ActionCard title="예약 현황" description="현황 보기" icon={Clock} onClick={() => router.push('/reservations/status')} />
              <ActionCard title="예약 대시보드" description="대시보드" icon={BarChart3} onClick={() => router.push('/dashboard')} />
            </div>
          </section>

          {/* Admin Section */}
          {/* ✅ isAuthenticated() 호출로 변경 */}
          {isAuthenticated() && userProfile?.role === 'admin' && (
            <section>
              <h2 className="text-xl font-semibold mb-4 text-destructive">관리자 메뉴</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ActionCard title="시스템 관리" description="관리자 패널" icon={Settings} onClick={() => navigateWithAuth('/admin', true)} />
              </div>
            </section>
          )}

          {/* 🧪 임시 테스트 섹션 - Operation: Atomic Profile */}
          {isAuthenticated() && (
            <section>
              <h2 className="text-xl font-semibold mb-4 text-blue-600">🧪 Atomic Profile RPC Test</h2>
              <AtomicProfileTest />
            </section>
          )}

          {/* Info Section for Guests */}
          {/* ✅ isAuthenticated() 호출로 변경 */}
          {!isAuthenticated() && (
            <section>
              <Card className="bg-muted/50 border-dashed">
                <CardHeader>
                  <CardTitle>처음 오셨나요?</CardTitle>
                  <CardDescription>Easyroom은 빠르고 간편한 회의실 예약 시스템입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">회원가입 후 모든 기능을 이용해보세요.</p>
                  <Button asChild><Link href="/signup">시작하기 <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                </CardContent>
              </Card>
            </section>
          )}
          
          {/* ... (나머지 UI는 기존과 동일) ... */}
          <section>
            <Card>
              <CardHeader><CardTitle>이용 안내</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div> <h3 className="font-semibold mb-2">예약 시간</h3> <p className="text-muted-foreground">오전 8시부터 오후 7시까지 30분 단위로 예약 가능합니다.</p> </div>
                <div> <h3 className="font-semibold mb-2">예약 규칙</h3> <p className="text-muted-foreground">사용이 끝난 회의실은 깨끗하게 정리해주세요. 미사용 예약은 다른 사람을 위해 미리 취소하는 센스를 보여주세요.</p> </div>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}