# Story 5.6: Analysis Configuration Management

Status: ready-for-dev

## Story
**As a** platform admin,
**I want** to configure analysis dimensions and weights,
**So that** the scoring can be tuned over time.

## Acceptance Criteria

1. **Given** the analysis config schema
   **When** this story is complete
   **Then** `analysis_configs` table exists with: id, version, name, system_prompt, model, is_active, created_by, created_at

2. **Given** the analysis config schema
   **When** this story is complete
   **Then** `analysis_dimensions` table exists with: id, config_id, name, description, weight, prompt_template, scoring_criteria, enabled, sort_order

3. **Given** the analysis config schema
   **When** this story is complete
   **Then** only one config can have `is_active = true`

4. **Given** a new analysis is triggered
   **When** the Edge Function loads config
   **Then** it uses the config where `is_active = true`

5. **Given** a new analysis is triggered
   **When** the Edge Function loads config
   **Then** the config_id is recorded with the analysis

6. **Given** default seed data
   **When** the database is initialized
   **Then** a default analysis config exists with 5 dimensions

7. **Given** default seed data
   **When** the database is initialized
   **Then** weights are: Clarity 25%, Context 25%, Specificity 20%, Goal 15%, Constraints 15%

## Tasks / Subtasks

- [ ] **Task 1: Create analysis_configs table** (AC: #1)
  - [ ] Create migration file `YYYYMMDDHHMMSS_create_analysis_configs_table.sql`
  - [ ] Define columns: id (UUID), version (INTEGER), name (TEXT), system_prompt (TEXT), model (TEXT DEFAULT 'gpt-4o-mini'), is_active (BOOLEAN), created_by (UUID FK to users), created_at (TIMESTAMPTZ)
  - [ ] Add unique constraint on `version` number
  - [ ] Create partial unique index for single active config: `WHERE is_active = true`
  - [ ] Add index on `is_active` for fast lookup
  - [ ] Enable RLS with admin-only modification policies

- [ ] **Task 2: Create analysis_dimensions table** (AC: #2)
  - [ ] Define columns: id (UUID), config_id (UUID FK), name (TEXT), description (TEXT), weight (INTEGER), prompt_template (TEXT), scoring_criteria (TEXT), enabled (BOOLEAN), sort_order (INTEGER)
  - [ ] Add foreign key constraint to `analysis_configs` with ON DELETE CASCADE
  - [ ] Add unique constraint on (config_id, name)
  - [ ] Add check constraint: weight >= 0 AND weight <= 100
  - [ ] Add index on config_id for efficient loading
  - [ ] Enable RLS with admin-only modification policies

- [ ] **Task 3: Update prompt_analyses table** (AC: #5)
  - [ ] Add `config_id` column (UUID FK to analysis_configs)
  - [ ] Create index on config_id for historical lookups
  - [ ] Update RLS policies to allow reading via prompt's team_id

- [ ] **Task 4: Create RLS policies** (AC: #1, #2)
  - [ ] `analysis_configs`: SELECT for all authenticated users (transparency)
  - [ ] `analysis_configs`: INSERT/UPDATE/DELETE restricted to `is_super_admin = true`
  - [ ] `analysis_dimensions`: Same pattern as configs
  - [ ] Test policies with admin and non-admin users
  - [ ] Verify service role client bypasses RLS for Edge Functions

- [ ] **Task 5: Create default seed data** (AC: #6, #7)
  - [ ] Create seed migration `YYYYMMDDHHMMSS_seed_default_analysis_config.sql`
  - [ ] Insert default config: version 1, name "Default Scoring v1", is_active = true
  - [ ] Insert 5 dimensions with weights:
    - Clarity: 25%, sort_order: 1
    - Context: 25%, sort_order: 2
    - Specificity: 20%, sort_order: 3
    - Goal: 15%, sort_order: 4
    - Constraints: 15%, sort_order: 5
  - [ ] Include detailed prompt_template and scoring_criteria for each
  - [ ] Verify weights sum to 100

- [ ] **Task 6: Update Edge Function to load active config** (AC: #4, #5)
  - [ ] Query analysis_configs where is_active = true with dimensions
  - [ ] Record config_id when inserting analysis results
  - [ ] Add error handling for missing active config (fail gracefully)
  - [ ] Log config version used for observability

- [ ] **Task 7: Create admin UI for config management** (AC: #1, #2, #3)
  - [ ] Create `app/(dashboard)/admin/analysis-config/page.tsx`
  - [ ] Display current active config with all dimensions
  - [ ] Show version history with activation dates
  - [ ] Implement "Create New Version" action (clones existing, increments version)
  - [ ] Add loading states with Skeleton components
  - [ ] Add error handling with toast notifications
  - [ ] Implement keyboard navigation (Tab, Enter, Escape)
  - [ ] Use TanStack Query with `isPending` for mutations

- [ ] **Task 8: Create config editor component**
  - [ ] Create `components/admin/config-editor.tsx`
  - [ ] Allow editing dimension weights with real-time sum validation
  - [ ] Show warning if weights don't sum to 100
  - [ ] Allow toggling dimension enabled status
  - [ ] Implement optimistic updates for better UX
  - [ ] Add aria-labels for accessibility

- [ ] **Task 9: Validate weights sum to 100%** (AC: #7)
  - [ ] Create database trigger function for INSERT/UPDATE validation
  - [ ] Sum all enabled dimension weights for a config
  - [ ] Reject if sum != 100 with clear error message
  - [ ] Use DEFERRED constraint for bulk seed inserts
  - [ ] Validate in admin UI before saving (client-side)

## Dev Notes

### Technology Stack
- **Database**: Supabase PostgreSQL with RLS
- **ORM**: Supabase client for CRUD, Drizzle for complex queries if needed
- **Frontend**: Next.js 15 App Router, TanStack Query v5 (`isPending` not `isLoading`)
- **UI**: shadcn/ui components, Tailwind CSS
- **Admin Access**: `users.is_super_admin = true` required

### Default Dimension Configuration
| Dimension | Weight | Sort Order |
|-----------|--------|------------|
| Clarity | 25% | 1 |
| Context | 25% | 2 |
| Specificity | 20% | 3 |
| Goal | 15% | 4 |
| Constraints | 15% | 5 |

### Database Schema

```sql
-- Migration: create_analysis_configs_table.sql

CREATE TABLE analysis_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_config_version UNIQUE (version)
);

-- Partial unique index: only one active config allowed
CREATE UNIQUE INDEX idx_one_active_config
  ON analysis_configs (is_active)
  WHERE is_active = true;

-- Index for active config lookup
CREATE INDEX idx_analysis_configs_active ON analysis_configs(is_active);

-- Enable RLS
ALTER TABLE analysis_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (non-overlapping)
CREATE POLICY "Authenticated users can read configs"
  ON analysis_configs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can insert configs"
  ON analysis_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Super admins can update configs"
  ON analysis_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Super admins can delete configs"
  ON analysis_configs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Analysis Dimensions table
CREATE TABLE analysis_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES analysis_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  prompt_template TEXT NOT NULL,
  scoring_criteria TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT unique_dimension_per_config UNIQUE (config_id, name)
);

-- Index for loading dimensions by config
CREATE INDEX idx_dimensions_config_id ON analysis_dimensions(config_id);

-- Enable RLS
ALTER TABLE analysis_dimensions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same pattern as configs)
CREATE POLICY "Authenticated users can read dimensions"
  ON analysis_dimensions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can insert dimensions"
  ON analysis_dimensions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Super admins can update dimensions"
  ON analysis_dimensions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "Super admins can delete dimensions"
  ON analysis_dimensions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Update prompt_analyses to track config version
ALTER TABLE prompt_analyses ADD COLUMN config_id UUID REFERENCES analysis_configs(id);
CREATE INDEX idx_prompt_analyses_config ON prompt_analyses(config_id);

COMMENT ON TABLE analysis_configs IS 'Configuration versions for prompt analysis';
COMMENT ON TABLE analysis_dimensions IS 'Scoring dimensions for each analysis config';
```

### Weight Validation Trigger

```sql
-- Deferred constraint trigger for weight validation
CREATE OR REPLACE FUNCTION validate_dimension_weights()
RETURNS TRIGGER AS $$
DECLARE
  total_weight INTEGER;
BEGIN
  SELECT COALESCE(SUM(weight), 0) INTO total_weight
  FROM analysis_dimensions
  WHERE config_id = NEW.config_id AND enabled = true;

  -- Allow non-100 during transaction, validate at commit
  IF total_weight != 100 AND total_weight > 0 THEN
    RAISE EXCEPTION 'Enabled dimension weights must sum to 100%%. Current sum: %', total_weight
      USING HINT = 'Adjust weights so enabled dimensions total exactly 100';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER check_dimension_weights
  AFTER INSERT OR UPDATE ON analysis_dimensions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION validate_dimension_weights();
```

### Default Seed Data

```sql
-- Migration: seed_default_analysis_config.sql

-- Insert default config
INSERT INTO analysis_configs (id, version, name, system_prompt, model, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  1,
  'Default Scoring v1',
  'You are an expert prompt engineering coach. Analyze the following prompt and score it on multiple dimensions. Be constructive, specific, and actionable in your feedback. Your goal is to help users write better prompts that get better results from AI assistants.',
  'gpt-4o-mini',
  true
);

-- Insert dimensions (weights sum to 100)
INSERT INTO analysis_dimensions (config_id, name, description, weight, prompt_template, scoring_criteria, enabled, sort_order) VALUES

('a0000000-0000-0000-0000-000000000001', 'Clarity',
 'How clear and unambiguous is the prompt? Can it be understood without additional context?',
 25,
 'Evaluate how clearly the prompt communicates the request. Consider ambiguity, sentence structure, and whether the intent is obvious.',
 '1-3: Confusing, multiple interpretations possible, poor grammar\n4-5: Somewhat clear but has ambiguous elements\n6-7: Generally clear with minor ambiguities\n8-9: Very clear, easy to understand\n10: Crystal clear, no possible misinterpretation',
 true, 1),

('a0000000-0000-0000-0000-000000000001', 'Context',
 'Is sufficient background information provided? Does the reader understand the situation?',
 25,
 'Evaluate whether enough context is provided to understand the request. Consider background info, environment details, and relevant history.',
 '1-3: No context, impossible to understand situation\n4-5: Minimal context, missing key background\n6-7: Adequate context, some gaps\n8-9: Good context, well-framed\n10: Excellent context, complete picture provided',
 true, 2),

('a0000000-0000-0000-0000-000000000001', 'Specificity',
 'Are requirements specific and detailed? Are vague terms avoided?',
 20,
 'Evaluate how specific and detailed the requirements are. Look for concrete details vs vague generalizations.',
 '1-3: Very vague, no specific details\n4-5: Some specifics but many undefined terms\n6-7: Reasonably specific with room for improvement\n8-9: Highly specific, detailed requirements\n10: Extremely detailed, nothing left to interpretation',
 true, 3),

('a0000000-0000-0000-0000-000000000001', 'Goal',
 'Is the desired outcome clearly stated? Will you know when you''ve succeeded?',
 15,
 'Evaluate whether the end goal is clear. Consider success criteria and how someone would know when the task is complete.',
 '1-3: No goal stated, unclear what success looks like\n4-5: Goal implied but not explicit\n6-7: Goal stated but success criteria unclear\n8-9: Clear goal with measurable outcome\n10: Perfect goal definition with explicit success criteria',
 true, 4),

('a0000000-0000-0000-0000-000000000001', 'Constraints',
 'Are limitations and boundaries defined? Are there clear parameters to work within?',
 15,
 'Evaluate whether constraints and boundaries are defined. Consider limitations, preferences, and scope boundaries.',
 '1-3: No constraints, completely open-ended\n4-5: Few constraints, mostly undefined scope\n6-7: Some constraints but gaps exist\n8-9: Well-defined constraints and boundaries\n10: Comprehensive constraints, all parameters clear',
 true, 5);
```

### TypeScript Types

```typescript
// lib/types/analysis-config.ts

export interface AnalysisConfig {
  id: string;
  version: number;
  name: string;
  system_prompt: string;
  model: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  analysis_dimensions?: AnalysisDimension[];
}

export interface AnalysisDimension {
  id: string;
  config_id: string;
  name: string;
  description: string;
  weight: number;
  prompt_template: string;
  scoring_criteria: string;
  enabled: boolean;
  sort_order: number;
}

export interface ConfigFormData {
  name: string;
  system_prompt: string;
  model: string;
  dimensions: Omit<AnalysisDimension, 'id' | 'config_id'>[];
}

export type ConfigMutationError = {
  code: 'WEIGHTS_INVALID' | 'VERSION_EXISTS' | 'UNAUTHORIZED' | 'UNKNOWN';
  message: string;
};
```

### Query Functions

```typescript
// lib/db/queries/analysis-config.ts
import { createClient } from '@/lib/supabase/server';
import type { AnalysisConfig } from '@/lib/types/analysis-config';

export async function getActiveConfig(): Promise<AnalysisConfig | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('analysis_configs')
    .select(`
      *,
      analysis_dimensions (*)
    `)
    .eq('is_active', true)
    .order('sort_order', { referencedTable: 'analysis_dimensions' })
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows
    throw error;
  }

  return data;
}

export async function getAllConfigs(): Promise<AnalysisConfig[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('analysis_configs')
    .select(`
      *,
      analysis_dimensions (*)
    `)
    .order('version', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createConfigVersion(
  baseConfigId: string,
  updates: Partial<ConfigFormData>
): Promise<AnalysisConfig> {
  const supabase = await createClient();

  // Get max version
  const { data: maxVersion } = await supabase
    .from('analysis_configs')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const newVersion = (maxVersion?.version || 0) + 1;

  // Insert new config (inactive by default)
  const { data: newConfig, error } = await supabase
    .from('analysis_configs')
    .insert({
      version: newVersion,
      name: updates.name || `Config v${newVersion}`,
      system_prompt: updates.system_prompt || '',
      model: updates.model || 'gpt-4o-mini',
      is_active: false,
      created_by: (await supabase.auth.getUser()).data.user?.id
    })
    .select()
    .single();

  if (error) throw error;
  return newConfig;
}
```

### File Locations

| File | Path |
|------|------|
| Config Migration | `supabase/migrations/YYYYMMDDHHMMSS_create_analysis_configs_table.sql` |
| Seed Migration | `supabase/migrations/YYYYMMDDHHMMSS_seed_default_analysis_config.sql` |
| TypeScript Types | `lib/types/analysis-config.ts` |
| Config Queries | `lib/db/queries/analysis-config.ts` |
| Admin Page | `app/(dashboard)/admin/analysis-config/page.tsx` |
| Config List | `components/admin/analysis/ConfigList.tsx` |
| Config Editor | `components/admin/analysis/ConfigEditor.tsx` |
| Dimension Editor | `components/admin/analysis/DimensionEditor.tsx` |

### Common Pitfalls to Avoid

1. **DO NOT** use `FOR ALL` RLS policy - use separate INSERT/UPDATE/DELETE policies
2. **DO NOT** allow multiple active configs - partial unique index enforces this
3. **DO NOT** delete old configs - preserve for historical analysis lookup
4. **DO NOT** allow weights that don't sum to 100 (for enabled dimensions)
5. **DO NOT** forget to seed default config on fresh database
6. **DO NOT** expose config editing to non-admin users
7. **DO NOT** hardcode dimension names in Edge Function - always load from DB
8. **DO NOT** use `isLoading` - TanStack Query v5 uses `isPending`

### Verification Checklist

After completing this story, verify:
- [ ] `analysis_configs` table exists with correct schema
- [ ] `analysis_dimensions` table exists with correct schema
- [ ] `prompt_analyses.config_id` column exists with FK
- [ ] Only one config can have `is_active = true` (test with SQL)
- [ ] Default config is seeded with 5 dimensions
- [ ] Dimension weights sum to 100% (25+25+20+15+15)
- [ ] Edge Function loads active config and records config_id
- [ ] Admin users can view and edit configs
- [ ] Non-admin users can view but not edit configs
- [ ] New config versions can be created (increments version)
- [ ] Weight validation rejects non-100 sums
- [ ] Admin UI shows loading states and handles errors
- [ ] Keyboard navigation works in config editor

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
