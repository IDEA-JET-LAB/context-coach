-- Phase 3: Session Aggregation Functions
-- Story 24-4: Session Aggregation Functions
--
-- Creates functions for real-time session statistics and conversation scoring
--
-- DEPENDENCY: This migration requires 24-2 (prompts extensions) to be applied first
-- because it references prompts.prompt_classification column.

-- ============================================
-- SCORING WEIGHTS BY PROMPT CLASSIFICATION
-- ============================================
-- Returns the scoring weight for a given prompt classification
-- selection and confirmation = 0 (skip scoring)

CREATE OR REPLACE FUNCTION get_prompt_scoring_weight(p_prompt_classification VARCHAR(50))
RETURNS DECIMAL(3,2) AS $$
BEGIN
  RETURN CASE p_prompt_classification
    WHEN 'initiating' THEN 1.00      -- Full responsibility for quality
    WHEN 'continuation' THEN 0.70    -- Context-dependent, less control
    WHEN 'selection' THEN 0.00       -- Skip scoring - just picking option
    WHEN 'correction' THEN 0.80      -- Important but reactive
    WHEN 'confirmation' THEN 0.00    -- Skip scoring - just saying yes
    WHEN 'clarification' THEN 0.60   -- Asks questions, moderate impact
    WHEN 'tool_result' THEN 0.00     -- Not a user prompt
    ELSE 1.00                        -- Default full weight for NULL/unknown
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_prompt_scoring_weight(VARCHAR) IS
  'Returns the scoring weight (0.00-1.00) for a prompt classification. Selection/confirmation return 0 to skip scoring. Used for weighted conversation score calculation.';

-- Grant execute
GRANT EXECUTE ON FUNCTION get_prompt_scoring_weight(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_prompt_scoring_weight(VARCHAR) TO service_role;

-- ============================================
-- UPDATE SESSION STATS (FULL RECALCULATION)
-- ============================================
-- Recalculates all session aggregates from prompts
-- Use for full refresh or when data may be out of sync

CREATE OR REPLACE FUNCTION update_session_stats(p_session_uuid UUID)
RETURNS VOID AS $$
DECLARE
  v_user_count INTEGER;
  v_breakdown JSONB;
  v_primary_stage VARCHAR(50);
  v_has_loop BOOLEAN;
BEGIN
  -- Lock the session row to prevent concurrent updates
  PERFORM 1 FROM sessions WHERE id = p_session_uuid FOR UPDATE;

  -- Count user messages (exclude tool_result classification)
  -- Note: Uses prompt_classification from 24-2, falls back to legacy prompt_type check
  SELECT COUNT(*) INTO v_user_count
  FROM prompts
  WHERE session_uuid = p_session_uuid
  AND (
    prompt_classification IS NULL
    OR prompt_classification != 'tool_result'
  )
  AND (
    prompt_type IS NULL
    OR prompt_type != 'tool_result'
  );

  -- Build stage breakdown from detected_stage
  SELECT COALESCE(jsonb_object_agg(detected_stage, cnt), '{}'::jsonb)
  INTO v_breakdown
  FROM (
    SELECT detected_stage, COUNT(*) as cnt
    FROM prompts
    WHERE session_uuid = p_session_uuid
    AND detected_stage IS NOT NULL
    GROUP BY detected_stage
  ) stage_counts;

  -- Determine primary stage (most common)
  SELECT detected_stage INTO v_primary_stage
  FROM prompts
  WHERE session_uuid = p_session_uuid
  AND detected_stage IS NOT NULL
  GROUP BY detected_stage
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Check for debugging loop (any prompt flagged)
  SELECT EXISTS (
    SELECT 1 FROM prompts
    WHERE session_uuid = p_session_uuid
    AND is_in_debugging_loop = TRUE
  ) INTO v_has_loop;

  -- Update session with calculated values
  UPDATE sessions SET
    user_message_count = v_user_count,
    stage_breakdown = v_breakdown,
    primary_stage = v_primary_stage,
    has_debugging_loop = COALESCE(v_has_loop, FALSE),
    updated_at = NOW()
  WHERE id = p_session_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_session_stats(UUID) IS
  'Recalculates all session aggregates: user_message_count, stage_breakdown, primary_stage, has_debugging_loop. Use for full refresh when data may be out of sync.';

-- Grant execute
GRANT EXECUTE ON FUNCTION update_session_stats(UUID) TO service_role;

-- ============================================
-- CALCULATE CONVERSATION SCORE
-- ============================================
-- Calculates weighted average score excluding selection/confirmation
-- Uses prompt_classification weights from get_prompt_scoring_weight()

CREATE OR REPLACE FUNCTION calculate_conversation_score(p_session_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER;
BEGIN
  -- Lock the session row to prevent concurrent updates
  PERFORM 1 FROM sessions WHERE id = p_session_uuid FOR UPDATE;

  -- Calculate weighted average of prompt scores
  -- Excludes prompts with 0 weight (selection, confirmation, tool_result)
  SELECT
    CASE
      WHEN SUM(get_prompt_scoring_weight(p.prompt_classification)) = 0 THEN NULL
      ELSE ROUND(
        SUM(pa.overall_score * get_prompt_scoring_weight(p.prompt_classification)) /
        NULLIF(SUM(get_prompt_scoring_weight(p.prompt_classification)), 0)
      )::INTEGER
    END
  INTO v_score
  FROM prompts p
  JOIN prompt_analyses pa ON pa.prompt_id = p.id
  WHERE p.session_uuid = p_session_uuid
  AND get_prompt_scoring_weight(p.prompt_classification) > 0;

  -- Update session with calculated score
  UPDATE sessions SET
    conversation_score = v_score,
    updated_at = NOW()
  WHERE id = p_session_uuid;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_conversation_score(UUID) IS
  'Calculates the weighted average conversation score, excluding selection/confirmation prompts. Updates sessions.conversation_score and returns the calculated value.';

-- Grant execute
GRANT EXECUTE ON FUNCTION calculate_conversation_score(UUID) TO service_role;

-- ============================================
-- UPDATE SESSION AGGREGATES TRIGGER
-- ============================================
-- Efficient incremental update on prompt insert
-- Increments counts without full recalculation

CREATE OR REPLACE FUNCTION update_session_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if session_uuid is set
  IF NEW.session_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Increment counts and update timestamp
  -- Check both prompt_classification (Phase 3) and prompt_type (legacy)
  UPDATE sessions SET
    total_prompts = total_prompts + 1,
    user_message_count = CASE
      WHEN (NEW.prompt_classification IS NULL OR NEW.prompt_classification != 'tool_result')
       AND (NEW.prompt_type IS NULL OR NEW.prompt_type != 'tool_result')
      THEN user_message_count + 1
      ELSE user_message_count
    END,
    ended_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.session_uuid;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_session_aggregates() IS
  'Trigger function for incremental session updates on prompt insert. Increments total_prompts and user_message_count, updates ended_at timestamp.';

-- Drop existing trigger if exists, then recreate
DROP TRIGGER IF EXISTS on_prompt_insert_update_session ON prompts;

CREATE TRIGGER on_prompt_insert_update_session
  AFTER INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_session_aggregates();

-- ============================================
-- ANALYSIS COMPLETE TRIGGER
-- ============================================
-- Recalculate conversation score when analysis is stored or updated

CREATE OR REPLACE FUNCTION on_analysis_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_session_uuid UUID;
BEGIN
  -- Get the session UUID for this prompt
  SELECT session_uuid INTO v_session_uuid
  FROM prompts
  WHERE id = NEW.prompt_id;

  -- Recalculate score if session exists
  IF v_session_uuid IS NOT NULL THEN
    PERFORM calculate_conversation_score(v_session_uuid);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION on_analysis_complete() IS
  'Trigger function that recalculates conversation score when prompt analysis is stored or updated.';

-- Drop existing trigger if exists, then recreate
DROP TRIGGER IF EXISTS on_prompt_analysis_insert ON prompt_analyses;

CREATE TRIGGER on_prompt_analysis_insert
  AFTER INSERT OR UPDATE OF overall_score ON prompt_analyses
  FOR EACH ROW
  EXECUTE FUNCTION on_analysis_complete();

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== PHASE 3: SESSION AGGREGATION FUNCTIONS COMPLETE ===';
  RAISE NOTICE 'Created functions: get_prompt_scoring_weight, update_session_stats, calculate_conversation_score';
  RAISE NOTICE 'Created/updated trigger: update_session_aggregates (on prompts INSERT)';
  RAISE NOTICE 'Created trigger: on_analysis_complete (on prompt_analyses INSERT/UPDATE)';
  RAISE NOTICE '======================================================';
END $$;
