-- Migration: Add input validation to store_analysis_result function
-- Security Fix: SECURITY DEFINER functions should validate inputs
--
-- This migration updates the store_analysis_result function to:
-- 1. Verify the prompt exists before storing analysis
-- 2. Verify the prompt is in 'processing' status (expected state)
-- 3. Prevent storing analysis for prompts in unexpected states

-- Update the store_analysis_result function with validation
CREATE OR REPLACE FUNCTION store_analysis_result(
  p_prompt_id UUID,
  p_config_id UUID,
  p_overall_score DECIMAL(3,1),
  p_dimension_scores JSONB,
  p_suggestions JSONB
) RETURNS UUID AS $$
DECLARE
  v_analysis_id UUID;
  v_prompt_status TEXT;
  v_prompt_exists BOOLEAN;
BEGIN
  -- SECURITY: Validate that the prompt exists and is in expected state
  SELECT EXISTS(SELECT 1 FROM prompts WHERE id = p_prompt_id), analysis_status
  INTO v_prompt_exists, v_prompt_status
  FROM prompts
  WHERE id = p_prompt_id;

  -- Check prompt exists
  IF NOT v_prompt_exists THEN
    RAISE EXCEPTION 'Prompt % does not exist', p_prompt_id
      USING ERRCODE = '23503';  -- foreign_key_violation
  END IF;

  -- Check prompt is in expected 'processing' state
  -- This prevents race conditions and unauthorized modifications
  IF v_prompt_status != 'processing' THEN
    RAISE EXCEPTION 'Prompt % is not in processing state (current: %)', p_prompt_id, v_prompt_status
      USING ERRCODE = 'P0001';  -- raise_exception
  END IF;

  -- SECURITY: Validate config_id exists
  IF NOT EXISTS(SELECT 1 FROM analysis_configs WHERE id = p_config_id) THEN
    RAISE EXCEPTION 'Config % does not exist', p_config_id
      USING ERRCODE = '23503';  -- foreign_key_violation
  END IF;

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function comment
COMMENT ON FUNCTION store_analysis_result IS 'Atomically stores analysis result and updates prompt status. Validates prompt exists and is in processing state before storing.';
