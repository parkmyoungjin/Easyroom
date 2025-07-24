-- Enhanced Database Constraints and Triggers Migration
-- Adds comprehensive data integrity constraints, audit logging, and validation triggers
-- Requirements: 1.3, 1.4

-- =============================================================================
-- AUDIT LOGGING INFRASTRUCTURE
-- =============================================================================

-- Create audit log table for tracking all data modifications
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID, -- References users.id (can be NULL for system operations)
    auth_user_id UUID, -- References auth.users.id (can be NULL for system operations)
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT audit_log_table_name_check 
        CHECK (table_name IN ('users', 'rooms', 'reservations')),
    CONSTRAINT audit_log_record_id_format_check 
        CHECK (record_id::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
);

-- Create indexes for audit log performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at ON public.audit_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_operation ON public.audit_log(operation);

-- =============================================================================
-- ENHANCED UUID VALIDATION FUNCTIONS
-- =============================================================================

-- Comprehensive UUID format validation function
CREATE OR REPLACE FUNCTION validate_uuid_format(uuid_value UUID, field_name TEXT DEFAULT 'UUID')
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Check if UUID is NULL
    IF uuid_value IS NULL THEN
        RAISE EXCEPTION '% cannot be NULL', field_name;
    END IF;
    
    -- Check UUID format using regex (more comprehensive than built-in validation)
    IF NOT (uuid_value::TEXT ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
        RAISE EXCEPTION '% has invalid UUID format: %', field_name, uuid_value;
    END IF;
    
    -- Check for common invalid UUIDs
    IF uuid_value::TEXT IN (
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff'
    ) THEN
        RAISE EXCEPTION '% cannot be a reserved UUID value: %', field_name, uuid_value;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Enhanced user ID validation with detailed context
CREATE OR REPLACE FUNCTION validate_user_id_with_context(
    user_id_value UUID, 
    operation_type TEXT,
    table_name TEXT DEFAULT 'unknown'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_exists BOOLEAN;
    is_auth_id BOOLEAN;
    user_name TEXT;
BEGIN
    -- Validate UUID format first
    PERFORM validate_uuid_format(user_id_value, 'user_id');
    
    -- Check if user_id exists in users table
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = user_id_value) INTO user_exists;
    
    IF NOT user_exists THEN
        -- Check if it might be an auth_id instead
        SELECT EXISTS(SELECT 1 FROM public.users WHERE auth_id = user_id_value) INTO is_auth_id;
        
        IF is_auth_id THEN
            -- Get user name for better error message
            SELECT name INTO user_name FROM public.users WHERE auth_id = user_id_value;
            
            RAISE EXCEPTION 'Invalid user_id in % operation on %: % appears to be auth_id for user "%" instead of database id. Use users.id, not users.auth_id', 
                          operation_type, table_name, user_id_value, COALESCE(user_name, 'unknown');
        ELSE
            RAISE EXCEPTION 'Invalid user_id in % operation on %: user % does not exist in users table', 
                          operation_type, table_name, user_id_value;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- =============================================================================
-- AUDIT LOGGING TRIGGER FUNCTIONS
-- =============================================================================

-- Generic audit logging function for all tables
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    current_auth_id UUID;
    session_info RECORD;
BEGIN
    -- Get current user information
    SELECT u.id INTO current_user_id
    FROM public.users u
    WHERE u.auth_id = auth.uid();
    
    current_auth_id := auth.uid();
    
    -- Insert audit record
    INSERT INTO public.audit_log (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        user_id,
        auth_user_id,
        session_id,
        ip_address,
        user_agent
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE 
            WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD)
            ELSE NULL
        END,
        CASE 
            WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)
            ELSE NULL
        END,
        current_user_id,
        current_auth_id,
        COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'session_id', 'unknown'),
        COALESCE(inet(current_setting('request.headers', true)::jsonb->>'x-forwarded-for'), '0.0.0.0'::inet),
        COALESCE(current_setting('request.headers', true)::jsonb->>'user-agent', 'unknown')
    );
    
    -- Return appropriate record
    CASE TG_OP
        WHEN 'DELETE' THEN RETURN OLD;
        ELSE RETURN NEW;
    END CASE;
END;
$$;

-- Enhanced validation trigger for reservations with audit context
CREATE OR REPLACE FUNCTION validate_reservation_with_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate user_id with enhanced context
    PERFORM validate_user_id_with_context(NEW.user_id, TG_OP, 'reservations');
    
    -- Validate room_id format and existence
    PERFORM validate_uuid_format(NEW.room_id, 'room_id');
    
    IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = NEW.room_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Invalid room_id in % operation: room % does not exist or is inactive', TG_OP, NEW.room_id;
    END IF;
    
    -- Validate time constraints
    IF NEW.start_time >= NEW.end_time THEN
        RAISE EXCEPTION 'Invalid time range in % operation: start_time (%) must be before end_time (%)', 
                       TG_OP, NEW.start_time, NEW.end_time;
    END IF;
    
    -- Prevent reservations too far in the future (1 year limit)
    IF NEW.start_time > CURRENT_TIMESTAMP + INTERVAL '1 year' THEN
        RAISE EXCEPTION 'Invalid reservation time in % operation: cannot create reservations more than 1 year in advance', TG_OP;
    END IF;
    
    -- Prevent reservations in the past (except for updates within grace period)
    IF TG_OP = 'INSERT' AND NEW.start_time < CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN
        RAISE EXCEPTION 'Invalid reservation time in % operation: cannot create reservations in the past', TG_OP;
    END IF;
    
    -- Validate title and purpose are not empty
    IF TRIM(NEW.title) = '' THEN
        RAISE EXCEPTION 'Invalid reservation in % operation: title cannot be empty', TG_OP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Enhanced validation trigger for users
CREATE OR REPLACE FUNCTION validate_user_with_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate auth_id format
    PERFORM validate_uuid_format(NEW.auth_id, 'auth_id');
    
    -- Validate email format
    IF NEW.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email format in % operation: %', TG_OP, NEW.email;
    END IF;
    
    -- Validate name is not empty
    IF TRIM(NEW.name) = '' THEN
        RAISE EXCEPTION 'Invalid user in % operation: name cannot be empty', TG_OP;
    END IF;
    
    -- Validate role
    IF NEW.role NOT IN ('employee', 'admin') THEN
        RAISE EXCEPTION 'Invalid role in % operation: % (must be employee or admin)', TG_OP, NEW.role;
    END IF;
    
    -- Validate employee_id format if provided
    IF NEW.employee_id IS NOT NULL AND TRIM(NEW.employee_id) = '' THEN
        RAISE EXCEPTION 'Invalid user in % operation: employee_id cannot be empty string', TG_OP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Enhanced validation trigger for rooms
CREATE OR REPLACE FUNCTION validate_room_with_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate name is not empty
    IF TRIM(NEW.name) = '' THEN
        RAISE EXCEPTION 'Invalid room in % operation: name cannot be empty', TG_OP;
    END IF;
    
    -- Validate capacity is positive
    IF NEW.capacity <= 0 THEN
        RAISE EXCEPTION 'Invalid room in % operation: capacity must be greater than 0', TG_OP;
    END IF;
    
    -- Validate capacity is reasonable (max 1000)
    IF NEW.capacity > 1000 THEN
        RAISE EXCEPTION 'Invalid room in % operation: capacity cannot exceed 1000', TG_OP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- =============================================================================
-- ENHANCED FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Drop existing constraints to recreate with enhanced options
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_user_id_fkey;
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_room_id_fkey;

-- Add enhanced foreign key constraints with proper cascade rules
ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_room_id_fkey 
FOREIGN KEY (room_id) REFERENCES public.rooms(id) 
ON DELETE RESTRICT 
ON UPDATE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- Add constraint to prevent users from referencing their own auth_id in reservations
ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_prevent_auth_id_confusion 
CHECK (
    user_id NOT IN (
        SELECT auth_id FROM public.users WHERE auth_id IS NOT NULL
    )
);

-- =============================================================================
-- ADDITIONAL CHECK CONSTRAINTS
-- =============================================================================

-- Enhanced UUID format constraints for all tables
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_id_format_check,
DROP CONSTRAINT IF EXISTS users_auth_id_format_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_id_format_check 
CHECK (id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
ADD CONSTRAINT users_auth_id_format_check 
CHECK (auth_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');

ALTER TABLE public.rooms 
DROP CONSTRAINT IF EXISTS rooms_id_format_check;

ALTER TABLE public.rooms 
ADD CONSTRAINT rooms_id_format_check 
CHECK (id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');

-- Enhanced business logic constraints
ALTER TABLE public.reservations 
DROP CONSTRAINT IF EXISTS reservations_duration_check,
DROP CONSTRAINT IF EXISTS reservations_future_check;

ALTER TABLE public.reservations 
ADD CONSTRAINT reservations_duration_check 
CHECK (end_time - start_time >= INTERVAL '15 minutes' AND end_time - start_time <= INTERVAL '8 hours'),
ADD CONSTRAINT reservations_future_check 
CHECK (start_time <= CURRENT_TIMESTAMP + INTERVAL '1 year');

-- Email format constraint for users
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_email_format_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_email_format_check 
CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Room capacity constraints
ALTER TABLE public.rooms 
DROP CONSTRAINT IF EXISTS rooms_capacity_range_check;

ALTER TABLE public.rooms 
ADD CONSTRAINT rooms_capacity_range_check 
CHECK (capacity > 0 AND capacity <= 1000);

-- =============================================================================
-- REPLACE EXISTING TRIGGERS WITH ENHANCED VERSIONS
-- =============================================================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS validate_reservation_user_id ON public.reservations;

-- Create enhanced validation and audit triggers for reservations
CREATE TRIGGER validate_reservation_enhanced
    BEFORE INSERT OR UPDATE ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION validate_reservation_with_audit();

CREATE TRIGGER audit_reservations
    AFTER INSERT OR UPDATE OR DELETE ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Create validation and audit triggers for users
CREATE TRIGGER validate_user_enhanced
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION validate_user_with_audit();

CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Create validation and audit triggers for rooms
CREATE TRIGGER validate_room_enhanced
    BEFORE INSERT OR UPDATE ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION validate_room_with_audit();

CREATE TRIGGER audit_rooms
    AFTER INSERT OR UPDATE OR DELETE ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- =============================================================================
-- DATA INTEGRITY MONITORING FUNCTIONS
-- =============================================================================

-- Enhanced data integrity check function
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT,
    severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check 1: User ID consistency in reservations
    RETURN QUERY
    SELECT 
        'User ID Consistency'::TEXT as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END as status,
        CASE 
            WHEN COUNT(*) = 0 THEN 'All reservations have valid user_id references'::TEXT
            ELSE FORMAT('%s reservations have invalid user_id references', COUNT(*))::TEXT
        END as details,
        'CRITICAL'::TEXT as severity
    FROM public.reservations r
    LEFT JOIN public.users u ON r.user_id = u.id
    WHERE u.id IS NULL;
    
    -- Check 2: Auth ID confusion detection
    RETURN QUERY
    SELECT 
        'Auth ID Confusion'::TEXT as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END as status,
        CASE 
            WHEN COUNT(*) = 0 THEN 'No auth_id confusion detected'::TEXT
            ELSE FORMAT('%s reservations may be using auth_id instead of user_id', COUNT(*))::TEXT
        END as details,
        'HIGH'::TEXT as severity
    FROM public.reservations r
    INNER JOIN public.users u ON r.user_id = u.auth_id
    WHERE r.user_id != u.id;
    
    -- Check 3: UUID format validation
    RETURN QUERY
    SELECT 
        'UUID Format Validation'::TEXT as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END as status,
        CASE 
            WHEN COUNT(*) = 0 THEN 'All UUIDs have valid format'::TEXT
            ELSE FORMAT('%s records have invalid UUID format', COUNT(*))::TEXT
        END as details,
        'MEDIUM'::TEXT as severity
    FROM (
        SELECT id FROM public.users WHERE id::TEXT !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        UNION ALL
        SELECT id FROM public.rooms WHERE id::TEXT !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        UNION ALL
        SELECT id FROM public.reservations WHERE id::TEXT !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) invalid_uuids;
    
    -- Check 4: Foreign key integrity
    RETURN QUERY
    SELECT 
        'Foreign Key Integrity'::TEXT as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END as status,
        CASE 
            WHEN COUNT(*) = 0 THEN 'All foreign key references are valid'::TEXT
            ELSE FORMAT('%s records have broken foreign key references', COUNT(*))::TEXT
        END as details,
        'CRITICAL'::TEXT as severity
    FROM (
        SELECT r.id FROM public.reservations r
        LEFT JOIN public.rooms rm ON r.room_id = rm.id
        WHERE rm.id IS NULL
    ) broken_fks;
    
    -- Check 5: Business logic constraints
    RETURN QUERY
    SELECT 
        'Business Logic Constraints'::TEXT as check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'::TEXT
            ELSE 'FAIL'::TEXT
        END as status,
        CASE 
            WHEN COUNT(*) = 0 THEN 'All business logic constraints are satisfied'::TEXT
            ELSE FORMAT('%s records violate business logic constraints', COUNT(*))::TEXT
        END as details,
        'MEDIUM'::TEXT as severity
    FROM (
        SELECT id FROM public.reservations WHERE start_time >= end_time
        UNION ALL
        SELECT id FROM public.reservations WHERE end_time - start_time < INTERVAL '15 minutes'
        UNION ALL
        SELECT id FROM public.reservations WHERE end_time - start_time > INTERVAL '8 hours'
        UNION ALL
        SELECT id FROM public.rooms WHERE capacity <= 0 OR capacity > 1000
        UNION ALL
        SELECT id FROM public.users WHERE TRIM(name) = '' OR email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ) constraint_violations;
END;
$$;

-- Function to get audit log summary
CREATE OR REPLACE FUNCTION get_audit_summary(
    start_date TIMESTAMPTZ DEFAULT CURRENT_DATE - INTERVAL '7 days',
    end_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
)
RETURNS TABLE (
    table_name TEXT,
    operation TEXT,
    count BIGINT,
    unique_users BIGINT,
    latest_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.table_name,
        al.operation,
        COUNT(*) as count,
        COUNT(DISTINCT al.user_id) as unique_users,
        MAX(al.performed_at) as latest_activity
    FROM public.audit_log al
    WHERE al.performed_at BETWEEN start_date AND end_date
    GROUP BY al.table_name, al.operation
    ORDER BY al.table_name, al.operation;
END;
$$;

-- =============================================================================
-- ENHANCED MONITORING VIEWS
-- =============================================================================

-- Enhanced health monitoring view
CREATE OR REPLACE VIEW enhanced_data_integrity_health AS
SELECT 
    check_name,
    status,
    details,
    severity,
    CURRENT_TIMESTAMP as checked_at
FROM check_data_integrity();

-- Audit activity summary view
CREATE OR REPLACE VIEW audit_activity_summary AS
SELECT 
    table_name,
    operation,
    count,
    unique_users,
    latest_activity
FROM get_audit_summary();

-- =============================================================================
-- PERMISSIONS AND SECURITY
-- =============================================================================

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION validate_uuid_format(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_user_id_with_context(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_data_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Grant access to new views
GRANT SELECT ON enhanced_data_integrity_health TO authenticated;
GRANT SELECT ON audit_activity_summary TO authenticated;

-- Restrict audit log access to admin users only
CREATE POLICY audit_log_admin_only ON public.audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE auth_id = auth.uid() AND role = 'admin'
        )
    );

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

-- Table comments
COMMENT ON TABLE public.audit_log IS 'Comprehensive audit log for all data modifications with user context and metadata';

-- Function comments
COMMENT ON FUNCTION validate_uuid_format IS 'Validates UUID format with comprehensive checks including reserved values';
COMMENT ON FUNCTION validate_user_id_with_context IS 'Enhanced user ID validation with detailed error context and auth_id confusion detection';
COMMENT ON FUNCTION audit_trigger_function IS 'Generic audit logging trigger function for all tables with user context';
COMMENT ON FUNCTION validate_reservation_with_audit IS 'Enhanced reservation validation with comprehensive business logic checks';
COMMENT ON FUNCTION validate_user_with_audit IS 'Enhanced user validation with email format and business logic checks';
COMMENT ON FUNCTION validate_room_with_audit IS 'Enhanced room validation with capacity and name checks';
COMMENT ON FUNCTION check_data_integrity IS 'Comprehensive data integrity check function returning detailed status';
COMMENT ON FUNCTION get_audit_summary IS 'Returns audit activity summary for specified date range';

-- View comments
COMMENT ON VIEW enhanced_data_integrity_health IS 'Real-time data integrity health monitoring with detailed status';
COMMENT ON VIEW audit_activity_summary IS 'Summary of recent audit activity across all tables';

-- Constraint comments
COMMENT ON CONSTRAINT reservations_prevent_auth_id_confusion ON public.reservations IS 
'Prevents reservations from using auth_id values as user_id';
COMMENT ON CONSTRAINT reservations_duration_check ON public.reservations IS 
'Ensures reservation duration is between 15 minutes and 8 hours';
COMMENT ON CONSTRAINT reservations_future_check ON public.reservations IS 
'Prevents reservations more than 1 year in the future';
COMMENT ON CONSTRAINT users_email_format_check ON public.users IS 
'Validates email format using regex pattern';
COMMENT ON CONSTRAINT rooms_capacity_range_check ON public.rooms IS 
'Ensures room capacity is between 1 and 1000';

-- =============================================================================
-- MIGRATION COMPLETION LOG
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== Enhanced Database Constraints and Triggers Migration Complete ===';
    RAISE NOTICE 'Added Features:';
    RAISE NOTICE '- Comprehensive audit logging for all table operations';
    RAISE NOTICE '- Enhanced UUID format validation with reserved value checks';
    RAISE NOTICE '- Improved foreign key constraints with proper cascade rules';
    RAISE NOTICE '- Business logic validation triggers for all tables';
    RAISE NOTICE '- Data integrity monitoring functions and views';
    RAISE NOTICE '- Auth ID confusion prevention constraints';
    RAISE NOTICE '- Email format validation and capacity range checks';
    RAISE NOTICE '- Admin-only audit log access with RLS';
    RAISE NOTICE '================================================================';
END $$;