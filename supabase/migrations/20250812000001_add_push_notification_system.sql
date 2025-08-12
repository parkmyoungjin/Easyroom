-- Push Notification System Migration
-- 푸시 알림 시스템을 위한 데이터베이스 스키마 확장

-- 1. users 테이블에 푸시 구독 관련 컬럼 추가
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS push_subscription JSONB,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "checkin_reminder": true,
  "minutes_before": 10,
  "enabled": true
}';

-- 2. 푸시 구독 정보 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_push_subscription 
ON public.users USING GIN (push_subscription) 
WHERE push_subscription IS NOT NULL;

-- 3. 알림 로그 테이블 생성 (중복 발송 방지 및 재시도 로직)
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL DEFAULT 'checkin_reminder',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'pending_retry'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 중복 방지를 위한 유니크 제약 (같은 예약에 대해 같은 타입의 알림은 한 번만)
  UNIQUE(reservation_id, user_id, notification_type)
);

-- 4. 알림 로그 테이블 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_notification_logs_reservation_user 
ON public.notification_logs(reservation_id, user_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at 
ON public.notification_logs(sent_at);

CREATE INDEX IF NOT EXISTS idx_notification_logs_status 
ON public.notification_logs(status);

CREATE INDEX IF NOT EXISTS idx_notification_logs_retry 
ON public.notification_logs(status, next_retry_at) 
WHERE status = 'pending_retry';

-- 5. 알림 로그 테이블 RLS 정책 설정
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있다면 삭제 후 재생성
DROP POLICY IF EXISTS "notification_logs_admin_select" ON public.notification_logs;
DROP POLICY IF EXISTS "notification_logs_user_select" ON public.notification_logs;
DROP POLICY IF EXISTS "notification_logs_system_insert" ON public.notification_logs;
DROP POLICY IF EXISTS "notification_logs_system_update" ON public.notification_logs;

-- 관리자만 모든 로그 조회 가능
CREATE POLICY "notification_logs_admin_select" ON public.notification_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- 사용자는 자신의 알림 로그만 조회 가능
CREATE POLICY "notification_logs_user_select" ON public.notification_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.auth_id = auth.uid() 
    AND users.id = notification_logs.user_id
  )
);

-- 시스템에서만 알림 로그 삽입/업데이트 가능 (서비스 역할 키 필요)
CREATE POLICY "notification_logs_system_insert" ON public.notification_logs
FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "notification_logs_system_update" ON public.notification_logs
FOR UPDATE USING (auth.role() = 'service_role');

-- 6. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_notification_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 있다면 삭제 후 재생성
DROP TRIGGER IF EXISTS trigger_update_notification_logs_updated_at ON public.notification_logs;

CREATE TRIGGER trigger_update_notification_logs_updated_at
  BEFORE UPDATE ON public.notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_logs_updated_at();

-- 7. 알림 통계 조회를 위한 뷰 생성 (관리자용)
CREATE OR REPLACE VIEW public.notification_stats_view AS
SELECT 
  DATE(sent_at) as date,
  notification_type,
  status,
  COUNT(*) as count,
  AVG(retry_count) as avg_retry_count
FROM public.notification_logs
GROUP BY DATE(sent_at), notification_type, status
ORDER BY date DESC, notification_type, status;

-- 뷰 권한 설정 (관리자만 조회 가능)
ALTER VIEW public.notification_stats_view OWNER TO postgres;
GRANT SELECT ON public.notification_stats_view TO authenticated;

-- 8. 재시도 대상 알림 조회 함수 (시스템용)
CREATE OR REPLACE FUNCTION public.get_notifications_for_retry()
RETURNS TABLE (
  id UUID,
  reservation_id UUID,
  user_id UUID,
  notification_type TEXT,
  retry_count INTEGER,
  error_message TEXT
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nl.id,
    nl.reservation_id,
    nl.user_id,
    nl.notification_type,
    nl.retry_count,
    nl.error_message
  FROM public.notification_logs nl
  WHERE nl.status = 'pending_retry'
    AND (nl.next_retry_at IS NULL OR nl.next_retry_at <= NOW())
    AND nl.retry_count < 3  -- 최대 3회 재시도
  ORDER BY nl.created_at ASC
  LIMIT 50;  -- 한 번에 최대 50개씩 처리
END;
$$;

-- 함수 권한 설정 (서비스 역할만 실행 가능)
REVOKE ALL ON FUNCTION public.get_notifications_for_retry() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_notifications_for_retry() TO service_role;

-- 9. 주석 추가
COMMENT ON TABLE public.notification_logs IS '푸시 알림 발송 로그 및 재시도 관리 테이블';
COMMENT ON COLUMN public.users.push_subscription IS '사용자의 푸시 구독 정보 (JSON 형태)';
COMMENT ON COLUMN public.users.notification_preferences IS '사용자의 알림 설정 (JSON 형태)';
COMMENT ON FUNCTION public.get_notifications_for_retry() IS '재시도가 필요한 알림 목록 조회 (시스템 전용)';