-- Drop legacy upsert_user_profile function
-- This function has been replaced by the atomic get_or_create_user_profile function

DROP FUNCTION IF EXISTS public.upsert_user_profile(
    p_auth_id text,
    p_email text,
    p_user_name text,
    p_user_department text,
    p_user_employee_id text
);

-- Add comment for documentation
COMMENT ON SCHEMA public IS 'Legacy upsert_user_profile function removed in favor of atomic get_or_create_user_profile function';