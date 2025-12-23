-- Migration: Add work style classification columns
-- Story 21-2: Work Style Categorization
--
-- Adds work_style_category and work_style_confidence columns to prompts table
-- for automatic classification of prompt work styles.

-- Step 1: Add work_style_category column with CHECK constraint
ALTER TABLE prompts
ADD COLUMN work_style_category VARCHAR(50);

-- Step 2: Add CHECK constraint for valid category values
ALTER TABLE prompts
ADD CONSTRAINT valid_work_style_category CHECK (
  work_style_category IS NULL OR work_style_category IN (
    'architecture_questions',
    'file_operations',
    'debugging',
    'agent_delegation',
    'testing',
    'deployment',
    'design_iteration',
    'context_recovery',
    'quick_commands',
    'business_discussion'
  )
);

-- Step 3: Add work_style_confidence column (0.00 to 1.00)
ALTER TABLE prompts
ADD COLUMN work_style_confidence DECIMAL(3,2);

-- Step 4: Add CHECK constraint for valid confidence range
ALTER TABLE prompts
ADD CONSTRAINT valid_work_style_confidence CHECK (
  work_style_confidence IS NULL OR (work_style_confidence >= 0 AND work_style_confidence <= 1)
);

-- Step 5: Add index for filtering by work_style_category
CREATE INDEX IF NOT EXISTS idx_prompts_work_style ON prompts(work_style_category);

-- Step 6: Add comments
COMMENT ON COLUMN prompts.work_style_category IS
  'Classification of prompt work style: architecture_questions, file_operations, debugging, agent_delegation, testing, deployment, design_iteration, context_recovery, quick_commands, or business_discussion';

COMMENT ON COLUMN prompts.work_style_confidence IS
  'Confidence score (0.00 to 1.00) for the work style classification';
