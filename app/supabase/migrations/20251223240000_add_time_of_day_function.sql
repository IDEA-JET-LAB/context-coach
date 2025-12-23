-- Time of Day Distribution SQL Functions
-- Story 21-5: Interaction Timing Analysis
-- Database-side function for calculating time-of-day activity distribution

-- ============================================
-- TIME OF DAY DISTRIBUTION FUNCTION
-- ============================================
-- Calculates time-of-day distribution for a user's prompts
-- Returns counts and percentages for morning, afternoon, evening, night
-- Plus peak hour identification

CREATE OR REPLACE FUNCTION get_time_of_day_distribution(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  morning_count INTEGER;
  afternoon_count INTEGER;
  evening_count INTEGER;
  night_count INTEGER;
  total_count INTEGER;
  peak_hour INTEGER;
BEGIN
  -- Count by time-of-day bucket
  SELECT
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 6 AND EXTRACT(HOUR FROM created_at) < 12),
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 12 AND EXTRACT(HOUR FROM created_at) < 18),
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 18 AND EXTRACT(HOUR FROM created_at) < 24),
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 0 AND EXTRACT(HOUR FROM created_at) < 6),
    COUNT(*)
  INTO morning_count, afternoon_count, evening_count, night_count, total_count
  FROM prompts
  WHERE user_id = p_user_id::TEXT
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);

  -- Find peak hour (hour with most prompts)
  SELECT EXTRACT(HOUR FROM created_at)::INTEGER
  INTO peak_hour
  FROM prompts
  WHERE user_id = p_user_id::TEXT
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
  GROUP BY EXTRACT(HOUR FROM created_at)
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Build result JSON
  result := json_build_object(
    'morning', morning_count,
    'afternoon', afternoon_count,
    'evening', evening_count,
    'night', night_count,
    'peakHour', COALESCE(peak_hour, 12),
    'morningPct', CASE WHEN total_count > 0 THEN ROUND(morning_count::NUMERIC / total_count * 100, 1) ELSE 0 END,
    'afternoonPct', CASE WHEN total_count > 0 THEN ROUND(afternoon_count::NUMERIC / total_count * 100, 1) ELSE 0 END,
    'eveningPct', CASE WHEN total_count > 0 THEN ROUND(evening_count::NUMERIC / total_count * 100, 1) ELSE 0 END,
    'nightPct', CASE WHEN total_count > 0 THEN ROUND(night_count::NUMERIC / total_count * 100, 1) ELSE 0 END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- TEAM TIME OF DAY DISTRIBUTION FUNCTION
-- ============================================
-- Calculates time-of-day distribution for an entire team

CREATE OR REPLACE FUNCTION get_team_time_of_day_distribution(
  p_team_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  morning_count INTEGER;
  afternoon_count INTEGER;
  evening_count INTEGER;
  night_count INTEGER;
  total_count INTEGER;
  peak_hour INTEGER;
BEGIN
  -- Count by time-of-day bucket for the team
  SELECT
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 6 AND EXTRACT(HOUR FROM created_at) < 12),
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 12 AND EXTRACT(HOUR FROM created_at) < 18),
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 18 AND EXTRACT(HOUR FROM created_at) < 24),
    COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM created_at) >= 0 AND EXTRACT(HOUR FROM created_at) < 6),
    COUNT(*)
  INTO morning_count, afternoon_count, evening_count, night_count, total_count
  FROM prompts
  WHERE team_id = p_team_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date);

  -- Find peak hour for the team
  SELECT EXTRACT(HOUR FROM created_at)::INTEGER
  INTO peak_hour
  FROM prompts
  WHERE team_id = p_team_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
  GROUP BY EXTRACT(HOUR FROM created_at)
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Build result JSON
  result := json_build_object(
    'morning', morning_count,
    'afternoon', afternoon_count,
    'evening', evening_count,
    'night', night_count,
    'peakHour', COALESCE(peak_hour, 12),
    'morningPct', CASE WHEN total_count > 0 THEN ROUND(morning_count::NUMERIC / total_count * 100, 1) ELSE 0 END,
    'afternoonPct', CASE WHEN total_count > 0 THEN ROUND(afternoon_count::NUMERIC / total_count * 100, 1) ELSE 0 END,
    'eveningPct', CASE WHEN total_count > 0 THEN ROUND(evening_count::NUMERIC / total_count * 100, 1) ELSE 0 END,
    'nightPct', CASE WHEN total_count > 0 THEN ROUND(night_count::NUMERIC / total_count * 100, 1) ELSE 0 END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- FUNCTION COMMENTS
-- ============================================

COMMENT ON FUNCTION get_time_of_day_distribution(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Calculates time-of-day distribution (morning/afternoon/evening/night) for a user''s prompts';

COMMENT ON FUNCTION get_team_time_of_day_distribution(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Calculates time-of-day distribution for an entire team''s prompts';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== TIME OF DAY FUNCTIONS MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created function: get_time_of_day_distribution(UUID, TIMESTAMPTZ, TIMESTAMPTZ)';
  RAISE NOTICE 'Created function: get_team_time_of_day_distribution(UUID, TIMESTAMPTZ, TIMESTAMPTZ)';
  RAISE NOTICE '=================================================';
END $$;
