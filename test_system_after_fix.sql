-- 보안 수정 후 시스템 재검증

-- 1. 뷰 보안 설정 확인 (수정된 함수)
SELECT public.check_view_security_settings();

-- 2. 뷰 존재 여부 확인
SELECT public.check_views_exist();

-- 3. 뷰 보안 상태 상세 확인
SELECT public.check_view_security_detailed();

-- 4. 전체 시스템 검증
SELECT public.validate_checkin_reminder_system();

-- 5. Edge Function 호출 테스트
SELECT public.trigger_checkin_reminders();

-- 6. 시스템 상태 대시보드 확인
SELECT * FROM public.system_status_dashboard;