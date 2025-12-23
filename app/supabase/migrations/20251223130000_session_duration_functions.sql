-- Session Duration Functions Migration
-- Story 16-6: Session Duration Calculation
-- Creates database functions for efficient duration aggregations

-- ============================================
-- HELPER FUNCTION: Calculate session duration
-- ============================================
-- Returns duration in minutes, capping at 24 hours for stale sessions

CREATE OR REPLACE FUNCTION calculate_session_duration_minutes(
  p_started_at TIMESTAMPTZ,
  p_ended_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_end_time TIMESTAMPTZ;
  v_duration_minutes INTEGER;
  v_max_minutes INTEGER := 24 * 60; -- 24 hours
BEGIN
  -- Use current time if session is still active
  v_end_time := COALESCE(p_ended_at, NOW());

  -- Calculate duration in minutes
  v_duration_minutes := EXTRACT(EPOCH FROM (v_end_time - p_started_at)) / 60;

  -- Cap at maximum to exclude stale sessions
  IF v_duration_minutes > v_max_minutes THEN
    v_duration_minutes := v_max_minutes;
  END IF;

  -- Ensure non-negative
  IF v_duration_minutes < 0 THEN
    v_duration_minutes := 0;
  END IF;

  RETURN v_duration_minutes;
END;
$$;

COMMENT ON FUNCTION calculate_session_duration_minutes IS
  'Calculates session duration in minutes, using current time for active sessions and capping at 24 hours';

-- ============================================
-- FUNCTION: Get session duration by day
-- ============================================
-- Aggregates session durations by day for a user

CREATE OR REPLACE FUNCTION get_session_duration_by_day(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  day DATE,
  total_minutes INTEGER,
  session_count INTEGER,
  active_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      DATE_TRUNC('day', p_start_date)::DATE,
      DATE_TRUNC('day', p_start_date)::DATE + (p_days - 1) * INTERVAL '1 day',
      '1 day'::INTERVAL
    )::DATE AS day
  ),
  session_data AS (
    SELECT
      DATE_TRUNC('day', s.started_at)::DATE AS session_day,
      calculate_session_duration_minutes(s.started_at, s.ended_at) AS duration_minutes,
      CASE WHEN s.ended_at IS NULL THEN 1 ELSE 0 END AS is_active
    FROM sessions s
    WHERE s.user_id = p_user_id
      AND s.started_at >= p_start_date
      AND s.started_at < p_start_date + p_days * INTERVAL '1 day'
      -- Exclude stale sessions (> 24 hours)
      AND calculate_session_duration_minutes(s.started_at, s.ended_at) < 24 * 60
  )
  SELECT
    ds.day,
    COALESCE(SUM(sd.duration_minutes)::INTEGER, 0) AS total_minutes,
    COUNT(sd.duration_minutes)::INTEGER AS session_count,
    COALESCE(SUM(sd.is_active)::INTEGER, 0) AS active_count
  FROM date_series ds
  LEFT JOIN session_data sd ON ds.day = sd.session_day
  GROUP BY ds.day
  ORDER BY ds.day DESC;
END;
$$;

COMMENT ON FUNCTION get_session_duration_by_day IS
  'Returns daily session duration aggregates for a user, including total minutes, session count, and active count';

-- ============================================
-- FUNCTION: Get session duration by week
-- ============================================
-- Aggregates session durations by week for a user

CREATE OR REPLACE FUNCTION get_session_duration_by_week(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ,
  p_weeks INTEGER DEFAULT 4
)
RETURNS TABLE (
  week_start DATE,
  total_minutes INTEGER,
  session_count INTEGER,
  active_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH week_series AS (
    SELECT generate_series(
      DATE_TRUNC('week', p_start_date)::DATE,
      DATE_TRUNC('week', p_start_date)::DATE + (p_weeks - 1) * INTERVAL '1 week',
      '1 week'::INTERVAL
    )::DATE AS week_start
  ),
  session_data AS (
    SELECT
      DATE_TRUNC('week', s.started_at)::DATE AS session_week,
      calculate_session_duration_minutes(s.started_at, s.ended_at) AS duration_minutes,
      CASE WHEN s.ended_at IS NULL THEN 1 ELSE 0 END AS is_active
    FROM sessions s
    WHERE s.user_id = p_user_id
      AND s.started_at >= DATE_TRUNC('week', p_start_date)
      AND s.started_at < DATE_TRUNC('week', p_start_date) + p_weeks * INTERVAL '1 week'
      AND calculate_session_duration_minutes(s.started_at, s.ended_at) < 24 * 60
  )
  SELECT
    ws.week_start,
    COALESCE(SUM(sd.duration_minutes)::INTEGER, 0) AS total_minutes,
    COUNT(sd.duration_minutes)::INTEGER AS session_count,
    COALESCE(SUM(sd.is_active)::INTEGER, 0) AS active_count
  FROM week_series ws
  LEFT JOIN session_data sd ON ws.week_start = sd.session_week
  GROUP BY ws.week_start
  ORDER BY ws.week_start DESC;
END;
$$;

COMMENT ON FUNCTION get_session_duration_by_week IS
  'Returns weekly session duration aggregates for a user';

-- ============================================
-- FUNCTION: Get session duration by month
-- ============================================
-- Aggregates session durations by month for a user

CREATE OR REPLACE FUNCTION get_session_duration_by_month(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ,
  p_months INTEGER DEFAULT 6
)
RETURNS TABLE (
  month_start DATE,
  total_minutes INTEGER,
  session_count INTEGER,
  active_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH month_series AS (
    SELECT generate_series(
      DATE_TRUNC('month', p_start_date)::DATE,
      DATE_TRUNC('month', p_start_date)::DATE + (p_months - 1) * INTERVAL '1 month',
      '1 month'::INTERVAL
    )::DATE AS month_start
  ),
  session_data AS (
    SELECT
      DATE_TRUNC('month', s.started_at)::DATE AS session_month,
      calculate_session_duration_minutes(s.started_at, s.ended_at) AS duration_minutes,
      CASE WHEN s.ended_at IS NULL THEN 1 ELSE 0 END AS is_active
    FROM sessions s
    WHERE s.user_id = p_user_id
      AND s.started_at >= DATE_TRUNC('month', p_start_date)
      AND s.started_at < DATE_TRUNC('month', p_start_date) + p_months * INTERVAL '1 month'
      AND calculate_session_duration_minutes(s.started_at, s.ended_at) < 24 * 60
  )
  SELECT
    ms.month_start,
    COALESCE(SUM(sd.duration_minutes)::INTEGER, 0) AS total_minutes,
    COUNT(sd.duration_minutes)::INTEGER AS session_count,
    COALESCE(SUM(sd.is_active)::INTEGER, 0) AS active_count
  FROM month_series ms
  LEFT JOIN session_data sd ON ms.month_start = sd.session_month
  GROUP BY ms.month_start
  ORDER BY ms.month_start DESC;
END;
$$;

COMMENT ON FUNCTION get_session_duration_by_month IS
  'Returns monthly session duration aggregates for a user';

-- ============================================
-- FUNCTION: Get team session duration by day
-- ============================================
-- Aggregates session durations by day for a team

CREATE OR REPLACE FUNCTION get_team_session_duration_by_day(
  p_team_id UUID,
  p_start_date TIMESTAMPTZ,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  day DATE,
  total_minutes INTEGER,
  session_count INTEGER,
  active_count INTEGER,
  unique_users INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      DATE_TRUNC('day', p_start_date)::DATE,
      DATE_TRUNC('day', p_start_date)::DATE + (p_days - 1) * INTERVAL '1 day',
      '1 day'::INTERVAL
    )::DATE AS day
  ),
  session_data AS (
    SELECT
      DATE_TRUNC('day', s.started_at)::DATE AS session_day,
      calculate_session_duration_minutes(s.started_at, s.ended_at) AS duration_minutes,
      CASE WHEN s.ended_at IS NULL THEN 1 ELSE 0 END AS is_active,
      s.user_id
    FROM sessions s
    WHERE s.team_id = p_team_id
      AND s.started_at >= p_start_date
      AND s.started_at < p_start_date + p_days * INTERVAL '1 day'
      AND calculate_session_duration_minutes(s.started_at, s.ended_at) < 24 * 60
  )
  SELECT
    ds.day,
    COALESCE(SUM(sd.duration_minutes)::INTEGER, 0) AS total_minutes,
    COUNT(sd.duration_minutes)::INTEGER AS session_count,
    COALESCE(SUM(sd.is_active)::INTEGER, 0) AS active_count,
    COUNT(DISTINCT sd.user_id)::INTEGER AS unique_users
  FROM date_series ds
  LEFT JOIN session_data sd ON ds.day = sd.session_day
  GROUP BY ds.day
  ORDER BY ds.day DESC;
END;
$$;

COMMENT ON FUNCTION get_team_session_duration_by_day IS
  'Returns daily session duration aggregates for a team, including unique user count';

-- ============================================
-- FUNCTION: Get user duration stats
-- ============================================
-- Calculates comprehensive duration statistics for a user

CREATE OR REPLACE FUNCTION get_user_duration_stats(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  total_minutes BIGINT,
  session_count INTEGER,
  active_count INTEGER,
  average_minutes INTEGER,
  longest_minutes INTEGER,
  shortest_minutes INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH valid_sessions AS (
    SELECT
      calculate_session_duration_minutes(s.started_at, s.ended_at) AS duration_minutes,
      CASE WHEN s.ended_at IS NULL THEN 1 ELSE 0 END AS is_active
    FROM sessions s
    WHERE s.user_id = p_user_id
      AND (p_start_date IS NULL OR s.started_at >= p_start_date)
      AND (p_end_date IS NULL OR s.started_at <= p_end_date)
      AND calculate_session_duration_minutes(s.started_at, s.ended_at) < 24 * 60
  )
  SELECT
    COALESCE(SUM(vs.duration_minutes), 0)::BIGINT AS total_minutes,
    COUNT(*)::INTEGER AS session_count,
    COALESCE(SUM(vs.is_active), 0)::INTEGER AS active_count,
    CASE WHEN COUNT(*) > 0
      THEN (SUM(vs.duration_minutes) / COUNT(*))::INTEGER
      ELSE 0
    END AS average_minutes,
    COALESCE(MAX(vs.duration_minutes), 0)::INTEGER AS longest_minutes,
    COALESCE(MIN(vs.duration_minutes), 0)::INTEGER AS shortest_minutes
  FROM valid_sessions vs;
END;
$$;

COMMENT ON FUNCTION get_user_duration_stats IS
  'Returns comprehensive duration statistics for a user including total, average, min, and max';

-- ============================================
-- FUNCTION: Get hourly distribution
-- ============================================
-- Returns prompt count distribution by hour of day

CREATE OR REPLACE FUNCTION get_user_hourly_distribution(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  hour INTEGER,
  prompt_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH hour_series AS (
    SELECT generate_series(0, 23) AS hour
  ),
  prompt_hours AS (
    SELECT
      EXTRACT(HOUR FROM p.created_at)::INTEGER AS prompt_hour
    FROM prompts p
    JOIN sessions s ON p.session_uuid = s.id
    WHERE s.user_id = p_user_id
      AND (p_start_date IS NULL OR p.created_at >= p_start_date)
      AND (p_end_date IS NULL OR p.created_at <= p_end_date)
  )
  SELECT
    hs.hour::INTEGER,
    COUNT(ph.prompt_hour)::INTEGER AS prompt_count
  FROM hour_series hs
  LEFT JOIN prompt_hours ph ON hs.hour = ph.prompt_hour
  GROUP BY hs.hour
  ORDER BY hs.hour;
END;
$$;

COMMENT ON FUNCTION get_user_hourly_distribution IS
  'Returns the distribution of prompts by hour of day for a user';

-- ============================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION calculate_session_duration_minutes TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_duration_by_day TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_duration_by_week TO authenticated;
GRANT EXECUTE ON FUNCTION get_session_duration_by_month TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_session_duration_by_day TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_duration_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_hourly_distribution TO authenticated;

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== SESSION DURATION FUNCTIONS MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created helper function: calculate_session_duration_minutes';
  RAISE NOTICE 'Created aggregation functions:';
  RAISE NOTICE '  - get_session_duration_by_day';
  RAISE NOTICE '  - get_session_duration_by_week';
  RAISE NOTICE '  - get_session_duration_by_month';
  RAISE NOTICE '  - get_team_session_duration_by_day';
  RAISE NOTICE '  - get_user_duration_stats';
  RAISE NOTICE '  - get_user_hourly_distribution';
  RAISE NOTICE '=====================================================';
END $$;
