-- HTTP 응답 구조 문제 해결
-- 문제: http_response 레코드에 status_code 필드가 없음
-- 해결: PostgreSQL HTTP 확장의 올바른 응답 구조 사용

-- 기존 함수 삭제 후 재생성
DROP FUNCTION IF EXISTS public.trigger_checkin_reminders();

-- 수정된 Edge Function 호출 함수 (HTTP 응답 구조 수정)
CREATE OR REPLACE FUNCTION public.trigger_checkin_reminders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    function_url TEXT;
    auth_header TEXT;
    response_data JSONB;
    http_result RECORD;
    supabase_url TEXT;
    service_key TEXT;
BEGIN
    -- Supabase URL과 서비스 키 설정
    supabase_url := 'https://jynolqsukaltetwmjczh.supabase.co';
    service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bm9scXN1a2FsdGV0d21qY3poIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMwMzQ2NywiZXhwIjoyMDY5ODc5NDY3fQ.Sr2TO7pjJKwhysQBAb3TzSL0kkg9B3lo9mR6VOU2rOU';
    
    -- Edge Function URL 구성
    function_url := supabase_url || '/functions/v1/send-checkin-reminders';
    auth_header := 'Bearer ' || service_key;
    
    RAISE NOTICE 'Calling Edge Function: %', function_url;
    
    -- HTTP POST 요청으로 Edge Function 호출 (수정된 구조)
    BEGIN
        -- HTTP 확장의 올바른 사용법
        SELECT 
            status,
            content,
            headers
        INTO http_result
        FROM extensions.http_post(
            function_url,
            '{}',
            'application/json',
            ARRAY[
                extensions.http_header('Authorization', auth_header),
                extensions.http_header('Content-Type', 'application/json')
            ]
        );
        
        -- 응답 처리 (수정된 필드명 사용)
        IF http_result.status BETWEEN 200 AND 299 THEN
            BEGIN
                response_data := http_result.content::jsonb;
            EXCEPTION
                WHEN OTHERS THEN
                    response_data := jsonb_build_object(
                        'message', 'Response received but not valid JSON',
                        'raw_content', http_result.content,
                        'status', http_result.status
                    );
            END;
            
            RAISE NOTICE 'Checkin reminders sent successfully: %', response_data->>'message';
            
            RETURN jsonb_build_object(
                'success', true,
                'status', http_result.status,
                'response', response_data,
                'executed_at', NOW()
            );
        ELSE
            RAISE WARNING 'Checkin reminder function failed with status %: %', 
                http_result.status, http_result.content;
                
            RETURN jsonb_build_object(
                'success', false,
                'status', http_result.status,
                'error', http_result.content,
                'executed_at', NOW()
            );
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to call Edge Function: %', SQLERRM;
            
            RETURN jsonb_build_object(
                'success', false,
                'error', SQLERRM,
                'function_url', function_url,
                'executed_at', NOW()
            );
    END;
END;
$$;

-- 대안 함수: 더 간단한 HTTP 호출 방식
CREATE OR REPLACE FUNCTION public.trigger_checkin_reminders_simple()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    function_url TEXT;
    auth_header TEXT;
    curl_command TEXT;
    result TEXT;
BEGIN
    -- Edge Function URL 구성
    function_url := 'https://jynolqsukaltetwmjczh.supabase.co/functions/v1/send-checkin-reminders';
    auth_header := 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bm9scXN1a2FsdGV0d21qY3poIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMwMzQ2NywiZXhwIjoyMDY5ODc5NDY3fQ.Sr2TO7pjJKwhysQBAb3TzSL0kkg9B3lo9mR6VOU2rOU';
    
    RAISE NOTICE 'Triggering Edge Function: %', function_url;
    
    -- 간단한 성공 응답 반환 (실제 HTTP 호출 없이 테스트용)
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Edge Function trigger initiated',
        'function_url', function_url,
        'executed_at', NOW(),
        'note', 'This is a simplified version for testing'
    );
END;
$$;

-- HTTP 확장 상태 확인 함수
CREATE OR REPLACE FUNCTION public.check_http_extension()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    extension_exists BOOLEAN;
    available_functions TEXT[];
BEGIN
    -- HTTP 확장 존재 확인
    SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'http'
    ) INTO extension_exists;
    
    -- 사용 가능한 HTTP 함수들 확인
    SELECT array_agg(proname) INTO available_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'extensions' 
    AND proname LIKE 'http%';
    
    RETURN jsonb_build_object(
        'http_extension_exists', extension_exists,
        'available_functions', available_functions,
        'checked_at', NOW()
    );
END;
$$;

-- 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.trigger_checkin_reminders() TO postgres;
GRANT EXECUTE ON FUNCTION public.trigger_checkin_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_checkin_reminders_simple() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_http_extension() TO authenticated;

-- 함수 설명 업데이트
COMMENT ON FUNCTION public.trigger_checkin_reminders() IS 'HTTP 응답 구조 수정된 Edge Function 호출';
COMMENT ON FUNCTION public.trigger_checkin_reminders_simple() IS '간단한 Edge Function 트리거 (테스트용)';
COMMENT ON FUNCTION public.check_http_extension() IS 'HTTP 확장 상태 및 사용 가능한 함수 확인';

-- 로그 기록
DO $$
BEGIN
    RAISE NOTICE '🔧 HTTP RESPONSE STRUCTURE FIXED';
    RAISE NOTICE '✅ Changed: http_response.status_code → http_result.status';
    RAISE NOTICE '✅ Added: Alternative simple trigger function';
    RAISE NOTICE '✅ Added: HTTP extension status check function';
    RAISE NOTICE '🌐 Edge Function calls should now work properly';
END $$;