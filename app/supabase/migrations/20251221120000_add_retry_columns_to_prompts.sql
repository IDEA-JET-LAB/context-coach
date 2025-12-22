-- Retry Columns Migration
-- Story 5.5: Retry Logic and Error Handling
--
-- Adds columns and indexes to support retry logic for failed analyses.

-- ============================================
-- ADD RETRY COLUMNS TO PROMPTS TABLE
-- ============================================

-- Number of analysis attempts (for retry limiting)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS analysis_attempts INTEGER NOT NULL DEFAULT 0;

-- Last error message from analysis (for debugging)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS last_analysis_error TEXT;

-- Timestamp of last analysis attempt (for timing/debugging)
ALTER TABLE prompts
ADD COLUMN IF NOT EXISTS last_analysis_attempt_at TIMESTAMPTZ;

-- ============================================
-- INDEXES FOR RETRY AND DEAD LETTER QUERIES
-- ============================================

-- Partial index for dead letter queue queries (failed prompts)
CREATE INDEX IF NOT EXISTS idx_prompts_failed ON prompts(analysis_status)
WHERE analysis_status = 'failed';

-- Partial index for finding prompts that need retry
-- (has attempts but not complete)
CREATE INDEX IF NOT EXISTS idx_prompts_retry_needed ON prompts(analysis_attempts)
WHERE analysis_attempts > 0 AND analysis_status != 'complete';
