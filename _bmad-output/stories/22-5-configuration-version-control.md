# Story 22.5: Configuration Version Control

Status: Ready

## Story

**As a** super admin,
**I want** a version control system for analysis configurations with draft/active/archived states,
**So that** I can safely iterate on configurations and rollback if needed.

## Acceptance Criteria

1. **Given** I create a new configuration
   **When** it is saved
   **Then** it starts in "draft" status
   **And** it receives an incremental version number

2. **Given** I have a draft configuration
   **When** I make changes and save
   **Then** the changes are saved without creating a new version
   **And** I can preview the draft against sample data

3. **Given** I want to activate a draft configuration
   **When** I click "Activate"
   **Then** a complete snapshot of the config is saved
   **And** the current active config becomes archived
   **And** the draft becomes active

4. **Given** I have an active configuration
   **When** I try to edit it
   **Then** I am prompted to create a new draft version
   **And** the active config remains unchanged

5. **Given** I need to rollback
   **When** I select an archived version and click "Rollback"
   **Then** a new draft is created from the archived snapshot
   **And** I can activate it after review

6. **Given** I view the version history
   **When** I select any version
   **Then** I see the complete configuration at that point in time
   **And** I can compare it with another version

7. **Given** I create or edit prompt templates (Story 22-1)
   **When** I save changes
   **Then** templates follow the same draft/active/archived lifecycle
   **And** template changes are captured in configuration snapshots

8. **Given** I create or edit classification rules (Story 22-2)
   **When** I save changes
   **Then** rules follow the same draft/active/archived lifecycle
   **And** rule changes are captured in configuration snapshots

9. **Given** I need to activate coordinated changes across configs, templates, and rules
   **When** I click "Activate Configuration Set"
   **Then** all related entities are activated atomically in a single transaction
   **And** if any entity fails validation, the entire activation is rolled back
   **And** a unified snapshot captures the complete state of all entity types

10. **Given** I need to rollback a coordinated configuration set
    **When** I select a snapshot that contains multiple entity types
    **Then** all entity types are restored together as drafts
    **And** the system maintains referential integrity between entities

## Dependencies

- **Story 7.5**: Analysis Config Editor (base config structure)
- **Story 22.1**: Analysis Prompt Templates (templates in config)
- **Story 22.3**: Scoring Weight Configuration (weights in config)
- **Story 22.10**: Configuration Audit Trail (audit logging)

## Tasks / Subtasks

- [ ] **Task 1: Extend database schema for versioning** (AC: #1, #3)
  - [ ] Create migration `20251223004000_config_versioning.sql`
  - [ ] Add `status` column to analysis_configs: 'draft', 'active', 'archived'
  - [ ] Create `config_snapshots` table for immutable snapshots
  - [ ] Add `parent_version_id` for tracking lineage
  - [ ] Add `activated_at`, `archived_at` timestamps

- [ ] **Task 2: Create config snapshot functionality** (AC: #3)
  - [ ] Create `lib/services/config-snapshots.ts`
  - [ ] Implement `createSnapshot(configId)` - captures full config state
  - [ ] Store dimensions, templates, rules, weights as JSON
  - [ ] Make snapshots immutable (no update policy)

- [ ] **Task 3: Implement draft editing workflow** (AC: #2)
  - [ ] Modify existing config edit page for draft-only editing
  - [ ] Add autosave for drafts (debounced, every 30 seconds)
  - [ ] Show "Draft" badge prominently
  - [ ] Add "Discard Changes" option

- [ ] **Task 4: Create activation workflow** (AC: #3)
  - [ ] Create `lib/services/config-activation.ts`
  - [ ] Implement pre-activation validation (weights sum, templates valid)
  - [ ] Create snapshot before activation
  - [ ] Archive current active config
  - [ ] Activate new config atomically

- [ ] **Task 5: Implement active config protection** (AC: #4)
  - [ ] Block direct edits to active configs (API-level)
  - [ ] Add "Create New Draft" button on active config view
  - [ ] Clone active config to new draft with incremented version
  - [ ] Redirect to draft editing page

- [ ] **Task 6: Create rollback functionality** (AC: #5)
  - [ ] Add "Rollback" button on archived version cards
  - [ ] Create new draft from archived snapshot
  - [ ] Preserve original snapshot (don't modify history)
  - [ ] Show rollback confirmation with diff summary

- [ ] **Task 7: Build version history view** (AC: #6)
  - [ ] Create `components/admin/config-version-history.tsx`
  - [ ] Query all versions ordered by created_at
  - [ ] Display timeline with status badges
  - [ ] Add expandable details for each version

- [ ] **Task 8: Implement version comparison** (AC: #6)
  - [ ] Create `components/admin/config-diff-viewer.tsx`
  - [ ] Allow selecting two versions for comparison
  - [ ] Show side-by-side diff of dimensions
  - [ ] Highlight added/removed/changed items

- [ ] **Task 9: Create preview functionality** (AC: #2)
  - [ ] Add "Preview" tab on draft config page
  - [ ] Run draft config against 5 sample prompts
  - [ ] Show resulting scores and feedback
  - [ ] Compare with current active config results

- [ ] **Task 10: Add version labels and notes** (AC: #1, #6)
  - [ ] Allow adding description/notes to each version
  - [ ] Support custom labels (e.g., "Holiday special", "Q4 focus")
  - [ ] Show notes in version history

- [ ] **Task 11: Extend versioning to prompt templates** (AC: #7)
  - [ ] Add `status` column to `prompt_templates` table (draft/active/archived)
  - [ ] Add `version`, `parent_version_id`, `activated_at`, `archived_at` columns
  - [ ] Create `lib/services/template-versioning.ts` with same lifecycle
  - [ ] Update template editor to respect draft-only editing
  - [ ] Include templates in config snapshots

- [ ] **Task 12: Extend versioning to classification rules** (AC: #8)
  - [ ] Add `status` column to `classification_rules` table (draft/active/archived)
  - [ ] Add `version`, `parent_version_id`, `activated_at`, `archived_at` columns
  - [ ] Create `lib/services/rule-versioning.ts` with same lifecycle
  - [ ] Update rule editor to respect draft-only editing
  - [ ] Include rules in config snapshots

- [ ] **Task 13: Create multi-entity snapshot service** (AC: #9, #10)
  - [ ] Create `lib/services/config-set-snapshots.ts`
  - [ ] Implement `createConfigSetSnapshot()` capturing configs, templates, rules
  - [ ] Store entity relationships and references in snapshot
  - [ ] Add `snapshot_type` column: 'single' | 'config_set'

- [ ] **Task 14: Implement coordinated activation** (AC: #9)
  - [ ] Create `lib/services/config-set-activation.ts`
  - [ ] Implement transaction-based activation using Supabase RPC
  - [ ] Validate all entities before starting transaction
  - [ ] Roll back all changes if any entity fails
  - [ ] Create unified snapshot on success

- [ ] **Task 15: Implement multi-entity rollback** (AC: #10)
  - [ ] Create `rollbackConfigSet(snapshotId)` function
  - [ ] Restore all entity types from snapshot as drafts
  - [ ] Preserve referential integrity (e.g., rule references template)
  - [ ] Show comprehensive diff before rollback confirmation

- [ ] **Task 16: Write E2E tests** (AC: #1-10)
  - [ ] Create `e2e/admin-config-versioning.spec.ts`
  - [ ] Test new config starts as draft
  - [ ] Test draft editing doesn't create versions
  - [ ] Test activation creates snapshot and archives old
  - [ ] Test active config blocks direct edit
  - [ ] Test rollback creates new draft
  - [ ] Test version comparison shows diff
  - [ ] Test template versioning lifecycle
  - [ ] Test rule versioning lifecycle
  - [ ] Test coordinated config set activation
  - [ ] Test multi-entity rollback from snapshot

## Dev Notes

### Database Schema

```sql
-- Migration: 20251223004000_config_versioning.sql

-- Add status to analysis_configs
ALTER TABLE analysis_configs
ADD COLUMN status VARCHAR(20) DEFAULT 'draft'
  CHECK (status IN ('draft', 'active', 'archived'));

-- Remove old is_active column (replace with status)
ALTER TABLE analysis_configs DROP COLUMN IF EXISTS is_active;

-- Add versioning fields
ALTER TABLE analysis_configs
ADD COLUMN parent_version_id UUID REFERENCES analysis_configs(id),
ADD COLUMN activated_at TIMESTAMPTZ,
ADD COLUMN archived_at TIMESTAMPTZ,
ADD COLUMN description TEXT,
ADD COLUMN labels TEXT[] DEFAULT '{}';

-- Config snapshots (immutable)
CREATE TABLE config_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID NOT NULL REFERENCES analysis_configs(id) ON DELETE CASCADE,
  config_version INTEGER NOT NULL,
  snapshot_data JSONB NOT NULL, -- Full config state
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT immutable_snapshot CHECK (true) -- Marker for RLS
);

-- No UPDATE policy on snapshots - they're immutable
ALTER TABLE config_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY snapshot_read ON config_snapshots
  FOR SELECT USING (true); -- Admins can read

CREATE POLICY snapshot_insert ON config_snapshots
  FOR INSERT WITH CHECK (true); -- Admins can create

-- No UPDATE or DELETE policies

-- Indexes
CREATE INDEX idx_configs_status ON analysis_configs(status);
CREATE INDEX idx_configs_parent ON analysis_configs(parent_version_id);
CREATE INDEX idx_snapshots_config ON config_snapshots(config_id);

-- Only one active config allowed
CREATE UNIQUE INDEX one_active_config ON analysis_configs (status)
  WHERE (status = 'active');

-- Migrate existing data
UPDATE analysis_configs
SET status = 'active'
WHERE is_active = TRUE;

UPDATE analysis_configs
SET status = 'archived'
WHERE is_active = FALSE AND id NOT IN (
  SELECT id FROM analysis_configs WHERE is_active = TRUE
);
```

### TypeScript Interfaces

```typescript
// lib/types/config-versioning.ts

export type ConfigStatus = 'draft' | 'active' | 'archived';

export interface VersionedConfig {
  id: string;
  version: number;
  name: string;
  description: string | null;
  labels: string[];
  status: ConfigStatus;
  parent_version_id: string | null;
  created_at: string;
  activated_at: string | null;
  archived_at: string | null;
  created_by: string | null;
}

export interface ConfigSnapshot {
  id: string;
  config_id: string;
  config_version: number;
  snapshot_type: 'single' | 'config_set'; // Single entity vs coordinated set
  snapshot_data: ConfigSnapshotData;
  created_at: string;
  created_by: string | null;
}

// Extended snapshot data model including all Epic 22 entity types
export interface ConfigSnapshotData {
  // Core analysis config
  system_prompt: string;
  model: string;
  dimensions: Array<{
    id: string;
    name: string;
    weight: number;
    prompt_template: string;
    scoring_criteria: string;
    enabled: boolean;
    sort_order: number;
  }>;

  // Story 22-1: Prompt Templates
  templates: Array<{
    id: string;
    name: string;
    type: 'system' | 'dimension' | 'feedback' | 'classification';
    template_key: string;
    body: string;
    variables: string[]; // e.g., ['prompt_text', 'dimension_name']
    version: number;
    is_default: boolean;
  }>;

  // Story 22-2: Classification Rules
  rules: Array<{
    id: string;
    name: string;
    category: string;
    pattern: string; // regex or keyword pattern
    pattern_type: 'regex' | 'keyword' | 'semantic';
    action: 'classify' | 'tag' | 'score_modifier';
    action_value: string | number;
    priority: number;
    enabled: boolean;
  }>;

  // Story 22-3: Scoring Weights (captured in dimensions.weight)
  // Story 22-4: Team-level overrides (separate snapshot per team)
  team_overrides?: Array<{
    team_id: string;
    dimension_name: string;
    weight_override: number;
  }>;

  // Metadata for coordinated snapshots
  entity_versions?: {
    config_version: number;
    template_versions: Record<string, number>; // template_id -> version
    rule_versions: Record<string, number>; // rule_id -> version
  };
}

export interface VersionComparison {
  left: VersionedConfig;
  right: VersionedConfig;
  differences: {
    dimensions: {
      added: string[];
      removed: string[];
      changed: Array<{
        name: string;
        field: string;
        left_value: any;
        right_value: any;
      }>;
    };
    system_prompt_changed: boolean;
    model_changed: boolean;
  };
}
```

### Snapshot Service

```typescript
// lib/services/config-snapshots.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from '@/lib/auth/admin';

export async function createSnapshot(configId: string): Promise<string> {
  await verifySuperAdmin();

  const supabase = createAdminClient();

  // Fetch full config state
  const { data: config } = await supabase
    .from('analysis_configs')
    .select(`
      id, version, name, system_prompt, model,
      analysis_dimensions(
        name, weight, prompt_template, scoring_criteria, enabled, sort_order
      )
    `)
    .eq('id', configId)
    .single();

  if (!config) throw new Error('Config not found');

  // Create snapshot
  const snapshotData = {
    system_prompt: config.system_prompt,
    model: config.model,
    dimensions: config.analysis_dimensions,
    // Add templates and rules when those features are implemented
  };

  const { data: snapshot, error } = await supabase
    .from('config_snapshots')
    .insert({
      config_id: configId,
      config_version: config.version,
      snapshot_data: snapshotData,
    })
    .select()
    .single();

  if (error) throw error;

  return snapshot.id;
}

export async function getSnapshot(snapshotId: string): Promise<ConfigSnapshot> {
  await verifySuperAdmin();

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('config_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (error) throw error;

  return data;
}
```

### Multi-Entity Config Set Snapshot Service

```typescript
// lib/services/config-set-snapshots.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from '@/lib/auth/admin';
import type { ConfigSnapshotData } from '@/lib/types/config-versioning';

/**
 * Creates a coordinated snapshot of all configuration entities.
 * This captures the complete state for atomic activation/rollback.
 */
export async function createConfigSetSnapshot(configId: string): Promise<string> {
  await verifySuperAdmin();

  const supabase = createAdminClient();

  // Fetch all entity types in parallel
  const [configResult, templatesResult, rulesResult, overridesResult] = await Promise.all([
    supabase
      .from('analysis_configs')
      .select(`
        id, version, name, system_prompt, model,
        analysis_dimensions(*)
      `)
      .eq('id', configId)
      .single(),

    supabase
      .from('prompt_templates')
      .select('*')
      .eq('status', 'draft'), // Get draft templates being activated

    supabase
      .from('classification_rules')
      .select('*')
      .eq('status', 'draft'), // Get draft rules being activated

    supabase
      .from('team_weight_overrides')
      .select('*')
      .eq('config_id', configId),
  ]);

  if (!configResult.data) throw new Error('Config not found');

  // Build comprehensive snapshot data
  const snapshotData: ConfigSnapshotData = {
    system_prompt: configResult.data.system_prompt,
    model: configResult.data.model,
    dimensions: configResult.data.analysis_dimensions || [],
    templates: (templatesResult.data || []).map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      template_key: t.template_key,
      body: t.body,
      variables: t.variables || [],
      version: t.version,
      is_default: t.is_default,
    })),
    rules: (rulesResult.data || []).map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      pattern: r.pattern,
      pattern_type: r.pattern_type,
      action: r.action,
      action_value: r.action_value,
      priority: r.priority,
      enabled: r.enabled,
    })),
    team_overrides: overridesResult.data || [],
    entity_versions: {
      config_version: configResult.data.version,
      template_versions: Object.fromEntries(
        (templatesResult.data || []).map(t => [t.id, t.version])
      ),
      rule_versions: Object.fromEntries(
        (rulesResult.data || []).map(r => [r.id, r.version])
      ),
    },
  };

  // Create the snapshot
  const { data: snapshot, error } = await supabase
    .from('config_snapshots')
    .insert({
      config_id: configId,
      config_version: configResult.data.version,
      snapshot_type: 'config_set',
      snapshot_data: snapshotData,
    })
    .select()
    .single();

  if (error) throw error;

  return snapshot.id;
}
```

### Transaction-Based Coordinated Activation

```typescript
// lib/services/config-set-activation.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from '@/lib/auth/admin';
import { createConfigSetSnapshot } from './config-set-snapshots';
import { logAdminAction } from './admin-users';
import { revalidatePath } from 'next/cache';

interface ActivationResult {
  success: boolean;
  snapshotId?: string;
  error?: string;
  failedEntity?: 'config' | 'templates' | 'rules';
}

/**
 * Activates a coordinated set of config, templates, and rules atomically.
 * Uses a Supabase RPC function for transaction support.
 */
export async function activateConfigSet(
  configId: string,
  templateIds: string[],
  ruleIds: string[]
): Promise<ActivationResult> {
  const admin = await verifySuperAdmin();
  const supabase = createAdminClient();

  // Step 1: Validate all entities before starting transaction
  const validationErrors = await validateAllEntities(configId, templateIds, ruleIds);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: validationErrors.join('; '),
    };
  }

  // Step 2: Create comprehensive snapshot BEFORE making changes
  const snapshotId = await createConfigSetSnapshot(configId);

  // Step 3: Execute atomic activation via RPC
  // This RPC function wraps all updates in a transaction
  const { data, error } = await supabase.rpc('activate_config_set', {
    p_config_id: configId,
    p_template_ids: templateIds,
    p_rule_ids: ruleIds,
    p_activated_by: admin.adminId,
    p_snapshot_id: snapshotId,
  });

  if (error) {
    // Transaction failed - snapshot remains but nothing was activated
    return {
      success: false,
      error: error.message,
      failedEntity: data?.failed_entity,
    };
  }

  await logAdminAction(admin.adminId, 'config_set_activated' as any, {
    config_id: configId,
    template_ids: templateIds,
    rule_ids: ruleIds,
    snapshot_id: snapshotId,
  });

  revalidatePath('/admin/config');
  return { success: true, snapshotId };
}

async function validateAllEntities(
  configId: string,
  templateIds: string[],
  ruleIds: string[]
): Promise<string[]> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  // Validate config weights sum to 100
  const { data: dimensions } = await supabase
    .from('analysis_dimensions')
    .select('weight, enabled')
    .eq('config_id', configId);

  const totalWeight = (dimensions || [])
    .filter(d => d.enabled)
    .reduce((sum, d) => sum + d.weight, 0);

  if (totalWeight !== 100) {
    errors.push(`Config dimension weights must sum to 100% (currently ${totalWeight}%)`);
  }

  // Validate templates are in draft status
  if (templateIds.length > 0) {
    const { data: templates } = await supabase
      .from('prompt_templates')
      .select('id, name, status')
      .in('id', templateIds);

    const nonDraftTemplates = (templates || []).filter(t => t.status !== 'draft');
    if (nonDraftTemplates.length > 0) {
      errors.push(`Templates must be in draft status: ${nonDraftTemplates.map(t => t.name).join(', ')}`);
    }
  }

  // Validate rules are in draft status
  if (ruleIds.length > 0) {
    const { data: rules } = await supabase
      .from('classification_rules')
      .select('id, name, status')
      .in('id', ruleIds);

    const nonDraftRules = (rules || []).filter(r => r.status !== 'draft');
    if (nonDraftRules.length > 0) {
      errors.push(`Rules must be in draft status: ${nonDraftRules.map(r => r.name).join(', ')}`);
    }
  }

  return errors;
}
```

### Database RPC for Atomic Activation

```sql
-- Migration: 20251223005000_config_set_activation_rpc.sql

CREATE OR REPLACE FUNCTION activate_config_set(
  p_config_id UUID,
  p_template_ids UUID[],
  p_rule_ids UUID[],
  p_activated_by UUID,
  p_snapshot_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_current_active_config_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Archive current active config
  SELECT id INTO v_current_active_config_id
  FROM analysis_configs
  WHERE status = 'active';

  IF v_current_active_config_id IS NOT NULL THEN
    UPDATE analysis_configs
    SET status = 'archived', archived_at = v_now
    WHERE id = v_current_active_config_id;
  END IF;

  -- Activate new config
  UPDATE analysis_configs
  SET status = 'active', activated_at = v_now
  WHERE id = p_config_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Config activation failed: config not in draft status'
      USING HINT = 'failed_entity=config';
  END IF;

  -- Archive current active templates and activate new ones
  UPDATE prompt_templates
  SET status = 'archived', archived_at = v_now
  WHERE status = 'active'
    AND template_key IN (
      SELECT template_key FROM prompt_templates WHERE id = ANY(p_template_ids)
    );

  UPDATE prompt_templates
  SET status = 'active', activated_at = v_now
  WHERE id = ANY(p_template_ids) AND status = 'draft';

  -- Archive current active rules and activate new ones
  UPDATE classification_rules
  SET status = 'archived', archived_at = v_now
  WHERE status = 'active'
    AND category IN (
      SELECT category FROM classification_rules WHERE id = ANY(p_rule_ids)
    );

  UPDATE classification_rules
  SET status = 'active', activated_at = v_now
  WHERE id = ANY(p_rule_ids) AND status = 'draft';

  RETURN jsonb_build_object(
    'success', true,
    'config_id', p_config_id,
    'templates_activated', array_length(p_template_ids, 1),
    'rules_activated', array_length(p_rule_ids, 1),
    'snapshot_id', p_snapshot_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction automatically rolls back
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'failed_entity', COALESCE(
        (regexp_match(SQLERRM, 'failed_entity=(\w+)'))[1],
        'unknown'
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Multi-Entity Rollback Service

```typescript
// lib/services/config-set-rollback.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from '@/lib/auth/admin';
import { logAdminAction } from './admin-users';
import type { ConfigSnapshotData } from '@/lib/types/config-versioning';
import { revalidatePath } from 'next/cache';

interface RollbackResult {
  success: boolean;
  newDraftIds: {
    configId?: string;
    templateIds: string[];
    ruleIds: string[];
  };
  error?: string;
}

/**
 * Restores all entity types from a config_set snapshot as new drafts.
 * Maintains referential integrity between entities.
 */
export async function rollbackConfigSet(snapshotId: string): Promise<RollbackResult> {
  const admin = await verifySuperAdmin();
  const supabase = createAdminClient();

  // Fetch the snapshot
  const { data: snapshot, error: fetchError } = await supabase
    .from('config_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (fetchError || !snapshot) {
    return { success: false, error: 'Snapshot not found', newDraftIds: { templateIds: [], ruleIds: [] } };
  }

  if (snapshot.snapshot_type !== 'config_set') {
    return { success: false, error: 'Not a config set snapshot', newDraftIds: { templateIds: [], ruleIds: [] } };
  }

  const snapshotData = snapshot.snapshot_data as ConfigSnapshotData;
  const result: RollbackResult = {
    success: true,
    newDraftIds: { templateIds: [], ruleIds: [] },
  };

  // Step 1: Create new draft config from snapshot
  const { data: maxVersion } = await supabase
    .from('analysis_configs')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (maxVersion?.version || 0) + 1;

  const { data: newConfig, error: configError } = await supabase
    .from('analysis_configs')
    .insert({
      name: `Rollback from v${snapshot.config_version}`,
      system_prompt: snapshotData.system_prompt,
      model: snapshotData.model,
      version: nextVersion,
      status: 'draft',
      parent_version_id: snapshot.config_id,
      description: `Rolled back from snapshot ${snapshotId}`,
      created_by: admin.adminId,
    })
    .select()
    .single();

  if (configError) {
    return { success: false, error: `Config rollback failed: ${configError.message}`, newDraftIds: result.newDraftIds };
  }

  result.newDraftIds.configId = newConfig.id;

  // Step 2: Restore dimensions
  const dimensionsToInsert = snapshotData.dimensions.map(d => ({
    config_id: newConfig.id,
    name: d.name,
    weight: d.weight,
    prompt_template: d.prompt_template,
    scoring_criteria: d.scoring_criteria,
    enabled: d.enabled,
    sort_order: d.sort_order,
  }));

  await supabase.from('analysis_dimensions').insert(dimensionsToInsert);

  // Step 3: Restore templates as drafts (with new IDs)
  const oldToNewTemplateId = new Map<string, string>();

  for (const template of snapshotData.templates || []) {
    const { data: newTemplate } = await supabase
      .from('prompt_templates')
      .insert({
        name: `${template.name} (restored)`,
        type: template.type,
        template_key: template.template_key,
        body: template.body,
        variables: template.variables,
        version: 1,
        status: 'draft',
        is_default: false, // Don't set as default until activated
        created_by: admin.adminId,
      })
      .select()
      .single();

    if (newTemplate) {
      oldToNewTemplateId.set(template.id, newTemplate.id);
      result.newDraftIds.templateIds.push(newTemplate.id);
    }
  }

  // Step 4: Restore rules as drafts (updating template references)
  for (const rule of snapshotData.rules || []) {
    const { data: newRule } = await supabase
      .from('classification_rules')
      .insert({
        name: `${rule.name} (restored)`,
        category: rule.category,
        pattern: rule.pattern,
        pattern_type: rule.pattern_type,
        action: rule.action,
        action_value: rule.action_value,
        priority: rule.priority,
        enabled: rule.enabled,
        version: 1,
        status: 'draft',
        created_by: admin.adminId,
      })
      .select()
      .single();

    if (newRule) {
      result.newDraftIds.ruleIds.push(newRule.id);
    }
  }

  // Step 5: Restore team overrides
  if (snapshotData.team_overrides && snapshotData.team_overrides.length > 0) {
    const overridesToInsert = snapshotData.team_overrides.map(o => ({
      config_id: newConfig.id,
      team_id: o.team_id,
      dimension_name: o.dimension_name,
      weight_override: o.weight_override,
    }));

    await supabase.from('team_weight_overrides').insert(overridesToInsert);
  }

  await logAdminAction(admin.adminId, 'config_set_rolled_back' as any, {
    snapshot_id: snapshotId,
    original_config_version: snapshot.config_version,
    new_config_id: newConfig.id,
    templates_restored: result.newDraftIds.templateIds.length,
    rules_restored: result.newDraftIds.ruleIds.length,
  });

  revalidatePath('/admin/config');
  return result;
}
```

### Activation Service

```typescript
// lib/services/config-activation.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from '@/lib/auth/admin';
import { createSnapshot } from './config-snapshots';
import { logAdminAction } from './admin-users';
import { revalidatePath } from 'next/cache';

export async function activateConfig(configId: string): Promise<void> {
  const admin = await verifySuperAdmin();

  const supabase = createAdminClient();

  // Validate config is draft
  const { data: config } = await supabase
    .from('analysis_configs')
    .select('status, version')
    .eq('id', configId)
    .single();

  if (!config) throw new Error('Config not found');
  if (config.status !== 'draft') {
    throw new Error('Only draft configs can be activated');
  }

  // Validate weights sum to 100
  const { data: dimensions } = await supabase
    .from('analysis_dimensions')
    .select('weight, enabled')
    .eq('config_id', configId);

  const totalWeight = (dimensions || [])
    .filter(d => d.enabled)
    .reduce((sum, d) => sum + d.weight, 0);

  if (totalWeight !== 100) {
    throw new Error(`Dimension weights must sum to 100% (currently ${totalWeight}%)`);
  }

  // Create snapshot of config being activated
  await createSnapshot(configId);

  // Archive current active config
  const { data: currentActive } = await supabase
    .from('analysis_configs')
    .select('id')
    .eq('status', 'active')
    .single();

  if (currentActive) {
    await supabase
      .from('analysis_configs')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
      })
      .eq('id', currentActive.id);
  }

  // Activate new config
  const { error } = await supabase
    .from('analysis_configs')
    .update({
      status: 'active',
      activated_at: new Date().toISOString(),
    })
    .eq('id', configId);

  if (error) throw error;

  await logAdminAction(admin.adminId, 'config_activated' as any, {
    config_id: configId,
    config_version: config.version,
    previous_active_id: currentActive?.id,
  });

  revalidatePath('/admin/config');
}

export async function createDraftFromActive(): Promise<string> {
  const admin = await verifySuperAdmin();

  const supabase = createAdminClient();

  // Get active config
  const { data: activeConfig } = await supabase
    .from('analysis_configs')
    .select(`
      id, name, system_prompt, model, version,
      analysis_dimensions(*)
    `)
    .eq('status', 'active')
    .single();

  if (!activeConfig) throw new Error('No active config found');

  // Get next version number
  const { data: maxVersion } = await supabase
    .from('analysis_configs')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (maxVersion?.version || 0) + 1;

  // Create new draft
  const { data: newConfig, error } = await supabase
    .from('analysis_configs')
    .insert({
      name: `${activeConfig.name} (v${nextVersion})`,
      system_prompt: activeConfig.system_prompt,
      model: activeConfig.model,
      version: nextVersion,
      status: 'draft',
      parent_version_id: activeConfig.id,
      created_by: admin.adminId,
    })
    .select()
    .single();

  if (error) throw error;

  // Copy dimensions
  const dimensions = activeConfig.analysis_dimensions.map((d: any) => ({
    ...d,
    id: undefined, // Let DB generate new IDs
    config_id: newConfig.id,
  }));

  await supabase.from('analysis_dimensions').insert(dimensions);

  await logAdminAction(admin.adminId, 'draft_created_from_active' as any, {
    new_config_id: newConfig.id,
    parent_config_id: activeConfig.id,
  });

  revalidatePath('/admin/config');
  return newConfig.id;
}
```

### Version Comparison

```typescript
// lib/services/config-comparison.ts

import { createAdminClient } from '@/lib/supabase/admin';
import type { VersionComparison } from '@/lib/types/config-versioning';

export async function compareVersions(
  leftId: string,
  rightId: string
): Promise<VersionComparison> {
  const supabase = createAdminClient();

  const [{ data: left }, { data: right }] = await Promise.all([
    supabase
      .from('analysis_configs')
      .select(`*, analysis_dimensions(*)`)
      .eq('id', leftId)
      .single(),
    supabase
      .from('analysis_configs')
      .select(`*, analysis_dimensions(*)`)
      .eq('id', rightId)
      .single(),
  ]);

  if (!left || !right) throw new Error('Config not found');

  // Compare dimensions
  const leftDims = new Map(left.analysis_dimensions.map((d: any) => [d.name, d]));
  const rightDims = new Map(right.analysis_dimensions.map((d: any) => [d.name, d]));

  const added = [...rightDims.keys()].filter(k => !leftDims.has(k));
  const removed = [...leftDims.keys()].filter(k => !rightDims.has(k));
  const changed: VersionComparison['differences']['dimensions']['changed'] = [];

  for (const [name, leftDim] of leftDims) {
    const rightDim = rightDims.get(name);
    if (!rightDim) continue;

    for (const field of ['weight', 'prompt_template', 'scoring_criteria', 'enabled']) {
      if ((leftDim as any)[field] !== (rightDim as any)[field]) {
        changed.push({
          name,
          field,
          left_value: (leftDim as any)[field],
          right_value: (rightDim as any)[field],
        });
      }
    }
  }

  return {
    left,
    right,
    differences: {
      dimensions: { added, removed, changed },
      system_prompt_changed: left.system_prompt !== right.system_prompt,
      model_changed: left.model !== right.model,
    },
  };
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Config List (updated) | `app/(dashboard)/admin/config/page.tsx` |
| Version History | `components/admin/config-version-history.tsx` |
| Diff Viewer | `components/admin/config-diff-viewer.tsx` |
| Activation Dialog | `components/admin/config-activation-dialog.tsx` |
| Rollback Dialog | `components/admin/config-rollback-dialog.tsx` |
| Draft Preview | `components/admin/draft-preview.tsx` |
| Services | `lib/services/config-snapshots.ts`, `lib/services/config-activation.ts` |
| Types | `lib/types/config-versioning.ts` |

### State Machine

```
                    ┌─────────────────┐
                    │                 │
   create()         │     DRAFT       │ ◄──────────┐
      ─────────────►│                 │            │
                    └────────┬────────┘            │
                             │                     │
                    activate()                     │
                             │                     │
                             ▼                     │
                    ┌─────────────────┐            │
                    │                 │  rollback()│
                    │     ACTIVE      │ ───────────┘
                    │                 │
                    └────────┬────────┘
                             │
                    new config activated
                             │
                             ▼
                    ┌─────────────────┐
                    │                 │
                    │    ARCHIVED     │
                    │                 │
                    └─────────────────┘
```

### Verification Checklist

After completing this story, verify:

**Core Config Versioning:**
- [ ] New configs created as draft
- [ ] Drafts can be edited freely
- [ ] Activation creates immutable snapshot
- [ ] Previous active becomes archived
- [ ] Only one active config at a time
- [ ] Active configs cannot be edited directly
- [ ] "Create Draft" copies active to new draft
- [ ] Rollback creates draft from archived snapshot
- [ ] Version history shows all versions
- [ ] Comparison shows differences accurately
- [ ] Preview runs draft against sample data

**Multi-Entity Versioning (AC #7-10):**
- [ ] Prompt templates have draft/active/archived lifecycle
- [ ] Classification rules have draft/active/archived lifecycle
- [ ] Config set snapshots capture all entity types
- [ ] Coordinated activation succeeds atomically
- [ ] Coordinated activation rolls back on any failure
- [ ] Multi-entity rollback restores all entity types as drafts
- [ ] Referential integrity maintained after rollback
- [ ] Entity versions tracked in snapshots


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [ ] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [ ] Checked `/design` route for component examples
- [ ] Identified required components from the inventory below
- [ ] Confirmed no hardcoded colors - using semantic tokens only
- [ ] No new UI patterns needed (or Design Epic story created)

### Required Components
<!-- Dev agent: Fill in specific components needed from DESIGN-SYSTEM-MANDATE.md -->
- Review `/design` route and `components/` directory before implementation
- Use semantic tokens: `bg-surface-*`, `text-content-*`, `border-border-*`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### Completion Notes List
*To be filled by dev agent after implementation*

### Change Log
| Date | Change | Author |
|------|--------|--------|

### File List
*To be filled by dev agent - list all files created/modified*
