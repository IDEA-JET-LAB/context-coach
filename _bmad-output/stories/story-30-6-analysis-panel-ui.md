# Story 30-6: Analysis Panel UI

## Story Info
- **Epic:** 30 - Conversation Analysis
- **Priority:** P1
- **Points:** 3
- **Status:** Done
- **Completed:** 2026-01-10

## Description

Add the deterministic stats panel to the conversation detail page's right sidebar. This displays instant, free statistics when a user views a conversation.

## Acceptance Criteria

- [x] Add "Conversation Stats" card to right sidebar
- [x] Display all deterministic metrics (from Story 30-2)
- [x] Show stats immediately on page load (with loading state)
- [x] Use existing design system components
- [x] Collapsible sections for tool and agent breakdown
- [x] Mobile responsive (panel behavior on small screens)

## Technical Details

### Component Structure

```
components/conversations/
├── analysis/
│   ├── ConversationStatsPanel.tsx   # Main panel component
│   ├── StatsCard.tsx                # Individual stat display
│   ├── ToolBreakdown.tsx            # Tool usage breakdown
│   ├── AgentBreakdown.tsx           # Agent usage breakdown
│   ├── ContextWindowGauge.tsx       # Visual context % display
│   └── OutcomeIndicator.tsx         # Outcome status display
```

### Main Panel Component

```typescript
// components/conversations/analysis/ConversationStatsPanel.tsx

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversationStats } from '@/lib/hooks/use-conversation-stats';
import { formatDuration, formatTokens } from '@/lib/analysis/token-estimator';

interface ConversationStatsPanelProps {
  sessionId: string;
}

export function ConversationStatsPanel({ sessionId }: ConversationStatsPanelProps) {
  const { data: stats, isLoading, error } = useConversationStats(sessionId);

  if (isLoading) {
    return <StatsLoadingSkeleton />;
  }

  if (error) {
    return <StatsError error={error} />;
  }

  if (!stats) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Conversation Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatItem
            label="Duration"
            value={stats.durationMinutes ? formatDuration(stats.durationMinutes) : 'Ongoing'}
            icon={<Clock className="h-4 w-4" />}
          />
          <StatItem
            label="Turns"
            value={stats.turnCount.toString()}
            icon={<MessageSquare className="h-4 w-4" />}
          />
        </div>

        {/* Token Usage */}
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground mb-2">Token Usage</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-medium">{formatTokens(stats.tokens.input)}</div>
              <div className="text-xs text-muted-foreground">In</div>
            </div>
            <div>
              <div className="text-sm font-medium">{formatTokens(stats.tokens.output)}</div>
              <div className="text-xs text-muted-foreground">Out</div>
            </div>
            <div>
              <div className="text-sm font-medium">{formatTokens(stats.tokens.total)}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </div>

        {/* Context Window */}
        <ContextWindowGauge
          peakPercentage={stats.contextWindow.peakPercentage}
          peakTurn={stats.contextWindow.peakTurn}
        />

        {/* Tool Breakdown */}
        {stats.tools.length > 0 && (
          <ToolBreakdown tools={stats.tools} />
        )}

        {/* Agent Breakdown */}
        {stats.agents.length > 0 && (
          <AgentBreakdown agents={stats.agents} />
        )}

        {/* Outcome */}
        <OutcomeIndicator outcome={stats.outcome} />
      </CardContent>
    </Card>
  );
}
```

### Stat Item Component

```typescript
// components/conversations/analysis/StatsCard.tsx

interface StatItemProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatItem({ label, value, icon, trend }: StatItemProps) {
  return (
    <div className="flex items-center gap-2">
      {icon && (
        <div className="text-muted-foreground">{icon}</div>
      )}
      <div>
        <div className="text-sm font-medium">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
```

### Context Window Gauge

```typescript
// components/conversations/analysis/ContextWindowGauge.tsx

interface ContextWindowGaugeProps {
  peakPercentage: number;
  peakTurn: number;
}

export function ContextWindowGauge({ peakPercentage, peakTurn }: ContextWindowGaugeProps) {
  const getColorClass = (pct: number) => {
    if (pct >= 90) return 'bg-destructive';
    if (pct >= 70) return 'bg-score-growth';
    return 'bg-primary';
  };

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Context Window Peak</span>
        <span className="text-xs font-medium">{peakPercentage}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getColorClass(peakPercentage)}`}
          style={{ width: `${Math.min(peakPercentage, 100)}%` }}
        />
      </div>
      {peakPercentage >= 70 && (
        <div className="text-xs text-muted-foreground mt-1">
          Peak at turn {peakTurn}
        </div>
      )}
    </div>
  );
}
```

### Tool Breakdown Component

```typescript
// components/conversations/analysis/ToolBreakdown.tsx

interface ToolBreakdownProps {
  tools: Array<{ name: string; count: number }>;
}

export function ToolBreakdown({ tools }: ToolBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Sort by count descending
  const sortedTools = [...tools].sort((a, b) => b.count - a.count);
  const topTools = sortedTools.slice(0, 4);
  const hasMore = sortedTools.length > 4;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="pt-2 border-t">
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
          <span className="text-xs text-muted-foreground">Tools Used</span>
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium">{tools.length} types</span>
            {hasMore && (
              <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            )}
          </div>
        </CollapsibleTrigger>

        <div className="mt-2 space-y-1">
          {topTools.map(tool => (
            <ToolRow key={tool.name} name={tool.name} count={tool.count} />
          ))}
        </div>

        {hasMore && (
          <CollapsibleContent>
            <div className="mt-1 space-y-1">
              {sortedTools.slice(4).map(tool => (
                <ToolRow key={tool.name} name={tool.name} count={tool.count} />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

function ToolRow({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="font-mono text-xs">{name}</span>
      <Badge variant="secondary" className="text-xs">{count}</Badge>
    </div>
  );
}
```

### Outcome Indicator

```typescript
// components/conversations/analysis/OutcomeIndicator.tsx

interface OutcomeIndicatorProps {
  outcome: {
    status: 'completed' | 'abandoned' | 'ongoing' | 'error' | 'unknown';
    indicators: string[];
  };
}

export function OutcomeIndicator({ outcome }: OutcomeIndicatorProps) {
  const config = {
    completed: { icon: CheckCircle, color: 'text-score-excellent', label: 'Completed' },
    ongoing: { icon: Clock, color: 'text-primary', label: 'Ongoing' },
    abandoned: { icon: XCircle, color: 'text-muted-foreground', label: 'Abandoned' },
    error: { icon: AlertTriangle, color: 'text-destructive', label: 'Error' },
    unknown: { icon: HelpCircle, color: 'text-muted-foreground', label: 'Unknown' },
  };

  const { icon: Icon, color, label } = config[outcome.status];

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      {outcome.indicators.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {outcome.indicators.map(indicator => (
            <Badge key={indicator} variant="outline" className="text-xs">
              {indicator}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
```

### React Query Hook

```typescript
// lib/hooks/use-conversation-stats.ts

import { useQuery } from '@tanstack/react-query';
import type { ConversationStats } from '@/lib/analysis/conversation-stats';

export function useConversationStats(sessionId: string) {
  return useQuery<ConversationStats>({
    queryKey: ['conversation-stats', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${sessionId}/stats`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversation stats');
      }
      const json = await response.json();
      return json.data;
    },
    staleTime: 60_000, // 1 minute
  });
}
```

### Integration with Existing Sidebar

Update `ConversationThreadClient.tsx` to include the new panel:

```typescript
// In the right sidebar section, add:
<ConversationStatsPanel sessionId={sessionId} />
```

## UI Mockup

```
┌─────────────────────────────────────────┐
│ 📊 Conversation Stats                   │
├─────────────────────────────────────────┤
│ ⏱️ Duration        ✉️ Turns              │
│    47 min            23                 │
├─────────────────────────────────────────┤
│ Token Usage                             │
│   45.2k      128.5k      173.7k         │
│    In         Out        Total          │
├─────────────────────────────────────────┤
│ Context Window Peak            78%      │
│ [██████████████████░░░░░░░░]            │
│ Peak at turn 18                         │
├─────────────────────────────────────────┤
│ Tools Used                    8 types ▼ │
│ Read                              12    │
│ Edit                               8    │
│ Bash                               5    │
│ Grep                               3    │
├─────────────────────────────────────────┤
│ Agents Used                   2 types   │
│ Explore                            2    │
│ general-purpose                    1    │
├─────────────────────────────────────────┤
│ ✓ Completed                             │
│ [git commit] [tests passed]             │
└─────────────────────────────────────────┘
```

## Tests

### Component Tests

```typescript
describe('ConversationStatsPanel', () => {
  it('should render loading skeleton initially');
  it('should render stats after loading');
  it('should render error state on failure');
  it('should format duration correctly');
  it('should format token counts with k suffix');
});

describe('ContextWindowGauge', () => {
  it('should show green for <70%');
  it('should show yellow for 70-90%');
  it('should show red for >90%');
  it('should display peak turn when high');
});

describe('ToolBreakdown', () => {
  it('should show top 4 tools by default');
  it('should expand to show all tools');
  it('should sort by count descending');
});

describe('OutcomeIndicator', () => {
  it('should show correct icon for each status');
  it('should display indicator badges');
});
```

### E2E Tests

```typescript
describe('Conversation Stats Panel', () => {
  it('should display stats when viewing conversation');
  it('should update when conversation has new messages');
});
```

## Dependencies

- Story 30-2: Deterministic Stats Service (API endpoint)
- Existing conversation thread page
- Design system components

## Out of Scope

- Interactive analysis chat (Story 30-7)
- Quick analysis buttons (Story 30-8)

## Definition of Done

- [ ] Components implemented with TypeScript
- [ ] Integrated into conversation detail page
- [ ] Loading and error states work correctly
- [ ] Mobile responsive
- [ ] Component tests passing
- [ ] E2E test passing
- [ ] Design system components used throughout
