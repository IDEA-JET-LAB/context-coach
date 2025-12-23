# Story D-6: Advanced Analytics Dashboard Design

Status: Ready

## Story

**As a** team lead or developer,
**I want** rich, interactive analytics visualizations,
**So that** I can understand prompting patterns, identify improvements, and track progress.

## Acceptance Criteria

1. **Given** the advanced analytics features (Epic 21)
   **When** the dashboard is designed
   **Then** all 12 analytics metrics have clear visual representations
   **And** visualizations are scannable at a glance but support deep dives
   **And** comparisons (user vs team, over time) are intuitive

2. **Given** the personal analytics view
   **When** designed
   **Then** users see their own patterns and trends prominently
   **And** work style categorization is visually clear
   **And** learning progression is motivating, not discouraging

3. **Given** the team analytics view
   **When** designed
   **Then** team leads can see aggregate patterns
   **And** individual comparisons are available without surveillance feel
   **And** insights are actionable (suggest coaching opportunities)

4. **Given** the interactive nature
   **When** designed
   **Then** users can filter by time range, project, and user
   **And** clicking on visualizations reveals more detail
   **And** data can be exported or shared

5. **Given** accessibility requirements
   **When** designed
   **Then** charts have text alternatives
   **And** color is not the only way to convey information
   **And** all controls are keyboard accessible

## Tasks / Subtasks

- [ ] **Task 1: Design Analytics Page Layout** (AC: #1, #2, #3)
  - [ ] Design page structure with filters at top
  - [ ] Design grid layout for metric cards
  - [ ] Design responsive behavior (2-col on tablet, 1-col on mobile)
  - [ ] Design navigation between Personal/Team views
  - [ ] Implement as `app/(dashboard)/dashboard/analytics/page.tsx` layout

- [ ] **Task 2: Design Context Window Management Viz** (AC: #1)
  - [ ] Design context usage gauge (% of window used)
  - [ ] Design warning threshold indicator
  - [ ] Design context exhaustion timeline
  - [ ] Implement as `components/analytics/context-gauge.tsx`

- [ ] **Task 3: Design Work Style Categorization** (AC: #1, #2)
  - [ ] Design work style badge/label system
  - [ ] Design style distribution chart (pie or bar)
  - [ ] Define style categories (e.g., "Explorer", "Focused", "Iterative")
  - [ ] Design style description tooltips
  - [ ] Implement as `components/analytics/work-style-badge.tsx`

- [ ] **Task 4: Design Sentiment Analysis Viz** (AC: #1, #2)
  - [ ] Design sentiment timeline (emoji or color-coded)
  - [ ] Design sentiment distribution breakdown
  - [ ] Design "frustration spike" detection indicator
  - [ ] Implement as `components/analytics/sentiment-timeline.tsx`

- [ ] **Task 5: Design Prompt Complexity Metrics** (AC: #1)
  - [ ] Design complexity score display
  - [ ] Design complexity breakdown (length, structure, specificity)
  - [ ] Design complexity trend over time
  - [ ] Implement as `components/analytics/complexity-card.tsx`

- [ ] **Task 6: Design Interaction Timing Analysis** (AC: #1)
  - [ ] Design response time histogram
  - [ ] Design "most productive hours" heatmap
  - [ ] Design session duration distribution
  - [ ] Implement as `components/analytics/timing-heatmap.tsx`

- [ ] **Task 7: Design Tool Usage Profiling** (AC: #1)
  - [ ] Design tool usage breakdown (bar chart)
  - [ ] Design tool effectiveness indicators
  - [ ] Design "frequently used tools" badges
  - [ ] Implement as `components/analytics/tool-usage-chart.tsx`

- [ ] **Task 8: Design Session Health Score** (AC: #1)
  - [ ] Design session health gauge (0-100)
  - [ ] Design health factors breakdown
  - [ ] Design health trend over sessions
  - [ ] Implement as `components/analytics/session-health.tsx`

- [ ] **Task 9: Design Technical Depth Profile** (AC: #1)
  - [ ] Design technical depth radar/spider chart
  - [ ] Design depth categories (architecture, debugging, etc.)
  - [ ] Design depth comparison (user vs team)
  - [ ] Implement as `components/analytics/depth-radar.tsx`

- [ ] **Task 10: Design Learning Progression Tracking** (AC: #1, #2)
  - [ ] Design skill growth chart (line over time)
  - [ ] Design milestone badges ("First 8+ score", "10 sessions", etc.)
  - [ ] Design improvement suggestions based on progression
  - [ ] Implement as `components/analytics/learning-progress.tsx`

- [ ] **Task 11: Design Workflow Efficiency Metrics** (AC: #1)
  - [ ] Design efficiency score card
  - [ ] Design bottleneck identification
  - [ ] Design efficiency tips based on patterns
  - [ ] Implement as `components/analytics/efficiency-card.tsx`

- [ ] **Task 12: Design Interactive Insights Dashboard** (AC: #4)
  - [ ] Design insight cards with AI-generated recommendations
  - [ ] Design "explore" interaction pattern
  - [ ] Design drill-down navigation (click chart → detail view)
  - [ ] Implement as `components/analytics/insight-card.tsx`

- [ ] **Task 13: Design Team Intelligence View** (AC: #3)
  - [ ] Design team aggregate metrics display
  - [ ] Design anonymous comparison mode
  - [ ] Design coaching opportunity highlights
  - [ ] Design team trends vs benchmarks
  - [ ] Implement as `components/analytics/team-intelligence.tsx`

- [ ] **Task 14: Design Filter and Export Controls** (AC: #4)
  - [ ] Design date range picker for analytics
  - [ ] Design project/user filter dropdowns
  - [ ] Design export button (CSV, PDF options)
  - [ ] Design share/screenshot functionality
  - [ ] Implement as `components/analytics/analytics-filters.tsx`

## Dev Notes

### Analytics Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Analytics                                [Personal ▼] [Export]  │
├─────────────────────────────────────────────────────────────────┤
│ Date: [Last 30 days ▼]  Project: [All ▼]  User: [Me ▼]        │
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│ │ Overall Score │ │ Session Health│ │ Context Usage │          │
│ │     7.8       │ │      85%      │ │     62%       │          │
│ │   ▲ +0.3      │ │   ▲ Healthy   │ │   ⚠ Growing   │          │
│ └───────────────┘ └───────────────┘ └───────────────┘          │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Score Trend Over Time                                      ││
│ │  10│     ╭─╮                                               ││
│ │    │   ╭─╯ ╰─╮  ╭───╮                                      ││
│ │   5│───╯     ╰──╯   ╰───                                   ││
│ │    └─────────────────────────────────────────              ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌────────────────────┐ ┌────────────────────────────────────┐  │
│ │ Work Style         │ │ Productive Hours                    │  │
│ │ ████ Explorer 45%  │ │ █▃▁▁▃█████▇▅▃▂▁▁▁▂▃▅▇███▇▅▃▂      │  │
│ │ ███ Focused   35%  │ │ 6am        12pm        6pm     12am │  │
│ │ ██ Iterative  20%  │ │                                     │  │
│ └────────────────────┘ └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Metric Cards Structure

Each metric card follows this pattern:

```typescript
interface MetricCardProps {
  title: string;
  value: number | string;
  change?: { value: number; direction: 'up' | 'down' | 'neutral' };
  chart?: React.ReactNode;  // Mini visualization
  onClick?: () => void;     // Drill-down
}
```

### Visualization Library

**Recommended: recharts + custom components**

```typescript
// Example usage
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Wrapped in theme-aware container
<ResponsiveContainer width="100%" height={200}>
  <LineChart data={scoreData}>
    <Line
      type="monotone"
      dataKey="score"
      stroke="hsl(var(--primary))"
      strokeWidth={2}
    />
    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
    <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" />
    <Tooltip contentStyle={{ background: 'hsl(var(--surface))' }} />
  </LineChart>
</ResponsiveContainer>
```

### Accessibility for Charts

```typescript
// Every chart needs:
<div role="img" aria-label="Score trend showing improvement from 6.5 to 7.8 over 30 days">
  <LineChart aria-hidden="true" ... />
  <span className="sr-only">
    Detailed data: Day 1: 6.5, Day 7: 6.8, Day 14: 7.2, Day 21: 7.5, Day 30: 7.8
  </span>
</div>
```

### Component Structure

```
components/analytics/
├── analytics-filters.tsx       # Date, project, user filters
├── metric-card.tsx             # Reusable metric display
├── context-gauge.tsx           # Context window usage
├── work-style-badge.tsx        # Style categorization
├── sentiment-timeline.tsx      # Sentiment over time
├── complexity-card.tsx         # Prompt complexity
├── timing-heatmap.tsx          # Activity heatmap
├── tool-usage-chart.tsx        # Tool usage breakdown
├── session-health.tsx          # Session health gauge
├── depth-radar.tsx             # Technical depth radar
├── learning-progress.tsx       # Skill progression
├── efficiency-card.tsx         # Workflow efficiency
├── insight-card.tsx            # AI-generated insights
└── team-intelligence.tsx       # Team aggregate view
```

### Color Palette for Charts

```css
/* Use semantic colors for data visualization */
--chart-1: hsl(210, 100%, 60%);  /* Primary data */
--chart-2: hsl(150, 70%, 50%);   /* Positive/growth */
--chart-3: hsl(30, 90%, 55%);    /* Warning */
--chart-4: hsl(0, 75%, 55%);     /* Negative/decline */
--chart-5: hsl(270, 60%, 60%);   /* Secondary data */
```

## Recommended Tools & Agents

### Pixel Agent (Visual Asset Generator)

Use the **Pixel agent** (`/bmad:custom:agents:pixel`) for analytics visual assets:

```
Pixel Commands:
- *generate          → Generate illustrations and decorative graphics
- *batch             → Generate cohesive illustration sets
- *analyze-component → Identify image needs in analytics components
```

**Use Pixel For:**
| Asset Type | Purpose |
|------------|---------|
| Empty analytics illustration | "Start coding to see analytics" graphic |
| Achievement badges | Milestone celebration graphics (e.g., "First 8+ Score") |
| Work style icons | Visual representations of Explorer, Focused, Iterative styles |
| Sentiment indicators | Custom emotion graphics beyond emojis |
| Insight card decorations | Subtle graphics for AI-generated insights |
| Dashboard hero graphic | Optional header illustration |
| Onboarding graphics | "How to read your analytics" visuals |

**Workflow:**
1. Create chart components with recharts (functional)
2. Identify empty states and decorative opportunities
3. Invoke Pixel: `*batch` for cohesive achievement badge set
4. Generate work style icons as a consistent set
5. `*accept` to deploy to `public/images/analytics/`

**Important:** Analytics visualizations should be primarily data-driven (charts, graphs). Use Pixel for supplementary illustrations, empty states, and gamification elements (badges, achievements).

### Frontend-Design Skill

Use `/frontend-design` for the React dashboard layout and metric card components.

**Combined Workflow:**
1. `/frontend-design` → Creates styled metric cards, layouts
2. Pixel → Generates empty state illustrations, badges
3. recharts → Provides actual data visualizations
4. Integration → Combines all elements into polished dashboard

## Dependencies

- **Depends on:** Story D-1, D-2, D-3 (design system and chart components)
- **Blocks:** Epic 21 (Advanced Analytics) implementation

## References

- Epic: Epic D: Phase 2 Design Foundation
- Epic 21: Advanced Analytics (all 12 stories)
- UX Spec: Dashboard section

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
