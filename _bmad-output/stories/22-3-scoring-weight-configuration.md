# Story 22.3: Scoring Weight Configuration

Status: Ready

## Story

**As a** super admin,
**I want** to configure scoring dimension weights that sum to 100%,
**So that** I can adjust the relative importance of different analysis dimensions.

## Acceptance Criteria

1. **Given** I navigate to Admin > Analysis > Scoring Weights
   **When** the page loads
   **Then** I see all analysis dimensions with their current weights
   **And** the total weight sum is displayed prominently

2. **Given** I adjust a dimension weight using the slider
   **When** I change the value
   **Then** the other weights can be adjusted to maintain 100% total
   **And** I see real-time feedback on the total

3. **Given** the total weight is not 100%
   **When** I try to save
   **Then** the save button is disabled
   **And** I see an error message indicating the discrepancy

4. **Given** I click "Auto-Balance"
   **When** I have unequal weights
   **Then** all enabled dimensions are set to equal weights
   **And** the total equals exactly 100%

5. **Given** I click "Reset to Defaults"
   **When** I confirm the action
   **Then** weights are restored to the original configuration
   **And** changes are not saved until I explicitly save

6. **Given** I save valid weights
   **When** the save completes
   **Then** new analyses use the updated weights
   **And** existing analyses retain their original weights
   **And** the change is logged to audit trail

## Dependencies

- **Story 7.5**: Analysis Config Editor (dimension data structure)
- **Story 22.5**: Configuration Version Control (snapshot before change)
- **Story 22.10**: Configuration Audit Trail (audit logging)

## Tasks / Subtasks

- [ ] **Task 1: Create scoring weights page** (AC: #1)
  - [ ] Create `app/(dashboard)/admin/analysis/weights/page.tsx`
  - [ ] Query active config with all dimensions
  - [ ] Display dimensions in sortable list with current weights
  - [ ] Show total weight sum prominently
  - [ ] Add status indicator (green if 100%, red if not)

- [ ] **Task 2: Create weight adjustment component** (AC: #2)
  - [ ] Create `components/admin/weight-adjuster.tsx`
  - [ ] Add slider for each dimension (0-100)
  - [ ] Add number input for precise values
  - [ ] Show real-time total as weights change
  - [ ] Enable/disable toggle for each dimension

- [ ] **Task 3: Implement weight validation** (AC: #3)
  - [ ] Add total calculation effect
  - [ ] Disable save button when total != 100
  - [ ] Display clear error message: "Total must equal 100% (currently X%)"
  - [ ] Highlight dimensions contributing to imbalance

- [ ] **Task 4: Implement auto-balance functionality** (AC: #4)
  - [ ] Create `autoBalanceWeights()` function
  - [ ] Calculate equal distribution for enabled dimensions
  - [ ] Handle remainder distribution (first N dimensions get +1)
  - [ ] Skip disabled dimensions (weight = 0)

- [ ] **Task 5: Implement reset to defaults** (AC: #5)
  - [ ] Create `lib/config/default-weights.ts` with default values
  - [ ] Add confirmation dialog before reset
  - [ ] Restore original weights from active config
  - [ ] Don't auto-save - require explicit save action

- [ ] **Task 6: Create weight save functionality** (AC: #6)
  - [ ] Create `lib/services/scoring-weights.ts` server actions
  - [ ] Validate total equals 100 on server
  - [ ] Update dimension weights in database
  - [ ] Log change to audit trail with old/new values
  - [ ] Invalidate any cached weight configurations

- [ ] **Task 7: Implement weight preview** (AC: #2)
  - [ ] Add "Preview Impact" button
  - [ ] Run sample prompt through analysis with new weights
  - [ ] Show before/after score comparison
  - [ ] Display dimension-by-dimension impact

- [ ] **Task 8: Create weight history view** (AC: #6)
  - [ ] Query audit trail for weight changes
  - [ ] Display change history in sidebar
  - [ ] Allow quick revert to previous configuration
  - [ ] Show diff between versions

- [ ] **Task 9: Add keyboard shortcuts** (AC: #2)
  - [ ] Tab/Shift+Tab to navigate dimensions
  - [ ] Arrow keys to adjust current dimension
  - [ ] Enter to save (if valid)
  - [ ] Escape to reset unsaved changes

- [ ] **Task 10: Write E2E tests** (AC: #1-6)
  - [ ] Create `e2e/admin-scoring-weights.spec.ts`
  - [ ] Test weight display and totals
  - [ ] Test slider adjustment updates total
  - [ ] Test save blocked when total != 100
  - [ ] Test auto-balance distributes evenly
  - [ ] Test reset restores defaults
  - [ ] Test saved weights persist

## Dev Notes

### Current Weight Schema (from Story 7.5)

The weights are stored in `analysis_dimensions` table:

```sql
-- Existing schema
CREATE TABLE analysis_dimensions (
  id UUID PRIMARY KEY,
  config_id UUID REFERENCES analysis_configs(id),
  name VARCHAR(50) NOT NULL,
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  enabled BOOLEAN DEFAULT TRUE,
  -- ... other fields
);
```

### TypeScript Interfaces

```typescript
// lib/types/scoring-weights.ts

export interface DimensionWeight {
  id: string;
  name: string;
  description: string;
  weight: number;
  enabled: boolean;
  minWeight?: number; // Optional minimum (e.g., 5%)
  maxWeight?: number; // Optional maximum (e.g., 50%)
}

export interface WeightConfiguration {
  config_id: string;
  config_version: number;
  dimensions: DimensionWeight[];
  total: number;
  is_valid: boolean;
}

export interface WeightChange {
  dimension_id: string;
  dimension_name: string;
  old_weight: number;
  new_weight: number;
}

export interface WeightSaveRequest {
  weights: Array<{
    dimension_id: string;
    weight: number;
    enabled: boolean;
  }>;
}
```

### Weight Adjuster Component

```typescript
// components/admin/weight-adjuster.tsx
'use client';

import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DimensionWeight } from '@/lib/types/scoring-weights';

interface WeightAdjusterProps {
  dimensions: DimensionWeight[];
  onChange: (dimensions: DimensionWeight[]) => void;
  defaultWeights: DimensionWeight[];
}

export function WeightAdjuster({
  dimensions,
  onChange,
  defaultWeights,
}: WeightAdjusterProps) {
  const [localDimensions, setLocalDimensions] = useState(dimensions);

  const total = localDimensions.reduce(
    (sum, d) => sum + (d.enabled ? d.weight : 0),
    0
  );
  const isValid = total === 100;

  function handleWeightChange(id: string, value: number) {
    setLocalDimensions(prev =>
      prev.map(d => (d.id === id ? { ...d, weight: Math.min(100, Math.max(0, value)) } : d))
    );
  }

  function handleEnabledChange(id: string, enabled: boolean) {
    setLocalDimensions(prev =>
      prev.map(d => (d.id === id ? { ...d, enabled, weight: enabled ? d.weight : 0 } : d))
    );
  }

  function autoBalance() {
    const enabledCount = localDimensions.filter(d => d.enabled).length;
    if (enabledCount === 0) return;

    const baseWeight = Math.floor(100 / enabledCount);
    const remainder = 100 % enabledCount;

    let assignedRemainder = 0;
    setLocalDimensions(prev =>
      prev.map(d => {
        if (!d.enabled) return { ...d, weight: 0 };
        const extra = assignedRemainder < remainder ? 1 : 0;
        assignedRemainder++;
        return { ...d, weight: baseWeight + extra };
      })
    );
  }

  function resetToDefaults() {
    setLocalDimensions(defaultWeights);
  }

  useEffect(() => {
    onChange(localDimensions);
  }, [localDimensions, onChange]);

  return (
    <div className="space-y-6">
      {/* Total indicator */}
      <div className={cn(
        "flex items-center justify-between p-4 rounded-lg",
        isValid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200",
        "border"
      )}>
        <span className="font-medium">Total Weight</span>
        <span className={cn(
          "text-2xl font-bold",
          isValid ? "text-green-600" : "text-red-600"
        )}>
          {total}%
        </span>
      </div>

      {/* Dimension list */}
      <div className="space-y-4">
        {localDimensions.map((dimension) => (
          <div
            key={dimension.id}
            className={cn(
              "p-4 border rounded-lg",
              !dimension.enabled && "opacity-50"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Switch
                  checked={dimension.enabled}
                  onCheckedChange={(checked) =>
                    handleEnabledChange(dimension.id, checked)
                  }
                />
                <div>
                  <span className="font-medium">{dimension.name}</span>
                  <p className="text-sm text-muted-foreground">
                    {dimension.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={dimension.weight}
                  onChange={(e) =>
                    handleWeightChange(dimension.id, parseInt(e.target.value) || 0)
                  }
                  className="w-20"
                  disabled={!dimension.enabled}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <Slider
              value={[dimension.weight]}
              onValueChange={([value]) =>
                handleWeightChange(dimension.id, value)
              }
              max={100}
              step={1}
              disabled={!dimension.enabled}
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={autoBalance}>
          Auto-Balance
        </Button>
        <Button variant="outline" onClick={resetToDefaults}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
```

### Server Actions

```typescript
// lib/services/scoring-weights.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin, SuperAdminError } from '@/lib/auth/admin';
import { logAdminAction } from '@/lib/services/admin-users';
import { revalidatePath } from 'next/cache';
import type { WeightSaveRequest, WeightChange } from '@/lib/types/scoring-weights';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

/**
 * Get current weights from active config
 */
export async function getCurrentWeights(): Promise<ActionResult<{
  config_id: string;
  dimensions: Array<{
    id: string;
    name: string;
    description: string;
    weight: number;
    enabled: boolean;
  }>;
}>> {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    const { data: activeConfig } = await supabase
      .from('analysis_configs')
      .select('id')
      .eq('is_active', true)
      .single();

    if (!activeConfig) {
      return { success: false, error: { code: 'NO_ACTIVE_CONFIG', message: 'No active config found' } };
    }

    const { data: dimensions, error } = await supabase
      .from('analysis_dimensions')
      .select('id, name, description, weight, enabled')
      .eq('config_id', activeConfig.id)
      .order('sort_order', { ascending: true });

    if (error) {
      return { success: false, error: { code: 'FETCH_ERROR', message: error.message } };
    }

    return {
      success: true,
      data: {
        config_id: activeConfig.id,
        dimensions: dimensions || [],
      },
    };
  } catch (err) {
    if (err instanceof SuperAdminError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    throw err;
  }
}

/**
 * Save updated weights
 */
export async function saveWeights(request: WeightSaveRequest): Promise<ActionResult<{ success: boolean }>> {
  try {
    const admin = await verifySuperAdmin();

    // Validate total equals 100
    const total = request.weights.reduce(
      (sum, w) => sum + (w.enabled !== false ? w.weight : 0),
      0
    );

    if (total !== 100) {
      return {
        success: false,
        error: { code: 'INVALID_TOTAL', message: `Weights must sum to 100% (currently ${total}%)` },
      };
    }

    const supabase = createAdminClient();

    // Get current weights for audit trail
    const { data: currentDimensions } = await supabase
      .from('analysis_dimensions')
      .select('id, name, weight, enabled')
      .in('id', request.weights.map(w => w.dimension_id));

    const changes: WeightChange[] = [];
    const currentMap = new Map(currentDimensions?.map(d => [d.id, d]) || []);

    // Update each dimension
    for (const weight of request.weights) {
      const current = currentMap.get(weight.dimension_id);
      if (current && (current.weight !== weight.weight || current.enabled !== weight.enabled)) {
        changes.push({
          dimension_id: weight.dimension_id,
          dimension_name: current.name,
          old_weight: current.weight,
          new_weight: weight.weight,
        });
      }

      const { error } = await supabase
        .from('analysis_dimensions')
        .update({ weight: weight.weight, enabled: weight.enabled ?? true })
        .eq('id', weight.dimension_id);

      if (error) {
        return { success: false, error: { code: 'UPDATE_ERROR', message: error.message } };
      }
    }

    // Log to audit trail
    if (changes.length > 0) {
      await logAdminAction(admin.adminId, 'weight_update' as any, {
        changes,
        total_weight: total,
      });
    }

    revalidatePath('/admin/analysis/weights');
    return { success: true, data: { success: true } };
  } catch (err) {
    if (err instanceof SuperAdminError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    throw err;
  }
}
```

### Default Weights Configuration

```typescript
// lib/config/default-weights.ts

export const DEFAULT_DIMENSION_WEIGHTS: Record<string, number> = {
  clarity: 20,
  specificity: 20,
  context: 20,
  actionability: 20,
  efficiency: 20,
};

export const DIMENSION_CONSTRAINTS = {
  clarity: { min: 10, max: 40 },
  specificity: { min: 10, max: 40 },
  context: { min: 10, max: 40 },
  actionability: { min: 10, max: 40 },
  efficiency: { min: 10, max: 40 },
};

export function getDefaultWeight(dimensionName: string): number {
  return DEFAULT_DIMENSION_WEIGHTS[dimensionName.toLowerCase()] ?? 20;
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Weights Page | `app/(dashboard)/admin/analysis/weights/page.tsx` |
| Weight Adjuster | `components/admin/weight-adjuster.tsx` |
| Weight History | `components/admin/weight-history.tsx` |
| Weight Preview | `components/admin/weight-preview.tsx` |
| Services | `lib/services/scoring-weights.ts` |
| Types | `lib/types/scoring-weights.ts` |
| Defaults | `lib/config/default-weights.ts` |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Move to next dimension |
| Shift+Tab | Move to previous dimension |
| Up Arrow | Increase weight by 1 |
| Down Arrow | Decrease weight by 1 |
| Shift+Up | Increase weight by 5 |
| Shift+Down | Decrease weight by 5 |
| Enter | Save (if valid) |
| Escape | Reset unsaved changes |

### Verification Checklist

After completing this story, verify:
- [ ] All dimensions displayed with current weights
- [ ] Total indicator shows correct sum
- [ ] Slider updates weight in real-time
- [ ] Number input allows precise values
- [ ] Save disabled when total != 100
- [ ] Error message shows current vs expected total
- [ ] Auto-balance distributes evenly
- [ ] Reset restores original values
- [ ] Saved weights persist after refresh
- [ ] Audit trail records changes with old/new values
- [ ] Keyboard navigation works


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
