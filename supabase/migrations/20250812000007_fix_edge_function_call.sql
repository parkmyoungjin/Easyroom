-- Edge Function 호출 방식 근본 수정
-- 문제: supabase_functions 스키마가 존재하지 않아 내부 호출 실패
-- 해결: HTTP 확장을 사용한 안정적인 외부 호출 방식으로 변경

-- 1. HTTP 확장 활성화 (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 2. trigger_checkin_reminders 함수를 HTTP 방식으로 재작성
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
    http_response extensions.http_response;
    supabase_url TEXT;
    service_key TEXT;
BEGIN
    -- Supabase URL과 서비스 키 가져오기
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_key := current_setting('app.settings.service_role_key', true);
    
    -- 환경 변수가 설정되지 않은 경우 기본값 사용
    IF supabase_url IS NULL OR supabase_url = '' THEN
        -- 현재 데이터베이스 연결에서 Supabase URL 추출 시도
        supabase_url := 'https://jynolqsukaltetwmjczh.supabase.co';
    END IF;
    
    IF service_key IS NULL OR service_key = '' THEN
        RAISE WARNING 'Service role key not configured. Using default authentication.';
        service_key := 'default';
    END IF;
    
    -- Edge Function URL 구성
    function_url := supabase_url || '/functions/v1/send-checkin-reminders';
    auth_header := 'Bearer ' || service_key;
    
    RAISE NOTICE 'Calling Edge Function: %', function_url;
    
    -- HTTP POST 요청으로 Edge Function 호출
    BEGIN
        SELECT * INTO http_response
        FROM extensions.http((
            'POST',
            function_url,
            ARRAY[extensions.http_header('Authorization', auth_header)],
            'application/json',
            '{}'
        )::extensions.http_request);
        
        -- 응답 처리
        IF http_response.status_code BETWEEN 200 AND 299 THEN
            BEGIN
                response_data := http_response.content::jsonb;
            EXCEPTION
                WHEN OTHERS THEN
                    response_data := jsonb_build_object(
                        'message', 'Response received but not valid JSON',
                        'raw_content', http_response.content,
                        'status_code', http_response.status_code
                    );
            END;
            
            RAISE NOTICE 'Checkin reminders sent successfully: %', response_data->>'message';
            
            RETURN jsonb_build_object(
                'success', true,
                'status_code', http_response.status_code,
                'response', response_data,
                'executed_at', NOW()
            );
        ELSE
            RAISE WARNING 'Checkin reminder function failed with status %: %', 
                http_response.status_code, http_response.content;
                
            RETURN jsonb_build_object(
                'success', false,
                'status_code', http_response.status_code,
                'error', http_response.content,
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

-- 3. 설정값 저장을 위한 함수 (관리자용)
CREATE OR REPLACE FUNCTION public.set_supabase_config(
    p_supabase_url TEXT,
    p_service_role_key TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 관리자 권한 확인
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE auth_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: admin role required';
    END IF;
    
    -- 설정값 저장
    PERFORM set_config('app.settings.supabase_url', p_supabase_url, false);
    PERFORM set_config('app.settings.service_role_key', p_service_role_key, false);
    
    RAISE NOTICE 'Supabase configuration updated successfully';
END;
$$;

-- 4. 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.trigger_checkin_reminders() TO postgres;
GRANT EXECUTE ON FUNCTION public.trigger_checkin_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_supabase_config(TEXT, TEXT) TO authenticated;

-- 5. 함수 설명 업데이트
COMMENT ON FUNCTION public.trigger_checkin_reminders() IS 'HTTP를 통한 Edge Function 호출로 체크인 알림 발송 (안정적인 외부 호출 방식)';
COMMENT ON FUNCTION public.set_supabase_config(TEXT, TEXT) IS 'Supabase URL 및 서비스 키 설정 (관리자 전용)';

-- 6. 로그 기록
DO $$
BEGIN
    RAISE NOTICE '🔧 EDGE FUNCTION CALL METHOD UPDATED';
    RAISE NOTICE '✅ Changed from: supabase_functions.invoke()';
    RAISE NOTICE '✅ Changed to: HTTP extension call';
    RAISE NOTICE '🌐 More stable and reliable external call method';
END $$;