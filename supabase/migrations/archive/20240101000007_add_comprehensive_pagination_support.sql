-- Add Comprehensive Pagination Support
-- Enhanced RPC functions with standardized pagination
-- Requirements: 3.4

-- ============================================================================
-- ENHANCED PAGINATION FUNCTIONS FOR RESERVATIONS
-- ============================================================================

-- Drop existing pagination functions if they exist
DROP FUNCTION IF EXISTS get_public_reservations_paginated(text, text, integer, integer);
DROP FUNCTION IF EXISTS get_public_reservations_anonymous_paginated(text, text, integer, integer);

-- Enhanced paginated public reservations for authenticated users
CREATE OR REPLACE FUNCTION get_public_reservations_paginated(
  start_date text,
  end_date text,
  page_limit integer DEFAULT 20,
  page_offset integer DEFAULT 0,
  sort_by text DEFAULT 'start_time',
  sort_order text DEFAULT 'asc',
  search_query text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  room_id uuid,
  user_id uuid,
  title text,
  purpose text,
  department text,
  user_name text,
  start_time timestamptz,
  end_time timestamptz,
  is_mine boolean,
  total_count bigint,
  has_more boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  total_records bigint;
  query_text text;
  sort_clause text;
BEGIN
  -- Get current user's database ID
  SELECT u.id INTO current_user_id
  FROM users u
  WHERE u.auth_id = auth.uid();

  -- Build sort clause with validation
  CASE sort_by
    WHEN 'start_time' THEN sort_clause := 'r.start_time';
    WHEN 'end_time' THEN sort_clause := 'r.end_time';
    WHEN 'title' THEN sort_clause := 'r.title';
    WHEN 'created_at' THEN sort_clause := 'r.created_at';
    ELSE sort_clause := 'r.start_time';
  END CASE;

  -- Validate sort order
  IF sort_order NOT IN ('asc', 'desc') THEN
    sort_order := 'asc';
  END IF;

  sort_clause := sort_clause || ' ' || sort_order;

  -- Get total count first
  query_text := '
    SELECT COUNT(*)
    FROM reservations r
    INNER JOIN users u ON r.user_id = u.id
    INNER JOIN rooms rm ON r.room_id = rm.id
    WHERE r.status = ''confirmed''
      AND r.start_time >= $1::timestamptz
      AND r.end_time <= $2::timestamptz
      AND rm.is_active = true';

  -- Add search filter if provided
  IF search_query IS NOT NULL AND search_query != '' THEN
    query_text := query_text || '
      AND (r.title ILIKE $7 OR r.purpose ILIKE $7 OR u.department ILIKE $7)';
  END IF;

  -- Execute count query
  IF search_query IS NOT NULL AND search_query != '' THEN
    EXECUTE query_text USING start_date::timestamptz, end_date::timestamptz, page_limit, page_offset, sort_clause, current_user_id, '%' || search_query || '%' INTO total_records;
  ELSE
    EXECUTE query_text USING start_date::timestamptz, end_date::timestamptz, page_limit, page_offset, sort_clause, current_user_id INTO total_records;
  END IF;

  -- Return paginated results
  RETURN QUERY
  SELECT 
    r.id,
    r.room_id,
    r.user_id,
    CASE 
      WHEN r.user_id = current_user_id THEN r.title
      ELSE 'Booked'
    END as title,
    CASE 
      WHEN r.user_id = current_user_id THEN r.purpose
      ELSE NULL
    END as purpose,
    u.department,
    u.name as user_name,
    r.start_time,
    r.end_time,
    (r.user_id = current_user_id) as is_mine,
    total_records as total_count,
    (page_offset + page_limit < total_records) as has_more
  FROM reservations r
  INNER JOIN users u ON r.user_id = u.id
  INNER JOIN rooms rm ON r.room_id = rm.id
  WHERE r.status = 'confirmed'
    AND r.start_time >= start_date::timestamptz
    AND r.end_time <= end_date::timestamptz
    AND rm.is_active = true
    AND (
      search_query IS NULL 
      OR search_query = '' 
      OR r.title ILIKE '%' || search_query || '%'
      OR r.purpose ILIKE '%' || search_query || '%'
      OR u.department ILIKE '%' || search_query || '%'
    )
  ORDER BY 
    CASE WHEN sort_by = 'start_time' AND sort_order = 'asc' THEN r.start_time END ASC,
    CASE WHEN sort_by = 'start_time' AND sort_order = 'desc' THEN r.start_time END DESC,
    CASE WHEN sort_by = 'end_time' AND sort_order = 'asc' THEN r.end_time END ASC,
    CASE WHEN sort_by = 'end_time' AND sort_order = 'desc' THEN r.end_time END DESC,
    CASE WHEN sort_by = 'title' AND sort_order = 'asc' THEN r.title END ASC,
    CASE WHEN sort_by = 'title' AND sort_order = 'desc' THEN r.title END DESC,
    CASE WHEN sort_by = 'created_at' AND sort_order = 'asc' THEN r.created_at END ASC,
    CASE WHEN sort_by = 'created_at' AND sort_order = 'desc' THEN r.created_at END DESC,
    r.start_time ASC -- Default fallback
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- Enhanced paginated public reservations for anonymous users
CREATE OR REPLACE FUNCTION get_public_reservations_anonymous_paginated(
  start_date text,
  end_date text,
  page_limit integer DEFAULT 20,
  page_offset integer DEFAULT 0,
  sort_by text DEFAULT 'start_time',
  sort_order text DEFAULT 'asc',
  search_query text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  room_id uuid,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  room_name text,
  is_mine boolean,
  total_count bigint,
  has_more boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_records bigint;
  sort_clause text;
BEGIN
  -- Build sort clause with validation
  CASE sort_by
    WHEN 'start_time' THEN sort_clause := 'r.start_time';
    WHEN 'end_time' THEN sort_clause := 'r.end_time';
    WHEN 'created_at' THEN sort_clause := 'r.created_at';
    ELSE sort_clause := 'r.start_time';
  END CASE;

  -- Validate sort order
  IF sort_order NOT IN ('asc', 'desc') THEN
    sort_order := 'asc';
  END IF;

  -- Get total count first
  SELECT COUNT(*)
  INTO total_records
  FROM reservations r
  INNER JOIN rooms rm ON r.room_id = rm.id
  WHERE r.status = 'confirmed'
    AND r.start_time >= start_date::timestamptz
    AND r.end_time <= end_date::timestamptz
    AND rm.is_active = true
    AND (
      search_query IS NULL 
      OR search_query = '' 
      OR r.title ILIKE '%' || search_query || '%'
    );

  -- Return paginated results (minimal info for anonymous users)
  RETURN QUERY
  SELECT 
    r.id,
    r.room_id,
    'Booked'::text as title, -- All reservations masked as 'Booked'
    r.start_time,
    r.end_time,
    rm.name as room_name,
    false as is_mine, -- Anonymous users never own reservations
    total_records as total_count,
    (page_offset + page_limit < total_records) as has_more
  FROM reservations r
  INNER JOIN rooms rm ON r.room_id = rm.id
  WHERE r.status = 'confirmed'
    AND r.start_time >= start_date::timestamptz
    AND r.end_time <= end_date::timestamptz
    AND rm.is_active = true
    AND (
      search_query IS NULL 
      OR search_query = '' 
      OR r.title ILIKE '%' || search_query || '%'
    )
  ORDER BY 
    CASE WHEN sort_by = 'start_time' AND sort_order = 'asc' THEN r.start_time END ASC,
    CASE WHEN sort_by = 'start_time' AND sort_order = 'desc' THEN r.start_time END DESC,
    CASE WHEN sort_by = 'end_time' AND sort_order = 'asc' THEN r.end_time END ASC,
    CASE WHEN sort_by = 'end_time' AND sort_order = 'desc' THEN r.end_time END DESC,
    CASE WHEN sort_by = 'created_at' AND sort_order = 'asc' THEN r.created_at END ASC,
    CASE WHEN sort_by = 'created_at' AND sort_order = 'desc' THEN r.created_at END DESC,
    r.start_time ASC -- Default fallback
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- ============================================================================
-- PAGINATION FUNCTIONS FOR ROOMS
-- ============================================================================

-- Paginated rooms function
CREATE OR REPLACE FUNCTION get_rooms_paginated(
  page_limit integer DEFAULT 50,
  page_offset integer DEFAULT 0,
  sort_by text DEFAULT 'name',
  sort_order text DEFAULT 'asc',
  search_query text DEFAULT NULL,
  include_inactive boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  capacity integer,
  location text,
  amenities jsonb,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint,
  has_more boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_records bigint;
BEGIN
  -- Get total count first
  SELECT COUNT(*)
  INTO total_records
  FROM rooms r
  WHERE (include_inactive OR r.is_active = true)
    AND (
      search_query IS NULL 
      OR search_query = '' 
      OR r.name ILIKE '%' || search_query || '%'
      OR r.description ILIKE '%' || search_query || '%'
      OR r.location ILIKE '%' || search_query || '%'
    );

  -- Return paginated results
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.description,
    r.capacity,
    r.location,
    r.amenities,
    r.is_active,
    r.created_at,
    r.updated_at,
    total_records as total_count,
    (page_offset + page_limit < total_records) as has_more
  FROM rooms r
  WHERE (include_inactive OR r.is_active = true)
    AND (
      search_query IS NULL 
      OR search_query = '' 
      OR r.name ILIKE '%' || search_query || '%'
      OR r.description ILIKE '%' || search_query || '%'
      OR r.location ILIKE '%' || search_query || '%'
    )
  ORDER BY 
    CASE WHEN sort_by = 'name' AND sort_order = 'asc' THEN r.name END ASC,
    CASE WHEN sort_by = 'name' AND sort_order = 'desc' THEN r.name END DESC,
    CASE WHEN sort_by = 'capacity' AND sort_order = 'asc' THEN r.capacity END ASC,
    CASE WHEN sort_by = 'capacity' AND sort_order = 'desc' THEN r.capacity END DESC,
    CASE WHEN sort_by = 'created_at' AND sort_order = 'asc' THEN r.created_at END ASC,
    CASE WHEN sort_by = 'created_at' AND sort_order = 'desc' THEN r.created_at END DESC,
    r.name ASC -- Default fallback
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- ============================================================================
-- PAGINATION FUNCTIONS FOR USERS (ADMIN ONLY)
-- ============================================================================

-- Paginated users function (admin only)
CREATE OR REPLACE FUNCTION get_users_paginated(
  page_limit integer DEFAULT 25,
  page_offset integer DEFAULT 0,
  sort_by text DEFAULT 'name',
  sort_order text DEFAULT 'asc',
  search_query text DEFAULT NULL,
  include_inactive boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  auth_id uuid,
  employee_id text,
  name text,
  email text,
  department text,
  role text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint,
  has_more boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_records bigint;
  current_user_role text;
BEGIN
  -- Check if current user is admin
  SELECT u.role INTO current_user_role
  FROM users u
  WHERE u.auth_id = auth.uid();

  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Get total count first
  SELECT COUNT(*)
  INTO total_records
  FROM users u
  WHERE (include_inactive OR u.is_active = true)
    AND (
      search_query IS NULL 
      OR search_query = '' 
      OR u.name ILIKE '%' || search_query || '%'
      OR u.email ILIKE '%' || search_query || '%'
      OR u.department ILIKE '%' || search_query || '%'
      OR u.employee_id ILIKE '%' || search_query || '%'
    );

  -- Return paginated results
  RETURN QUERY
  SELECT 
    u.id,
    u.auth_id,
    u.employee_id,
    u.name,
    u.email,
    u.department,
    u.role,
    u.is_active,
    u.created_at,
    u.updated_at,
    total_records as total_count,
    (page_offset + page_limit < total_records) as has_more
  FROM users u
  WHERE (include_inactive OR u.is_active = true)
    AND (
      search_query IS NULL 
      OR search_query = '' 
      OR u.name ILIKE '%' || search_query || '%'
      OR u.email ILIKE '%' || search_query || '%'
      OR u.department ILIKE '%' || search_query || '%'
      OR u.employee_id ILIKE '%' || search_query || '%'
    )
  ORDER BY 
    CASE WHEN sort_by = 'name' AND sort_order = 'asc' THEN u.name END ASC,
    CASE WHEN sort_by = 'name' AND sort_order = 'desc' THEN u.name END DESC,
    CASE WHEN sort_by = 'email' AND sort_order = 'asc' THEN u.email END ASC,
    CASE WHEN sort_by = 'email' AND sort_order = 'desc' THEN u.email END DESC,
    CASE WHEN sort_by = 'department' AND sort_order = 'asc' THEN u.department END ASC,
    CASE WHEN sort_by = 'department' AND sort_order = 'desc' THEN u.department END DESC,
    CASE WHEN sort_by = 'created_at' AND sort_order = 'asc' THEN u.created_at END ASC,
    CASE WHEN sort_by = 'created_at' AND sort_order = 'desc' THEN u.created_at END DESC,
    u.name ASC -- Default fallback
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ============================================================================

-- Indexes for efficient pagination on reservations
CREATE INDEX IF NOT EXISTS idx_reservations_pagination_auth 
ON reservations (status, start_time, end_time, user_id) 
WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_reservations_pagination_anon 
ON reservations (status, start_time, end_time) 
WHERE status = 'confirmed';

-- Indexes for efficient pagination on rooms
CREATE INDEX IF NOT EXISTS idx_rooms_pagination 
ON rooms (is_active, name, created_at);

-- Indexes for efficient pagination on users
CREATE INDEX IF NOT EXISTS idx_users_pagination 
ON users (is_active, name, email, department, created_at);

-- Text search indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_reservations_text_search 
ON reservations USING gin(to_tsvector('english', title || ' ' || COALESCE(purpose, '')));

CREATE INDEX IF NOT EXISTS idx_rooms_text_search 
ON rooms USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(location, '')));

CREATE INDEX IF NOT EXISTS idx_users_text_search 
ON users USING gin(to_tsvector('english', name || ' ' || email || ' ' || department || ' ' || COALESCE(employee_id, '')));

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_public_reservations_paginated TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_reservations_anonymous_paginated TO anon;
GRANT EXECUTE ON FUNCTION get_rooms_paginated TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_users_paginated TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_public_reservations_paginated IS 'Enhanced paginated public reservations for authenticated users with search and sorting';
COMMENT ON FUNCTION get_public_reservations_anonymous_paginated IS 'Enhanced paginated public reservations for anonymous users with limited data';
COMMENT ON FUNCTION get_rooms_paginated IS 'Paginated rooms listing with search and sorting capabilities';
COMMENT ON FUNCTION get_users_paginated IS 'Paginated users listing for admin users with search and sorting';