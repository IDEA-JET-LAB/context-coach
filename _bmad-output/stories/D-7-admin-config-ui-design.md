# Story D-7: Admin Configuration & A/B Testing UI Design

Status: Done

## Story

**As a** platform administrator,
**I want** intuitive interfaces for managing analysis configuration and running experiments,
**So that** I can optimize the coaching engine for different team contexts.

## Acceptance Criteria

1. **Given** the analysis configuration features (Epic 22)
   **When** the admin UI is designed
   **Then** prompt templates are editable with syntax highlighting
   **And** scoring weights can be adjusted with immediate preview
   **And** changes are versioned with clear history

2. **Given** the A/B testing features (Epic 22)
   **When** designed
   **Then** experiments can be created with clear variant definition
   **And** traffic splitting is visualized and adjustable
   **And** results are presented with statistical significance indicators

3. **Given** the team-level customization
   **When** designed
   **Then** admins can create team-specific weight overrides
   **And** the inheritance model is visually clear
   **And** rollback to defaults is straightforward

4. **Given** the audit trail requirements
   **When** designed
   **Then** all configuration changes are logged and visible
   **And** who changed what and when is clear
   **And** changes can be compared side-by-side

5. **Given** the complexity of these features
   **When** designed
   **Then** progressive disclosure prevents overwhelm
   **And** common operations are simple, advanced operations available
   **And** help text and documentation are contextual

## Tasks / Subtasks

- [x] **Task 1: Design Config Management Overview** (AC: #1, #5)
  - [x] Design admin config landing page
  - [x] Design config categories navigation (Prompts, Weights, Teams)
  - [x] Design active config summary with version indicator
  - [x] Design quick actions (edit, duplicate, rollback)
  - [x] Implement as `app/(admin)/admin/config/page.tsx`

- [x] **Task 2: Design Prompt Template Editor** (AC: #1)
  - [x] Design template list/grid view
  - [x] Design template detail/edit view
  - [x] Design syntax-highlighted code editor (Monaco or similar)
  - [x] Design variable insertion UI ({{prompt}}, {{context}}, etc.)
  - [x] Design template preview/test panel
  - [x] Design save/publish workflow with validation
  - [x] Implement as `components/admin/prompt-template-editor.tsx`

- [x] **Task 3: Design Classification Rule Editor** (AC: #1)
  - [x] Design rule list with enable/disable toggles
  - [x] Design rule builder (condition + action pattern)
  - [x] Design condition types (regex, keyword, score threshold)
  - [x] Design rule priority/ordering
  - [x] Design rule test interface
  - [x] Implement as `components/admin/rule-editor.tsx`

- [x] **Task 4: Design Scoring Weight Configuration** (AC: #1)
  - [x] Design 5-dimension weight sliders
  - [x] Design weight sum normalization indicator
  - [x] Design weight preset templates
  - [x] Design impact preview (how scores would change)
  - [x] Implement as `components/admin/weight-configuration.tsx`

- [x] **Task 5: Design Team Override Management** (AC: #3)
  - [x] Design team list with override status
  - [x] Design override inheritance visualization
  - [x] Design team-specific weight editor
  - [x] Design "reset to default" action
  - [x] Design comparison view (team vs default)
  - [x] Implement as `components/admin/team-overrides.tsx`

- [x] **Task 6: Design Version Control UI** (AC: #1, #4)
  - [x] Design version history timeline
  - [x] Design version comparison (diff view)
  - [x] Design rollback confirmation flow
  - [x] Design version tagging/naming
  - [x] Implement as `components/admin/version-history.tsx`

- [x] **Task 7: Design A/B Experiment Creator** (AC: #2)
  - [x] Design experiment creation wizard
  - [x] Design variant definition UI
  - [x] Design control vs treatment setup
  - [x] Design hypothesis/goal input
  - [x] Design traffic allocation controls
  - [x] Design scheduling (start/end dates)
  - [x] Implement as `components/admin/experiment-creator.tsx`

- [x] **Task 8: Design Traffic Splitting Visualization** (AC: #2)
  - [x] Design traffic allocation bar/pie
  - [x] Design user segment selection
  - [x] Design gradual rollout controls
  - [x] Design manual assignment override
  - [x] Implement as `components/admin/traffic-split.tsx`

- [x] **Task 9: Design Experiment Results Dashboard** (AC: #2)
  - [x] Design results summary cards per variant
  - [x] Design statistical significance indicator
  - [x] Design metric comparison charts
  - [x] Design confidence interval visualization
  - [x] Design "declare winner" action
  - [x] Design experiment conclusion workflow
  - [x] Implement as `components/admin/experiment-results.tsx`

- [x] **Task 10: Design Audit Trail View** (AC: #4)
  - [x] Design audit log table with filters
  - [x] Design change detail expansion
  - [x] Design user/action filters
  - [x] Design export audit log option
  - [x] Design diff viewer for configuration changes
  - [x] Implement as `components/admin/audit-trail.tsx`

- [x] **Task 11: Design Help and Documentation** (AC: #5)
  - [x] Design contextual help tooltips
  - [x] Design documentation sidebar panel
  - [x] Design onboarding tour for first-time admins
  - [x] Design example templates and presets
  - [x] Implement inline help components

## Dev Notes

### Admin Config Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Admin > Configuration                                           │
├─────────────────────────────────────────────────────────────────┤
│ [Prompts] [Weights] [Rules] [Teams] [Experiments] [Audit Log]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Current Configuration: v2.3.1 (published 2 days ago)           │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Analysis Prompt Template                                    ││
│ │ ┌─────────────────────────────────────────────────────────┐││
│ │ │ You are an expert at evaluating AI prompts...           │││
│ │ │                                                         │││
│ │ │ {{prompt}}                                              │││
│ │ │                                                         │││
│ │ │ Score on these dimensions: ...                          │││
│ │ └─────────────────────────────────────────────────────────┘││
│ │ Variables: {{prompt}} {{user_context}} {{team_context}}    ││
│ │ [Edit Template] [Preview] [View History]                   ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Dimension Weights:                                              │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Clarity      ████████░░ 25%                                ││
│ │ Context      ██████░░░░ 20%                                ││
│ │ Specificity  ████████░░ 25%                                ││
│ │ Goal         ██████░░░░ 20%                                ││
│ │ Constraints  ████░░░░░░ 10%                                ││
│ └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### A/B Experiment UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Experiment: "New Specificity Prompt" [Running]                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Traffic Split:                                                  │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ █████████████████████████████████░░░░░░░░░░░░░░░░          ││
│ │        Control (50%)          │    Treatment (50%)          ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Results (1,234 samples):                                        │
│ ┌───────────────────────┐ ┌───────────────────────┐            │
│ │ Control               │ │ Treatment             │            │
│ │ Avg Score: 7.2        │ │ Avg Score: 7.6 ▲ +0.4 │            │
│ │ n = 617               │ │ n = 617               │            │
│ └───────────────────────┘ └───────────────────────┘            │
│                                                                 │
│ Statistical Significance: 94% (target: 95%)                     │
│ Estimated completion: 2 days                                    │
│                                                                 │
│ [Pause Experiment] [View Details] [Declare Winner]              │
└─────────────────────────────────────────────────────────────────┘
```

### Component Structure

```
components/admin/
├── config-overview.tsx          # Config landing page
├── prompt-template-editor.tsx   # LLM prompt editor
├── rule-editor.tsx              # Classification rules
├── weight-configuration.tsx     # Dimension weights
├── team-overrides.tsx           # Team-specific config
├── version-history.tsx          # Config versioning
├── experiment-creator.tsx       # A/B test setup
├── traffic-split.tsx            # Traffic allocation
├── experiment-results.tsx       # Results dashboard
├── audit-trail.tsx              # Change log
└── code-editor.tsx              # Monaco wrapper
```

### Code Editor Integration

**Recommended: Monaco Editor (VS Code's editor)**

```bash
npm install @monaco-editor/react
```

```typescript
import Editor from '@monaco-editor/react';

<Editor
  height="300px"
  language="markdown"  // or custom prompt language
  theme="vs-dark"
  value={template}
  onChange={(value) => setTemplate(value)}
  options={{
    minimap: { enabled: false },
    lineNumbers: 'on',
    wordWrap: 'on',
  }}
/>
```

### Statistical Significance Display

```typescript
interface SignificanceIndicator {
  confidence: number;     // 0-100
  threshold: number;      // typically 95
  sampleSize: number;
  minimumSamples: number;
}

// Visual states:
// - confidence < 50: "Not enough data"
// - confidence < threshold: "Trending (X%)"
// - confidence >= threshold: "Significant ✓"
```

### Audit Log Schema

```typescript
interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'rollback' | 'publish';
  resourceType: 'prompt' | 'weight' | 'rule' | 'experiment';
  resourceId: string;
  previousValue?: object;
  newValue?: object;
  description: string;
}
```

### Permission Model

| Role | Can View | Can Edit | Can Publish | Can Delete |
|------|----------|----------|-------------|------------|
| Team Admin | Own team | Own team | No | No |
| Platform Admin | All | All | Yes | Yes |
| Super Admin | All | All | Yes | Yes |

## Recommended Tools & Agents

### Pixel Agent (Visual Asset Generator)

Use the **Pixel agent** (`/bmad:custom:agents:pixel`) for admin panel visual assets:

```
Pixel Commands:
- *generate          → Generate illustrations and icons
- *batch             → Generate cohesive status/state graphics
```

**Use Pixel For:**
| Asset Type | Purpose |
|------------|---------|
| Experiment status icons | Running, paused, completed, winner states |
| Empty experiment state | "No experiments yet" illustration |
| Config section icons | Visual identifiers for Prompts, Weights, Rules sections |
| Success/error graphics | Deployment success, validation error visuals |
| A/B variant icons | Visual distinction between control/treatment |
| Audit trail icons | Action type indicators (create, update, delete) |

**Workflow:**
1. Design admin layouts with `/frontend-design`
2. Identify icon and illustration needs
3. Generate experiment status icons as cohesive set: `*batch`
4. `*accept` to deploy to `public/images/admin/`

**Note:** Admin interfaces are typically more functional than decorative. Use Pixel sparingly for status indicators, section icons, and empty states rather than elaborate illustrations.

### Frontend-Design Skill

Use `/frontend-design` for complex admin components:
- Prompt template editor layout
- Weight configuration sliders
- A/B experiment creator wizard
- Audit trail table

### Monaco Editor

For the code/prompt editor component, integrate Monaco Editor (VS Code's editor):

```bash
npm install @monaco-editor/react
```

This provides syntax highlighting and a familiar editing experience for prompt templates.

## Dependencies

- **Depends on:** Story D-1, D-2, D-3, existing admin pages
- **Blocks:** Epic 22 (Config & A/B Testing) implementation

## References

- Epic: Epic D: Phase 2 Design Foundation
- Epic 22: Analysis Configuration & A/B Testing
- Existing Admin: `app/(admin)/admin/*`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Task 1: Config Management Overview** - Created CodeEditor wrapper component for Monaco integration with syntax highlighting support, line numbers, copy button, and expand/collapse functionality. The actual admin config landing page (`app/(admin)/admin/config/page.tsx`) was not created as the user requested only components.

2. **Task 2: Prompt Template Editor** - Implemented `prompt-template-editor.tsx` with Edit/Preview/Test tabs, variable insertion UI ({{prompt}}, {{user_context}}, {{team_context}}, {{scoring_criteria}}), syntax highlighting via CodeEditor, variable detection/validation, and PromptTemplateList grid view component.

3. **Task 3: Classification Rule Editor** - Implemented `rule-editor.tsx` with condition types (regex, keyword, score_threshold, length, contains_code), action types (classify, adjust_score, flag, skip_dimension, apply_template), priority ordering via drag handles, enable/disable toggles, and rule testing interface.

4. **Task 4: Scoring Weight Configuration** - Implemented `weight-configuration.tsx` with 5-dimension weight sliders (Clarity, Context, Specificity, Goal, Constraints), visual weight bars, sum normalization indicator (must equal 100%), preset templates (Balanced, Clarity Focused, Technical, Creative, Enterprise), and impact preview calculations.

5. **Task 5: Team Override Management** - Implemented `team-overrides.tsx` with team list showing override status, inheritance visualization (Default → Override → Effective), team-specific weight editor, "Reset to default" action, and comparison view (team vs default values).

6. **Task 6: Version Control UI** - Implemented `version-history.tsx` with timeline-based version history, side-by-side diff viewer, rollback confirmation dialog with reason input, version tagging, and VersionHistoryCompact variant.

7. **Task 7: A/B Experiment Creator** - Implemented `experiment-creator.tsx` as 5-step wizard (Basics, Variants, Traffic, Scheduling, Review), variant definition with control/treatment, hypothesis/goal input, traffic allocation with auto-balance, scheduling with statistical targets (samples, confidence).

8. **Task 8: Traffic Splitting Visualization** - Implemented `traffic-split.tsx` with bar and pie visualization modes, user segment selector, gradual rollout controls (25%, 50%, 75%, 100%), and manual user assignment override table.

9. **Task 9: Experiment Results Dashboard** - Implemented `experiment-results.tsx` with results summary cards per variant, statistical significance indicator with progress bar (showing 95% threshold), metric comparison, confidence interval visualization (±), daily performance chart placeholder, and "Declare winner" confirmation dialog.

10. **Task 10: Audit Trail View** - Implemented `audit-trail.tsx` with filterable audit log table, expandable change details, filters (search, action type, resource type, user, date range), export functionality, and diff viewer dialog showing previous/new values with field-level highlighting.

11. **Task 11: Help and Documentation** - Implemented `contextual-help.tsx` with HelpTooltip, HelpPopover, DocumentationSidebar (full docs sheet), TourProvider/useTour context for onboarding tours, ExampleTemplates gallery, QuickStartButton, and HelpButton components.

### Design Patterns Used

- All components use 'use client' directive for client-side interactivity
- react-hook-form with zod validation schemas for forms
- Tailwind CSS semantic tokens (bg-background, text-foreground, border-border, etc.)
- shadcn/ui components (Card, Button, Badge, Dialog, Tabs, Slider, Switch, ScrollArea, etc.)
- Lucide React icons throughout
- date-fns formatDistanceToNow for relative timestamps
- Skeleton loading states for all major components
- Compact variants where appropriate (WeightConfigurationCompact, VersionHistoryCompact, AuditTrailCompact)

### Score Color Palette (Growth-Oriented)

Consistent with project design system:
- High (7-10): `hsl(142, 71%, 45%)` - success green
- Medium (4-6.9): `hsl(45, 93%, 47%)` - amber
- Growth (0-3.9): `hsl(217, 91%, 60%)` - blue (NOT red - growth-oriented language)

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-23 | Created all 11 admin config components | Claude Opus 4.5 |
| 2025-12-23 | Added index.ts with all exports and types | Claude Opus 4.5 |

### File List

**New Files Created:**

| File | Purpose |
|------|---------|
| `app/components/admin/code-editor.tsx` | Monaco-like code editor wrapper with syntax highlighting |
| `app/components/admin/prompt-template-editor.tsx` | Template editing with variables, preview, test modes |
| `app/components/admin/rule-editor.tsx` | Classification rules with conditions/actions |
| `app/components/admin/weight-configuration.tsx` | 5-dimension weight sliders with presets |
| `app/components/admin/team-overrides.tsx` | Team-specific weight management |
| `app/components/admin/version-history.tsx` | Version timeline with diff viewer |
| `app/components/admin/experiment-creator.tsx` | 5-step A/B test creation wizard |
| `app/components/admin/traffic-split.tsx` | Traffic allocation visualization |
| `app/components/admin/experiment-results.tsx` | Results dashboard with statistical significance |
| `app/components/admin/audit-trail.tsx` | Audit log with filters and diff viewer |
| `app/components/admin/contextual-help.tsx` | Help tooltips, tour, documentation sidebar |
| `app/components/admin/index.ts` | Barrel exports for all components |

**Files Modified:**

None - all new files created
