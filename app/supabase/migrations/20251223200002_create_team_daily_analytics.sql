-- Team Daily Analytics Table Migration
-- Story 21-12: Team Intelligence Analytics
-- Creates team_daily_analytics table for aggregated team-level metrics

-- ============================================
-- TEAM_DAILY_ANALYTICS TABLE
-- ============================================
-- Stores daily aggregated analytics for teams
-- Used for team intelligence dashboard

CREATE TABLE team_daily_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Prompt metrics
  total_prompts INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  avg_prompt_score DECIMAL(4,2),
  avg_session_health DECIMAL(4,2),

  -- Distribution data (JSONB for flexibility)
  work_style_distribution JSONB,
  sentiment_distribution JSONB,
  persona_distribution JSONB,

  -- Team activity metrics
  active_users INTEGER NOT NULL DEFAULT 0,
  total_team_members INTEGER NOT NULL DEFAULT 0,

  -- Week-over-week changes (cached for performance)
  score_change DECIMAL(4,2),
  efficiency_change DECIMAL(4,2),
  frustration_change DECIMAL(4,2),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint for (team_id, date)
  CONSTRAINT unique_team_date UNIQUE (team_id, date)
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary lookup by team_id
CREATE INDEX idx_team_daily_analytics_team ON team_daily_analytics(team_id);

-- Date-based queries (recent analytics)
CREATE INDEX idx_team_daily_analytics_date ON team_daily_analytics(date DESC);

-- Composite index for team + date range queries
CREATE INDEX idx_team_daily_analytics_team_date ON team_daily_analytics(team_id, date DESC);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE TRIGGER team_daily_analytics_updated_at
  BEFORE UPDATE ON team_daily_analytics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE team_daily_analytics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Team members can view their team's daily analytics
CREATE POLICY "Team members can view team daily analytics" ON team_daily_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_daily_analytics.team_id
        AND tm.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- Service role can manage team daily analytics (for aggregation jobs)
CREATE POLICY "Service role can insert team daily analytics" ON team_daily_analytics
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update team daily analytics" ON team_daily_analytics
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete team daily analytics" ON team_daily_analytics
  FOR DELETE TO service_role
  USING (true);

-- ============================================
-- TABLE COMMENTS
-- ============================================

COMMENT ON TABLE team_daily_analytics IS
  'Stores daily aggregated analytics for teams, used by team intelligence dashboard';

COMMENT ON COLUMN team_daily_analytics.team_id IS
  'Reference to the team this analytics record belongs to';

COMMENT ON COLUMN team_daily_analytics.date IS
  'The date this analytics record covers';

COMMENT ON COLUMN team_daily_analytics.total_prompts IS
  'Total number of prompts submitted by team members on this date';

COMMENT ON COLUMN team_daily_analytics.total_sessions IS
  'Total number of sessions started by team members on this date';

COMMENT ON COLUMN team_daily_analytics.avg_prompt_score IS
  'Average prompt quality score across all team prompts on this date';

COMMENT ON COLUMN team_daily_analytics.avg_session_health IS
  'Average session health score across all team sessions on this date';

COMMENT ON COLUMN team_daily_analytics.work_style_distribution IS
  'JSONB: Distribution of work styles among team members { "explorer": 3, "focused": 5, ... }';

COMMENT ON COLUMN team_daily_analytics.sentiment_distribution IS
  'JSONB: Distribution of sentiment categories { "polite": 10, "frustrated": 2, ... }';

COMMENT ON COLUMN team_daily_analytics.persona_distribution IS
  'JSONB: Distribution of technical personas { "architect": 2, "craftsman": 5, ... }';

COMMENT ON COLUMN team_daily_analytics.active_users IS
  'Count of unique users who submitted prompts on this date';

COMMENT ON COLUMN team_daily_analytics.total_team_members IS
  'Total team member count at the time of aggregation';

COMMENT ON COLUMN team_daily_analytics.score_change IS
  'Week-over-week change in average prompt score';

COMMENT ON COLUMN team_daily_analytics.efficiency_change IS
  'Week-over-week change in team efficiency metrics';

COMMENT ON COLUMN team_daily_analytics.frustration_change IS
  'Week-over-week change in frustration rate';

-- ============================================
-- AGGREGATION FUNCTION
-- ============================================

-- Function to aggregate daily analytics for a specific team and date
CREATE OR REPLACE FUNCTION aggregate_team_daily_analytics(
  p_team_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
  v_record_id UUID;
  v_total_prompts INTEGER;
  v_total_sessions INTEGER;
  v_avg_score DECIMAL(4,2);
  v_active_users INTEGER;
  v_total_members INTEGER;
  v_work_styles JSONB;
  v_sentiments JSONB;
  v_prev_week_score DECIMAL(4,2);
  v_score_change DECIMAL(4,2);
BEGIN
  -- Get total prompts and average score for the team on this date
  SELECT
    COUNT(p.id)::INTEGER,
    AVG(pa.overall_score),
    COUNT(DISTINCT p.user_id)::INTEGER
  INTO v_total_prompts, v_avg_score, v_active_users
  FROM prompts p
  LEFT JOIN prompt_analyses pa ON pa.prompt_id = p.id
  WHERE p.team_id = p_team_id
    AND DATE(p.created_at) = p_date;

  -- Get total sessions for the team on this date
  SELECT COUNT(DISTINCT s.id)::INTEGER
  INTO v_total_sessions
  FROM sessions s
  WHERE s.team_id = p_team_id
    AND DATE(s.started_at) = p_date;

  -- Get total team members
  SELECT COUNT(*)::INTEGER
  INTO v_total_members
  FROM team_members
  WHERE team_id = p_team_id;

  -- Get previous week's average score for comparison
  SELECT AVG(pa.overall_score)
  INTO v_prev_week_score
  FROM prompts p
  LEFT JOIN prompt_analyses pa ON pa.prompt_id = p.id
  WHERE p.team_id = p_team_id
    AND DATE(p.created_at) = p_date - INTERVAL '7 days';

  -- Calculate week-over-week change
  IF v_prev_week_score IS NOT NULL AND v_avg_score IS NOT NULL THEN
    v_score_change := v_avg_score - v_prev_week_score;
  ELSE
    v_score_change := NULL;
  END IF;

  -- Build work style distribution from classification data
  SELECT COALESCE(jsonb_object_agg(key, count), '{}'::JSONB)
  INTO v_work_styles
  FROM (
    SELECT
      p.classification->'work_style' AS key,
      COUNT(*) AS count
    FROM prompts p
    WHERE p.team_id = p_team_id
      AND DATE(p.created_at) = p_date
      AND p.classification IS NOT NULL
      AND p.classification->'work_style' IS NOT NULL
    GROUP BY p.classification->'work_style'
  ) sub;

  -- Build sentiment distribution from classification data
  SELECT COALESCE(jsonb_object_agg(key, count), '{}'::JSONB)
  INTO v_sentiments
  FROM (
    SELECT
      p.classification->'sentiment' AS key,
      COUNT(*) AS count
    FROM prompts p
    WHERE p.team_id = p_team_id
      AND DATE(p.created_at) = p_date
      AND p.classification IS NOT NULL
      AND p.classification->'sentiment' IS NOT NULL
    GROUP BY p.classification->'sentiment'
  ) sub;

  -- Upsert the analytics record
  INSERT INTO team_daily_analytics (
    team_id,
    date,
    total_prompts,
    total_sessions,
    avg_prompt_score,
    active_users,
    total_team_members,
    work_style_distribution,
    sentiment_distribution,
    score_change
  )
  VALUES (
    p_team_id,
    p_date,
    COALESCE(v_total_prompts, 0),
    COALESCE(v_total_sessions, 0),
    v_avg_score,
    COALESCE(v_active_users, 0),
    COALESCE(v_total_members, 0),
    v_work_styles,
    v_sentiments,
    v_score_change
  )
  ON CONFLICT (team_id, date)
  DO UPDATE SET
    total_prompts = EXCLUDED.total_prompts,
    total_sessions = EXCLUDED.total_sessions,
    avg_prompt_score = EXCLUDED.avg_prompt_score,
    active_users = EXCLUDED.active_users,
    total_team_members = EXCLUDED.total_team_members,
    work_style_distribution = EXCLUDED.work_style_distribution,
    sentiment_distribution = EXCLUDED.sentiment_distribution,
    score_change = EXCLUDED.score_change,
    updated_at = NOW()
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION aggregate_team_daily_analytics TO service_role;

COMMENT ON FUNCTION aggregate_team_daily_analytics IS
  'Aggregates daily analytics for a specific team and date. Can be run as a cron job.';

-- ============================================
-- BULK AGGREGATION FUNCTION
-- ============================================

-- Function to aggregate daily analytics for ALL teams for a specific date
CREATE OR REPLACE FUNCTION aggregate_all_teams_daily_analytics(
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_team_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_team_id IN SELECT id FROM teams LOOP
    PERFORM aggregate_team_daily_analytics(v_team_id, p_date);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION aggregate_all_teams_daily_analytics TO service_role;

COMMENT ON FUNCTION aggregate_all_teams_daily_analytics IS
  'Aggregates daily analytics for all teams. Intended to be run as a daily cron job at 00:10 UTC.';

-- ============================================
-- TEAM INTELLIGENCE VIEW (Optional helper)
-- ============================================

-- Create a view for easy team intelligence queries
CREATE OR REPLACE VIEW team_intelligence_summary AS
SELECT
  t.id AS team_id,
  t.name AS team_name,
  COUNT(DISTINCT tm.user_id) AS team_size,
  COALESCE(
    (SELECT SUM(tda.total_prompts)
     FROM team_daily_analytics tda
     WHERE tda.team_id = t.id
       AND tda.date >= CURRENT_DATE - INTERVAL '30 days'),
    0
  ) AS total_prompts_30d,
  COALESCE(
    (SELECT SUM(tda.total_sessions)
     FROM team_daily_analytics tda
     WHERE tda.team_id = t.id
       AND tda.date >= CURRENT_DATE - INTERVAL '30 days'),
    0
  ) AS total_sessions_30d,
  COALESCE(
    (SELECT AVG(tda.avg_prompt_score)
     FROM team_daily_analytics tda
     WHERE tda.team_id = t.id
       AND tda.date >= CURRENT_DATE - INTERVAL '30 days'
       AND tda.avg_prompt_score IS NOT NULL),
    0
  ) AS avg_score_30d,
  COALESCE(
    (SELECT MAX(tda.active_users)
     FROM team_daily_analytics tda
     WHERE tda.team_id = t.id
       AND tda.date >= CURRENT_DATE - INTERVAL '7 days'),
    0
  ) AS max_active_users_7d
FROM teams t
LEFT JOIN team_members tm ON tm.team_id = t.id
GROUP BY t.id, t.name;

COMMENT ON VIEW team_intelligence_summary IS
  'Provides a quick summary of team intelligence metrics for dashboard use';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== TEAM DAILY ANALYTICS MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created team_daily_analytics table';
  RAISE NOTICE 'Created indexes for efficient queries';
  RAISE NOTICE 'Enabled RLS with team-based access policies';
  RAISE NOTICE 'Created aggregate_team_daily_analytics function';
  RAISE NOTICE 'Created aggregate_all_teams_daily_analytics function';
  RAISE NOTICE 'Created team_intelligence_summary view';
  RAISE NOTICE '==============================================';
END $$;
