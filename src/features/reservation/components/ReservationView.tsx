
"use client";

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReservationCalendarView from "./ReservationCalendarView";
import { ReservationListView } from "./ReservationListView";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

export default function ReservationView() {
  const router = useRouter();
  
  // Enable real-time updates with polling fallback
  useRealtimeSubscription();

  const handleCellClick = (date: Date, hour: number) => {
    // ✅ 수정: 과거 시간 체크 로직 개선
   // const clickedDateTime = new Date(date);
   // clickedDateTime.setHours(hour, 0, 0, 0);
    
    //if (clickedDateTime < new Date()) {
    //  console.log('과거 시간은 예약할 수 없습니다.');
    //  return;
    //}    
    
  // 모달 대신 페이지로 이동
  const dateString = format(date, 'yyyy-MM-dd');
  router.push(`/reservations/new?date=${dateString}&hour=${hour}`);
};

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">회의실 예약</h1>
      </div>
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar">캘린더</TabsTrigger>
          <TabsTrigger value="list">목록</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar">
          <ReservationCalendarView onCellClick={handleCellClick} />
        </TabsContent>
        <TabsContent value="list">
          <ReservationListView />
        </TabsContent>
      </Tabs>

    </div>
  );
} 