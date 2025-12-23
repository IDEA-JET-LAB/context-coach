# Session Prompt: Continue Epic D (Phase 2 Design Foundation)

## Context

You are continuing implementation of Epic D (Phase 2 Design Foundation) for the Contextor project.

## Completed Stories

| Story | Status | Description |
|-------|--------|-------------|
| D-1 | ✅ Complete | Semantic Color Tokens |
| D-2 | ✅ Complete | Spacing & Layout System |
| D-3 | ✅ Complete | Component Library Expansion (30+ components) |
| D-8 | ✅ Complete | Apply Component Library to Existing UI |

## Remaining Stories

| Story | Status | Description |
|-------|--------|-------------|
| D-4 | Ready | VS Code Extension UI Design |
| D-5 | Ready | Import & Recovery UI Design |
| D-6 | Ready | Advanced Analytics Dashboard Design |
| D-7 | Ready | Admin Configuration & A/B Testing UI Design |

## Story Files Location

All story files are in: `_bmad-output/stories/`
- `D-4-vscode-extension-design.md`
- `D-5-import-recovery-ui-design.md`
- `D-6-advanced-analytics-design.md`
- `D-7-admin-config-ui-design.md`

## Key Technical Context

### Component Library Structure
```
app/components/
├── analytics/     # MetricCard, TrendIndicator, ComparisonBar, InsightCard, DimensionRadar
├── charts/        # LineChart, BarChart, Gauge, Sparkline, Heatmap
├── feedback/      # showToast, InlineAlert, ConfirmationModal, EmptyState variants
├── forms/         # CodeBlock, and other form components
└── ui/            # Base shadcn/ui components
```

### Design Tokens Location
- `app/tailwind.config.ts` - All design tokens (colors, spacing, etc.)
- Semantic color tokens already implemented in D-1

### Dev Server
- Port: 3050
- URL: http://127.0.0.1:3050

## Recommended Approach

1. **Read the story files** for D-4 through D-7 to understand requirements
2. **For independent tasks**, use parallel Opus subagents (same pattern as D-8)
3. **Test on dev server** after each major change
4. **Run build verification** before marking stories complete

## Parallelization Strategy (from D-8 success)

D-8 was completed using 5 parallel Opus subagents. Consider similar approach:
- Group related tasks to minimize conflicts
- Each agent should have clear, non-overlapping file responsibilities
- Use `model: "opus"` for subagents when tasks are complex

## Request

Continue implementing Epic D stories D-4 through D-7. Start by reading the story files to understand the requirements, then implement them systematically. Use parallel subagents where tasks are independent.

If story files don't exist for D-4 through D-7, check the main epic file at `_bmad-output/prd.md` or ask for clarification on requirements.
