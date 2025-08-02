'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { RoomManagement } from '@/features/admin/components/RoomManagement';
import { ReservationList } from '@/features/admin/components/ReservationList';
import { StatisticsDownload } from '@/features/admin/components/StatisticsDownload';
import { useAuth } from '@/hooks/useAuth';

export function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('rooms');

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        <p className="mt-2 text-muted-foreground">
          회의실 관리 및 예약 통계를 확인할 수 있습니다.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rooms">회의실 관리</TabsTrigger>
          <TabsTrigger value="reservations">예약 내역</TabsTrigger>
          <TabsTrigger value="statistics">통계</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="rooms">
            <Card>
              <CardHeader>
                <CardTitle>회의실 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <RoomManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reservations">
            <Card>
              <CardHeader>
                <CardTitle>전체 예약 내역</CardTitle>
              </CardHeader>
              <CardContent>
                <ReservationList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="statistics">
            <Card>
              <CardHeader>
                <CardTitle>통계 다운로드</CardTitle>
              </CardHeader>
              <CardContent>
                <StatisticsDownload />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
} 