-- 체크인 알림 시스템을 위한 데이터베이스 스키마 확장
-- Phase 1: 데이터베이스 스키마 확장

-- 1. reservations 테이블에 알림 발송 추적 컬럼 추가
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS is_reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ NULL;

-- 2. 핵심 성능 최적화 인덱스 (알림 대상 조회용)
CREATE INDEX IF NOT EXISTS idx_reservations_reminder_pending 
ON public.reservations(start_time, is_reminder_sent) 
WHERE is_reminder_sent = FALSE AND status = 'confirmed';

-- 3. 알림 통계 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_notification_logs_checkin_reminder 
ON public.notification_logs(notification_type, status, created_at) 
WHERE notification_type = 'checkin_reminder';

-- 4. 컬럼 설명 추가
COMMENT ON COLUMN public.reservations.is_reminder_sent IS '체크인 알림 발송 여부 (중복 발송 방지용)';
COMMENT ON COLUMN public.reservations.reminder_sent_at IS '체크인 알림 발송 시각';

-- 5. 인덱스 설명 추가
COMMENT ON INDEX public.idx_reservations_reminder_pending IS '알림 대상 예약 조회 최적화 인덱스';
COMMENT ON INDEX public.idx_notification_logs_checkin_reminder IS '체크인 알림 통계 조회 최적화 인덱스';

-- 6. 기존 예약들의 is_reminder_sent 초기화 (이미 지난 예약들은 true로 설정)
UPDATE public.reservations 
SET is_reminder_sent = TRUE 
WHERE start_time < NOW() AND is_reminder_sent IS NULL;

-- 7. 향후 예약들의 is_reminder_sent 초기화 (false로 설정)
UPDATE public.reservations 
SET is_reminder_sent = FALSE 
WHERE start_time >= NOW() AND is_reminder_sent IS NULL;