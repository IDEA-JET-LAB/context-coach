# Design System Mandate for Phase 2+ Development

**Status:** MANDATORY for all Epic 17+ stories
**Created:** 2025-12-23
**Authority:** Product Owner directive

---

## Executive Summary

All Phase 2+ development (Epic 17 and beyond) **MUST** use the established design system components exclusively. No new UI patterns, custom styling, or ad-hoc components shall be created without explicit approval.

---

## The Mandate

### Rule 1: Use Existing Components

**Before creating any UI element, developers MUST check:**

1. `/design` route for available components
2. `components/` directory for existing implementations
3. This document's component inventory

### Rule 2: No Hardcoded Colors

**All colors MUST use semantic tokens from `tailwind.config.ts`:**

```typescript
// CORRECT
className="bg-surface-primary text-content-primary border-border-default"

// WRONG - DO NOT DO THIS
className="bg-zinc-900 text-white border-zinc-700"
```

### Rule 3: Component Composition Over Creation

**If a component doesn't exist exactly as needed:**

1. First: Compose existing components
2. Second: Extend existing component with props
3. Last resort: Request new component via Design Epic story

---

## Component Inventory

### Charts (`components/charts/`)

| Component | Use Case | Import |
|-----------|----------|--------|
| `LineChart` | Trend visualization, time series | `@/components/charts` |
| `BarChart` | Distribution, comparison | `@/components/charts` |
| `Gauge` | Score display (0-10) | `@/components/charts` |
| `Sparkline` | Inline mini trends | `@/components/charts` |
| `Heatmap` | Time-based activity grids | `@/components/charts` |

### Analytics (`components/analytics/`)

| Component | Use Case | Import |
|-----------|----------|--------|
| `MetricCard` | KPI display with trends | `@/components/analytics` |
| `TrendIndicator` | Up/down arrows, percentages | `@/components/analytics` |
| `ComparisonBar` | User vs team comparison | `@/components/analytics` |
| `InsightCard` | AI-generated insights | `@/components/analytics` |
| `SessionTimeline` | Session event visualization | `@/components/analytics` |
| `DimensionRadar` | 5-dimension spider chart | `@/components/analytics` |
| `ContextGauge` | Context window usage | `@/components/analytics` |
| `WorkStyleBadge` | Work style categorization | `@/components/analytics` |
| `SentimentTimeline` | Sentiment over time | `@/components/analytics` |
| `ComplexityCard` | Prompt complexity metrics | `@/components/analytics` |
| `TimingHeatmap` | Interaction timing | `@/components/analytics` |
| `ToolUsageChart` | Tool usage profiling | `@/components/analytics` |
| `SessionHealth` | Session health score | `@/components/analytics` |
| `DepthRadar` | Technical depth profile | `@/components/analytics` |
| `LearningProgress` | Learning progression | `@/components/analytics` |
| `EfficiencyCard` | Workflow efficiency | `@/components/analytics` |
| `EnhancedInsightCard` | Interactive insights | `@/components/analytics` |
| `TeamIntelligence` | Team analytics | `@/components/analytics` |
| `AnalyticsFilters` | Filter controls | `@/components/analytics` |

### Forms (`components/forms/`)

| Component | Use Case | Import |
|-----------|----------|--------|
| `MultiStepForm` | Wizard patterns | `@/components/forms` |
| `WeightSlider` | Labeled percentage sliders | `@/components/forms` |
| `TagInput` | Multi-value text input | `@/components/forms` |
| `JsonEditor` | Syntax highlighted JSON | `@/components/forms` |
| `RuleEditor` | Condition/rule builder | `@/components/forms` |
| `CodeBlock` | Styled code display | `@/components/forms` |

### Import (`components/import/`)

| Component | Use Case | Import |
|-----------|----------|--------|
| `SessionPreviewCard` | Import preview cards | `@/components/import` |
| `ImportProgressBar` | Multi-phase progress | `@/components/import` |
| `FileTree` | Transcript file browser | `@/components/import` |
| `TranscriptBrowser` | Full transcript browser | `@/components/import` |
| `ImportPreview` | Import preview modal | `@/components/import` |
| `ImportProgress` | Import progress display | `@/components/import` |
| `ImportHistory` | Import history list | `@/components/import` |
| `ImportModal` | Import flow modal | `@/components/import` |

### Recovery (`components/recovery/`)

| Component | Use Case | Import |
|-----------|----------|--------|
| `RecoveryBanner` | Session recovery prompt | `@/components/recovery` |
| `SessionSnapshot` | Where you left off | `@/components/recovery` |
| `RecoveryNotification` | Recovery notification | `@/components/recovery` |
| `RecoveryDetail` | Recovery detail view | `@/components/recovery` |

### Feedback (`components/feedback/`)

| Component | Use Case | Import |
|-----------|----------|--------|
| `InlineAlert` | Contextual messages | `@/components/feedback` |
| `ConfirmationModal` | Destructive actions | `@/components/feedback` |
| `EmptyState` | Empty state variants | `@/components/feedback` |
| `showToast` | Toast notifications | `@/components/feedback` |

### Admin (`components/admin/`)

| Component | Use Case | Import |
|-----------|----------|--------|
| `PromptTemplateEditor` | Analysis prompt editing | `@/components/admin` |
| `RuleEditor` | Classification rules | `@/components/admin` |
| `WeightConfiguration` | Scoring weights | `@/components/admin` |
| `TeamOverrides` | Team-level overrides | `@/components/admin` |
| `VersionHistory` | Config version control | `@/components/admin` |
| `ExperimentCreator` | A/B experiment setup | `@/components/admin` |
| `TrafficSplit` | Traffic allocation | `@/components/admin` |
| `ExperimentResults` | Experiment dashboard | `@/components/admin` |
| `AuditTrail` | Configuration audit log | `@/components/admin` |
| `CodeEditor` | Syntax-highlighted editor | `@/components/admin` |
| `ContextualHelp` | Inline help tooltips | `@/components/admin` |

---

## Semantic Token Reference

### Background Colors

```
bg-surface-primary     → Main backgrounds
bg-surface-secondary   → Cards, elevated surfaces
bg-surface-tertiary    → Nested elements
bg-surface-accent      → Highlighted areas
bg-surface-inverse     → Inverted sections
```

### Text Colors

```
text-content-primary   → Main text
text-content-secondary → Subdued text
text-content-tertiary  → Hints, placeholders
text-content-accent    → Links, emphasis
text-content-inverse   → On dark backgrounds
```

### Border Colors

```
border-border-default  → Standard borders
border-border-subtle   → Light borders
border-border-strong   → Emphasized borders
border-border-accent   → Accent borders
```

### Status Colors

```
text-status-success / bg-status-success-subtle
text-status-warning / bg-status-warning-subtle
text-status-error / bg-status-error-subtle
text-status-info / bg-status-info-subtle
```

---

## Story Template Addition

All stories for Epic 17+ MUST include this section:

```markdown
## Design System Requirements

**Mandatory:** This story MUST use existing design system components.

### Required Components
<!-- List specific components from DESIGN-SYSTEM-MANDATE.md -->

### Styling Rules
- Use semantic tokens only (no hardcoded colors)
- Reference `/design` route for component examples
- Extend existing components before creating new ones

### Pre-Implementation Checklist
- [ ] Reviewed `/design` route for available components
- [ ] Identified all required components from inventory
- [ ] Confirmed no hardcoded colors in designs
- [ ] Requested new components if needed (separate Design story)
```

---

## Enforcement

### During Story Creation (PM)

- PM must reference this document when creating stories
- Stories must list specific components to use
- No story may introduce new UI patterns without Design Epic story

### During Implementation (Dev)

- Dev agent must check component inventory before coding
- Code review must reject hardcoded colors
- New components require Product Owner approval

### During Code Review

- Reject any `bg-zinc-*`, `text-gray-*`, or similar hardcoded colors
- Verify imports from established component paths
- Check for component duplication

---

## References

- **Design Route:** `/design` (http://127.0.0.1:3050/design)
- **Component Source:** `app/components/`
- **Tokens Config:** `app/tailwind.config.ts`
- **Epic D Stories:** `_bmad-output/stories/D-*.md`
