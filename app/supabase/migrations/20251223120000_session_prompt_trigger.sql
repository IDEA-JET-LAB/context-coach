-- Session Prompt Count Trigger Migration
-- Story 16-3: Session Metadata Capture
-- Automatically increments session.total_prompts when a prompt is linked to a session

-- ============================================
-- TRIGGER FUNCTION
-- ============================================
-- Increments total_prompts on the linked session when a prompt is inserted

CREATE OR REPLACE FUNCTION on_prompt_session_link()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if session_uuid is set
  IF NEW.session_uuid IS NOT NULL THEN
    UPDATE sessions
    SET
      total_prompts = total_prompts + 1,
      updated_at = NOW()
    WHERE id = NEW.session_uuid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER ON INSERT
-- ============================================
-- Fires after a new prompt is inserted with a session_uuid

CREATE TRIGGER prompt_session_link_trigger
  AFTER INSERT ON prompts
  FOR EACH ROW
  WHEN (NEW.session_uuid IS NOT NULL)
  EXECUTE FUNCTION on_prompt_session_link();

-- ============================================
-- TRIGGER FOR UPDATE (optional but useful)
-- ============================================
-- Handles the case where session_uuid is updated on an existing prompt
-- This is less common but ensures consistency

CREATE OR REPLACE FUNCTION on_prompt_session_relink()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrement old session if it was linked
  IF OLD.session_uuid IS NOT NULL AND OLD.session_uuid IS DISTINCT FROM NEW.session_uuid THEN
    UPDATE sessions
    SET
      total_prompts = GREATEST(0, total_prompts - 1),
      updated_at = NOW()
    WHERE id = OLD.session_uuid;
  END IF;

  -- Increment new session if now linked (and wasn't before, or different)
  IF NEW.session_uuid IS NOT NULL AND (OLD.session_uuid IS NULL OR OLD.session_uuid IS DISTINCT FROM NEW.session_uuid) THEN
    UPDATE sessions
    SET
      total_prompts = total_prompts + 1,
      updated_at = NOW()
    WHERE id = NEW.session_uuid;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prompt_session_relink_trigger
  AFTER UPDATE OF session_uuid ON prompts
  FOR EACH ROW
  WHEN (OLD.session_uuid IS DISTINCT FROM NEW.session_uuid)
  EXECUTE FUNCTION on_prompt_session_relink();

-- ============================================
-- TRIGGER FOR DELETE
-- ============================================
-- Decrements total_prompts when a prompt is deleted

CREATE OR REPLACE FUNCTION on_prompt_session_unlink()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrement session if it was linked
  IF OLD.session_uuid IS NOT NULL THEN
    UPDATE sessions
    SET
      total_prompts = GREATEST(0, total_prompts - 1),
      updated_at = NOW()
    WHERE id = OLD.session_uuid;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prompt_session_unlink_trigger
  AFTER DELETE ON prompts
  FOR EACH ROW
  WHEN (OLD.session_uuid IS NOT NULL)
  EXECUTE FUNCTION on_prompt_session_unlink();

-- ============================================
-- FUNCTION COMMENTS
-- ============================================

COMMENT ON FUNCTION on_prompt_session_link() IS
  'Increments session.total_prompts when a prompt is inserted with a session_uuid';

COMMENT ON FUNCTION on_prompt_session_relink() IS
  'Handles session.total_prompts when a prompt''s session_uuid is changed';

COMMENT ON FUNCTION on_prompt_session_unlink() IS
  'Decrements session.total_prompts when a linked prompt is deleted';

-- ============================================
-- RECALCULATE FUNCTION (for fixing data)
-- ============================================
-- Utility function to recalculate total_prompts for all sessions
-- Can be called manually if counts get out of sync

CREATE OR REPLACE FUNCTION recalculate_session_prompt_counts()
RETURNS TABLE (session_id UUID, old_count INTEGER, new_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH calculated AS (
    SELECT
      s.id AS session_id,
      s.total_prompts AS old_count,
      COUNT(p.id)::BIGINT AS new_count
    FROM sessions s
    LEFT JOIN prompts p ON p.session_uuid = s.id
    GROUP BY s.id, s.total_prompts
    HAVING s.total_prompts != COUNT(p.id)
  ),
  updated AS (
    UPDATE sessions s
    SET
      total_prompts = c.new_count::INTEGER,
      updated_at = NOW()
    FROM calculated c
    WHERE s.id = c.session_id
    RETURNING s.id
  )
  SELECT c.session_id, c.old_count, c.new_count
  FROM calculated c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_session_prompt_counts() IS
  'Utility function to recalculate total_prompts for all sessions where the count is incorrect';

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== SESSION PROMPT TRIGGER MIGRATION COMPLETE ===';
  RAISE NOTICE 'Created trigger: prompt_session_link_trigger (INSERT)';
  RAISE NOTICE 'Created trigger: prompt_session_relink_trigger (UPDATE)';
  RAISE NOTICE 'Created trigger: prompt_session_unlink_trigger (DELETE)';
  RAISE NOTICE 'Created utility: recalculate_session_prompt_counts()';
  RAISE NOTICE '=================================================';
END $$;
