'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button, Card, Tabs } from '@mantine/core';
import { toast } from 'sonner';
import { RoomManagement } from '@/features/admin/components/RoomManagement';
import { ReservationList } from '@/features/admin/components/ReservationList';
import { StatisticsDownload } from '@/features/admin/components/StatisticsDownload';
import { useAuth } from '@/hooks/useAuth';

export function AdminDashboard() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('rooms');

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        <p className="mt-2 text-muted-foreground">
          회의실 관리 및 예약 통계를 확인할 수 있습니다.
        </p>
      </div>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'rooms')}>
        <Tabs.List grow>
          <Tabs.Tab value="rooms">회의실 관리</Tabs.Tab>
          <Tabs.Tab value="reservations">예약 내역</Tabs.Tab>
          <Tabs.Tab value="statistics">통계</Tabs.Tab>
        </Tabs.List>

        <div className="mt-6">
          <Tabs.Panel value="rooms">
            <Card withBorder>
              <Card.Section withBorder inheritPadding py="xs">
                <h3 className="text-lg font-semibold">회의실 관리</h3>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                <RoomManagement />
              </Card.Section>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="reservations">
            <Card withBorder>
              <Card.Section withBorder inheritPadding py="xs">
                <h3 className="text-lg font-semibold">전체 예약 내역</h3>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                <ReservationList />
              </Card.Section>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="statistics">
            <Card withBorder>
              <Card.Section withBorder inheritPadding py="xs">
                <h3 className="text-lg font-semibold">통계 다운로드</h3>
              </Card.Section>
              <Card.Section inheritPadding py="md">
                <StatisticsDownload />
              </Card.Section>
            </Card>
          </Tabs.Panel>
        </div>
      </Tabs>
    </div>
  );
} 