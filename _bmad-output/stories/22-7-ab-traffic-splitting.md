# Story 22.7: A/B Traffic Splitting

Status: Ready

## Story

**As a** system,
**I want** to deterministically assign users to experiment variants using hash-based logic,
**So that** each user consistently receives the same variant throughout an experiment.

## Acceptance Criteria

1. **Given** a running experiment exists
   **When** a new prompt is analyzed
   **Then** the user is assigned to control or variant based on hash
   **And** the assignment respects the configured traffic split

2. **Given** a user has been assigned to a variant
   **When** the same user's subsequent prompts are analyzed
   **Then** they receive the same variant (sticky assignment)
   **And** the assignment is retrievable from the database

3. **Given** the traffic split is 30% variant / 70% control
   **When** 1000 users are assigned
   **Then** approximately 300 are in variant and 700 in control
   **And** the distribution is statistically valid

4. **Given** a user is assigned to the variant
   **When** their prompt is analyzed
   **Then** the variant's configuration is used for analysis
   **And** the result is tagged with the experiment and variant

5. **Given** an experiment is paused
   **When** new prompts arrive
   **Then** existing assignments are honored
   **But** no new assignments are created
   **And** the active config is used instead

6. **Given** multiple experiments are running
   **When** a user is assigned
   **Then** they can be in different variants of different experiments
   **And** each experiment's assignment is independent

7. **Given** multiple experiments target the same team or user segment
   **When** experiments would assign conflicting configurations
   **Then** the system detects the conflict before assignment
   **And** applies priority-based resolution (newest experiment wins, or explicit priority)
   **And** logs the conflict for admin review

## Dependencies

- **Story 22.6**: A/B Experiment Creation (experiment data model)
- **Story 22.4**: Team-Level Weight Overrides (weight resolution)
- **Story 4.5**: Prompt Storage and Queue (capture pipeline)

### Dependency Clarification

**Relationship between Story 22.6 and 22.7:**

There is no circular dependency between these stories. They have distinct responsibilities:

| Story | Responsibility | Phase |
|-------|---------------|-------|
| **22.6 - A/B Experiment Creation** | Experiment lifecycle management: create, configure, start, pause, stop experiments. Defines the `experiments` and `experiment_variants` tables. | Definition/Setup |
| **22.7 - A/B Traffic Splitting** | Runtime assignment mechanics: hash-based user routing, sticky assignments, variant selection during prompt analysis. | Execution/Runtime |

**Data Flow:**
1. Admin creates experiment via 22.6 (defines control/variant configs, traffic split)
2. When prompts arrive, 22.7 handles user assignment based on 22.6's experiment definitions
3. 22.7 reads from tables created by 22.6 but never modifies experiment configuration

**Dependency Direction:** 22.7 depends on 22.6 (one-way dependency). Story 22.6 must be implemented first to provide the experiment data model that 22.7's assignment logic operates on.

## PRD Alignment

This story implements **PRD Story 22.7: A/B Traffic Splitting** from Epic 22 (Analysis Configuration & A/B Testing). The story covers the traffic splitting mechanics described in the PRD, including deterministic hash-based assignment and sticky variant assignment.

## Tasks / Subtasks

- [ ] **Task 1: Create assignment hash function** (AC: #1, #3)
  - [ ] Create `lib/utils/experiment-hash.ts`
  - [ ] Implement deterministic hash: `hash(user_id + experiment_id)`
  - [ ] Map hash to 0-99 range for percentage-based splitting
  - [ ] Add unit tests for distribution uniformity

- [ ] **Task 2: Implement assignment logic** (AC: #1, #2)
  - [ ] Create `lib/services/experiment-assignment.ts`
  - [ ] Check for existing assignment first
  - [ ] If no assignment, calculate hash and create assignment
  - [ ] Store assignment in `experiment_assignments` table
  - [ ] Return variant name and config ID

- [ ] **Task 3: Handle sticky assignments** (AC: #2)
  - [ ] Query assignment by (experiment_id, user_id)
  - [ ] Return cached assignment if exists
  - [ ] Ensure assignment survives across sessions
  - [ ] Handle edge case of deleted experiments

- [ ] **Task 4: Validate traffic split distribution** (AC: #3)
  - [ ] Create test that assigns 10,000 mock users
  - [ ] Verify distribution within 5% of target
  - [ ] Use chi-squared test for statistical validation
  - [ ] Add monitoring for live distribution

- [ ] **Task 5: Integrate with analysis pipeline** (AC: #4)
  - [ ] Modify `analyze-prompt` edge function
  - [ ] Check for running experiments
  - [ ] Get or create assignment for user
  - [ ] Use assigned config instead of active config
  - [ ] Tag analysis result with experiment context

- [ ] **Task 6: Handle paused experiments** (AC: #5)
  - [ ] Check experiment status in assignment logic
  - [ ] If paused, honor existing assignments
  - [ ] If paused, new users get active config (no assignment)
  - [ ] Resume should continue assigning new users

- [ ] **Task 7: Support multiple experiments** (AC: #6)
  - [ ] Allow users to be in multiple experiments simultaneously
  - [ ] Each experiment has independent assignment
  - [ ] Ensure no config conflicts (validate on experiment creation)
  - [ ] Return all applicable experiments for a user

- [ ] **Task 7.5: Implement experiment conflict detection** (AC: #7)
  - [ ] Create `lib/services/experiment-conflict-detector.ts`
  - [ ] Detect overlapping team/user segment targeting
  - [ ] Implement priority-based resolution strategy
  - [ ] Add conflict logging for admin dashboard
  - [ ] Create validation endpoint for experiment creation (called by 22.6)
  - [ ] Add unit tests for conflict scenarios

- [ ] **Task 8: Track assignment metrics** (AC: #1, #3)
  - [ ] Update `sample_count` on experiment_variants table
  - [ ] Create async job to sync counts periodically
  - [ ] Add real-time counter for admin dashboard
  - [ ] Log unusual distribution patterns

- [ ] **Task 9: Create assignment debugging endpoint** (AC: #2, #4)
  - [ ] Create `GET /api/admin/experiments/assignments/[userId]`
  - [ ] Return all experiment assignments for a user
  - [ ] Include hash values for debugging
  - [ ] Restrict to super admin only

- [ ] **Task 10: Write E2E tests** (AC: #1-6)
  - [ ] Create `e2e/experiment-assignment.spec.ts`
  - [ ] Test new user assignment
  - [ ] Test sticky assignment across prompts
  - [ ] Test traffic split approximation
  - [ ] Test paused experiment behavior
  - [ ] Test multiple simultaneous experiments

## Dev Notes

### Hash Function Implementation

```typescript
// lib/utils/experiment-hash.ts

import { createHash } from 'crypto';

/**
 * Deterministic hash function for experiment assignment
 *
 * Properties:
 * - Deterministic: Same inputs always produce same output
 * - Uniform: Hash values distribute evenly across range
 * - Independent: Different experiments get different assignments
 */
export function calculateAssignmentHash(
  userId: string,
  experimentId: string
): number {
  const input = `${userId}:${experimentId}`;
  const hash = createHash('md5').update(input).digest('hex');

  // Take first 8 hex chars (32 bits) and convert to number
  const hashValue = parseInt(hash.substring(0, 8), 16);

  // Map to 0-99 range
  return hashValue % 100;
}

/**
 * Determine variant based on hash and traffic percentage
 *
 * @param hash - Hash value 0-99
 * @param variantPercentage - Percentage of traffic for variant (e.g., 50)
 * @returns 'control' or 'variant'
 */
export function getVariantFromHash(
  hash: number,
  variantPercentage: number
): 'control' | 'variant' {
  // Users with hash < (100 - variantPercentage) get control
  // Users with hash >= (100 - variantPercentage) get variant
  const controlThreshold = 100 - variantPercentage;
  return hash < controlThreshold ? 'control' : 'variant';
}

// Example:
// variantPercentage = 30 means 30% variant, 70% control
// controlThreshold = 70
// hash 0-69 -> control (70%)
// hash 70-99 -> variant (30%)
```

### Assignment Service

```typescript
// lib/services/experiment-assignment.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { calculateAssignmentHash, getVariantFromHash } from '@/lib/utils/experiment-hash';

export interface AssignmentResult {
  experiment_id: string;
  experiment_name: string;
  variant_name: 'control' | 'variant';
  config_id: string;
  config_snapshot_id: string;
  is_new_assignment: boolean;
}

/**
 * Get or create experiment assignment for a user
 */
export async function getOrCreateAssignment(
  userId: string,
  experimentId: string
): Promise<AssignmentResult | null> {
  const supabase = createAdminClient();

  // Get experiment with variants
  const { data: experiment } = await supabase
    .from('experiments')
    .select(`
      id, name, status, traffic_percentage,
      experiment_variants(id, variant_name, config_id, config_snapshot_id)
    `)
    .eq('id', experimentId)
    .single();

  if (!experiment) return null;

  // Check for existing assignment
  const { data: existing } = await supabase
    .from('experiment_assignments')
    .select('variant_name')
    .eq('experiment_id', experimentId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    // Return existing assignment
    const variant = experiment.experiment_variants.find(
      (v: any) => v.variant_name === existing.variant_name
    );

    return {
      experiment_id: experiment.id,
      experiment_name: experiment.name,
      variant_name: existing.variant_name,
      config_id: variant.config_id,
      config_snapshot_id: variant.config_snapshot_id,
      is_new_assignment: false,
    };
  }

  // If experiment is not running, don't create new assignment
  if (experiment.status !== 'running') {
    return null;
  }

  // Calculate new assignment
  const hash = calculateAssignmentHash(userId, experimentId);
  const variantName = getVariantFromHash(hash, experiment.traffic_percentage);

  // Create assignment
  const { error } = await supabase
    .from('experiment_assignments')
    .insert({
      experiment_id: experimentId,
      user_id: userId,
      variant_name: variantName,
    });

  if (error) {
    console.error('[Experiment Assignment] Error:', error);
    return null;
  }

  // Increment sample count
  await supabase.rpc('increment_variant_sample_count', {
    p_experiment_id: experimentId,
    p_variant_name: variantName,
  });

  const variant = experiment.experiment_variants.find(
    (v: any) => v.variant_name === variantName
  );

  return {
    experiment_id: experiment.id,
    experiment_name: experiment.name,
    variant_name: variantName,
    config_id: variant.config_id,
    config_snapshot_id: variant.config_snapshot_id,
    is_new_assignment: true,
  };
}

/**
 * Get all running experiments and assignments for a user
 */
export async function getActiveExperimentsForUser(
  userId: string
): Promise<AssignmentResult[]> {
  const supabase = createAdminClient();

  // Get all running experiments
  const { data: experiments } = await supabase
    .from('experiments')
    .select(`
      id, name, traffic_percentage,
      experiment_variants(id, variant_name, config_id, config_snapshot_id)
    `)
    .eq('status', 'running');

  if (!experiments || experiments.length === 0) {
    return [];
  }

  const results: AssignmentResult[] = [];

  for (const experiment of experiments) {
    const assignment = await getOrCreateAssignment(userId, experiment.id);
    if (assignment) {
      results.push(assignment);
    }
  }

  return results;
}

/**
 * Get all assignments for a user (for admin debugging)
 */
export async function getUserAssignments(userId: string): Promise<Array<{
  experiment_id: string;
  experiment_name: string;
  experiment_status: string;
  variant_name: string;
  assigned_at: string;
  hash_value: number;
}>> {
  const supabase = createAdminClient();

  const { data: assignments } = await supabase
    .from('experiment_assignments')
    .select(`
      experiment_id, variant_name, assigned_at,
      experiment:experiments(id, name, status)
    `)
    .eq('user_id', userId)
    .order('assigned_at', { ascending: false });

  return (assignments || []).map((a: any) => ({
    experiment_id: a.experiment_id,
    experiment_name: a.experiment.name,
    experiment_status: a.experiment.status,
    variant_name: a.variant_name,
    assigned_at: a.assigned_at,
    hash_value: calculateAssignmentHash(userId, a.experiment_id),
  }));
}
```

### Database Function for Sample Count

```sql
-- Add to migration 20251223005000_experiments.sql

-- Function to atomically increment variant sample count
CREATE OR REPLACE FUNCTION increment_variant_sample_count(
  p_experiment_id UUID,
  p_variant_name VARCHAR(20)
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE experiment_variants
  SET sample_count = sample_count + 1
  WHERE experiment_id = p_experiment_id
    AND variant_name = p_variant_name;
END;
$$;
```

### Analysis Pipeline Integration

```typescript
// supabase/functions/analyze-prompt/index.ts (modification)

import { getActiveExperimentsForUser } from './experiment-assignment';
import { getWeightsForTeam } from './weight-resolver';

async function analyzePrompt(prompt: Prompt): Promise<Analysis> {
  // Check for running experiments
  const experiments = await getActiveExperimentsForUser(prompt.user_id);

  let configToUse;
  let experimentContext = null;

  if (experiments.length > 0) {
    // Use first experiment's assigned config
    // (In practice, you'd handle multiple experiments more carefully)
    const experiment = experiments[0];
    configToUse = await getConfigFromSnapshot(experiment.config_snapshot_id);
    experimentContext = {
      experiment_id: experiment.experiment_id,
      experiment_name: experiment.experiment_name,
      variant_name: experiment.variant_name,
    };
  } else {
    // No experiments, use active config (with team overrides)
    configToUse = await getActiveConfig();
  }

  // Get weights (experiment config or team overrides)
  const weights = experimentContext
    ? configToUse.dimensions.map(d => ({ name: d.name, weight: d.weight }))
    : await getWeightsForTeam(prompt.team_id);

  // Perform analysis
  const result = await performAnalysis(prompt, configToUse, weights);

  // Tag with experiment context
  return {
    ...result,
    experiment_context: experimentContext,
  };
}
```

### Distribution Validation Test

```typescript
// lib/utils/__tests__/experiment-hash.test.ts

import { calculateAssignmentHash, getVariantFromHash } from '../experiment-hash';

describe('Experiment Hash Distribution', () => {
  it('distributes uniformly across 100 buckets', () => {
    const experimentId = 'test-experiment-123';
    const buckets = new Array(100).fill(0);

    // Simulate 10,000 users
    for (let i = 0; i < 10000; i++) {
      const userId = `user-${i}`;
      const hash = calculateAssignmentHash(userId, experimentId);
      buckets[hash]++;
    }

    // Each bucket should have roughly 100 users (10000/100)
    // Allow 50% variance (50-150)
    for (let i = 0; i < 100; i++) {
      expect(buckets[i]).toBeGreaterThan(50);
      expect(buckets[i]).toBeLessThan(150);
    }
  });

  it('respects traffic split percentages', () => {
    const experimentId = 'test-experiment-456';
    const variantPercentage = 30; // 30% variant, 70% control

    let controlCount = 0;
    let variantCount = 0;

    for (let i = 0; i < 10000; i++) {
      const userId = `user-${i}`;
      const hash = calculateAssignmentHash(userId, experimentId);
      const variant = getVariantFromHash(hash, variantPercentage);

      if (variant === 'control') {
        controlCount++;
      } else {
        variantCount++;
      }
    }

    // Expected: 70% control, 30% variant
    // Allow 5% variance
    expect(controlCount).toBeGreaterThan(6500); // > 65%
    expect(controlCount).toBeLessThan(7500);    // < 75%
    expect(variantCount).toBeGreaterThan(2500); // > 25%
    expect(variantCount).toBeLessThan(3500);    // < 35%
  });

  it('produces consistent assignments', () => {
    const userId = 'consistent-user-123';
    const experimentId = 'consistent-experiment-456';

    // Same inputs should always produce same output
    const hash1 = calculateAssignmentHash(userId, experimentId);
    const hash2 = calculateAssignmentHash(userId, experimentId);
    const hash3 = calculateAssignmentHash(userId, experimentId);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('produces different assignments for different experiments', () => {
    const userId = 'user-123';

    const hash1 = calculateAssignmentHash(userId, 'experiment-1');
    const hash2 = calculateAssignmentHash(userId, 'experiment-2');

    // Different experiments should (usually) produce different hashes
    // Note: There's a 1% chance they're the same, so we test multiple
    let differentCount = 0;
    for (let i = 0; i < 100; i++) {
      const h1 = calculateAssignmentHash(`user-${i}`, 'experiment-a');
      const h2 = calculateAssignmentHash(`user-${i}`, 'experiment-b');
      if (h1 !== h2) differentCount++;
    }

    expect(differentCount).toBeGreaterThan(90); // At least 90% different
  });
});
```

### Component File Locations

| Component | Path |
|-----------|------|
| Hash Utility | `lib/utils/experiment-hash.ts` |
| Assignment Service | `lib/services/experiment-assignment.ts` |
| Conflict Detector | `lib/services/experiment-conflict-detector.ts` |
| Assignment API | `app/api/admin/experiments/assignments/[userId]/route.ts` |
| Hash Tests | `lib/utils/__tests__/experiment-hash.test.ts` |
| Assignment Tests | `lib/services/__tests__/experiment-assignment.test.ts` |
| Conflict Tests | `lib/services/__tests__/experiment-conflict-detector.test.ts` |

### Experiment Conflict Detection

When multiple experiments run simultaneously, they may target overlapping user segments. The conflict detector handles this:

```typescript
// lib/services/experiment-conflict-detector.ts

export interface ExperimentConflict {
  experiment_id_1: string;
  experiment_id_2: string;
  conflict_type: 'same_team' | 'overlapping_segment' | 'global_overlap';
  affected_users_estimate: number;
  resolution: 'priority' | 'newest_wins' | 'manual';
}

export interface ConflictResolution {
  winning_experiment_id: string;
  reason: string;
  logged_at: string;
}

/**
 * Detect conflicts between running experiments
 */
export async function detectExperimentConflicts(
  newExperimentId: string
): Promise<ExperimentConflict[]> {
  const supabase = createAdminClient();

  // Get the new experiment's targeting
  const { data: newExp } = await supabase
    .from('experiments')
    .select('id, team_id, target_segment')
    .eq('id', newExperimentId)
    .single();

  if (!newExp) return [];

  // Find running experiments with overlapping targeting
  const { data: runningExperiments } = await supabase
    .from('experiments')
    .select('id, team_id, target_segment, priority, created_at')
    .eq('status', 'running')
    .neq('id', newExperimentId);

  const conflicts: ExperimentConflict[] = [];

  for (const exp of runningExperiments || []) {
    // Check for same team targeting
    if (exp.team_id === newExp.team_id) {
      conflicts.push({
        experiment_id_1: newExperimentId,
        experiment_id_2: exp.id,
        conflict_type: 'same_team',
        affected_users_estimate: await estimateTeamUsers(exp.team_id),
        resolution: 'priority',
      });
    }

    // Check for global experiments (no team filter)
    if (!exp.team_id && !newExp.team_id) {
      conflicts.push({
        experiment_id_1: newExperimentId,
        experiment_id_2: exp.id,
        conflict_type: 'global_overlap',
        affected_users_estimate: await estimateTotalUsers(),
        resolution: 'newest_wins',
      });
    }
  }

  return conflicts;
}

/**
 * Resolve which experiment takes priority for a user
 */
export function resolveExperimentPriority(
  experiments: Array<{ id: string; priority?: number; created_at: string }>
): string {
  // Sort by priority (higher first), then by created_at (newer first)
  const sorted = [...experiments].sort((a, b) => {
    // Explicit priority takes precedence
    if (a.priority !== undefined && b.priority !== undefined) {
      return b.priority - a.priority;
    }
    if (a.priority !== undefined) return -1;
    if (b.priority !== undefined) return 1;

    // Fall back to newest experiment wins
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return sorted[0].id;
}

/**
 * Log conflict for admin review
 */
export async function logExperimentConflict(
  conflict: ExperimentConflict,
  resolution: ConflictResolution
): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from('experiment_conflict_log').insert({
    experiment_id_1: conflict.experiment_id_1,
    experiment_id_2: conflict.experiment_id_2,
    conflict_type: conflict.conflict_type,
    resolution_strategy: conflict.resolution,
    winning_experiment_id: resolution.winning_experiment_id,
    resolution_reason: resolution.reason,
    logged_at: new Date().toISOString(),
  });
}
```

### Multi-Experiment Priority Handling

When a user could be assigned to multiple experiments, the system uses this priority order:

1. **Explicit Priority**: Experiments can have an optional `priority` field (higher number = higher priority)
2. **Newest Wins**: If no explicit priority, the most recently created experiment takes precedence
3. **Independent Assignment**: Different experiments testing different aspects (e.g., one testing dimension weights, another testing prompts) can run independently

**Assignment Strategy:**

```typescript
// In getActiveExperimentsForUser()
async function selectPrimaryExperiment(
  userId: string,
  experiments: Experiment[]
): Promise<Experiment> {
  // Filter to experiments that could conflict (same config aspect)
  const potentialConflicts = groupByConfigAspect(experiments);

  // For each group, select the highest priority experiment
  const selectedExperiments: Experiment[] = [];

  for (const [aspect, exps] of Object.entries(potentialConflicts)) {
    if (exps.length === 1) {
      selectedExperiments.push(exps[0]);
    } else {
      // Resolve conflict using priority
      const winningId = resolveExperimentPriority(exps);
      const winner = exps.find(e => e.id === winningId)!;
      selectedExperiments.push(winner);

      // Log the conflict
      for (const loser of exps.filter(e => e.id !== winningId)) {
        await logExperimentConflict(
          {
            experiment_id_1: winner.id,
            experiment_id_2: loser.id,
            conflict_type: 'same_team',
            affected_users_estimate: 1,
            resolution: 'priority',
          },
          {
            winning_experiment_id: winner.id,
            reason: `Priority resolution for user ${userId}`,
            logged_at: new Date().toISOString(),
          }
        );
      }
    }
  }

  return selectedExperiments[0];
}
```

### Performance Considerations

1. **Assignment Lookup**: O(1) with indexed query on (experiment_id, user_id)
2. **Hash Calculation**: O(1) MD5 hash, ~0.1ms
3. **Caching**: Consider Redis cache for hot experiment data
4. **Batch Updates**: Sample counts updated asynchronously

### Verification Checklist

After completing this story, verify:
- [ ] Hash function produces uniform distribution
- [ ] Same user always gets same variant
- [ ] Traffic split matches configured percentage
- [ ] New assignments created only for running experiments
- [ ] Paused experiments honor existing assignments
- [ ] Multiple experiments work independently
- [ ] Experiment conflicts are detected and logged
- [ ] Priority-based resolution works correctly
- [ ] Sample counts increment correctly
- [ ] Analysis results tagged with experiment context
- [ ] Admin can debug user assignments


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
