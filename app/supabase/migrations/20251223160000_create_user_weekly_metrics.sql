-- Story 21-9: Learning Progression Tracking
-- Creates user_weekly_metrics table for tracking week-over-week improvements

-- Create user_weekly_metrics table
CREATE TABLE IF NOT EXISTS user_weekly_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  avg_prompt_score DECIMAL(4,2),
  frustration_rate DECIMAL(4,3),
  prompts_per_goal DECIMAL(5,2),
  context_exhaustion_rate DECIMAL(4,3),
  total_prompts INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_week UNIQUE (user_id, week_start),
  CONSTRAINT valid_week_start CHECK (EXTRACT(DOW FROM week_start) = 0) -- Must be Sunday
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_weekly_metrics_user_id ON user_weekly_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_weekly_metrics_week_start ON user_weekly_metrics(week_start);
CREATE INDEX IF NOT EXISTS idx_user_weekly_metrics_user_week ON user_weekly_metrics(user_id, week_start DESC);

-- Add comments for documentation
COMMENT ON TABLE user_weekly_metrics IS 'Weekly aggregated metrics for learning progression tracking';
COMMENT ON COLUMN user_weekly_metrics.week_start IS 'Start of the week (Sunday)';
COMMENT ON COLUMN user_weekly_metrics.avg_prompt_score IS 'Average prompt score for the week (0-10)';
COMMENT ON COLUMN user_weekly_metrics.frustration_rate IS 'Ratio of frustrated prompts (0-1)';
COMMENT ON COLUMN user_weekly_metrics.prompts_per_goal IS 'Average prompts needed to achieve goal';
COMMENT ON COLUMN user_weekly_metrics.context_exhaustion_rate IS 'Ratio of sessions with context resets (0-1)';

-- Enable RLS
ALTER TABLE user_weekly_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view their own metrics
CREATE POLICY "Users can view own weekly metrics"
  ON user_weekly_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update metrics (for aggregation function)
CREATE POLICY "Service role can manage weekly metrics"
  ON user_weekly_metrics
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Function to aggregate weekly metrics from prompts and sessions
CREATE OR REPLACE FUNCTION aggregate_user_weekly_metrics(week_start_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected INTEGER := 0;
  week_end_date DATE := week_start_date + INTERVAL '6 days';
BEGIN
  -- Validate week_start_date is a Sunday
  IF EXTRACT(DOW FROM week_start_date) != 0 THEN
    RAISE EXCEPTION 'week_start_date must be a Sunday, got day of week %', EXTRACT(DOW FROM week_start_date);
  END IF;

  -- Delete existing entries for this week (upsert behavior)
  DELETE FROM user_weekly_metrics WHERE week_start = week_start_date;

  -- Insert aggregated metrics from prompts and sessions
  INSERT INTO user_weekly_metrics (
    user_id,
    week_start,
    avg_prompt_score,
    frustration_rate,
    prompts_per_goal,
    context_exhaustion_rate,
    total_prompts,
    total_sessions
  )
  SELECT
    p.user_id,
    week_start_date,
    -- Average prompt score from analyses
    COALESCE(
      (SELECT AVG(pa.overall_score)
       FROM prompt_analyses pa
       WHERE pa.prompt_id IN (
         SELECT id FROM prompts
         WHERE user_id = p.user_id
           AND created_at >= week_start_date
           AND created_at < week_end_date + INTERVAL '1 day'
       )),
      NULL
    ),
    -- Frustration rate: prompts with negative sentiment / total prompts
    COALESCE(
      (SELECT COUNT(*)::DECIMAL / NULLIF(COUNT(*)::DECIMAL, 0)
       FROM prompts pr
       LEFT JOIN prompt_analyses pa ON pa.prompt_id = pr.id
       WHERE pr.user_id = p.user_id
         AND pr.created_at >= week_start_date
         AND pr.created_at < week_end_date + INTERVAL '1 day'
         AND pa.overall_score < 4),
      0
    ),
    -- Prompts per goal: estimated from session patterns
    -- Using average prompts per session as proxy
    CASE
      WHEN s.session_count > 0 THEN p.total_prompts::DECIMAL / s.session_count
      ELSE NULL
    END,
    -- Context exhaustion: placeholder - would need context tracking data
    NULL,
    p.total_prompts,
    COALESCE(s.session_count, 0)
  FROM (
    -- Aggregate prompts per user
    SELECT
      user_id,
      COUNT(*) as total_prompts
    FROM prompts
    WHERE created_at >= week_start_date
      AND created_at < week_end_date + INTERVAL '1 day'
    GROUP BY user_id
  ) p
  LEFT JOIN (
    -- Aggregate sessions per user
    SELECT
      user_id,
      COUNT(*) as session_count
    FROM sessions
    WHERE started_at >= week_start_date
      AND started_at < week_end_date + INTERVAL '1 day'
    GROUP BY user_id
  ) s ON s.user_id = p.user_id
  WHERE p.total_prompts > 0;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  RETURN rows_affected;
END;
$$;

-- Grant execute permission to authenticated users (for manual triggers)
GRANT EXECUTE ON FUNCTION aggregate_user_weekly_metrics(DATE) TO authenticated;

-- Function to get previous week's start date
CREATE OR REPLACE FUNCTION get_previous_week_start(current_week DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT current_week - INTERVAL '7 days';
$$;

-- Function to get current week start (Sunday)
CREATE OR REPLACE FUNCTION get_current_week_start()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT DATE_TRUNC('week', CURRENT_DATE)::DATE - INTERVAL '1 day';
$$;

COMMENT ON FUNCTION aggregate_user_weekly_metrics IS 'Aggregates user metrics for a given week, called by weekly cron job';
COMMENT ON FUNCTION get_previous_week_start IS 'Returns the Sunday before the given week start';
COMMENT ON FUNCTION get_current_week_start IS 'Returns the most recent Sunday (start of current week)';
