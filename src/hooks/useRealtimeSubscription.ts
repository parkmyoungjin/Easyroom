"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

/**
 * Subscribes to real-time updates for reservations.
 * Includes automatic polling fallback when WebSocket connection fails.
 */
export function useRealtimeSubscription() {
  const queryClient = useQueryClient();
  const isConnectedRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    // Clear existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const channel = supabase
      .channel("reservations_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["reservations"] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          isConnectedRef.current = true;
          reconnectAttemptsRef.current = 0; // ✅ 연결 성공 시 재시도 카운터 리셋
          // Stop polling when realtime is connected
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
        if (status === 'CHANNEL_ERROR') {
          console.error("Realtime channel error:", err);
          isConnectedRef.current = false;
          // Start polling fallback
          startPollingFallback();
        }
        if (status === 'CLOSED') {
          isConnectedRef.current = false;
          // Start polling fallback
          startPollingFallback();
        }
      });

    // Function to start polling fallback
    const startPollingFallback = () => {
      if (pollingIntervalRef.current) return; // Already polling
      
      // ✅ 점진적 백오프: 더 긴 간격으로 조정 (과도한 요청 방지)
      const interval = Math.min(30000 + (reconnectAttemptsRef.current * 10000), 120000);
      
      pollingIntervalRef.current = setInterval(() => {
        if (!isConnectedRef.current) {
          queryClient.invalidateQueries({ queryKey: ["reservations"] });
          reconnectAttemptsRef.current++;
        }
      }, interval); // 30초 → 40초 → 50초 ... 최대 2분
    };

    // Start polling fallback after 5 seconds if not connected
    const fallbackTimer = setTimeout(() => {
      if (!isConnectedRef.current) {
        startPollingFallback();
      }
    }, 5000);

    return () => {
      clearTimeout(fallbackTimer);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      supabase.removeChannel(channel);
      isConnectedRef.current = false;
    };
  }, [queryClient]);
}

/**
 * @deprecated Use useRealtimeSubscription() instead which includes automatic polling fallback
 */
export function usePollingFallback(interval: number) {
  console.warn("usePollingFallback is deprecated. Use useRealtimeSubscription() instead.");
}
