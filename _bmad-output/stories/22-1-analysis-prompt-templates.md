# Story 22.1: Analysis Prompt Templates

Status: Completed

## Story

**As a** super admin,
**I want** to create, edit, and manage LLM prompt templates with variable substitution,
**So that** I can customize how the AI analyzes prompts without changing code.

## Acceptance Criteria

1. **Given** I navigate to Admin > Analysis > Prompt Templates
   **When** the page loads
   **Then** I see all prompt templates listed with name, type, and status

2. **Given** I click "Create Template"
   **When** the form opens
   **Then** I can define: name, type (analysis/feedback/classification), template body with `{{variables}}`
   **And** I see a list of available variables for each template type

3. **Given** I enter a template body
   **When** I use `{{variable}}` syntax
   **Then** the editor highlights valid variables in green
   **And** unknown variables are highlighted in yellow with a warning

4. **Given** I save a prompt template
   **When** validation passes
   **Then** the template is saved as draft status
   **And** I can preview it with sample data

5. **Given** I click "Preview" on a template
   **When** sample data is provided
   **Then** I see the rendered template with variables substituted
   **And** I can optionally run it through the LLM for a test analysis

6. **Given** I have a draft template
   **When** I click "Publish"
   **Then** the template status changes to active
   **And** it becomes available for use in analysis configurations

## Dependencies

- **Story 7.5**: Analysis Config Editor (base admin config UI patterns)
- **Story 22.5**: Configuration Version Control (versioning infrastructure)
- **Story 22.10**: Configuration Audit Trail (audit logging)

## Tasks / Subtasks

- [x] **Task 1: Create database schema for prompt templates** (AC: #1, #6)
  - [x] Create migration `20251224001000_prompt_templates.sql`
  - [x] Create `prompt_templates` table with fields: id, name, type, body, variables, status, version, created_by, created_at, updated_at
  - [x] Create `prompt_template_variables` table for variable definitions
  - [x] Add RLS policies for super admin access only
  - [x] Add audit trigger for all changes

- [x] **Task 2: Create prompt templates list page** (AC: #1)
  - [x] Create `app/(dashboard)/admin/analysis/templates/page.tsx`
  - [x] Query all templates with service role client
  - [x] Display templates in table with: name, type badge, status badge, last updated
  - [x] Add filter by type (analysis/feedback/classification)
  - [x] Add "Create Template" button

- [x] **Task 3: Create template form component** (AC: #2, #3)
  - [x] Create `components/admin/templates/template-form.tsx`
  - [x] Add name input field
  - [x] Add type selector (analysis, feedback, classification)
  - [x] Create template body editor with syntax highlighting
  - [x] Display available variables panel based on selected type

- [x] **Task 4: Implement variable highlighting in editor** (AC: #3)
  - [x] Create `components/admin/templates/template-editor.tsx` with custom textarea overlay
  - [x] Define variable regex pattern: `\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}`
  - [x] Highlight valid variables in green (from variable definitions)
  - [x] Highlight unknown variables in yellow with tooltip warning
  - [x] Add autocomplete for variables

- [x] **Task 5: Create template variable definitions** (AC: #2)
  - [x] Define analysis variables: `{{prompt}}`, `{{prompt_length}}`, `{{word_count}}`, `{{context}}`
  - [x] Define feedback variables: `{{score}}`, `{{dimension_scores}}`, `{{suggestions}}`
  - [x] Define classification variables: `{{prompt}}`, `{{patterns}}`, `{{categories}}`
  - [x] Store in `prompt_template_variables` table with descriptions

- [x] **Task 6: Create template preview functionality** (AC: #4, #5)
  - [x] Create `lib/services/prompt-template-preview.ts`
  - [x] Create sample data generator for each template type
  - [x] Implement variable substitution engine
  - [x] Add "Preview" button that shows rendered template
  - [x] Add optional "Test with LLM" button (rate limited)

- [x] **Task 7: Implement template save/publish workflow** (AC: #4, #6)
  - [x] Create `lib/services/prompt-templates.ts` server actions
  - [x] Implement `createTemplate()` - saves as draft
  - [x] Implement `updateTemplate()` - only for drafts
  - [x] Implement `publishTemplate()` - changes status to active
  - [x] Add validation for required variables per type

- [x] **Task 8: Create template detail/edit page** (AC: #2, #4)
  - [x] Create `app/(dashboard)/admin/analysis/templates/[id]/page.tsx`
  - [x] Load existing template data
  - [x] Allow editing if template is draft
  - [x] Show read-only view for published templates
  - [x] Add "Publish" button for drafts

- [x] **Task 9: Add template duplication** (AC: #2)
  - [x] Add "Duplicate" action to template list
  - [x] Create copy with "Copy of [name]" naming
  - [x] New copy is always draft status
  - [x] Redirect to edit page for new copy

- [x] **Task 10: Write E2E tests** (AC: #1-6)
  - [x] Create `e2e/admin-prompt-templates.spec.ts`
  - [x] Test template list displays correctly
  - [x] Test template creation with valid variables
  - [x] Test variable highlighting (valid/unknown)
  - [x] Test preview with sample data
  - [x] Test publish workflow

## Dev Notes

### Database Schema

```sql
-- Migration: 20251224001000_prompt_templates.sql

-- Template types enum
CREATE TYPE prompt_template_type AS ENUM ('analysis', 'feedback', 'classification');

-- Template status enum
CREATE TYPE prompt_template_status AS ENUM ('draft', 'active', 'archived');

-- Prompt templates table
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type prompt_template_type NOT NULL,
  body TEXT NOT NULL,
  status prompt_template_status DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  CONSTRAINT unique_active_name_type UNIQUE NULLS NOT DISTINCT (name, type, status)
    WHERE (status = 'active')
);

-- Variable definitions table
CREATE TABLE prompt_template_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  type prompt_template_type NOT NULL,
  description TEXT NOT NULL,
  example_value TEXT,
  required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_variable_per_type UNIQUE (name, type)
);

-- Indexes
CREATE INDEX idx_templates_type_status ON prompt_templates(type, status);
CREATE INDEX idx_templates_created_by ON prompt_templates(created_by);

-- RLS Policies (super admin only via service role)
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_template_variables ENABLE ROW LEVEL SECURITY;

-- Insert default variables
INSERT INTO prompt_template_variables (name, type, description, example_value, required) VALUES
  -- Analysis variables
  ('prompt', 'analysis', 'The user prompt to analyze', 'Explain how React hooks work', true),
  ('prompt_length', 'analysis', 'Character count of the prompt', '156', true),
  ('word_count', 'analysis', 'Word count of the prompt', '28', true),
  ('context', 'analysis', 'Additional context if available', 'Previous conversation...', false),

  -- Feedback variables
  ('score', 'feedback', 'Overall score (1-10)', '7.5', true),
  ('dimension_scores', 'feedback', 'JSON object of dimension scores', '{"clarity": 8, "specificity": 6}', true),
  ('suggestions', 'feedback', 'Array of improvement suggestions', '["Be more specific", "Add context"]', true),
  ('strengths', 'feedback', 'Array of prompt strengths', '["Clear goal", "Good structure"]', false),

  -- Classification variables
  ('prompt', 'classification', 'The prompt to classify', 'Fix the bug in auth.ts', true),
  ('patterns', 'classification', 'Regex patterns to match against', '{"bug_fix": "fix|bug|error"}', true),
  ('categories', 'classification', 'Available category definitions', '["feature", "bug_fix", "refactor"]', true);
```

### TypeScript Interfaces

```typescript
// lib/types/prompt-templates.ts

export type PromptTemplateType = 'analysis' | 'feedback' | 'classification';
export type PromptTemplateStatus = 'draft' | 'active' | 'archived';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  type: PromptTemplateType;
  body: string;
  status: PromptTemplateStatus;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PromptTemplateVariable {
  id: string;
  name: string;
  type: PromptTemplateType;
  description: string;
  example_value: string | null;
  required: boolean;
}

export interface TemplatePreviewResult {
  rendered: string;
  variables_used: string[];
  missing_required: string[];
  unknown_variables: string[];
}
```

### Variable Substitution Engine

```typescript
// lib/utils/template-engine.ts

const VARIABLE_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

export function extractVariables(template: string): string[] {
  const matches = template.matchAll(VARIABLE_REGEX);
  return [...new Set([...matches].map(m => m[1]))];
}

export function renderTemplate(
  template: string,
  variables: Record<string, string>
): TemplatePreviewResult {
  const used: string[] = [];
  const missing: string[] = [];
  const unknown: string[] = [];

  const rendered = template.replace(VARIABLE_REGEX, (match, varName) => {
    used.push(varName);
    if (varName in variables) {
      return variables[varName];
    }
    missing.push(varName);
    return match; // Keep original if not found
  });

  return {
    rendered,
    variables_used: used,
    missing_required: missing,
    unknown_variables: unknown,
  };
}
```

### Editor Component Pattern

```typescript
// components/admin/template-editor.tsx
'use client';

import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { Decoration, DecorationSet, ViewPlugin } from '@codemirror/view';

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  validVariables: string[];
  disabled?: boolean;
}

export function TemplateEditor({ value, onChange, validVariables, disabled }: TemplateEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Highlight plugin for variables
  const variableHighlighter = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.createDecorations(view);
    }

    createDecorations(view: EditorView) {
      const decorations: Range<Decoration>[] = [];
      const text = view.state.doc.toString();
      const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

      let match;
      while ((match = regex.exec(text)) !== null) {
        const varName = match[1];
        const isValid = validVariables.includes(varName);
        const deco = Decoration.mark({
          class: isValid ? 'variable-valid' : 'variable-unknown',
        });
        decorations.push(deco.range(match.index, match.index + match[0].length));
      }

      return Decoration.set(decorations);
    }
  });

  // Setup CodeMirror editor
  useEffect(() => {
    if (!editorRef.current) return;

    const editor = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        variableHighlighter,
        EditorView.editable.of(!disabled),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
      parent: editorRef.current,
    });

    return () => editor.destroy();
  }, [validVariables]);

  return (
    <div ref={editorRef} className="border rounded-md min-h-[200px]" />
  );
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Templates List Page | `app/(dashboard)/admin/analysis/templates/page.tsx` |
| Template Detail Page | `app/(dashboard)/admin/analysis/templates/[id]/page.tsx` |
| New Template Page | `app/(dashboard)/admin/analysis/templates/new/page.tsx` |
| Template Form | `components/admin/templates/template-form.tsx` |
| Template Editor | `components/admin/templates/template-editor.tsx` |
| Variable Panel | `components/admin/templates/template-variable-panel.tsx` |
| Preview Modal | `components/admin/templates/template-preview-modal.tsx` |
| Services | `lib/services/prompt-templates.ts` |
| Types | `lib/types/prompt-templates.ts` |
| Template Engine | `lib/utils/template-engine.ts` |

### Security Considerations

1. **Input Sanitization**: Template body must be sanitized to prevent XSS when previewing
2. **Rate Limiting**: LLM test calls should be rate limited (5/minute per admin)
3. **Audit Trail**: All template changes logged via Story 22.10
4. **Access Control**: Super admin only, verified via `verifySuperAdmin()`

### Verification Checklist

After completing this story, verify:
- [x] Template list shows all templates with correct badges
- [x] Can create new template with all fields
- [x] Variable highlighting works (green for valid, yellow for unknown)
- [x] Variable autocomplete appears when typing `{{`
- [x] Preview shows rendered template correctly
- [x] Cannot edit published templates
- [x] Publish changes status from draft to active
- [x] Duplicate creates new draft copy
- [x] Audit log records all changes


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [x] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [x] Checked `/design` route for component examples
- [x] Identified required components from the inventory below
- [x] Confirmed no hardcoded colors - using semantic tokens only
- [x] No new UI patterns needed (or Design Epic story created)

### Required Components
- `Button` from `@/components/ui/button`
- `Card`, `CardHeader`, `CardContent`, `CardTitle` from `@/components/ui/card`
- `Badge` from `@/components/ui/badge`
- `Input` from `@/components/ui/input`
- `Label` from `@/components/ui/label`
- `Textarea` from `@/components/ui/textarea`
- `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` from `@/components/ui/select`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` from `@/components/ui/dialog`
- `AlertDialog` from `@/components/ui/alert-dialog`
- `DropdownMenu` from `@/components/ui/dropdown-menu`
- `Tooltip` from `@/components/ui/tooltip`
- `InlineAlert`, `EmptyState`, `showToast` from `@/components/feedback`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Database Migration**: Created `20251224001000_prompt_templates.sql` with proper enums, tables, indexes, RLS, audit triggers, and seed data for variables.

2. **Type System**: Created comprehensive TypeScript types in `lib/types/prompt-templates.ts` including `PromptTemplate`, `PromptTemplateVariable`, `TemplatePreviewResult`, and status/type configurations.

3. **Template Engine**: Implemented `lib/utils/template-engine.ts` with variable extraction, validation, rendering, and sample data generation for all three template types.

4. **Server Actions**: Created two service files:
   - `lib/services/prompt-templates.ts` - CRUD operations with verifySuperAdmin() protection
   - `lib/services/prompt-template-preview.ts` - Preview and test functionality

5. **UI Components**: Built modular component architecture in `components/admin/templates/`:
   - `template-list.tsx` - List view with actions dropdown
   - `template-filters.tsx` - Type and status filters with URL state
   - `template-form.tsx` - Main form with validation
   - `template-editor.tsx` - Custom editor with variable highlighting overlay
   - `template-variable-panel.tsx` - Variable reference panel with click-to-insert
   - `template-preview-modal.tsx` - Preview dialog with sample/custom data

6. **Pages**: Created three pages under `app/(dashboard)/admin/analysis/templates/`:
   - `page.tsx` - List page with filters
   - `new/page.tsx` - Create new template
   - `[id]/page.tsx` - View/edit existing template

7. **Navigation**: Updated `components/admin/admin-sidebar.tsx` to include Templates link

8. **E2E Tests**: Created comprehensive test suite in `e2e/admin-prompt-templates.spec.ts` covering:
   - List page display and filtering
   - Template creation workflow
   - Variable highlighting
   - Preview functionality
   - Publish workflow
   - Template duplication
   - Variable panel interactions
   - Access control

9. **Design System Compliance**: All components use semantic tokens (text-foreground, bg-background, border-border, etc.) and existing UI components from the design system.

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2025-12-24 | Initial implementation of Story 22-1 | Claude Opus 4.5 |

### File List

**Created Files:**
- `/app/supabase/migrations/20251224001000_prompt_templates.sql`
- `/app/lib/types/prompt-templates.ts`
- `/app/lib/utils/template-engine.ts`
- `/app/lib/services/prompt-templates.ts`
- `/app/lib/services/prompt-template-preview.ts`
- `/app/components/admin/templates/index.ts`
- `/app/components/admin/templates/template-list.tsx`
- `/app/components/admin/templates/template-filters.tsx`
- `/app/components/admin/templates/template-form.tsx`
- `/app/components/admin/templates/template-editor.tsx`
- `/app/components/admin/templates/template-variable-panel.tsx`
- `/app/components/admin/templates/template-preview-modal.tsx`
- `/app/app/(dashboard)/admin/analysis/templates/page.tsx`
- `/app/app/(dashboard)/admin/analysis/templates/new/page.tsx`
- `/app/app/(dashboard)/admin/analysis/templates/[id]/page.tsx`
- `/app/e2e/admin-prompt-templates.spec.ts`

**Modified Files:**
- `/app/components/admin/admin-sidebar.tsx` - Added Templates navigation link
