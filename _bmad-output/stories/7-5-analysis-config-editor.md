# Story 7.5: Analysis Config Editor

Status: ready-for-dev

## Story

**As a** super admin,
**I want** to edit analysis configurations,
**So that** I can tune the AI scoring system.

## Acceptance Criteria

1. **Given** I navigate to Admin > Analysis Config
   **When** the page loads
   **Then** I see all config versions with status (active/inactive)

2. **Given** I click "Create New Version"
   **When** the form opens
   **Then** I can set: version name, system prompt, AI model
   **And** I can add/edit/remove dimensions with: name, weight, prompt template, scoring criteria

3. **Given** I save a new config
   **When** it's created
   **Then** it's saved as inactive
   **And** I can preview it on sample prompts

4. **Given** I click "Activate" on a config
   **When** I confirm
   **Then** the previous active config is deactivated
   **And** new analyses use the new config
   **And** existing analyses retain their original config_id

## Dependencies

- **Story 5.6**: Analysis Configuration Management (creates `analysis_configs` and `analysis_dimensions` tables)
- **Story 7.1**: Admin Access Control (admin route protection and `is_super_admin` check)
- **Story 7.2**: Admin Dashboard Overview (admin layout and navigation)

## Tasks / Subtasks

- [ ] **Task 1: Create analysis config list page** (AC: #1)
  - [ ] Create `app/(dashboard)/admin/analysis-config/page.tsx`
  - [ ] Query all analysis_configs with service role client (`lib/supabase/admin.ts`)
  - [ ] Display configs in a list/table with: version name, status, created date, last modified
  - [ ] Add badge for active/inactive status
  - [ ] Add "Create New Version" button

- [ ] **Task 2: Create config version card component** (AC: #1)
  - [ ] Create `components/admin/config-version-card.tsx`
  - [ ] Display version name prominently
  - [ ] Show active status with green badge
  - [ ] Show dimension count summary
  - [ ] Add action buttons: View, Edit (if inactive), Activate, Delete (if inactive)

- [ ] **Task 3: Create new config form page** (AC: #2)
  - [ ] Create `app/(dashboard)/admin/analysis-config/new/page.tsx`
  - [ ] Add form fields for: version name, description
  - [ ] Add system prompt textarea (large, multi-line)
  - [ ] Add AI model selector dropdown
  - [ ] Use react-hook-form with Zod validation

- [ ] **Task 4: Create dimension editor component** (AC: #2)
  - [ ] Create `components/admin/dimension-editor.tsx`
  - [ ] Display list of dimensions with drag-to-reorder
  - [ ] Add "Add Dimension" button
  - [ ] Each dimension shows: name, weight, collapse/expand toggle

- [ ] **Task 5: Create dimension form fields** (AC: #2)
  - [ ] Add dimension name input
  - [ ] Add weight slider/number input (0-100, total should be 100)
  - [ ] Add prompt template textarea with variable hints
  - [ ] Add scoring criteria textarea
  - [ ] Add delete dimension button with confirmation

- [ ] **Task 6: Implement weight validation** (AC: #2)
  - [ ] Display total weight sum dynamically
  - [ ] Show warning if total is not 100
  - [ ] Prevent save if weights don't sum to 100
  - [ ] Add "Auto-balance" button to distribute evenly

- [ ] **Task 7: Create config save functionality** (AC: #3)
  - [ ] Create `lib/api/admin/save-analysis-config.ts` server action
  - [ ] Validate all required fields
  - [ ] Save config with `is_active = false`
  - [ ] Save all dimensions with config_id reference
  - [ ] Return created config ID
  - [ ] Redirect to config detail page

- [ ] **Task 8: Create config detail/edit page** (AC: #2, #3)
  - [ ] Create `app/(dashboard)/admin/analysis-config/[id]/page.tsx`
  - [ ] Load existing config and dimensions
  - [ ] Allow editing if config is inactive
  - [ ] Show read-only view if config is active
  - [ ] Display "Activate" button for inactive configs

- [ ] **Task 9: Implement preview functionality** (AC: #3)
  - [ ] Create `components/admin/config-preview.tsx`
  - [ ] Add sample prompt input textarea
  - [ ] Add "Preview Analysis" button
  - [ ] Create `lib/api/admin/preview-analysis.ts` server action
  - [ ] Run analysis with selected config (without saving result)
  - [ ] Display preview scores for each dimension

- [ ] **Task 10: Implement config activation** (AC: #4)
  - [ ] Create `lib/api/admin/activate-config.ts` server action
  - [ ] Add confirmation dialog before activation (use AlertDialog from shadcn/ui)
  - [ ] Deactivate currently active config
  - [ ] Activate selected config
  - [ ] Use database transaction for atomicity
  - [ ] Log activation event to `console.log('[Admin] Analysis config ${configId} activated')`

- [ ] **Task 11: Create config duplication** (AC: #2)
  - [ ] Add "Duplicate" button on config cards
  - [ ] Create `lib/api/admin/duplicate-config.ts` server action
  - [ ] Copy config with new name "Copy of [original]"
  - [ ] Copy all dimensions
  - [ ] Open new config in edit mode

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- Next.js 15 with App Router
- TypeScript in strict mode
- react-hook-form for form management
- Zod for validation
- Service role client for all queries (bypasses RLS for cross-team data)

**Analysis Engine Context:**
- Configs are versioned and immutable once active
- Each analysis links to specific config_id
- Only one config can be active at a time (enforced by unique index)
- Active configs cannot be edited (create new version instead)

### Existing Infrastructure (From Story 5.6)

The following database tables already exist from Story 5.6:

```sql
-- analysis_configs table (already created)
CREATE TABLE analysis_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  system_prompt TEXT NOT NULL,
  model VARCHAR(50) NOT NULL DEFAULT 'gpt-4o-mini',
  is_active BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

-- analysis_dimensions table (already created)
CREATE TABLE analysis_dimensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID REFERENCES analysis_configs(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  enabled BOOLEAN DEFAULT TRUE,
  prompt_template TEXT NOT NULL,
  scoring_criteria TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index ensures only one active config
CREATE UNIQUE INDEX one_active_config ON analysis_configs (is_active) WHERE is_active = TRUE;
```

### TypeScript Interfaces

```typescript
// Types matching database schema
interface AnalysisConfig {
  id: string;
  version_name: string;
  description: string | null;
  system_prompt: string;
  ai_model: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AnalysisDimension {
  id: string;
  config_id: string;
  name: string;
  weight: number; // 0-100, all dimensions must sum to 100
  prompt_template: string;
  scoring_criteria: string;
  display_order: number;
}
```

### Supabase Client Pattern

```typescript
// lib/supabase/admin.ts - Use this for all admin queries
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Bypasses RLS
    { auth: { persistSession: false } }
  );
}
```

### Config List Query

```typescript
// lib/db/queries/admin-analysis-config.ts
import { createAdminClient } from '@/lib/supabase/admin';

export async function getAnalysisConfigs() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('analysis_configs')
    .select(`
      id,
      version_name,
      description,
      ai_model,
      is_active,
      created_at,
      updated_at,
      analysis_dimensions(count)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data?.map(config => ({
    ...config,
    dimension_count: config.analysis_dimensions?.[0]?.count ?? 0,
  })) ?? [];
}
```

### Config Form Schema

```typescript
// lib/validations/analysis-config.ts
import { z } from 'zod';

export const dimensionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Dimension name is required'),
  weight: z.number().min(0).max(100),
  prompt_template: z.string().min(1, 'Prompt template is required'),
  scoring_criteria: z.string().min(1, 'Scoring criteria is required'),
  display_order: z.number(),
});

export const analysisConfigSchema = z.object({
  version_name: z.string().min(1, 'Version name is required'),
  description: z.string().optional(),
  system_prompt: z.string().min(1, 'System prompt is required'),
  ai_model: z.enum(['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'claude-3-5-haiku']),
  dimensions: z.array(dimensionSchema)
    .min(1, 'At least one dimension is required')
    .refine(
      dims => dims.reduce((sum, d) => sum + d.weight, 0) === 100,
      'Dimension weights must sum to 100'
    ),
});

export type AnalysisConfigInput = z.infer<typeof analysisConfigSchema>;
export type DimensionInput = z.infer<typeof dimensionSchema>;
```

### Dimension Editor Component

```typescript
// components/admin/dimension-editor.tsx
'use client';

import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { AnalysisConfigInput } from '@/lib/validations/analysis-config';

interface DimensionEditorProps {
  form: UseFormReturn<AnalysisConfigInput>;
}

export function DimensionEditor({ form }: DimensionEditorProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'dimensions',
  });

  const totalWeight = form.watch('dimensions').reduce(
    (sum, dim) => sum + (dim.weight ?? 0),
    0
  );

  function addDimension() {
    append({
      name: '',
      weight: 0,
      prompt_template: '',
      scoring_criteria: '',
      display_order: fields.length,
    });
  }

  function autoBalance() {
    const count = fields.length;
    if (count === 0) return;

    const baseWeight = Math.floor(100 / count);
    const remainder = 100 % count;

    fields.forEach((_, index) => {
      const weight = index < remainder ? baseWeight + 1 : baseWeight;
      form.setValue(`dimensions.${index}.weight`, weight);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Dimensions</h3>
        <div className="flex items-center gap-2">
          <span className={totalWeight === 100 ? 'text-green-600' : 'text-red-600'}>
            Total: {totalWeight}%
          </span>
          <Button type="button" variant="outline" size="sm" onClick={autoBalance}>
            Auto-balance
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addDimension}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {fields.map((field, index) => (
        <Card key={field.id}>
          <CardHeader className="flex flex-row items-center gap-2 py-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
            <Input
              {...form.register(`dimensions.${index}.name`)}
              placeholder="Dimension name"
              className="flex-1"
            />
            <div className="flex items-center gap-2 w-32">
              <Slider
                value={[form.watch(`dimensions.${index}.weight`)]}
                onValueChange={([value]) =>
                  form.setValue(`dimensions.${index}.weight`, value)
                }
                max={100}
                step={1}
              />
              <span className="w-12 text-sm">{form.watch(`dimensions.${index}.weight`)}%</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">Prompt Template</label>
              <Textarea
                {...form.register(`dimensions.${index}.prompt_template`)}
                placeholder="Template for evaluating this dimension. Use {{prompt}} for the user's prompt."
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Scoring Criteria</label>
              <Textarea
                {...form.register(`dimensions.${index}.scoring_criteria`)}
                placeholder="Criteria for scoring 1-10 on this dimension"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Save Config Server Action

```typescript
// lib/api/admin/save-analysis-config.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { analysisConfigSchema, type AnalysisConfigInput } from '@/lib/validations/analysis-config';
import { revalidatePath } from 'next/cache';

export async function saveAnalysisConfig(input: AnalysisConfigInput) {
  const validated = analysisConfigSchema.parse(input);
  const supabase = createAdminClient();

  const { data: config, error: configError } = await supabase
    .from('analysis_configs')
    .insert({
      version_name: validated.version_name,
      description: validated.description,
      system_prompt: validated.system_prompt,
      ai_model: validated.ai_model,
      is_active: false,
    })
    .select()
    .single();

  if (configError) throw configError;

  const dimensions = validated.dimensions.map((dim, index) => ({
    config_id: config.id,
    name: dim.name,
    weight: dim.weight,
    prompt_template: dim.prompt_template,
    scoring_criteria: dim.scoring_criteria,
    display_order: index,
  }));

  const { error: dimsError } = await supabase
    .from('analysis_dimensions')
    .insert(dimensions);

  if (dimsError) throw dimsError;

  revalidatePath('/admin/analysis-config');
  return { id: config.id };
}
```

### Activate Config Server Action

```typescript
// lib/api/admin/activate-config.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function activateConfig(configId: string) {
  const supabase = createAdminClient();

  // Deactivate all configs first
  const { error: deactivateError } = await supabase
    .from('analysis_configs')
    .update({ is_active: false })
    .eq('is_active', true);

  if (deactivateError) throw deactivateError;

  // Activate selected config
  const { error: activateError } = await supabase
    .from('analysis_configs')
    .update({ is_active: true, activated_at: new Date().toISOString() })
    .eq('id', configId);

  if (activateError) throw activateError;

  console.log(`[Admin] Analysis config ${configId} activated`);

  revalidatePath('/admin/analysis-config');
  return { success: true };
}
```

### Error Response Format

Follow the standard API error format from project-context.md:

```typescript
// Error responses
{ error: { code: 'VALIDATION_ERROR', message: 'Weights must sum to 100' } }
{ error: { code: 'NOT_FOUND', message: 'Config not found' } }
{ error: { code: 'FORBIDDEN', message: 'Cannot edit active config' } }
```

### Component File Locations

| Component | Path |
|-----------|------|
| Config List Page | `app/(dashboard)/admin/analysis-config/page.tsx` |
| New Config Page | `app/(dashboard)/admin/analysis-config/new/page.tsx` |
| Config Detail Page | `app/(dashboard)/admin/analysis-config/[id]/page.tsx` |
| Config Version Card | `components/admin/config-version-card.tsx` |
| Dimension Editor | `components/admin/dimension-editor.tsx` |
| Config Preview | `components/admin/config-preview.tsx` |
| Config Form | `components/admin/analysis-config-form.tsx` |
| Config Queries | `lib/db/queries/admin-analysis-config.ts` |
| Save Action | `lib/api/admin/save-analysis-config.ts` |
| Activate Action | `lib/api/admin/activate-config.ts` |
| Preview Action | `lib/api/admin/preview-analysis.ts` |
| Duplicate Action | `lib/api/admin/duplicate-config.ts` |
| Validation Schema | `lib/validations/analysis-config.ts` |

### AI Model Options

| Model ID | Display Name | Provider |
|----------|--------------|----------|
| gpt-4o | GPT-4o | OpenAI |
| gpt-4o-mini | GPT-4o Mini | OpenAI |
| claude-3-5-sonnet | Claude 3.5 Sonnet | Anthropic |
| claude-3-5-haiku | Claude 3.5 Haiku | Anthropic |

### shadcn/ui Components Needed

```bash
npx shadcn@latest add card form input textarea select slider badge alert-dialog
```

### Common Pitfalls to Avoid

1. **DO NOT** allow editing active configs - create new version instead
2. **DO NOT** allow activation if weights don't sum to 100
3. **DO NOT** delete active configs
4. **DO NOT** forget to order dimensions by display_order
5. **DO NOT** allow duplicate version names
6. **DO NOT** forget to handle preview errors gracefully
7. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
8. **DO NOT** use regular Supabase client - always use admin client for admin routes

### Verification Checklist

After completing this story, verify:
- [ ] Config list shows all versions with status
- [ ] Active config has green badge
- [ ] "Create New Version" opens form
- [ ] Version name is required
- [ ] System prompt is required
- [ ] AI model selector works
- [ ] Can add/remove dimensions
- [ ] Weight slider updates total
- [ ] Warning shows if weights != 100
- [ ] Auto-balance distributes evenly
- [ ] New configs save as inactive
- [ ] Preview runs analysis on sample
- [ ] Activation deactivates previous
- [ ] Active configs are read-only
- [ ] Duplicate creates copy

## Dev Agent Record

### Agent Model Used

*To be filled by dev agent*

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
