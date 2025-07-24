// src/app/page-content.tsx

'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Calendar, Users, Clock, Settings, LogOut, BarChart3, LogIn, UserPlus, ArrowRight 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ✅ 재사용 가능한 ActionCard 컴포넌트
interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
}

function ActionCard({ title, description, icon: Icon, onClick, disabled = false }: ActionCardProps) {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-300 ${
        disabled 
          ? 'bg-muted/50 cursor-not-allowed' 
          : 'hover:shadow-lg hover:border-primary'
      }`}
      onClick={!disabled ? onClick : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{description}</div>
        <p className={`text-xs text-muted-foreground ${disabled ? 'line-through' : ''}`}>
          {title} 페이지로 이동
        </p>
      </CardContent>
    </Card>
  );
}


export default function PageContent() {
  const router = useRouter();
  const { userProfile, signOut, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  
  // ✅ 로딩 상태를 useAuth 훅의 isLoading으로 통합하여 단순화
  if (isLoading()) {
    // Suspense가 처리하므로 이 부분은 거의 보이지 않지만, 안전장치로 둡니다.
    // return <MainPageSkeleton />; // page.tsx에서 이미 처리
    return null; 
  }

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: '로그아웃 완료',
        description: '안전하게 로그아웃되었습니다.',
      });
      // 페이지 새로고침으로 깨끗한 상태에서 시작
      router.refresh(); 
    } catch (error) {
      toast({
        title: '로그아웃 오류',
        description: '로그아웃 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  // ✅ 인증이 필요한 네비게이션을 처리하는 헬퍼 함수
  const navigateWithAuth = (path: string, requiresAdmin = false) => {
    if (!isAuthenticated()) {
      toast({
        title: '로그인이 필요합니다',
        description: '이 기능을 사용하려면 로그인해주세요.',
        variant: 'destructive',
      });
      router.push('/login');
      return;
    }
    if (requiresAdmin && userProfile?.role !== 'admin') {
      toast({
        title: '권한이 없습니다',
        description: '관리자만 접근할 수 있습니다.',
        variant: 'destructive',
      });
      return;
    }
    router.push(path);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Easyroom
            </h1>
            <p className="mt-2 text-muted-foreground">
              {isAuthenticated() && userProfile
                ? <>안녕하세요, <span className="font-semibold text-primary">{userProfile.name}</span>님!</>
                : '회의실 예약 시스템에 오신 것을 환영합니다.'
              }
            </p>
          </div>
          {isAuthenticated() ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="font-semibold">{userProfile?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {userProfile?.department}
                </p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">로그아웃</span>
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/login"><LogIn className="mr-2 h-4 w-4" />로그인</Link>
              </Button>
              <Button asChild>
                <Link href="/signup"><UserPlus className="mr-2 h-4 w-4" />회원가입</Link>
              </Button>
            </div>
          )}
        </header>

        {/* Quick Actions */}
        <main className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">바로가기</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <ActionCard 
                title="새 예약" 
                description="예약하기" 
                icon={Calendar}
                onClick={() => navigateWithAuth('/reservations/new')}
                disabled={!isAuthenticated()}
              />
              <ActionCard 
                title="내 예약" 
                description="예약 관리" 
                icon={Users}
                onClick={() => navigateWithAuth('/reservations/my')}
                disabled={!isAuthenticated()}
              />
              <ActionCard 
                title="예약 현황" 
                description="현황 보기" 
                icon={Clock}
                onClick={() => router.push('/reservations/status')}
              />
              <ActionCard 
                title="예약 대시보드" 
                description="대시보드" 
                icon={BarChart3}
                onClick={() => router.push('/dashboard')}
              />
            </div>
          </section>

          {/* Admin Section */}
          {isAuthenticated() && userProfile?.role === 'admin' && (
            <section>
              <h2 className="text-xl font-semibold mb-4 text-destructive">관리자 메뉴</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <ActionCard 
                  title="시스템 관리" 
                  description="관리자 패널" 
                  icon={Settings}
                  onClick={() => navigateWithAuth('/admin', true)}
                />
              </div>
            </section>
          )}

          {/* Info Section for Guests */}
          {!isAuthenticated() && (
            <section>
              <Card className="bg-muted/50 border-dashed">
                <CardHeader>
                  <CardTitle>처음 오셨나요?</CardTitle>
                  <CardDescription>
                    Easyroom은 빠르고 간편한 회의실 예약 시스템입니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">회원가입 후 모든 기능을 이용해보세요.</p>
                  <Button asChild>
                    <Link href="/signup">
                      시작하기 <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </section>
          )}

          {/* Info Section */}
          <section>
            <Card>
              <CardHeader><CardTitle>이용 안내</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h3 className="font-semibold mb-2">예약 시간</h3>
                  <p className="text-muted-foreground">오전 8시부터 오후 7시까지 30분 단위로 예약 가능합니다.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">예약 규칙</h3>
                  <p className="text-muted-foreground">사용이 끝난 회의실은 깨끗하게 정리해주세요. 미사용 예약은 다른 사람을 위해 미리 취소하는 센스를 보여주세요.</p>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}