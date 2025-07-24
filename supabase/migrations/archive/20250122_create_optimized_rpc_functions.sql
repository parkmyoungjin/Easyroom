-- Create optimized RPC functions for complex queries
-- This migration adds performance-optimized database functions

-- Function to get reservation statistics with aggregated data
CREATE OR REPLACE FUNCTION get_reservation_statistics(
  start_date DATE,
  end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH room_stats AS (
    SELECT 
      r.id as room_id,
      r.name as room_name,
      COUNT(res.id) as reservation_count,
      AVG(EXTRACT(EPOCH FROM (res.end_time - res.start_time))/3600) as avg_duration_hours
    FROM rooms r
    LEFT JOIN reservations res ON r.id = res.room_id 
      AND res.start_time::date BETWEEN start_date AND end_date
      AND res.status = 'confirmed'
    GROUP BY r.id, r.name
  ),
  time_stats AS (
    SELECT 
      EXTRACT(HOUR FROM start_time) as hour,
      COUNT(*) as reservation_count
    FROM reservations
    WHERE start_time::date BETWEEN start_date AND end_date
      AND status = 'confirmed'
    GROUP BY EXTRACT(HOUR FROM start_time)
    ORDER BY hour
  ),
  dept_stats AS (
    SELECT 
      u.department,
      COUNT(res.id) as reservation_count
    FROM users u
    JOIN reservations res ON u.id = res.user_id
    WHERE res.start_time::date BETWEEN start_date AND end_date
      AND res.status = 'confirmed'
      AND u.department IS NOT NULL
    GROUP BY u.department
  ),
  cancel_stats AS (
    SELECT 
      COALESCE(cancellation_reason, '사유 없음') as reason,
      COUNT(*) as count
    FROM reservations
    WHERE start_time::date BETWEEN start_date AND end_date
      AND status = 'cancelled'
    GROUP BY cancellation_reason
  )
  SELECT json_build_object(
    'room_stats', (SELECT json_agg(row_to_json(room_stats)) FROM room_stats),
    'time_stats', (SELECT json_agg(row_to_json(time_stats)) FROM time_stats),
    'dept_stats', (SELECT json_agg(row_to_json(dept_stats)) FROM dept_stats),
    'cancel_stats', (SELECT json_agg(row_to_json(cancel_stats)) FROM cancel_stats),
    'summary', json_build_object(
      'total_reservations', (
        SELECT COUNT(*) FROM reservations 
        WHERE start_time::date BETWEEN start_date AND end_date 
          AND status = 'confirmed'
      ),
      'total_cancelled', (
        SELECT COUNT(*) FROM reservations 
        WHERE start_time::date BETWEEN start_date AND end_date 
          AND status = 'cancelled'
      ),
      'cancellation_rate', (
        SELECT ROUND(
          (COUNT(*) FILTER (WHERE status = 'cancelled')::numeric / 
           NULLIF(COUNT(*), 0) * 100), 2
        )
        FROM reservations 
        WHERE start_time::date BETWEEN start_date AND end_date
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to get room availability with conflict details
CREATE OR REPLACE FUNCTION get_room_availability_detailed(
  room_id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH conflicts AS (
    SELECT 
      res.id,
      res.title,
      res.start_time,
      res.end_time,
      u.name as user_name,
      u.department
    FROM reservations res
    JOIN users u ON res.user_id = u.id
    WHERE res.room_id = get_room_availability_detailed.room_id
      AND res.status = 'confirmed'
      AND (
        res.start_time < get_room_availability_detailed.end_time AND 
        res.end_time > get_room_availability_detailed.start_time
      )
  )
  SELECT json_build_object(
    'available', (SELECT COUNT(*) = 0 FROM conflicts),
    'conflicts', (SELECT COALESCE(json_agg(row_to_json(conflicts)), '[]'::json) FROM conflicts),
    'room_info', (
      SELECT row_to_json(r) FROM (
        SELECT id, name, capacity, location, amenities 
        FROM rooms 
        WHERE id = get_room_availability_detailed.room_id
      ) r
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to get user reservations with room details (optimized)
CREATE OR REPLACE FUNCTION get_user_reservations_detailed(
  user_id UUID,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH user_reservations AS (
    SELECT 
      res.*,
      r.name as room_name,
      r.location as room_location,
      r.capacity as room_capacity
    FROM reservations res
    JOIN rooms r ON res.room_id = r.id
    WHERE res.user_id = get_user_reservations_detailed.user_id
    ORDER BY res.start_time DESC
    LIMIT limit_count
    OFFSET offset_count
  ),
  total_count AS (
    SELECT COUNT(*) as count
    FROM reservations
    WHERE user_id = get_user_reservations_detailed.user_id
  )
  SELECT json_build_object(
    'data', (SELECT COALESCE(json_agg(row_to_json(user_reservations)), '[]'::json) FROM user_reservations),
    'pagination', json_build_object(
      'total_count', (SELECT count FROM total_count),
      'limit', limit_count,
      'offset', offset_count,
      'has_more', (SELECT count > (offset_count + limit_count) FROM total_count)
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to search rooms with advanced filtering
CREATE OR REPLACE FUNCTION search_rooms_advanced(
  search_query TEXT DEFAULT '',
  min_capacity INTEGER DEFAULT 0,
  required_amenities TEXT[] DEFAULT '{}',
  available_from TIMESTAMPTZ DEFAULT NULL,
  available_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH filtered_rooms AS (
    SELECT DISTINCT r.*
    FROM rooms r
    WHERE r.is_active = true
      AND (search_query = '' OR (
        r.name ILIKE '%' || search_query || '%' OR 
        r.location ILIKE '%' || search_query || '%' OR
        r.description ILIKE '%' || search_query || '%'
      ))
      AND r.capacity >= min_capacity
      AND (
        array_length(required_amenities, 1) IS NULL OR
        r.amenities ?& required_amenities
      )
      AND (
        available_from IS NULL OR available_to IS NULL OR
        NOT EXISTS (
          SELECT 1 FROM reservations res
          WHERE res.room_id = r.id
            AND res.status = 'confirmed'
            AND res.start_time < available_to
            AND res.end_time > available_from
        )
      )
    ORDER BY r.name
  )
  SELECT json_build_object(
    'data', (SELECT COALESCE(json_agg(row_to_json(filtered_rooms)), '[]'::json) FROM filtered_rooms),
    'count', (SELECT COUNT(*) FROM filtered_rooms)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_reservation_statistics(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_availability_detailed(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_reservations_detailed(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_rooms_advanced(TEXT, INTEGER, TEXT[], TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reservations_user_start_time ON reservations(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_room_time_status ON reservations(room_id, start_time, end_time, status);
CREATE INDEX IF NOT EXISTS idx_reservations_date_status ON reservations(start_time::date, status);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department) WHERE department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_search ON rooms USING gin(to_tsvector('english', name || ' ' || COALESCE(location, '') || ' ' || COALESCE(description, ''))) WHERE is_active = true;