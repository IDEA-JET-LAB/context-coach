# Story 22.6: A/B Experiment Creation

Status: Ready

## Story

**As a** super admin,
**I want** to create A/B experiments comparing different analysis configurations,
**So that** I can scientifically test which configuration produces better outcomes.

## Acceptance Criteria

1. **Given** I navigate to Admin > Experiments
   **When** the page loads
   **Then** I see all experiments with their status (draft/active/running/analyzing/completed)
   **And** running experiments show real-time metrics

2. **Given** I click "Create Experiment"
   **When** the form opens
   **Then** I can define: name, hypothesis, control config, variant config
   **And** I can set traffic split percentage (default 50/50)

3. **Given** I select a control configuration
   **When** I select a variant configuration
   **Then** I see a comparison of the two configurations
   **And** key differences are highlighted

4. **Given** I set experiment parameters
   **When** I configure the experiment
   **Then** I can set: minimum sample size per variant, minimum run duration, success metric
   **And** I can optionally enable auto-promotion of winner

5. **Given** I create an experiment as draft
   **When** I review the draft
   **Then** I can edit all parameters before activation
   **And** I can preview the traffic split logic

6. **Given** I activate an experiment
   **When** activation completes
   **Then** the experiment status changes to "running"
   **And** new prompts start being assigned to variants
   **And** both configs remain unchanged during the experiment

## Dependencies

- **Story 22.5**: Configuration Version Control (config snapshots for experiment)
- **Story 22.7**: A/B Traffic Splitting (assignment logic)
- **Story 22.10**: Configuration Audit Trail (audit logging)

## Tasks / Subtasks

- [ ] **Task 1: Create experiments database schema** (AC: #1, #6)
  - [ ] Create migration `20251223005000_experiments.sql`
  - [ ] Create `experiments` table with experiment metadata
  - [ ] Create `experiment_variants` table for control/variant configs
  - [ ] Add status enum: draft, active, running, paused, analyzing, completed
  - [ ] Add RLS policies for super admin access

- [ ] **Task 2: Create experiments list page** (AC: #1)
  - [ ] Create `app/(dashboard)/admin/experiments/page.tsx`
  - [ ] Query all experiments with status badges
  - [ ] Show key metrics inline: sample sizes, current winner
  - [ ] Add filter by status
  - [ ] Add "Create Experiment" button

- [ ] **Task 3: Create experiment card component** (AC: #1)
  - [ ] Create `components/admin/experiment-card.tsx`
  - [ ] Display experiment name and hypothesis
  - [ ] Show control vs variant with traffic split
  - [ ] Display sample counts per variant
  - [ ] Show status-specific actions

- [ ] **Task 4: Create experiment form** (AC: #2, #4)
  - [ ] Create `components/admin/experiment-form.tsx`
  - [ ] Add name and hypothesis fields
  - [ ] Add config selector for control (typically active config)
  - [ ] Add config selector for variant (must be different)
  - [ ] Add traffic split slider (10-90%, default 50%)

- [ ] **Task 5: Add experiment parameters** (AC: #4)
  - [ ] Add minimum sample size input (default 100 per variant)
  - [ ] Add minimum run duration selector (1 day - 30 days)
  - [ ] Add success metric selector (overall score, specific dimension)
  - [ ] Add significance threshold input (default 0.05)
  - [ ] Add auto-promotion toggle

- [ ] **Task 6: Create config comparison view** (AC: #3)
  - [ ] Create `components/admin/experiment-config-comparison.tsx`
  - [ ] Display side-by-side config summaries
  - [ ] Highlight weight differences
  - [ ] Highlight dimension differences
  - [ ] Show prompt template diff if different

- [ ] **Task 7: Implement experiment save** (AC: #5)
  - [ ] Create `lib/services/experiments.ts` server actions
  - [ ] Validate control and variant are different
  - [ ] Create experiment as draft
  - [ ] Create snapshots of both configs
  - [ ] Log creation to audit trail

- [ ] **Task 8: Create draft edit page** (AC: #5)
  - [ ] Create `app/(dashboard)/admin/experiments/[id]/page.tsx`
  - [ ] Load existing experiment data
  - [ ] Allow editing all fields if draft
  - [ ] Show read-only view if not draft
  - [ ] Add "Activate" button for drafts

- [ ] **Task 9: Implement experiment activation** (AC: #6)
  - [ ] Create `activateExperiment()` server action
  - [ ] Validate no other experiment is running with same configs
  - [ ] Lock both configs (prevent changes during experiment)
  - [ ] Initialize assignment counters
  - [ ] Change status to "running"

- [ ] **Task 10: Add experiment lifecycle controls** (AC: #6)
  - [ ] Add "Pause" button for running experiments
  - [ ] Add "Resume" button for paused experiments
  - [ ] Add "Stop Early" button with confirmation
  - [ ] Log all lifecycle changes to audit trail

- [ ] **Task 11: Write E2E tests** (AC: #1-6)
  - [ ] Create `e2e/admin-experiments.spec.ts`
  - [ ] Test experiment list displays correctly
  - [ ] Test experiment creation with all fields
  - [ ] Test config comparison shows differences
  - [ ] Test draft editing and validation
  - [ ] Test activation changes status

## Dev Notes

### Database Schema

```sql
-- Migration: 20251223005000_experiments.sql

-- Experiment status enum
CREATE TYPE experiment_status AS ENUM (
  'draft',      -- Not yet started
  'active',     -- Ready to run (validated)
  'running',    -- Currently splitting traffic
  'paused',     -- Temporarily stopped
  'analyzing',  -- Collecting final stats
  'completed'   -- Finished with results
);

-- Experiments table
CREATE TABLE experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  hypothesis TEXT NOT NULL,
  status experiment_status DEFAULT 'draft',

  -- Traffic configuration
  traffic_percentage INTEGER DEFAULT 50 CHECK (traffic_percentage >= 10 AND traffic_percentage <= 90),

  -- Success criteria
  min_sample_size INTEGER DEFAULT 100,
  min_duration_hours INTEGER DEFAULT 24,
  significance_threshold DECIMAL(4,3) DEFAULT 0.05,
  success_metric VARCHAR(50) DEFAULT 'overall_score',
  auto_promote_winner BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Results (populated when analyzing/completed)
  winner_variant VARCHAR(20), -- 'control', 'variant', 'inconclusive'
  p_value DECIMAL(6,5),
  effect_size DECIMAL(6,4),
  confidence_interval JSONB
);

-- Experiment variants
CREATE TABLE experiment_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_name VARCHAR(20) NOT NULL CHECK (variant_name IN ('control', 'variant')),
  config_id UUID NOT NULL REFERENCES analysis_configs(id),
  config_snapshot_id UUID REFERENCES config_snapshots(id),
  sample_count INTEGER DEFAULT 0,
  mean_score DECIMAL(5,2),
  std_deviation DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_experiment_variant UNIQUE (experiment_id, variant_name)
);

-- User experiment assignments (for sticky assignment)
CREATE TABLE experiment_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  variant_name VARCHAR(20) NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_experiment UNIQUE (experiment_id, user_id)
);

-- Indexes
CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_variants_experiment ON experiment_variants(experiment_id);
CREATE INDEX idx_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX idx_assignments_user ON experiment_assignments(user_id);

-- RLS
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;
```

### TypeScript Interfaces

```typescript
// lib/types/experiments.ts

export type ExperimentStatus =
  | 'draft'
  | 'active'
  | 'running'
  | 'paused'
  | 'analyzing'
  | 'completed';

export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: ExperimentStatus;
  traffic_percentage: number;
  min_sample_size: number;
  min_duration_hours: number;
  significance_threshold: number;
  success_metric: string;
  auto_promote_winner: boolean;
  created_at: string;
  activated_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  winner_variant: 'control' | 'variant' | 'inconclusive' | null;
  p_value: number | null;
  effect_size: number | null;
  confidence_interval: { lower: number; upper: number } | null;
}

export interface ExperimentVariant {
  id: string;
  experiment_id: string;
  variant_name: 'control' | 'variant';
  config_id: string;
  config_snapshot_id: string | null;
  sample_count: number;
  mean_score: number | null;
  std_deviation: number | null;
}

export interface ExperimentWithVariants extends Experiment {
  variants: ExperimentVariant[];
}

export interface CreateExperimentInput {
  name: string;
  hypothesis: string;
  control_config_id: string;
  variant_config_id: string;
  traffic_percentage?: number;
  min_sample_size?: number;
  min_duration_hours?: number;
  significance_threshold?: number;
  success_metric?: string;
  auto_promote_winner?: boolean;
}
```

### Experiment Service

```typescript
// lib/services/experiments.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from '@/lib/auth/admin';
import { createSnapshot } from './config-snapshots';
import { logAdminAction } from './admin-users';
import { revalidatePath } from 'next/cache';
import type { CreateExperimentInput, Experiment } from '@/lib/types/experiments';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function createExperiment(
  input: CreateExperimentInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await verifySuperAdmin();

    // Validate configs are different
    if (input.control_config_id === input.variant_config_id) {
      return {
        success: false,
        error: { code: 'SAME_CONFIG', message: 'Control and variant must be different configurations' },
      };
    }

    const supabase = createAdminClient();

    // Validate both configs exist
    const { data: configs } = await supabase
      .from('analysis_configs')
      .select('id, name')
      .in('id', [input.control_config_id, input.variant_config_id]);

    if (!configs || configs.length !== 2) {
      return {
        success: false,
        error: { code: 'CONFIG_NOT_FOUND', message: 'One or both configurations not found' },
      };
    }

    // Create experiment
    const { data: experiment, error: expError } = await supabase
      .from('experiments')
      .insert({
        name: input.name,
        hypothesis: input.hypothesis,
        traffic_percentage: input.traffic_percentage ?? 50,
        min_sample_size: input.min_sample_size ?? 100,
        min_duration_hours: input.min_duration_hours ?? 24,
        significance_threshold: input.significance_threshold ?? 0.05,
        success_metric: input.success_metric ?? 'overall_score',
        auto_promote_winner: input.auto_promote_winner ?? false,
        status: 'draft',
        created_by: admin.adminId,
      })
      .select()
      .single();

    if (expError) {
      return { success: false, error: { code: 'CREATE_ERROR', message: expError.message } };
    }

    // Create variants
    const variants = [
      { experiment_id: experiment.id, variant_name: 'control', config_id: input.control_config_id },
      { experiment_id: experiment.id, variant_name: 'variant', config_id: input.variant_config_id },
    ];

    const { error: varError } = await supabase
      .from('experiment_variants')
      .insert(variants);

    if (varError) {
      await supabase.from('experiments').delete().eq('id', experiment.id);
      return { success: false, error: { code: 'CREATE_ERROR', message: varError.message } };
    }

    await logAdminAction(admin.adminId, 'experiment_created' as any, {
      experiment_id: experiment.id,
      control_config_id: input.control_config_id,
      variant_config_id: input.variant_config_id,
    });

    revalidatePath('/admin/experiments');
    return { success: true, data: { id: experiment.id } };
  } catch (err) {
    console.error('[Experiments] Create error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to create experiment' } };
  }
}

export async function activateExperiment(experimentId: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const admin = await verifySuperAdmin();

    const supabase = createAdminClient();

    // Get experiment with variants
    const { data: experiment } = await supabase
      .from('experiments')
      .select(`
        id, status,
        experiment_variants(id, variant_name, config_id)
      `)
      .eq('id', experimentId)
      .single();

    if (!experiment) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Experiment not found' } };
    }

    if (experiment.status !== 'draft') {
      return { success: false, error: { code: 'INVALID_STATUS', message: 'Only draft experiments can be activated' } };
    }

    // Check no other running experiment with same configs
    const configIds = experiment.experiment_variants.map((v: any) => v.config_id);
    const { data: conflicting } = await supabase
      .from('experiments')
      .select(`
        id,
        experiment_variants!inner(config_id)
      `)
      .eq('status', 'running')
      .in('experiment_variants.config_id', configIds);

    if (conflicting && conflicting.length > 0) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'Another experiment is already running with one of these configurations' },
      };
    }

    // Create snapshots for both configs
    for (const variant of experiment.experiment_variants) {
      const snapshotId = await createSnapshot(variant.config_id);
      await supabase
        .from('experiment_variants')
        .update({ config_snapshot_id: snapshotId })
        .eq('id', variant.id);
    }

    // Activate experiment
    const { error } = await supabase
      .from('experiments')
      .update({
        status: 'running',
        activated_at: new Date().toISOString(),
      })
      .eq('id', experimentId);

    if (error) {
      return { success: false, error: { code: 'ACTIVATION_ERROR', message: error.message } };
    }

    await logAdminAction(admin.adminId, 'experiment_activated' as any, {
      experiment_id: experimentId,
    });

    revalidatePath('/admin/experiments');
    return { success: true, data: { success: true } };
  } catch (err) {
    console.error('[Experiments] Activation error:', err);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: 'Failed to activate experiment' } };
  }
}

export async function pauseExperiment(experimentId: string): Promise<ActionResult<{ success: boolean }>> {
  const admin = await verifySuperAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('experiments')
    .update({ status: 'paused' })
    .eq('id', experimentId)
    .eq('status', 'running');

  if (error) {
    return { success: false, error: { code: 'PAUSE_ERROR', message: error.message } };
  }

  await logAdminAction(admin.adminId, 'experiment_paused' as any, { experiment_id: experimentId });
  revalidatePath('/admin/experiments');
  return { success: true, data: { success: true } };
}

export async function resumeExperiment(experimentId: string): Promise<ActionResult<{ success: boolean }>> {
  const admin = await verifySuperAdmin();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('experiments')
    .update({ status: 'running' })
    .eq('id', experimentId)
    .eq('status', 'paused');

  if (error) {
    return { success: false, error: { code: 'RESUME_ERROR', message: error.message } };
  }

  await logAdminAction(admin.adminId, 'experiment_resumed' as any, { experiment_id: experimentId });
  revalidatePath('/admin/experiments');
  return { success: true, data: { success: true } };
}
```

### Experiment Form Component

```typescript
// components/admin/experiment-form.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalysisConfig } from '@/lib/validations/analysis-config';

const experimentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  hypothesis: z.string().min(10, 'Hypothesis must be at least 10 characters'),
  control_config_id: z.string().uuid('Select a control configuration'),
  variant_config_id: z.string().uuid('Select a variant configuration'),
  traffic_percentage: z.number().min(10).max(90).default(50),
  min_sample_size: z.number().min(50).max(10000).default(100),
  min_duration_hours: z.number().min(1).max(720).default(24),
  significance_threshold: z.number().min(0.001).max(0.1).default(0.05),
  success_metric: z.string().default('overall_score'),
  auto_promote_winner: z.boolean().default(false),
}).refine(data => data.control_config_id !== data.variant_config_id, {
  message: 'Control and variant must be different',
  path: ['variant_config_id'],
});

type ExperimentFormData = z.infer<typeof experimentSchema>;

interface ExperimentFormProps {
  configs: AnalysisConfig[];
  onSubmit: (data: ExperimentFormData) => Promise<void>;
  isLoading: boolean;
}

export function ExperimentForm({ configs, onSubmit, isLoading }: ExperimentFormProps) {
  const form = useForm<ExperimentFormData>({
    resolver: zodResolver(experimentSchema),
    defaultValues: {
      traffic_percentage: 50,
      min_sample_size: 100,
      min_duration_hours: 24,
      significance_threshold: 0.05,
      auto_promote_winner: false,
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>Experiment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input {...form.register('name')} placeholder="e.g., Q4 Scoring Optimization" />
          </div>
          <div>
            <label className="text-sm font-medium">Hypothesis</label>
            <Textarea
              {...form.register('hypothesis')}
              placeholder="e.g., Increasing the weight of specificity will improve overall prompt quality..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Config selection */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Selection</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium">Control (Current)</label>
            <Select onValueChange={(v) => form.setValue('control_config_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select control config" />
              </SelectTrigger>
              <SelectContent>
                {configs.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.name} (v{config.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Variant (Test)</label>
            <Select onValueChange={(v) => form.setValue('variant_config_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select variant config" />
              </SelectTrigger>
              <SelectContent>
                {configs.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.name} (v{config.version})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Experiment Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium">
              Traffic Split: {form.watch('traffic_percentage')}% Variant
            </label>
            <Slider
              value={[form.watch('traffic_percentage')]}
              onValueChange={([v]) => form.setValue('traffic_percentage', v)}
              min={10}
              max={90}
              step={5}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {100 - form.watch('traffic_percentage')}% Control / {form.watch('traffic_percentage')}% Variant
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Min Sample Size (per variant)</label>
              <Input
                type="number"
                {...form.register('min_sample_size', { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Min Duration (hours)</label>
              <Input
                type="number"
                {...form.register('min_duration_hours', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Auto-promote Winner</label>
              <p className="text-xs text-muted-foreground">
                Automatically activate the winning config when experiment completes
              </p>
            </div>
            <Switch
              checked={form.watch('auto_promote_winner')}
              onCheckedChange={(v) => form.setValue('auto_promote_winner', v)}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Experiment'}
      </Button>
    </form>
  );
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Experiments List Page | `app/(dashboard)/admin/experiments/page.tsx` |
| Experiment Detail Page | `app/(dashboard)/admin/experiments/[id]/page.tsx` |
| New Experiment Page | `app/(dashboard)/admin/experiments/new/page.tsx` |
| Experiment Card | `components/admin/experiment-card.tsx` |
| Experiment Form | `components/admin/experiment-form.tsx` |
| Config Comparison | `components/admin/experiment-config-comparison.tsx` |
| Status Badge | `components/admin/experiment-status-badge.tsx` |
| Services | `lib/services/experiments.ts` |
| Types | `lib/types/experiments.ts` |

### Experiment Lifecycle

```
  create()          validate()        activate()
     │                  │                 │
     ▼                  ▼                 ▼
  ┌─────────┐      ┌─────────┐      ┌──────────┐
  │  DRAFT  │ ───► │  ACTIVE │ ───► │ RUNNING  │
  └─────────┘      └─────────┘      └────┬─────┘
                                         │
                         ┌───────────────┼───────────────┐
                         │               │               │
                    pause()          complete()     stop_early()
                         │               │               │
                         ▼               ▼               ▼
                   ┌──────────┐    ┌───────────┐   ┌───────────┐
                   │  PAUSED  │    │ ANALYZING │   │ COMPLETED │
                   └────┬─────┘    └─────┬─────┘   └───────────┘
                        │                │
                   resume()         calculate_results()
                        │                │
                        ▼                ▼
                   ┌──────────┐    ┌───────────┐
                   │ RUNNING  │    │ COMPLETED │
                   └──────────┘    └───────────┘
```

### Verification Checklist

After completing this story, verify:
- [ ] Experiment list shows all experiments with status
- [ ] Can create experiment with all required fields
- [ ] Control and variant must be different
- [ ] Config comparison shows differences
- [ ] Traffic split slider works (10-90%)
- [ ] Can edit draft experiments
- [ ] Cannot edit running experiments
- [ ] Activation creates config snapshots
- [ ] Pause/resume changes status correctly
- [ ] Audit trail logs all lifecycle changes


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
