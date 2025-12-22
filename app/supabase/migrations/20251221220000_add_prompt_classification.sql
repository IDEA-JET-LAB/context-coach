-- Migration: Add prompt classification support
-- Story 5.7: Command Prompt Classification
--
-- Adds prompt_type column to distinguish between:
-- - 'prompt': Regular prompts (analyzed)
-- - 'command': Pure slash commands like /commit, /dev (skipped)
-- - 'command_with_prompt': Commands with text like "/dev help me" (analyzed)

-- Step 1: Add prompt_type column
ALTER TABLE prompts
ADD COLUMN prompt_type TEXT NOT NULL DEFAULT 'prompt'
CHECK (prompt_type IN ('prompt', 'command', 'command_with_prompt'));

-- Step 2: Add analyzed_text column for storing extracted prompt from command_with_prompt
-- This is the text portion that gets analyzed (e.g., "help me implement OAuth" from "/dev help me implement OAuth")
ALTER TABLE prompts
ADD COLUMN analyzed_text TEXT;

-- Step 3: Update analysis_status CHECK constraint to include 'skipped'
-- First drop the existing constraint, then add new one
ALTER TABLE prompts DROP CONSTRAINT IF EXISTS prompts_analysis_status_check;
ALTER TABLE prompts
ADD CONSTRAINT prompts_analysis_status_check
CHECK (analysis_status IN ('pending', 'processing', 'complete', 'failed', 'skipped'));

-- Step 4: Classify existing prompts based on their text content
-- Pure commands: start with / and have no meaningful text after
UPDATE prompts
SET prompt_type = 'command',
    analysis_status = CASE
      WHEN analysis_status = 'pending' THEN 'skipped'
      ELSE analysis_status
    END
WHERE text ~ '^/[a-zA-Z][a-zA-Z0-9_:-]*\s*$'
   OR text ~ '^/[a-zA-Z][a-zA-Z0-9_:-]*\s+[\d\s-]*$';

-- Commands with prompts: start with / but have meaningful text after
UPDATE prompts
SET prompt_type = 'command_with_prompt',
    analyzed_text = regexp_replace(text, '^/[a-zA-Z][a-zA-Z0-9_:-]*\s+', '')
WHERE text ~ '^/[a-zA-Z][a-zA-Z0-9_:-]*\s+.+'
  AND prompt_type = 'prompt'  -- Not already classified as command
  AND length(regexp_replace(text, '^/[a-zA-Z][a-zA-Z0-9_:-]*\s+', '')) > 5;

-- Step 5: Add index for filtering by prompt_type
CREATE INDEX IF NOT EXISTS idx_prompts_prompt_type ON prompts(prompt_type);

-- Step 6: Add comments
COMMENT ON COLUMN prompts.prompt_type IS
  'Classification: prompt (regular), command (skip analysis), command_with_prompt (analyze extracted text)';

COMMENT ON COLUMN prompts.analyzed_text IS
  'For command_with_prompt type: the extracted text portion that was analyzed';
