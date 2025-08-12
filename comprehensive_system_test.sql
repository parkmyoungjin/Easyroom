-- 체크인 알림 시스템 종합 검증

-- 1. 뷰 접근 테스트 (실제 데이터 접근 확인)
SELECT '=== VIEW ACCESS TEST ===' as test_section;
SELECT public.test_view_access();

-- 2. 전체 시스템 검증
SELECT '=== SYSTEM VALIDATION ===' as test_section;
SELECT public.validate_checkin_reminder_system();

-- 3. Edge Function 호출 테스트
SELECT '=== EDGE FUNCTION TEST ===' as test_section;
SELECT public.trigger_checkin_reminders();

-- 4. 시스템 상태 대시보드 확인
SELECT '=== SYSTEM STATUS DASHBOARD ===' as test_section;
SELECT * FROM public.system_status_dashboard;

-- 5. 자동화 시스템 상태 확인
SELECT '=== AUTOMATION STATUS ===' as test_section;
SELECT public.get_automation_system_status();