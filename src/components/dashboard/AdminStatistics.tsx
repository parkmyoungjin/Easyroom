'use client';

import { useQuery } from '@tanstack/react-query';
import { 
  getRoomUsageStatistics, 
  getNoShowReservations, 
  runAutomationManually,
  getCronJobsStatus 
} from '@/lib/api/checkin-checkout';
import type { 
  RoomUsageStatistics, 
  NoShowReservation, 
  CronJobStatus 
} from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  Play,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { useState } from 'react';

interface AdminStatisticsProps {
  className?: string;
}

export function AdminStatistics({ className }: AdminStatisticsProps) {
  const [isRunningAutomation, setIsRunningAutomation] = useState(false);

  // 회의실 사용률 통계
  const { data: roomStats, isLoading: isLoadingRoomStats, refetch: refetchRoomStats } = useQuery({
    queryKey: ['room-usage-statistics'],
    queryFn: getRoomUsageStatistics,
    refetchInterval: 60000 // 1분마다 갱신
  });

  // No-Show 예약 목록
  const { data: noShowReservations, isLoading: isLoadingNoShows, refetch: refetchNoShows } = useQuery({
    queryKey: ['no-show-reservations'],
    queryFn: getNoShowReservations,
    refetchInterval: 60000
  });

  // Cron 작업 상태
  const { data: cronJobs, isLoading: isLoadingCronJobs, refetch: refetchCronJobs } = useQuery({
    queryKey: ['cron-jobs-status'],
    queryFn: getCronJobsStatus,
    refetchInterval: 30000 // 30초마다 갱신
  });

  // 수동 자동화 실행
  const handleRunAutomation = async () => {
    setIsRunningAutomation(true);
    try {
      const result = await runAutomationManually();
      
      if (result.success !== false) {
        toast.success('자동화 작업 완료', {
          description: `처리된 항목: ${result.total_processed}개 (연장: ${result.overtime_updated}, No-Show: ${result.no_shows_marked}, 자동 체크아웃: ${result.auto_checkouts})`
        });
        
        // 관련 데이터 새로고침
        refetchRoomStats();
        refetchNoShows();
      } else {
        toast.error('자동화 작업 실패', {
          description: result.error || '알 수 없는 오류가 발생했습니다.'
        });
      }
    } catch (error) {
      toast.error('자동화 작업 오류', {
        description: '네트워크 오류가 발생했습니다.'
      });
      console.error('Manual automation error:', error);
    } finally {
      setIsRunningAutomation(false);
    }
  };

  // 전체 통계 계산
  const totalStats = roomStats?.reduce((acc: {
    totalReservations: number;
    completedReservations: number;
    noShowReservations: number;
    currentlyInUse: number;
  }, room: RoomUsageStatistics) => ({
    totalReservations: acc.totalReservations + room.total_reservations,
    completedReservations: acc.completedReservations + room.completed_reservations,
    noShowReservations: acc.noShowReservations + room.no_show_reservations,
    currentlyInUse: acc.currentlyInUse + room.currently_in_use
  }), {
    totalReservations: 0,
    completedReservations: 0,
    noShowReservations: 0,
    currentlyInUse: 0
  });

  const overallCompletionRate = totalStats && totalStats.totalReservations > 0 
    ? Math.round((totalStats.completedReservations / totalStats.totalReservations) * 100)
    : 0;

  const overallNoShowRate = totalStats && totalStats.totalReservations > 0
    ? Math.round((totalStats.noShowReservations / totalStats.totalReservations) * 100)
    : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 전체 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 예약</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingRoomStats ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                totalStats?.totalReservations || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">전체 예약 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">완료율</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoadingRoomStats ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                `${overallCompletionRate}%`
              )}
            </div>
            <p className="text-xs text-muted-foreground">정상 사용 완료</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Show율</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {isLoadingRoomStats ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                `${overallNoShowRate}%`
              )}
            </div>
            <p className="text-xs text-muted-foreground">미사용 예약</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">현재 사용 중</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {isLoadingRoomStats ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                totalStats?.currentlyInUse || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">회의실</p>
          </CardContent>
        </Card>
      </div>

      {/* 자동화 제어 패널 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            자동화 제어
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">수동 자동화 실행</h4>
              <p className="text-sm text-muted-foreground">
                연장 상태 업데이트, No-Show 처리, 자동 체크아웃을 즉시 실행합니다.
              </p>
            </div>
            <Button 
              onClick={handleRunAutomation}
              disabled={isRunningAutomation}
              variant="outline"
            >
              {isRunningAutomation ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  실행 중...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  실행
                </>
              )}
            </Button>
          </div>

          {/* Cron 작업 상태 */}
          <div className="space-y-2">
            <h4 className="font-medium">자동화 작업 상태</h4>
            {isLoadingCronJobs ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">상태 확인 중...</span>
              </div>
            ) : cronJobs && cronJobs.length > 0 ? (
              <div className="space-y-2">
                {cronJobs.map((job: CronJobStatus) => (
                  <div key={job.jobid} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div>
                      <span className="font-medium">{job.jobname}</span>
                      <span className="text-sm text-muted-foreground ml-2">({job.schedule})</span>
                    </div>
                    <Badge variant={job.active ? 'default' : 'secondary'}>
                      {job.active ? '활성' : '비활성'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">자동화 작업 정보를 불러올 수 없습니다.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 회의실별 사용률 통계 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            회의실별 사용률
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingRoomStats ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">통계 로딩 중...</span>
            </div>
          ) : roomStats && roomStats.length > 0 ? (
            <div className="space-y-4">
              {roomStats.map((room: RoomUsageStatistics) => (
                <div key={room.room_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{room.room_name}</h4>
                      <p className="text-sm text-muted-foreground">{room.location}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        완료율: {room.completion_rate}% | No-Show율: {room.no_show_rate}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        총 {room.total_reservations}개 예약
                      </div>
                    </div>
                  </div>
                  
                  {/* 진행률 바 */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${room.completion_rate}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>완료: {room.completed_reservations}</span>
                    <span>No-Show: {room.no_show_reservations}</span>
                    <span>사용 중: {room.currently_in_use}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              통계 데이터가 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 최근 No-Show 예약 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            최근 No-Show 예약
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingNoShows ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">No-Show 목록 로딩 중...</span>
            </div>
          ) : noShowReservations && noShowReservations.length > 0 ? (
            <div className="space-y-3">
              {noShowReservations.slice(0, 10).map((reservation: NoShowReservation) => (
                <div key={reservation.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <h4 className="font-medium">{reservation.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {reservation.room_name} · {reservation.user_name} ({reservation.department})
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {format(new Date(reservation.start_time), 'MM/dd HH:mm', { locale: ko })}
                    </div>
                    <Badge variant="destructive">No-Show</Badge>
                  </div>
                </div>
              ))}
              
              {noShowReservations.length > 10 && (
                <p className="text-center text-sm text-muted-foreground">
                  ...외 {noShowReservations.length - 10}개 더
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              최근 No-Show 예약이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}