-- Add is_imported flag to sessions table
-- This allows differentiating between live-captured and imported sessions

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS is_imported BOOLEAN DEFAULT FALSE;

-- Add index for filtering by import status
CREATE INDEX IF NOT EXISTS idx_sessions_is_imported ON sessions(is_imported) WHERE is_imported = TRUE;

COMMENT ON COLUMN sessions.is_imported IS 'True if session was created via historical import, false for live captures';
