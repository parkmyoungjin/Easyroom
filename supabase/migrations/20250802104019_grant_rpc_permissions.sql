-- ============================================================================
-- Grant permissions for the recreated atomic profile RPC function
-- ============================================================================

-- 함수 실행 권한을 authenticated 사용자에게 부여
GRANT EXECUTE ON FUNCTION public.get_or_create_user_profile() TO authenticated;

-- 권한 부여 완료 로그
DO $$
BEGIN
    RAISE NOTICE '✅ Permissions granted to authenticated users for get_or_create_user_profile()';
END $$;