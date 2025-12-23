-- Interaction Timing Trigger Migration
-- Story 21-5: Interaction Timing Analysis
-- Creates trigger to automatically calculate timing metrics on prompt insert

-- ============================================
-- TIMING ANALYSIS TRIGGER FUNCTION
-- ============================================
-- Calculates timing metrics in a BEFORE INSERT trigger for optimal performance
-- This ensures timing data is available immediately without a separate update

CREATE OR REPLACE FUNCTION analyze_prompt_timing()
RETURNS TRIGGER AS $$
DECLARE
  prev_timestamp TIMESTAMPTZ;
  prev_sequence INTEGER;
  time_diff INTEGER;
BEGIN
  -- Only process if we have a session context
  IF NEW.session_uuid IS NOT NULL THEN
    -- Get the most recent prompt in this session before the current one
    SELECT
      p.created_at,
      p.sequence_number
    INTO
      prev_timestamp,
      prev_sequence
    FROM prompts p
    WHERE p.session_uuid = NEW.session_uuid
      AND (NEW.created_at IS NULL OR p.created_at < NEW.created_at)
    ORDER BY p.created_at DESC
    LIMIT 1;

    IF prev_timestamp IS NOT NULL THEN
      -- Calculate time since previous prompt in seconds
      time_diff := EXTRACT(EPOCH FROM (COALESCE(NEW.created_at, NOW()) - prev_timestamp))::INTEGER;
      NEW.time_since_previous_seconds := time_diff;

      -- Set rapid-fire flag (< 30 seconds)
      NEW.is_rapid_fire := time_diff < 30;

      -- Set long-pause flag (> 300 seconds / 5 minutes)
      NEW.is_long_pause := time_diff > 300;

      -- Set sequence number (increment from previous)
      NEW.sequence_number := COALESCE(prev_sequence, 0) + 1;
    ELSE
      -- First prompt in session
      NEW.time_since_previous_seconds := NULL;
      NEW.is_rapid_fire := false;
      NEW.is_long_pause := false;
      NEW.sequence_number := 1;
    END IF;
  ELSE
    -- No session context - set defaults
    NEW.time_since_previous_seconds := NULL;
    NEW.is_rapid_fire := false;
    NEW.is_long_pause := false;
    -- sequence_number may be set externally, don't override if already set
    IF NEW.sequence_number IS NULL THEN
      NEW.sequence_number := 1;
    END IF;
  END IF;

  -- Check for follow-up patterns in the prompt text
  -- Patterns: also, and, additionally, furthermore, now, next, then, one more thing, another thing, oh, wait
  NEW.is_follow_up := NEW.text ~* '^\s*(also|and|additionally|furthermore|now|next|then|one more thing|another thing|oh|wait)\b';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CREATE TRIGGER
-- ============================================
-- BEFORE INSERT trigger to populate timing fields before row is inserted

-- Drop existing trigger if it exists (for idempotent migrations)
DROP TRIGGER IF EXISTS prompt_timing_trigger ON prompts;

CREATE TRIGGER prompt_timing_trigger
  BEFORE INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION analyze_prompt_timing();

-- ============================================
-- FUNCTION COMMENTS
-- ============================================

COMMENT ON FUNCTION analyze_prompt_timing() IS
  'Calculates timing metrics (time_since_previous_seconds, is_rapid_fire, is_long_pause, is_follow_up, sequence_number) before a prompt is inserted';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== TIMING TRIGGER MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created function: analyze_prompt_timing()';
  RAISE NOTICE 'Created trigger: prompt_timing_trigger (BEFORE INSERT)';
  RAISE NOTICE 'Timing metrics will be automatically calculated on insert';
  RAISE NOTICE '==========================================';
END $$;
