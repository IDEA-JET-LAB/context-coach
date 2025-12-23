# Story D-7: Admin Configuration & A/B Testing UI Design

Status: Ready

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

- [ ] **Task 1: Design Config Management Overview** (AC: #1, #5)
  - [ ] Design admin config landing page
  - [ ] Design config categories navigation (Prompts, Weights, Teams)
  - [ ] Design active config summary with version indicator
  - [ ] Design quick actions (edit, duplicate, rollback)
  - [ ] Implement as `app/(admin)/admin/config/page.tsx`

- [ ] **Task 2: Design Prompt Template Editor** (AC: #1)
  - [ ] Design template list/grid view
  - [ ] Design template detail/edit view
  - [ ] Design syntax-highlighted code editor (Monaco or similar)
  - [ ] Design variable insertion UI ({{prompt}}, {{context}}, etc.)
  - [ ] Design template preview/test panel
  - [ ] Design save/publish workflow with validation
  - [ ] Implement as `components/admin/prompt-template-editor.tsx`

- [ ] **Task 3: Design Classification Rule Editor** (AC: #1)
  - [ ] Design rule list with enable/disable toggles
  - [ ] Design rule builder (condition + action pattern)
  - [ ] Design condition types (regex, keyword, score threshold)
  - [ ] Design rule priority/ordering
  - [ ] Design rule test interface
  - [ ] Implement as `components/admin/rule-editor.tsx`

- [ ] **Task 4: Design Scoring Weight Configuration** (AC: #1)
  - [ ] Design 5-dimension weight sliders
  - [ ] Design weight sum normalization indicator
  - [ ] Design weight preset templates
  - [ ] Design impact preview (how scores would change)
  - [ ] Implement as `components/admin/weight-configuration.tsx`

- [ ] **Task 5: Design Team Override Management** (AC: #3)
  - [ ] Design team list with override status
  - [ ] Design override inheritance visualization
  - [ ] Design team-specific weight editor
  - [ ] Design "reset to default" action
  - [ ] Design comparison view (team vs default)
  - [ ] Implement as `components/admin/team-overrides.tsx`

- [ ] **Task 6: Design Version Control UI** (AC: #1, #4)
  - [ ] Design version history timeline
  - [ ] Design version comparison (diff view)
  - [ ] Design rollback confirmation flow
  - [ ] Design version tagging/naming
  - [ ] Implement as `components/admin/version-history.tsx`

- [ ] **Task 7: Design A/B Experiment Creator** (AC: #2)
  - [ ] Design experiment creation wizard
  - [ ] Design variant definition UI
  - [ ] Design control vs treatment setup
  - [ ] Design hypothesis/goal input
  - [ ] Design traffic allocation controls
  - [ ] Design scheduling (start/end dates)
  - [ ] Implement as `components/admin/experiment-creator.tsx`

- [ ] **Task 8: Design Traffic Splitting Visualization** (AC: #2)
  - [ ] Design traffic allocation bar/pie
  - [ ] Design user segment selection
  - [ ] Design gradual rollout controls
  - [ ] Design manual assignment override
  - [ ] Implement as `components/admin/traffic-split.tsx`

- [ ] **Task 9: Design Experiment Results Dashboard** (AC: #2)
  - [ ] Design results summary cards per variant
  - [ ] Design statistical significance indicator
  - [ ] Design metric comparison charts
  - [ ] Design confidence interval visualization
  - [ ] Design "declare winner" action
  - [ ] Design experiment conclusion workflow
  - [ ] Implement as `components/admin/experiment-results.tsx`

- [ ] **Task 10: Design Audit Trail View** (AC: #4)
  - [ ] Design audit log table with filters
  - [ ] Design change detail expansion
  - [ ] Design user/action filters
  - [ ] Design export audit log option
  - [ ] Design diff viewer for configuration changes
  - [ ] Implement as `components/admin/audit-trail.tsx`

- [ ] **Task 11: Design Help and Documentation** (AC: #5)
  - [ ] Design contextual help tooltips
  - [ ] Design documentation sidebar panel
  - [ ] Design onboarding tour for first-time admins
  - [ ] Design example templates and presets
  - [ ] Implement inline help components

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

{{agent_model_name_version}}

### Completion Notes List

*To be filled by design agent after completion*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by design agent - list all files created/modified*
