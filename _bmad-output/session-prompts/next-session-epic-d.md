# Next Session Prompt: Epic D Design Stories (D-4 to D-8)

Copy and paste this prompt to start your next session:

---

## Session Goal

Continue implementing Epic D (Phase 2 Design Foundation) stories D-4 through D-8.

## Context

**Completed:**
- D-1: Design System Audit ✅
- D-2: Existing UI Refactoring (240+ hardcoded colors → semantic tokens) ✅
- D-3: Component Library Expansion (30+ components at `/design`) ✅

**Ready for Implementation:**
- D-4: VS Code Extension Design
- D-5: Import/Recovery UI Design
- D-6: Advanced Analytics Design
- D-7: Admin Config UI Design
- D-8: Apply Component Library to Existing UI

## Story Files

All story files are at: `_bmad-output/stories/D-*.md`

Read the story files before starting implementation:
```
_bmad-output/stories/D-4-vscode-extension-design.md
_bmad-output/stories/D-5-import-recovery-ui-design.md
_bmad-output/stories/D-6-advanced-analytics-design.md
_bmad-output/stories/D-7-admin-config-ui-design.md
_bmad-output/stories/D-8-apply-component-library.md
```

## Implementation Strategy

### Recommended Order

**Option A - Design First (if creating mockups/wireframes):**
1. D-4, D-5, D-6, D-7 (design stories)
2. D-8 (apply components)

**Option B - Implementation First (practical approach):**
1. **D-8 first** - Apply existing components to current UI (immediate visual improvement)
2. Then D-5, D-6, D-7 as needed for Phase 2 features
3. D-4 when VS Code extension work begins

### Parallel Execution with Subagents

**USE SUBAGENTS** to parallelize work. Launch multiple agents with `model: "opus"` for complex tasks.

**Example parallel tasks for D-8:**
```
Launch in parallel:
- Agent 1: Refactor /analytics page (Task 1)
- Agent 2: Refactor /prompts/[id] page (Task 2)
- Agent 3: Standardize empty states across app (Task 4)
```

**Subagent prompt template:**
```
Implement D-8 Task X: [Task Name]

Story file: _bmad-output/stories/D-8-apply-component-library.md

Your task: [Specific task description]

Components to use (import from):
- @/components/charts: LineChart, BarChart, Gauge, Sparkline
- @/components/analytics: MetricCard, TrendIndicator, ComparisonBar, InsightCard
- @/components/feedback: showToast, InlineAlert, ConfirmationModal, EmptyState

Requirements:
1. Read the existing page implementation first
2. Replace ad-hoc components with library components
3. Maintain all existing functionality
4. Test that the page still works correctly
5. Update the story file when done

Do NOT create new files unless absolutely necessary. Edit existing files.
```

## Component Library Reference

View components at: http://127.0.0.1:3050/design

**Available Components:**

| Category | Components | Import Path |
|----------|-----------|-------------|
| Charts | LineChart, BarChart, Gauge, Sparkline, Heatmap | `@/components/charts` |
| Analytics | MetricCard, TrendIndicator, ComparisonBar, InsightCard, SessionTimeline, DimensionRadar | `@/components/analytics` |
| Forms | MultiStepForm, WeightSlider, TagInput, JsonEditor, RuleEditor, CodeBlock | `@/components/forms` |
| Import | SessionPreviewCard, ImportProgressBar, FileTree | `@/components/import` |
| Recovery | RecoveryBanner, SessionSnapshot | `@/components/recovery` |
| Feedback | InlineAlert, ConfirmationModal, EmptyState, showToast | `@/components/feedback` |
| Navigation | Tabs, TabsList, TabsTrigger, TabsContent | `@/components/ui/tabs` |

## Key Commands

```bash
# Start dev server
cd app && npm run dev -- -p 3050

# Run build to check for errors
cd app && npm run build

# Run tests
cd app && npm test

# View component library
open http://127.0.0.1:3050/design
```

## Sprint Status

Update `_bmad-output/stories/sprint-status.yaml` as you complete tasks.

## Instructions

1. Read this context and the relevant story files
2. Start with D-8 (most impactful, uses existing components)
3. Use subagents (model: "opus") for parallel work on independent tasks
4. Update story status and sprint-status.yaml as you progress
5. Commit after each major task completion
6. Test each page after refactoring

Begin by reading the D-8 story file and planning your approach.

---

**End of prompt**
