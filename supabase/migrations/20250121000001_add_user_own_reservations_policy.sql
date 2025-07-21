-- 사용자가 자신의 모든 예약을 볼 수 있는 RLS 정책 추가
-- 기존 정책과 함께 작동하여 사용자는 확정된 모든 예약 + 자신의 모든 예약을 볼 수 있음

-- 새로운 정책 추가: 사용자는 상태와 관계없이 자신의 모든 예약을 볼 수 있다.
CREATE POLICY "Users can view their own reservations" ON public.reservations
    FOR SELECT USING (auth.uid() IN (SELECT auth_id FROM public.users WHERE id = user_id));

-- 정책 추가 완료 로그
DO $
BEGIN
    RAISE NOTICE '사용자 자신의 예약 조회 정책이 추가되었습니다.';
    RAISE NOTICE '- 사용자는 이제 상태와 관계없이 자신의 모든 예약을 볼 수 있습니다.';
    RAISE NOTICE '- 기존 정책과 함께 작동하여 OR 조건으로 적용됩니다.';
END $;

-- 마이그레이션 메타데이터
COMMENT ON POLICY "Users can view their own reservations" ON public.reservations IS '사용자가 상태와 관계없이 자신의 모든 예약을 조회할 수 있는 정책';