-- Data Integrity Validation Queries
-- SQL queries to check user_id references and data consistency
-- Requirements: 4.1, 4.2

-- ============================================================================
-- 1. RESERVATION USER ID VALIDATION
-- ============================================================================

-- Check for reservations with user_id that don't exist in users table
-- This identifies orphaned reservations
SELECT 
    'Orphaned Reservations' as check_type,
    r.id as reservation_id,
    r.user_id,
    r.title,
    r.start_time,
    r.created_at,
    'user_id does not exist in users table' as issue
FROM reservations r
LEFT JOIN users u ON r.user_id = u.id
WHERE u.id IS NULL
ORDER BY r.created_at DESC;

-- Check for reservations where user_id might be auth_id instead of database id
-- This identifies potential auth_id/dbId confusion
SELECT 
    'Potential Auth ID Confusion' as check_type,
    r.id as reservation_id,
    r.user_id as current_user_id,
    u.id as correct_user_id,
    u.auth_id,
    u.name as user_name,
    u.email,
    r.title,
    r.start_time,
    'user_id appears to be auth_id instead of database id' as issue
FROM reservations r
INNER JOIN users u ON r.user_id = u.auth_id
WHERE r.user_id != u.id
ORDER BY r.created_at DESC;

-- Count reservations by user ID type to identify patterns
SELECT 
    'User ID Type Analysis' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE id = r.user_id) THEN 'Valid Database ID'
        WHEN EXISTS (SELECT 1 FROM users WHERE auth_id = r.user_id) THEN 'Auth ID (Incorrect)'
        ELSE 'Invalid/Unknown ID'
    END as id_type,
    COUNT(*) as reservation_count
FROM reservations r
GROUP BY 
    CASE 
        WHEN EXISTS (SELECT 1 FROM users WHERE id = r.user_id) THEN 'Valid Database ID'
        WHEN EXISTS (SELECT 1 FROM users WHERE auth_id = r.user_id) THEN 'Auth ID (Incorrect)'
        ELSE 'Invalid/Unknown ID'
    END
ORDER BY reservation_count DESC;

-- ============================================================================
-- 2. USER DATA CONSISTENCY VALIDATION
-- ============================================================================

-- Check for users without auth_id (orphaned users)
SELECT 
    'Orphaned Users' as check_type,
    id as user_id,
    name,
    email,
    department,
    created_at,
    'user has no auth_id connection' as issue
FROM users
WHERE auth_id IS NULL
ORDER BY created_at DESC;

-- Check for duplicate auth_id values
SELECT 
    'Duplicate Auth IDs' as check_type,
    auth_id,
    COUNT(*) as user_count,
    STRING_AGG(name || ' (' || email || ')', ', ') as affected_users,
    'multiple users share same auth_id' as issue
FROM users
WHERE auth_id IS NOT NULL
GROUP BY auth_id
HAVING COUNT(*) > 1
ORDER BY user_count DESC;

-- Check for duplicate email addresses
SELECT 
    'Duplicate Emails' as check_type,
    email,
    COUNT(*) as user_count,
    STRING_AGG(name || ' (ID: ' || id || ')', ', ') as affected_users,
    'multiple users share same email' as issue
FROM users
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY user_count DESC;

-- Check for users with missing required fields
SELECT 
    'Incomplete User Data' as check_type,
    id as user_id,
    name,
    email,
    CASE 
        WHEN name IS NULL OR name = '' THEN 'Missing name'
        WHEN email IS NULL OR email = '' THEN 'Missing email'
        WHEN department IS NULL OR department = '' THEN 'Missing department'
        WHEN auth_id IS NULL THEN 'Missing auth_id'
        ELSE 'Other issue'
    END as issue
FROM users
WHERE 
    name IS NULL OR name = '' OR
    email IS NULL OR email = '' OR
    department IS NULL OR department = '' OR
    auth_id IS NULL
ORDER BY created_at DESC;

-- ============================================================================
-- 3. FOREIGN KEY RELATIONSHIP VALIDATION
-- ============================================================================

-- Validate all reservation foreign key relationships
SELECT 
    'Foreign Key Validation' as check_type,
    r.id as reservation_id,
    r.title,
    r.start_time,
    CASE 
        WHEN u.id IS NULL THEN 'Invalid user_id: ' || r.user_id
        WHEN rm.id IS NULL THEN 'Invalid room_id: ' || r.room_id
        ELSE 'Valid relationships'
    END as issue
FROM reservations r
LEFT JOIN users u ON r.user_id = u.id
LEFT JOIN rooms rm ON r.room_id = rm.id
WHERE u.id IS NULL OR rm.id IS NULL
ORDER BY r.created_at DESC;

-- ============================================================================
-- 4. DATA INTEGRITY SUMMARY REPORT
-- ============================================================================

-- Generate summary statistics for data integrity
WITH integrity_stats AS (
    SELECT 
        'Total Users' as metric,
        COUNT(*)::text as value,
        'users in database' as description
    FROM users
    
    UNION ALL
    
    SELECT 
        'Users with Auth ID' as metric,
        COUNT(*)::text as value,
        'users properly connected to auth' as description
    FROM users
    WHERE auth_id IS NOT NULL
    
    UNION ALL
    
    SELECT 
        'Total Reservations' as metric,
        COUNT(*)::text as value,
        'reservations in database' as description
    FROM reservations
    
    UNION ALL
    
    SELECT 
        'Valid Reservation User IDs' as metric,
        COUNT(*)::text as value,
        'reservations with valid user_id references' as description
    FROM reservations r
    INNER JOIN users u ON r.user_id = u.id
    
    UNION ALL
    
    SELECT 
        'Orphaned Reservations' as metric,
        COUNT(*)::text as value,
        'reservations with invalid user_id' as description
    FROM reservations r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE u.id IS NULL
    
    UNION ALL
    
    SELECT 
        'Auth ID Confusion Cases' as metric,
        COUNT(*)::text as value,
        'reservations possibly using auth_id instead of db id' as description
    FROM reservations r
    INNER JOIN users u ON r.user_id = u.auth_id
    WHERE r.user_id != u.id
)
SELECT 
    '=== DATA INTEGRITY SUMMARY ===' as report_section,
    '' as metric,
    '' as value,
    'Generated: ' || NOW()::text as description

UNION ALL

SELECT 
    '' as report_section,
    metric,
    value,
    description
FROM integrity_stats

UNION ALL

SELECT 
    '=== RECOMMENDATIONS ===' as report_section,
    '' as metric,
    '' as value,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM reservations r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE u.id IS NULL
        ) THEN 'Run user ID repair script to fix orphaned reservations'
        WHEN EXISTS (
            SELECT 1 FROM reservations r
            INNER JOIN users u ON r.user_id = u.auth_id
            WHERE r.user_id != u.id
        ) THEN 'Fix auth_id/database_id confusion in reservations'
        ELSE 'Data integrity appears good - no major issues detected'
    END as description;

-- ============================================================================
-- 5. HELPER FUNCTIONS FOR DATA REPAIR
-- ============================================================================

-- Function to identify correct user_id for a given auth_id
-- Usage: SELECT get_correct_user_id('auth-id-here');
CREATE OR REPLACE FUNCTION get_correct_user_id(input_auth_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
    correct_id UUID;
BEGIN
    SELECT id INTO correct_id
    FROM users
    WHERE auth_id = input_auth_id;
    
    RETURN correct_id;
END;
$;

-- Function to validate if a user_id is correct (references users.id not auth_id)
-- Usage: SELECT is_valid_user_id('user-id-here');
CREATE OR REPLACE FUNCTION is_valid_user_id(input_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
    is_valid BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM users WHERE id = input_user_id
    ) INTO is_valid;
    
    RETURN is_valid;
END;
$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_correct_user_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_valid_user_id(UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION get_correct_user_id IS 
'Returns the correct database user ID for a given auth_id. Used for data integrity repairs.';

COMMENT ON FUNCTION is_valid_user_id IS 
'Validates if a user_id correctly references the users table primary key (not auth_id).';