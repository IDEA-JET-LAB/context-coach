# Story 22.4: Team-Level Weight Overrides

Status: Ready

## Story

**As a** team admin,
**I want** to customize scoring weights for my team,
**So that** our prompt analysis reflects our team's specific priorities and workflow.

## Acceptance Criteria

1. **Given** I am a team admin on the Team Settings page
   **When** I navigate to "Scoring Preferences"
   **Then** I see the global weights as defaults
   **And** I see an option to customize for my team

2. **Given** I enable team customization
   **When** the customization panel opens
   **Then** I can adjust each dimension weight
   **And** the total must still equal 100%

3. **Given** I save team weight overrides
   **When** my team members' prompts are analyzed
   **Then** the analysis uses my team's custom weights
   **And** other teams are unaffected

4. **Given** I want to see the impact of weight changes
   **When** I click "Preview Impact"
   **Then** I see a comparison of scores with global vs team weights
   **And** the preview uses recent team prompts

5. **Given** I want to use global weights again
   **When** I click "Reset to Global Defaults"
   **Then** my team overrides are removed
   **And** future analyses use global weights

6. **Given** a super admin changes global weights
   **When** my team has custom weights
   **Then** my team weights are unaffected
   **But** I see a notification that global defaults have changed

## Dependencies

- **Story 22.3**: Scoring Weight Configuration (global weights)
- **Story 2.4**: Team Settings (team settings UI)
- **Story 22.10**: Configuration Audit Trail (audit logging)

## Tasks / Subtasks

- [ ] **Task 1: Create team weight overrides table** (AC: #1, #3)
  - [ ] Create migration `20251223003000_team_weight_overrides.sql`
  - [ ] Create `team_weight_overrides` table: team_id, dimension_name, weight, enabled
  - [ ] Add unique constraint on (team_id, dimension_name)
  - [ ] Add RLS policies for team admin access
  - [ ] Add foreign key to teams table

- [ ] **Task 2: Add scoring preferences section to team settings** (AC: #1)
  - [ ] Add new tab "Scoring Preferences" to team settings page
  - [ ] Display global weights as read-only reference
  - [ ] Add toggle: "Use Custom Weights"
  - [ ] Show customization panel when enabled

- [ ] **Task 3: Create team weight editor component** (AC: #2)
  - [ ] Create `components/team-settings/team-weight-editor.tsx`
  - [ ] Reuse weight adjustment UI from Story 22.3
  - [ ] Display global weight as reference below each slider
  - [ ] Show difference indicator (+/- from global)

- [ ] **Task 4: Implement team weight resolution** (AC: #3)
  - [ ] Create `lib/services/weight-resolver.ts`
  - [ ] `getWeightsForTeam(teamId)` - returns team overrides or global
  - [ ] Add caching layer for performance
  - [ ] Update analysis engine to use weight resolver

- [ ] **Task 5: Create weight preview feature** (AC: #4)
  - [ ] Create `components/team-settings/weight-impact-preview.tsx`
  - [ ] Fetch 5 recent team prompts
  - [ ] Calculate scores with global weights
  - [ ] Calculate scores with team weights
  - [ ] Display side-by-side comparison

- [ ] **Task 6: Implement save team weights** (AC: #3)
  - [ ] Create `lib/services/team-weights.ts` server actions
  - [ ] Validate team admin role
  - [ ] Validate total equals 100%
  - [ ] Upsert overrides (insert or update)
  - [ ] Log to audit trail

- [ ] **Task 7: Implement reset to global** (AC: #5)
  - [ ] Add reset confirmation dialog
  - [ ] Delete all team weight overrides
  - [ ] Log reset action to audit trail
  - [ ] Invalidate weight cache for team

- [ ] **Task 8: Create global change notification** (AC: #6)
  - [ ] Track global weight version in settings
  - [ ] Compare team's last-seen version on settings load
  - [ ] Show notification banner if global changed
  - [ ] "Dismiss" updates last-seen version

- [ ] **Task 9: Add team weight to analysis pipeline** (AC: #3)
  - [ ] Modify `analyze-prompt` edge function
  - [ ] Fetch team weights using resolver
  - [ ] Pass weights to scoring calculation
  - [ ] Store weight config version with analysis result

- [ ] **Task 10: Write E2E tests** (AC: #1-6)
  - [ ] Create `e2e/team-weight-overrides.spec.ts`
  - [ ] Test team settings shows scoring preferences
  - [ ] Test custom weight editing
  - [ ] Test save and verify analysis uses team weights
  - [ ] Test reset removes overrides
  - [ ] Test different teams have isolated weights

## Dev Notes

### Database Schema

```sql
-- Migration: 20251223003000_team_weight_overrides.sql

-- Team weight overrides
CREATE TABLE team_weight_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  dimension_name VARCHAR(50) NOT NULL,
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_team_dimension UNIQUE (team_id, dimension_name)
);

-- Track when team last viewed global weights (for change notification)
CREATE TABLE team_weight_settings (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  custom_weights_enabled BOOLEAN DEFAULT FALSE,
  last_global_version_seen INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_team_overrides_team ON team_weight_overrides(team_id);

-- RLS Policies
ALTER TABLE team_weight_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_weight_settings ENABLE ROW LEVEL SECURITY;

-- Team admins can read/write their team's overrides
CREATE POLICY team_admin_overrides ON team_weight_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_weight_overrides.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'admin'
    )
  );

CREATE POLICY team_admin_settings ON team_weight_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_weight_settings.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role = 'admin'
    )
  );
```

### TypeScript Interfaces

```typescript
// lib/types/team-weights.ts

export interface TeamWeightOverride {
  id: string;
  team_id: string;
  dimension_name: string;
  weight: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamWeightSettings {
  team_id: string;
  custom_weights_enabled: boolean;
  last_global_version_seen: number;
}

export interface ResolvedWeights {
  source: 'global' | 'team';
  team_id?: string;
  config_version: number;
  dimensions: Array<{
    name: string;
    weight: number;
    enabled: boolean;
    is_override: boolean; // true if different from global
  }>;
}

export interface WeightImpactPreview {
  prompt_id: string;
  prompt_preview: string;
  global_score: number;
  team_score: number;
  difference: number;
  dimension_comparison: Array<{
    name: string;
    global_weight: number;
    team_weight: number;
    global_contribution: number;
    team_contribution: number;
  }>;
}
```

### Weight Resolver

```typescript
// lib/services/weight-resolver.ts

import { createAdminClient } from '@/lib/supabase/admin';

// In-memory cache with 5-minute TTL
const weightCache = new Map<string, { data: ResolvedWeights; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getWeightsForTeam(teamId: string): Promise<ResolvedWeights> {
  // Check cache first
  const cached = weightCache.get(teamId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const supabase = createAdminClient();

  // Check if team has custom weights enabled
  const { data: settings } = await supabase
    .from('team_weight_settings')
    .select('custom_weights_enabled')
    .eq('team_id', teamId)
    .single();

  if (!settings?.custom_weights_enabled) {
    // Use global weights
    return getGlobalWeights();
  }

  // Fetch team overrides
  const { data: overrides } = await supabase
    .from('team_weight_overrides')
    .select('dimension_name, weight, enabled')
    .eq('team_id', teamId);

  // Fetch global for comparison
  const global = await getGlobalWeights();

  // Merge: team overrides take precedence
  const overrideMap = new Map(
    overrides?.map(o => [o.dimension_name, o]) || []
  );

  const resolved: ResolvedWeights = {
    source: 'team',
    team_id: teamId,
    config_version: global.config_version,
    dimensions: global.dimensions.map(d => {
      const override = overrideMap.get(d.name);
      if (override) {
        return {
          name: d.name,
          weight: override.weight,
          enabled: override.enabled,
          is_override: override.weight !== d.weight,
        };
      }
      return { ...d, is_override: false };
    }),
  };

  // Cache the result
  weightCache.set(teamId, {
    data: resolved,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return resolved;
}

export async function getGlobalWeights(): Promise<ResolvedWeights> {
  const cached = weightCache.get('_global');
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const supabase = createAdminClient();

  const { data: activeConfig } = await supabase
    .from('analysis_configs')
    .select(`
      id, version,
      analysis_dimensions(name, weight, enabled)
    `)
    .eq('is_active', true)
    .single();

  const resolved: ResolvedWeights = {
    source: 'global',
    config_version: activeConfig?.version || 1,
    dimensions: (activeConfig?.analysis_dimensions || []).map(d => ({
      name: d.name,
      weight: d.weight,
      enabled: d.enabled,
      is_override: false,
    })),
  };

  weightCache.set('_global', {
    data: resolved,
    expires: Date.now() + CACHE_TTL_MS,
  });

  return resolved;
}

export function invalidateTeamCache(teamId: string): void {
  weightCache.delete(teamId);
}

export function invalidateGlobalCache(): void {
  weightCache.delete('_global');
  // Also invalidate all team caches since they reference global
  for (const key of weightCache.keys()) {
    if (key !== '_global') {
      const cached = weightCache.get(key);
      if (cached) {
        // Mark as expired
        cached.expires = 0;
      }
    }
  }
}
```

### Team Weight Editor Component

```typescript
// components/team-settings/team-weight-editor.tsx
'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, RotateCcw } from 'lucide-react';
import type { ResolvedWeights } from '@/lib/types/team-weights';

interface TeamWeightEditorProps {
  globalWeights: ResolvedWeights;
  teamWeights: ResolvedWeights | null;
  onSave: (weights: Array<{ dimension_name: string; weight: number; enabled: boolean }>) => void;
  onReset: () => void;
  isLoading: boolean;
}

export function TeamWeightEditor({
  globalWeights,
  teamWeights,
  onSave,
  onReset,
  isLoading,
}: TeamWeightEditorProps) {
  const [customEnabled, setCustomEnabled] = useState(teamWeights?.source === 'team');
  const [dimensions, setDimensions] = useState(
    teamWeights?.dimensions || globalWeights.dimensions
  );

  const total = dimensions.reduce(
    (sum, d) => sum + (d.enabled ? d.weight : 0),
    0
  );
  const isValid = total === 100;

  function handleWeightChange(name: string, weight: number) {
    setDimensions(prev =>
      prev.map(d => (d.name === name ? { ...d, weight } : d))
    );
  }

  function handleSave() {
    if (!isValid) return;
    onSave(dimensions.map(d => ({
      dimension_name: d.name,
      weight: d.weight,
      enabled: d.enabled,
    })));
  }

  return (
    <div className="space-y-6">
      {/* Enable custom weights toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <h3 className="font-medium">Custom Scoring Weights</h3>
          <p className="text-sm text-muted-foreground">
            Override global weights for your team
          </p>
        </div>
        <Switch
          checked={customEnabled}
          onCheckedChange={setCustomEnabled}
        />
      </div>

      {customEnabled && (
        <>
          {/* Dimension editors */}
          <div className="space-y-4">
            {dimensions.map((dimension) => {
              const globalDim = globalWeights.dimensions.find(
                d => d.name === dimension.name
              );
              const diff = dimension.weight - (globalDim?.weight || 0);

              return (
                <div key={dimension.name} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{dimension.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{dimension.weight}%</span>
                      {diff !== 0 && (
                        <span className={diff > 0 ? 'text-green-600' : 'text-red-600'}>
                          ({diff > 0 ? '+' : ''}{diff})
                        </span>
                      )}
                    </div>
                  </div>
                  <Slider
                    value={[dimension.weight]}
                    onValueChange={([value]) =>
                      handleWeightChange(dimension.name, value)
                    }
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>Global: {globalDim?.weight || 0}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total and validation */}
          <Alert variant={isValid ? 'default' : 'destructive'}>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              Total: {total}% {!isValid && '(must equal 100%)'}
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!isValid || isLoading}>
              {isLoading ? 'Saving...' : 'Save Weights'}
            </Button>
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Global
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Team Settings Tab | `app/(dashboard)/team/[id]/settings/scoring/page.tsx` |
| Team Weight Editor | `components/team-settings/team-weight-editor.tsx` |
| Weight Impact Preview | `components/team-settings/weight-impact-preview.tsx` |
| Global Change Banner | `components/team-settings/global-weights-changed-banner.tsx` |
| Services | `lib/services/team-weights.ts` |
| Weight Resolver | `lib/services/weight-resolver.ts` |
| Types | `lib/types/team-weights.ts` |

### Analysis Pipeline Integration

The weight resolver must be integrated into the analysis edge function:

```typescript
// supabase/functions/analyze-prompt/index.ts (modification)

import { getWeightsForTeam } from './weight-resolver';

async function analyzePrompt(prompt: Prompt): Promise<Analysis> {
  // Get team-specific or global weights
  const weights = await getWeightsForTeam(prompt.team_id);

  // Use weights in scoring calculation
  const dimensionScores = await calculateDimensionScores(prompt);

  const overallScore = dimensionScores.reduce((sum, ds) => {
    const weightConfig = weights.dimensions.find(w => w.name === ds.dimension);
    const weight = weightConfig?.weight || 20;
    return sum + (ds.score * weight / 100);
  }, 0);

  return {
    overall_score: overallScore,
    dimension_scores: dimensionScores,
    weight_config_version: weights.config_version,
    weight_source: weights.source,
    // ...
  };
}
```

### Security Considerations

1. **Team Admin Only**: Weight edits restricted to team admins (via RLS)
2. **Team Isolation**: Teams cannot see or affect other teams' weights
3. **Validation**: Server-side validation that total equals 100%
4. **Audit Trail**: All weight changes logged with team context

### Verification Checklist

After completing this story, verify:
- [ ] Scoring preferences tab visible to team admins only
- [ ] Global weights displayed as reference
- [ ] Custom weights toggle enables editing
- [ ] Weight changes show difference from global
- [ ] Total validation prevents invalid saves
- [ ] Saved weights used in team's prompt analysis
- [ ] Other teams unaffected by changes
- [ ] Reset removes all overrides
- [ ] Global change notification appears
- [ ] Cache invalidation works correctly


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
