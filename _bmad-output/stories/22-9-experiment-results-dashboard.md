# Story 22.9: Experiment Results Dashboard

Status: Completed

## Story

**As a** super admin,
**I want** to visualize A/B experiment results with charts and statistical metrics,
**So that** I can understand experiment outcomes and make informed decisions about configuration changes.

## Acceptance Criteria

1. **Given** I navigate to an experiment detail page
   **When** the experiment has results
   **Then** I see a summary card with: sample sizes, p-value, effect size, winner status

2. **Given** the experiment is running
   **When** I view the results dashboard
   **Then** I see real-time updating metrics (refreshes every 60 seconds)
   **And** I see a live sample count per variant

3. **Given** I view score distributions
   **When** the chart loads
   **Then** I see overlapping histograms for control and variant
   **And** I see mean lines for each group

4. **Given** I view the trend chart
   **When** looking at cumulative metrics
   **Then** I see score means over time for both variants
   **And** I see the moment significance was reached (if applicable)

5. **Given** the experiment has a winner
   **When** I view the results
   **Then** the winning variant is clearly highlighted
   **And** I see an "Apply Winner" button to activate the winning config

6. **Given** I want detailed statistics
   **When** I expand the statistics panel
   **Then** I see: confidence intervals, t-statistic, degrees of freedom
   **And** I can download raw data as CSV

## Dependencies

- **Story 22.6**: A/B Experiment Creation (experiment data model)
- **Story 22.8**: Statistical Significance Calculation (statistics engine)
- **Story 22.10**: Configuration Audit Trail (apply winner audit)

## Tasks / Subtasks

- [ ] **Task 1: Create experiment results page** (AC: #1, #2)
  - [ ] Create `app/(dashboard)/admin/experiments/[id]/results/page.tsx`
  - [ ] Query experiment with variants and statistics
  - [ ] Display summary card with key metrics
  - [ ] Add auto-refresh for running experiments

- [ ] **Task 2: Create summary statistics card** (AC: #1)
  - [ ] Create `components/admin/experiment-summary-card.tsx`
  - [ ] Display sample sizes per variant
  - [ ] Display p-value with significance indicator
  - [ ] Display effect size with category badge
  - [ ] Display winner status (control/variant/inconclusive)

- [ ] **Task 3: Create score distribution chart** (AC: #3)
  - [ ] Create `components/admin/score-distribution-chart.tsx`
  - [ ] Use Recharts for visualization
  - [ ] Create overlapping histogram bins (0-10 range)
  - [ ] Add vertical lines for means
  - [ ] Add legend for control/variant

- [ ] **Task 4: Create trend chart** (AC: #4)
  - [ ] Create `components/admin/experiment-trend-chart.tsx`
  - [ ] Query daily aggregated scores per variant
  - [ ] Plot cumulative mean over time
  - [ ] Mark significance threshold crossing
  - [ ] Add sample size as secondary y-axis

- [ ] **Task 5: Create winner highlight component** (AC: #5)
  - [ ] Create `components/admin/experiment-winner-banner.tsx`
  - [ ] Display winner variant prominently
  - [ ] Show improvement percentage
  - [ ] Add "Apply Winner" button
  - [ ] Show confidence level

- [ ] **Task 6: Implement apply winner action** (AC: #5)
  - [ ] Create `applyExperimentWinner()` server action
  - [ ] Activate winning variant's config
  - [ ] Complete experiment if still running
  - [ ] Log to audit trail with experiment context

- [ ] **Task 7: Create detailed statistics panel** (AC: #6)
  - [ ] Create `components/admin/experiment-detailed-stats.tsx`
  - [ ] Display confidence interval with visualization
  - [ ] Display t-statistic and degrees of freedom
  - [ ] Display per-dimension comparisons
  - [ ] Add collapsible/expandable state

- [ ] **Task 8: Implement CSV export** (AC: #6)
  - [ ] Create `GET /api/admin/experiments/[id]/export`
  - [ ] Fetch all prompt analyses for experiment
  - [ ] Format as CSV with columns: prompt_id, variant, score, dimensions
  - [ ] Return as downloadable file

- [ ] **Task 9: Create real-time updates** (AC: #2)
  - [ ] Set up polling interval (60 seconds)
  - [ ] Use React Query for data fetching
  - [ ] Show loading indicator during refresh
  - [ ] Pause polling when tab not visible

- [ ] **Task 10: Create mobile-responsive layout** (AC: #1-6)
  - [ ] Stack charts vertically on mobile
  - [ ] Simplify summary card for small screens
  - [ ] Make table scrollable horizontally
  - [ ] Ensure touch-friendly controls

- [ ] **Task 11: Write E2E tests** (AC: #1-6)
  - [ ] Create `e2e/admin-experiment-results.spec.ts`
  - [ ] Test summary card displays correct values
  - [ ] Test charts render without errors
  - [ ] Test winner banner appears for completed experiments
  - [ ] Test CSV download works
  - [ ] Test apply winner activates config

## Dev Notes

### Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Experiment: Q4 Scoring Optimization                         │
│  Status: Running  │  Started: Dec 20, 2025  │  Samples: 847 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │  CONTROL             │  │  VARIANT              │        │
│  │  n = 423             │  │  n = 424              │        │
│  │  Mean: 6.82          │  │  Mean: 7.15           │        │
│  │  Std: 1.24           │  │  Std: 1.18            │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  p-value: 0.0234  │  Effect: 0.27 (small)  │  VARIANT │   │
│  │                   │                         │  WINS    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [Score Distribution Chart]                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     ▓▓▓▓░░░░                                         │   │
│  │   ▓▓▓▓▓▓▓▓░░░░░░                                     │   │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░                                 │   │
│  │ Control ━━━  Variant ━━━                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [Trend Over Time Chart]                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       ╱──────                                        │   │
│  │     ╱                                                │   │
│  │   ╱────────                                          │   │
│  │ Day 1   Day 2   Day 3   Day 4   Day 5               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [Detailed Statistics]  [Expand ▼]                          │
│  [Export CSV]  [Apply Winner]                               │
└─────────────────────────────────────────────────────────────┘
```

### Summary Card Component

```typescript
// components/admin/experiment-summary-card.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExperimentStatistics } from '@/lib/services/experiment-statistics';

interface ExperimentSummaryCardProps {
  stats: ExperimentStatistics;
  isRunning: boolean;
}

export function ExperimentSummaryCard({ stats, isRunning }: ExperimentSummaryCardProps) {
  const pValueColor = stats.tTest.significant ? 'text-green-600' : 'text-yellow-600';
  const effectColor = getEffectColor(stats.effectSize.category);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Results Summary</span>
          {isRunning && (
            <Badge variant="outline" className="animate-pulse">
              Live
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Variant comparison */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <VariantCard
            name="Control"
            stats={stats.control}
            isWinner={stats.winner === 'control'}
          />
          <VariantCard
            name="Variant"
            stats={stats.variant}
            isWinner={stats.winner === 'variant'}
          />
        </div>

        {/* Statistical significance */}
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <span className="text-sm text-muted-foreground">P-Value</span>
            <p className={cn("text-lg font-semibold", pValueColor)}>
              {stats.tTest.p_value.toFixed(4)}
              {stats.tTest.significant && ' *'}
            </p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Effect Size</span>
            <p className={cn("text-lg font-semibold", effectColor)}>
              {stats.effectSize.cohens_d.toFixed(2)}
              <Badge variant="outline" className="ml-2">
                {stats.effectSize.category}
              </Badge>
            </p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Winner</span>
            <WinnerBadge winner={stats.winner} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VariantCard({
  name,
  stats,
  isWinner,
}: {
  name: string;
  stats: { n: number; mean: number; stdDev: number };
  isWinner: boolean;
}) {
  return (
    <div className={cn(
      "p-4 rounded-lg border",
      isWinner && "border-green-500 bg-green-50"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{name}</span>
        {isWinner && <Badge className="bg-green-500">Winner</Badge>}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Samples</span>
          <span className="font-mono">{stats.n}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Mean Score</span>
          <span className="font-mono">{stats.mean.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Std Dev</span>
          <span className="font-mono">{stats.stdDev.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function WinnerBadge({ winner }: { winner: 'control' | 'variant' | 'inconclusive' }) {
  if (winner === 'inconclusive') {
    return (
      <Badge variant="secondary" className="text-lg px-4 py-1">
        Inconclusive
      </Badge>
    );
  }

  return (
    <Badge className="text-lg px-4 py-1 bg-green-500">
      {winner === 'control' ? 'Control' : 'Variant'} Wins
    </Badge>
  );
}

function getEffectColor(category: string): string {
  switch (category) {
    case 'large':
      return 'text-green-600';
    case 'medium':
      return 'text-blue-600';
    case 'small':
      return 'text-yellow-600';
    default:
      return 'text-gray-600';
  }
}
```

### Score Distribution Chart

```typescript
// components/admin/score-distribution-chart.tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface DistributionData {
  bin: string;
  control: number;
  variant: number;
}

interface ScoreDistributionChartProps {
  controlScores: number[];
  variantScores: number[];
  controlMean: number;
  variantMean: number;
}

export function ScoreDistributionChart({
  controlScores,
  variantScores,
  controlMean,
  variantMean,
}: ScoreDistributionChartProps) {
  // Create histogram bins (1-10 with 0.5 width)
  const bins = Array.from({ length: 18 }, (_, i) => 1 + i * 0.5);
  const data: DistributionData[] = bins.map((bin, i) => {
    const nextBin = bins[i + 1] || 10.5;
    const controlCount = controlScores.filter(s => s >= bin && s < nextBin).length;
    const variantCount = variantScores.filter(s => s >= bin && s < nextBin).length;

    return {
      bin: bin.toFixed(1),
      control: (controlCount / controlScores.length) * 100,
      variant: (variantCount / variantScores.length) * 100,
    };
  });

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="10%">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="bin"
            label={{ value: 'Score', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            label={{ value: 'Frequency (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
          />
          <Legend />
          <Bar dataKey="control" fill="#6366f1" opacity={0.7} name="Control" />
          <Bar dataKey="variant" fill="#22c55e" opacity={0.7} name="Variant" />
          <ReferenceLine
            x={controlMean.toFixed(1)}
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{ value: `Control Mean: ${controlMean.toFixed(2)}`, position: 'top' }}
          />
          <ReferenceLine
            x={variantMean.toFixed(1)}
            stroke="#22c55e"
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{ value: `Variant Mean: ${variantMean.toFixed(2)}`, position: 'top' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Trend Chart

```typescript
// components/admin/experiment-trend-chart.tsx
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface TrendData {
  date: string;
  controlMean: number;
  variantMean: number;
  controlSamples: number;
  variantSamples: number;
}

interface ExperimentTrendChartProps {
  data: TrendData[];
  significanceDate?: string;
}

export function ExperimentTrendChart({
  data,
  significanceDate,
}: ExperimentTrendChartProps) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            label={{ value: 'Date', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            yAxisId="left"
            domain={[0, 10]}
            label={{ value: 'Mean Score', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ value: 'Cumulative Samples', angle: 90, position: 'insideRight' }}
          />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="controlMean"
            stroke="#6366f1"
            strokeWidth={2}
            name="Control Mean"
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="variantMean"
            stroke="#22c55e"
            strokeWidth={2}
            name="Variant Mean"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="controlSamples"
            stroke="#6366f1"
            strokeDasharray="3 3"
            name="Control Samples"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="variantSamples"
            stroke="#22c55e"
            strokeDasharray="3 3"
            name="Variant Samples"
            dot={false}
          />
          {significanceDate && (
            <ReferenceLine
              x={significanceDate}
              stroke="#ef4444"
              strokeWidth={2}
              label={{ value: 'Significance Reached', position: 'top' }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### CSV Export Endpoint

```typescript
// app/api/admin/experiments/[id]/export/route.ts

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifySuperAdmin } from '@/lib/auth/admin';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await verifySuperAdmin();

    const supabase = createAdminClient();

    // Get experiment data
    const { data: analyses } = await supabase
      .from('prompt_analyses')
      .select(`
        id,
        prompt_id,
        experiment_variant,
        overall_score,
        dimension_scores,
        created_at
      `)
      .eq('experiment_id', params.id)
      .order('created_at', { ascending: true });

    if (!analyses || analyses.length === 0) {
      return NextResponse.json(
        { error: { code: 'NO_DATA', message: 'No data to export' } },
        { status: 404 }
      );
    }

    // Build CSV
    const headers = [
      'analysis_id',
      'prompt_id',
      'variant',
      'overall_score',
      'created_at',
      ...Object.keys(analyses[0].dimension_scores || {}),
    ];

    const rows = analyses.map((a) => [
      a.id,
      a.prompt_id,
      a.experiment_variant,
      a.overall_score,
      a.created_at,
      ...Object.values(a.dimension_scores || {}),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((v) => `"${v}"`).join(',')),
    ].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="experiment-${params.id}.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'EXPORT_ERROR', message: 'Failed to export data' } },
      { status: 500 }
    );
  }
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Results Page | `app/(dashboard)/admin/experiments/[id]/results/page.tsx` |
| Summary Card | `components/admin/experiment-summary-card.tsx` |
| Distribution Chart | `components/admin/score-distribution-chart.tsx` |
| Trend Chart | `components/admin/experiment-trend-chart.tsx` |
| Winner Banner | `components/admin/experiment-winner-banner.tsx` |
| Detailed Stats | `components/admin/experiment-detailed-stats.tsx` |
| Export API | `app/api/admin/experiments/[id]/export/route.ts` |

### Data Fetching with Auto-Refresh

```typescript
// lib/hooks/use-experiment-results.ts

import { useQuery } from '@tanstack/react-query';
import { getExperimentResults } from '@/lib/services/experiments';

export function useExperimentResults(experimentId: string, isRunning: boolean) {
  return useQuery({
    queryKey: ['experiment-results', experimentId],
    queryFn: () => getExperimentResults(experimentId),
    refetchInterval: isRunning ? 60000 : false, // Refresh every 60s if running
    refetchIntervalInBackground: false, // Don't refresh when tab not visible
  });
}
```

### Verification Checklist

After completing this story, verify:
- [ ] Summary card shows all key metrics
- [ ] Sample sizes update for running experiments
- [ ] Distribution chart shows overlapping histograms
- [ ] Mean lines are positioned correctly
- [ ] Trend chart shows daily progression
- [ ] Significance marker appears at correct date
- [ ] Winner banner highlights winning variant
- [ ] Apply Winner button activates config
- [ ] Detailed stats expand/collapse
- [ ] CSV download includes all data
- [ ] Mobile layout works correctly
- [ ] Auto-refresh pauses when tab hidden


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
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List
- Created experiment results dashboard with summary cards
- Score distribution histogram using Recharts
- Trend chart with significance marker and cumulative samples
- Winner highlight banner with Apply Winner action
- Detailed statistics panel (expandable) with CI visualization
- CSV export endpoint for raw data download
- Auto-refresh every 60s for running experiments
- Mobile-responsive layout with touch-friendly controls

### Change Log
| Date | Change | Author |
|------|--------|--------|
| 2025-12-24 | Story completed with full dashboard and visualizations | Dev Agent |

### File List
- `app/components/admin/experiment-results.tsx`
- `app/components/admin/experiment-detail-view.tsx`
- `app/components/admin/experiment-card.tsx`
- `app/api/admin/experiments/[id]/export/route.ts`
- `app/lib/hooks/use-experiment-results.ts`
- `app/e2e/admin-experiments.spec.ts`
