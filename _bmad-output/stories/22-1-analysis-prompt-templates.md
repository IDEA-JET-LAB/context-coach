# Story 22.1: Analysis Prompt Templates

Status: Ready

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

- [ ] **Task 1: Create database schema for prompt templates** (AC: #1, #6)
  - [ ] Create migration `20251223001000_prompt_templates.sql`
  - [ ] Create `prompt_templates` table with fields: id, name, type, body, variables, status, version, created_by, created_at, updated_at
  - [ ] Create `prompt_template_variables` table for variable definitions
  - [ ] Add RLS policies for super admin access only
  - [ ] Add audit trigger for all changes

- [ ] **Task 2: Create prompt templates list page** (AC: #1)
  - [ ] Create `app/(dashboard)/admin/analysis/templates/page.tsx`
  - [ ] Query all templates with service role client
  - [ ] Display templates in table with: name, type badge, status badge, last updated
  - [ ] Add filter by type (analysis/feedback/classification)
  - [ ] Add "Create Template" button

- [ ] **Task 3: Create template form component** (AC: #2, #3)
  - [ ] Create `components/admin/prompt-template-form.tsx`
  - [ ] Add name input field
  - [ ] Add type selector (analysis, feedback, classification)
  - [ ] Create template body editor with syntax highlighting
  - [ ] Display available variables panel based on selected type

- [ ] **Task 4: Implement variable highlighting in editor** (AC: #3)
  - [ ] Create `components/admin/template-editor.tsx` with CodeMirror or Monaco
  - [ ] Define variable regex pattern: `\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}`
  - [ ] Highlight valid variables in green (from variable definitions)
  - [ ] Highlight unknown variables in yellow with tooltip warning
  - [ ] Add autocomplete for variables

- [ ] **Task 5: Create template variable definitions** (AC: #2)
  - [ ] Define analysis variables: `{{prompt}}`, `{{prompt_length}}`, `{{word_count}}`, `{{context}}`
  - [ ] Define feedback variables: `{{score}}`, `{{dimension_scores}}`, `{{suggestions}}`
  - [ ] Define classification variables: `{{prompt}}`, `{{patterns}}`, `{{categories}}`
  - [ ] Store in `prompt_template_variables` table with descriptions

- [ ] **Task 6: Create template preview functionality** (AC: #4, #5)
  - [ ] Create `lib/services/prompt-template-preview.ts`
  - [ ] Create sample data generator for each template type
  - [ ] Implement variable substitution engine
  - [ ] Add "Preview" button that shows rendered template
  - [ ] Add optional "Test with LLM" button (rate limited)

- [ ] **Task 7: Implement template save/publish workflow** (AC: #4, #6)
  - [ ] Create `lib/services/prompt-templates.ts` server actions
  - [ ] Implement `createTemplate()` - saves as draft
  - [ ] Implement `updateTemplate()` - only for drafts
  - [ ] Implement `publishTemplate()` - changes status to active
  - [ ] Add validation for required variables per type

- [ ] **Task 8: Create template detail/edit page** (AC: #2, #4)
  - [ ] Create `app/(dashboard)/admin/analysis/templates/[id]/page.tsx`
  - [ ] Load existing template data
  - [ ] Allow editing if template is draft
  - [ ] Show read-only view for published templates
  - [ ] Add "Publish" button for drafts

- [ ] **Task 9: Add template duplication** (AC: #2)
  - [ ] Add "Duplicate" action to template list
  - [ ] Create copy with "Copy of [name]" naming
  - [ ] New copy is always draft status
  - [ ] Redirect to edit page for new copy

- [ ] **Task 10: Write E2E tests** (AC: #1-6)
  - [ ] Create `e2e/admin-prompt-templates.spec.ts`
  - [ ] Test template list displays correctly
  - [ ] Test template creation with valid variables
  - [ ] Test variable highlighting (valid/unknown)
  - [ ] Test preview with sample data
  - [ ] Test publish workflow

## Dev Notes

### Database Schema

```sql
-- Migration: 20251223001000_prompt_templates.sql

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
| Template Form | `components/admin/prompt-template-form.tsx` |
| Template Editor | `components/admin/template-editor.tsx` |
| Variable Panel | `components/admin/template-variable-panel.tsx` |
| Preview Modal | `components/admin/template-preview-modal.tsx` |
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
- [ ] Template list shows all templates with correct badges
- [ ] Can create new template with all fields
- [ ] Variable highlighting works (green for valid, yellow for unknown)
- [ ] Variable autocomplete appears when typing `{{`
- [ ] Preview shows rendered template correctly
- [ ] Cannot edit published templates
- [ ] Publish changes status from draft to active
- [ ] Duplicate creates new draft copy
- [ ] Audit log records all changes


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
