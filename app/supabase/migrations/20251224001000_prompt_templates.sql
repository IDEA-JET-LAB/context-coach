-- Migration: 20251224001000_prompt_templates.sql
-- Description: Create prompt templates schema for Story 22-1

-- Template types enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_template_type') THEN
    CREATE TYPE prompt_template_type AS ENUM ('analysis', 'feedback', 'classification');
  END IF;
END $$;

-- Template status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prompt_template_status') THEN
    CREATE TYPE prompt_template_status AS ENUM ('draft', 'active', 'archived');
  END IF;
END $$;

-- Prompt templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type prompt_template_type NOT NULL,
  body TEXT NOT NULL,
  status prompt_template_status DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  -- Ensure unique active templates per name+type combination
  CONSTRAINT check_template_body_length CHECK (char_length(body) >= 10)
);

-- Add a partial unique index to enforce unique active templates per name+type
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_template_name_type
ON prompt_templates (name, type)
WHERE status = 'active';

-- Variable definitions table
CREATE TABLE IF NOT EXISTS prompt_template_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  type prompt_template_type NOT NULL,
  description TEXT NOT NULL,
  example_value TEXT,
  required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_variable_per_type UNIQUE (name, type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_templates_type_status ON prompt_templates(type, status);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON prompt_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_status ON prompt_templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_updated_at ON prompt_templates(updated_at DESC);

-- RLS Policies (super admin only via service role)
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_template_variables ENABLE ROW LEVEL SECURITY;

-- Super admins can read/write templates via service role client
-- No direct user policies needed as we use service role client for all admin operations

-- Trigger to update updated_at on template changes
CREATE OR REPLACE FUNCTION update_prompt_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_prompt_template_timestamp ON prompt_templates;
CREATE TRIGGER trigger_update_prompt_template_timestamp
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_prompt_template_timestamp();

-- Audit trigger for template changes
-- Note: Audit logging will be added in a future migration when admin_audit_logs table is ready
-- CREATE OR REPLACE FUNCTION audit_prompt_template_change() ... (deferred)

-- Insert default variables for each template type
INSERT INTO prompt_template_variables (name, type, description, example_value, required) VALUES
  -- Analysis variables
  ('prompt', 'analysis', 'The user prompt to analyze', 'Explain how React hooks work', true),
  ('prompt_length', 'analysis', 'Character count of the prompt', '156', true),
  ('word_count', 'analysis', 'Word count of the prompt', '28', true),
  ('context', 'analysis', 'Additional context if available', 'Previous conversation about React patterns...', false),

  -- Feedback variables
  ('score', 'feedback', 'Overall score (1-10)', '7.5', true),
  ('dimension_scores', 'feedback', 'JSON object of dimension scores', '{"clarity": 8, "specificity": 6, "context": 7}', true),
  ('suggestions', 'feedback', 'Array of improvement suggestions', '["Be more specific about the desired output", "Add context about your environment"]', true),
  ('strengths', 'feedback', 'Array of prompt strengths identified', '["Clear goal stated", "Good structure"]', false),

  -- Classification variables
  ('prompt', 'classification', 'The prompt to classify', 'Fix the bug in auth.ts where login fails', true),
  ('patterns', 'classification', 'Regex patterns to match against', '{"bug_fix": "fix|bug|error", "feature": "add|create|implement"}', true),
  ('categories', 'classification', 'Available category definitions', '["feature", "bug_fix", "refactor", "documentation", "question"]', true)
ON CONFLICT (name, type) DO NOTHING;

-- Insert sample templates for testing/demo purposes
INSERT INTO prompt_templates (name, description, type, body, status, version, created_by)
VALUES
  (
    'Default Analysis Template',
    'Standard template for analyzing prompt quality',
    'analysis',
    'Analyze the following prompt for quality and effectiveness:

Prompt: {{prompt}}
Length: {{prompt_length}} characters ({{word_count}} words)

{{context}}

Evaluate the prompt on the following dimensions:
1. Clarity - Is the intent clear?
2. Specificity - Is it specific enough to get a good response?
3. Context - Does it provide sufficient context?
4. Structure - Is it well-organized?

Provide a score from 1-10 for each dimension and an overall score.',
    'draft',
    1,
    NULL
  ),
  (
    'Feedback Generation Template',
    'Template for generating user feedback based on analysis',
    'feedback',
    'Based on the analysis results, provide constructive feedback to the user.

Overall Score: {{score}}/10
Dimension Breakdown: {{dimension_scores}}

Identified Strengths:
{{strengths}}

Generate improvement suggestions based on the following areas:
{{suggestions}}

Format the feedback in a friendly, encouraging tone that helps the user improve their prompting skills.',
    'draft',
    1,
    NULL
  ),
  (
    'Prompt Classification Template',
    'Template for categorizing prompts by intent',
    'classification',
    'Classify the following prompt into one of the available categories:

Prompt: {{prompt}}

Available Categories: {{categories}}

Pattern Matching Rules: {{patterns}}

Determine the primary category and confidence level.
If the prompt fits multiple categories, list them in order of relevance.',
    'draft',
    1,
    NULL
  )
ON CONFLICT DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE prompt_templates IS 'LLM prompt templates for analysis, feedback, and classification with version control';
COMMENT ON TABLE prompt_template_variables IS 'Variable definitions available for each template type';
