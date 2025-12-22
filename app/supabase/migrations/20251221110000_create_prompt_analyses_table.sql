-- Prompt Analyses Table Migration
-- Story 5.4: Analysis Storage
-- NOTE: This migration MUST run AFTER 20251221100000_create_analysis_configs_table.sql

-- ============================================
-- PROMPT_ANALYSES TABLE
-- Stores AI analysis results for each prompt
-- ============================================
CREATE TABLE prompt_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES analysis_configs(id),
  overall_score DECIMAL(3,1) NOT NULL,
  dimension_scores JSONB NOT NULL,
  suggestions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Enforce score range: 1.0 to 10.0
  CONSTRAINT valid_overall_score CHECK (overall_score >= 1 AND overall_score <= 10),

  -- One analysis per prompt
  CONSTRAINT unique_prompt_analysis UNIQUE (prompt_id)
);

-- Add table comment
COMMENT ON TABLE prompt_analyses IS 'Stores AI analysis results for each prompt';
COMMENT ON COLUMN prompt_analyses.dimension_scores IS 'JSONB: { [dimensionName]: { score: number, reasoning: string } }';
COMMENT ON COLUMN prompt_analyses.suggestions IS 'JSONB: { byDimension: {...}, prioritized: string[], generatedAt: ISO8601 }';

-- ============================================
-- INDEXES
-- ============================================
-- Primary lookup by prompt_id (covered by unique constraint, but explicit for clarity)
CREATE INDEX idx_prompt_analyses_prompt_id ON prompt_analyses(prompt_id);

-- Dashboard: latest analyses
CREATE INDEX idx_prompt_analyses_created_at ON prompt_analyses(created_at DESC);

-- Dashboard: filter/sort by score
CREATE INDEX idx_prompt_analyses_overall_score ON prompt_analyses(overall_score);

-- Join to config version
CREATE INDEX idx_prompt_analyses_config_id ON prompt_analyses(config_id);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE prompt_analyses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Team members can read analyses for their team's prompts
-- Uses team_members join for proper multi-tenancy (not JWT claim)
CREATE POLICY "Team members can read analyses" ON prompt_analyses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prompts p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE p.id = prompt_analyses.prompt_id
      AND tm.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- Service role can insert analyses (used by Edge Function)
CREATE POLICY "Service role can insert analyses" ON prompt_analyses
  FOR INSERT TO service_role
  WITH CHECK (true);

-- ============================================
-- ATOMIC STORAGE FUNCTION
-- Inserts analysis and updates prompt status in one transaction
-- ============================================
CREATE OR REPLACE FUNCTION store_analysis_result(
  p_prompt_id UUID,
  p_config_id UUID,
  p_overall_score DECIMAL(3,1),
  p_dimension_scores JSONB,
  p_suggestions JSONB
) RETURNS UUID AS $$
DECLARE
  v_analysis_id UUID;
BEGIN
  -- Insert analysis record
  INSERT INTO prompt_analyses (
    prompt_id,
    config_id,
    overall_score,
    dimension_scores,
    suggestions
  )
  VALUES (
    p_prompt_id,
    p_config_id,
    p_overall_score,
    p_dimension_scores,
    p_suggestions
  )
  RETURNING id INTO v_analysis_id;

  -- Update prompt status to complete
  UPDATE prompts
  SET analysis_status = 'complete'
  WHERE id = p_prompt_id;

  RETURN v_analysis_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Analysis already exists for prompt %', p_prompt_id
      USING ERRCODE = '23505';  -- unique_violation error code
  WHEN foreign_key_violation THEN
    RAISE EXCEPTION 'Invalid prompt_id or config_id: prompt=%, config=%', p_prompt_id, p_config_id
      USING ERRCODE = '23503';  -- foreign_key_violation error code
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION store_analysis_result TO service_role;

COMMENT ON FUNCTION store_analysis_result IS 'Atomically stores analysis result and updates prompt status';
