// supabase/functions/send-checkin-reminders/index.ts
// 체크인 알림 발송 Edge Function (최적화 완료)

import { createClient } from 'supabase'
import { serve } from 'std/http/server.ts'
import webpush from 'web-push'

// 타입 정의
interface ReservationWithUser {
  id: string
  title: string
  start_time: string
  end_time: string
  users: {
    id: string
    name: string
    push_subscription: any
    notification_preferences: any
  }
  rooms: {
    name: string
  }
}

interface NotificationResult {
  reservationId: string
  userId: string
  success: boolean
  error?: string
}

// VAPID 설정 (환경변수에서 로드)
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL')

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_EMAIL) {
  throw new Error('VAPID configuration missing. Please set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_EMAIL')
}

// Web Push 설정
webpush.setVapidDetails(
  `mailto:${VAPID_EMAIL}`,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

serve(async (req: Request) => {
  try {
    console.log('🔔 Starting checkin reminder process...')

    // Supabase 클라이언트 생성 (서비스 역할 - 내부 호출이므로 인증 검증 불필요)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 알림 대상 시간 범위 계산 (5-15분 후)
    const now = new Date()
    const reminderWindowStart = new Date(now.getTime() + 5 * 60 * 1000)
    const reminderWindowEnd = new Date(now.getTime() + 15 * 60 * 1000)

    console.log(`Checking reservations: ${reminderWindowStart.toISOString()} ~ ${reminderWindowEnd.toISOString()}`)

    // 알림 대상 예약 조회 (최적화된 쿼리)
    const { data: reservations, error: queryError } = await supabase
      .from('reservations')
      .select(`
        id,
        title,
        start_time,
        end_time,
        users!inner (
          id,
          name,
          push_subscription,
          notification_preferences
        ),
        rooms!inner (
          name
        )
      `)
      .eq('status', 'confirmed')
      .eq('is_reminder_sent', false)
      .gte('start_time', reminderWindowStart.toISOString())
      .lte('start_time', reminderWindowEnd.toISOString())
      .not('users.push_subscription', 'is', null)

    if (queryError) {
      console.error('Database query error:', queryError)
      throw new Error(`Database query failed: ${queryError.message}`)
    }

    if (!reservations || reservations.length === 0) {
      console.log('No reservations found for reminder')
      return new Response(
        JSON.stringify({ 
          message: 'No reservations found for reminder',
          count: 0,
          timestamp: now.toISOString()
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Found ${reservations.length} reservations for reminder`)

    // 푸시 알림 발송 및 DB 업데이트 처리
    const results: NotificationResult[] = []
    const dbUpdates: Promise<any>[] = []

    for (const reservation of reservations as ReservationWithUser[]) {
      const user = reservation.users
      const room = reservation.rooms

      // 사용자 알림 설정 확인
      const preferences = user.notification_preferences
      if (preferences && (!preferences.enabled || !preferences.checkin_reminder)) {
        console.log(`Skipping user ${user.id} - notifications disabled`)
        continue
      }

      try {
        // 시작 시간까지 남은 분 계산
        const minutesUntilStart = Math.round(
          (new Date(reservation.start_time).getTime() - now.getTime()) / (1000 * 60)
        )

        // 푸시 알림 페이로드 생성
        const payload = {
          title: '🔔 회의 시작 알림',
          body: `${minutesUntilStart}분 후 "${room.name}"에서 "${reservation.title}" 회의가 시작됩니다.`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          data: {
            reservationId: reservation.id,
            roomName: room.name,
            startTime: reservation.start_time,
            action: 'checkin_reminder',
            url: `/reservations/status?id=${reservation.id}`
          }
        }

        // Web Push 발송
        await webpush.sendNotification(
          user.push_subscription,
          JSON.stringify(payload)
        )

        console.log(`✅ Notification sent successfully to user ${user.id}`)

        results.push({
          reservationId: reservation.id,
          userId: user.id,
          success: true
        })

        // 성공 시 DB 업데이트 (배치 처리)
        dbUpdates.push(
          supabase
            .from('reservations')
            .update({ 
              is_reminder_sent: true,
              reminder_sent_at: now.toISOString()
            })
            .eq('id', reservation.id)
        )

        dbUpdates.push(
          supabase
            .from('notification_logs')
            .insert({
              reservation_id: reservation.id,
              user_id: user.id,
              notification_type: 'checkin_reminder',
              status: 'sent',
              sent_at: now.toISOString()
            })
        )

      } catch (error: any) {
        console.error(`❌ Failed to send notification for reservation ${reservation.id}:`, error)
        
        results.push({
          reservationId: reservation.id,
          userId: user.id,
          success: false,
          error: error.message
        })

        // 실패 로그 기록
        dbUpdates.push(
          supabase
            .from('notification_logs')
            .insert({
              reservation_id: reservation.id,
              user_id: user.id,
              notification_type: 'checkin_reminder',
              status: 'failed',
              error_message: error.message,
              sent_at: now.toISOString()
            })
        )
      }
    }

    // 모든 DB 업데이트를 병렬 실행
    const updateResults = await Promise.allSettled(dbUpdates)
    const failedUpdates = updateResults.filter(result => result.status === 'rejected')
    
    if (failedUpdates.length > 0) {
      console.warn(`${failedUpdates.length} database updates failed`)
    }

    const successful = results.filter(r => r.success).length
    const failed = results.length - successful

    console.log(`🎉 Batch completed: ${successful} successful, ${failed} failed`)

    return new Response(
      JSON.stringify({
        message: 'Checkin reminders processed',
        total: results.length,
        successful,
        failed,
        timestamp: now.toISOString(),
        processing_time_ms: Date.now() - now.getTime()
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('❌ Edge Function error:', error)
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  }
})