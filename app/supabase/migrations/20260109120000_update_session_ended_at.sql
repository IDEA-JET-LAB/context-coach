-- Migration: Update session ended_at from last prompt timestamp
-- This migration:
-- 1. Updates all existing sessions with ended_at calculated from their last prompt
-- 2. Creates a trigger to auto-update ended_at when new prompts are added

-- Step 1: Update all existing sessions with ended_at from last prompt
-- Only update if the last prompt timestamp is >= started_at (to satisfy check constraint)
UPDATE sessions s
SET ended_at = subq.last_prompt_at
FROM (
  SELECT
    p.session_uuid,
    MAX(p.created_at) as last_prompt_at
  FROM prompts p
  GROUP BY p.session_uuid
) subq
WHERE s.id = subq.session_uuid
  AND s.ended_at IS NULL
  AND subq.last_prompt_at >= s.started_at;

-- Step 2: Create function to update session ended_at on prompt insert
CREATE OR REPLACE FUNCTION update_session_ended_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the session's ended_at to the new prompt's timestamp
  -- Only update if this prompt's timestamp is later than current ended_at
  -- AND the timestamp is >= started_at (to satisfy check constraint)
  IF NEW.session_uuid IS NOT NULL THEN
    UPDATE sessions
    SET ended_at = NEW.created_at
    WHERE id = NEW.session_uuid
      AND (ended_at IS NULL OR ended_at < NEW.created_at)
      AND started_at <= NEW.created_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger on prompts table
DROP TRIGGER IF EXISTS trigger_update_session_ended_at ON prompts;
CREATE TRIGGER trigger_update_session_ended_at
  AFTER INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_session_ended_at();

-- Step 4: Also update on prompt_responses insert (for live capture)
CREATE OR REPLACE FUNCTION update_session_ended_at_from_response()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_uuid IS NOT NULL THEN
    UPDATE sessions
    SET ended_at = NEW.created_at
    WHERE id = NEW.session_uuid
      AND (ended_at IS NULL OR ended_at < NEW.created_at)
      AND started_at <= NEW.created_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_session_ended_at_response ON prompt_responses;
CREATE TRIGGER trigger_update_session_ended_at_response
  AFTER INSERT ON prompt_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_session_ended_at_from_response();
