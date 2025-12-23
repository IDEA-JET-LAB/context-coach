-- Interval Statistics SQL Functions
-- Story 21-5: Interaction Timing Analysis
-- Database-side functions for calculating interval statistics

-- ============================================
-- INTERVAL STATISTICS FUNCTION
-- ============================================
-- Calculates average, median, min, max intervals for a user's prompts
-- Optionally filtered by session

CREATE OR REPLACE FUNCTION calculate_interval_stats(
  p_user_id UUID,
  p_session_id UUID DEFAULT NULL
)
RETURNS TABLE (
  average_interval_seconds NUMERIC,
  median_interval_seconds NUMERIC,
  min_interval_seconds INTEGER,
  max_interval_seconds INTEGER,
  total_prompts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG(time_since_previous_seconds)::NUMERIC AS average_interval_seconds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_since_previous_seconds)::NUMERIC AS median_interval_seconds,
    MIN(time_since_previous_seconds) AS min_interval_seconds,
    MAX(time_since_previous_seconds) AS max_interval_seconds,
    COUNT(*) AS total_prompts
  FROM prompts
  WHERE user_id = p_user_id::TEXT  -- user_id in prompts table is TEXT
    AND (p_session_id IS NULL OR session_uuid = p_session_id)
    AND time_since_previous_seconds IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- INTERVAL STATISTICS BY TEAM FUNCTION
-- ============================================
-- Calculates interval statistics for an entire team

CREATE OR REPLACE FUNCTION calculate_team_interval_stats(
  p_team_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  average_interval_seconds NUMERIC,
  median_interval_seconds NUMERIC,
  min_interval_seconds INTEGER,
  max_interval_seconds INTEGER,
  total_prompts BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG(time_since_previous_seconds)::NUMERIC AS average_interval_seconds,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_since_previous_seconds)::NUMERIC AS median_interval_seconds,
    MIN(time_since_previous_seconds) AS min_interval_seconds,
    MAX(time_since_previous_seconds) AS max_interval_seconds,
    COUNT(*) AS total_prompts
  FROM prompts
  WHERE team_id = p_team_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
    AND time_since_previous_seconds IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION COMMENTS
-- ============================================

COMMENT ON FUNCTION calculate_interval_stats(UUID, UUID) IS
  'Calculates interval statistics (avg, median, min, max) for a user''s prompts, optionally filtered by session';

COMMENT ON FUNCTION calculate_team_interval_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Calculates interval statistics for an entire team, optionally filtered by date range';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== INTERVAL STATS FUNCTIONS MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created function: calculate_interval_stats(UUID, UUID)';
  RAISE NOTICE 'Created function: calculate_team_interval_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ)';
  RAISE NOTICE '===================================================';
END $$;
