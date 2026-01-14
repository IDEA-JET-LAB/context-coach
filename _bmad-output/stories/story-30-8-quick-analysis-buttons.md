# Story 30-8: Quick Analysis Buttons

## Story Info
- **Epic:** 30 - Conversation Analysis
- **Priority:** P2
- **Points:** 2
- **Status:** Done
- **Completed:** 2026-01-10

## Description

Add pre-built analysis prompts for common questions. These "Quick Analysis" buttons provide one-click access to frequently useful analyses, reducing friction for users who don't know what to ask.

## Acceptance Criteria

- [x] Add 4 quick action buttons above custom question input
- [x] Each button uses optimized prompt and content selection
- [x] Show warning for high-token analyses (Deep Dive)
- [x] Track which quick analyses are most used (analytics)
- [x] Clicking button fills question and submits automatically

## Technical Details

### Quick Analysis Definitions

```typescript
// lib/analysis/quick-analyses.ts

export interface QuickAnalysis {
  id: string;
  label: string;
  icon: LucideIcon;
  prompt: string;
  questionType: 'summarize' | 'find_issues' | 'suggestions' | 'deep_dive';
  contentSettings: {
    includePrompts: boolean;
    includeResponses: boolean;
    includeThinking: boolean;
    includeTools: boolean;
  };
  recommendedModel: 'haiku' | 'sonnet' | 'opus';
  warning?: string;
}

export const QUICK_ANALYSES: QuickAnalysis[] = [
  {
    id: 'summarize',
    label: 'Summarize',
    icon: FileText,
    prompt: `Summarize this conversation in 2-3 sentences:
1. What was the user trying to accomplish?
2. What was the outcome?
3. How many turns did it take?

Be concise and factual.`,
    questionType: 'summarize',
    contentSettings: {
      includePrompts: true,
      includeResponses: true,
      includeThinking: false,
      includeTools: false,
    },
    recommendedModel: 'haiku',
  },
  {
    id: 'find_issues',
    label: 'Find Issues',
    icon: AlertTriangle,
    prompt: `Analyze this conversation and identify 3-5 issues with how the user approached it. Focus on context-engineering mistakes:

- Did they provide enough context upfront?
- Were their requests clear and specific?
- Did they have to repeat themselves or clarify?
- Did they let the AI work autonomously or micromanage?
- Were there unnecessary back-and-forth exchanges?

For each issue, provide:
1. What went wrong
2. Why it matters
3. What they could do differently

Be specific with examples from the conversation.`,
    questionType: 'find_issues',
    contentSettings: {
      includePrompts: true,
      includeResponses: true,
      includeThinking: false,
      includeTools: true,
    },
    recommendedModel: 'sonnet',
  },
  {
    id: 'suggestions',
    label: 'Suggestions',
    icon: Lightbulb,
    prompt: `Based on this conversation, provide 3-5 actionable suggestions for how the user could improve their prompting in future conversations.

Focus on:
- How to better frame initial requests
- What context to provide upfront
- When to intervene vs let the AI work
- How to course-correct efficiently

Format each suggestion as:
**Suggestion:** [One-line summary]
**Why:** [Brief explanation]
**Example:** [How they could apply this]`,
    questionType: 'suggestions',
    contentSettings: {
      includePrompts: true,
      includeResponses: true,
      includeThinking: false,
      includeTools: false,
    },
    recommendedModel: 'sonnet',
  },
  {
    id: 'deep_dive',
    label: 'Deep Dive',
    icon: Microscope,
    prompt: `Perform a deep analysis of this conversation, including the AI's reasoning process.

Analyze:
1. **Goal Clarity:** How well did the user communicate their intent?
2. **Context Quality:** Was sufficient context provided? What was missing?
3. **AI Reasoning:** Were the AI's decisions logical? Any suboptimal paths?
4. **Collaboration Efficiency:** How well did the human-AI collaboration flow?
5. **Outcome Assessment:** Was the goal achieved? What could be improved?

Provide specific examples and quotes from the conversation to support your analysis.`,
    questionType: 'deep_dive',
    contentSettings: {
      includePrompts: true,
      includeResponses: true,
      includeThinking: true,
      includeTools: true,
    },
    recommendedModel: 'opus',
    warning: 'Includes thinking blocks - higher token usage',
  },
];
```

### Quick Analysis Buttons Component

```typescript
// components/conversations/analysis/QuickAnalysisButtons.tsx

interface QuickAnalysisButtonsProps {
  onSelect: (analysis: QuickAnalysis) => void;
  disabled?: boolean;
  tokenEstimates?: Record<string, number>;
}

export function QuickAnalysisButtons({
  onSelect,
  disabled,
  tokenEstimates,
}: QuickAnalysisButtonsProps) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-2">Quick Analysis</div>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ANALYSES.map(analysis => (
          <QuickAnalysisButton
            key={analysis.id}
            analysis={analysis}
            onClick={() => onSelect(analysis)}
            disabled={disabled}
            tokenEstimate={tokenEstimates?.[analysis.id]}
          />
        ))}
      </div>
    </div>
  );
}

function QuickAnalysisButton({
  analysis,
  onClick,
  disabled,
  tokenEstimate,
}: {
  analysis: QuickAnalysis;
  onClick: () => void;
  disabled?: boolean;
  tokenEstimate?: number;
}) {
  const Icon = analysis.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className="w-full justify-start gap-2 h-auto py-2"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div className="text-left">
              <div className="text-xs font-medium">{analysis.label}</div>
              {tokenEstimate && (
                <div className="text-[10px] text-muted-foreground">
                  ~{formatTokens(tokenEstimate)}
                </div>
              )}
            </div>
            {analysis.warning && (
              <AlertTriangle className="h-3 w-3 text-score-growth ml-auto" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{getAnalysisDescription(analysis.id)}</p>
          {analysis.warning && (
            <p className="text-xs text-score-growth mt-1">{analysis.warning}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getAnalysisDescription(id: string): string {
  const descriptions: Record<string, string> = {
    summarize: 'Get a quick 2-3 sentence summary of what happened in this conversation.',
    find_issues: 'Identify context-engineering mistakes and areas for improvement.',
    suggestions: 'Get actionable tips for improving your prompting skills.',
    deep_dive: 'Full analysis including AI reasoning - best for learning from complex conversations.',
  };
  return descriptions[id] || '';
}
```

### Integration with Chat Panel

Update `AnalysisChatPanel.tsx` to include quick analysis buttons:

```typescript
// In AnalysisChatPanel.tsx

const handleQuickAnalysis = (analysis: QuickAnalysis) => {
  // Set content selections
  setIncludePrompts(analysis.contentSettings.includePrompts);
  setIncludeResponses(analysis.contentSettings.includeResponses);
  setIncludeThinking(analysis.contentSettings.includeThinking);
  setIncludeTools(analysis.contentSettings.includeTools);

  // Set recommended model
  setModel(analysis.recommendedModel);

  // Set question and submit
  setQuestion(analysis.prompt);

  // Track analytics
  trackQuickAnalysisUsed(analysis.id);

  // Auto-submit after state updates
  setTimeout(() => {
    handleAnalyze(analysis.questionType);
  }, 100);
};

// Calculate token estimates for each quick analysis
const quickAnalysisTokenEstimates = useMemo(() => {
  if (!content) return {};

  return QUICK_ANALYSES.reduce((acc, analysis) => {
    const estimate = estimateConversationTokens(content, analysis.contentSettings);
    acc[analysis.id] = estimate.total;
    return acc;
  }, {} as Record<string, number>);
}, [content]);

// In the JSX:
<QuickAnalysisButtons
  onSelect={handleQuickAnalysis}
  disabled={isAnalyzing || !content}
  tokenEstimates={quickAnalysisTokenEstimates}
/>
```

### Analytics Tracking

```typescript
// lib/analytics/quick-analysis-tracking.ts

export async function trackQuickAnalysisUsed(
  analysisId: string,
  sessionId: string,
  teamId: string
): Promise<void> {
  // Log to analytics service (could be Supabase, PostHog, etc.)
  await supabase.from('analytics_events').insert({
    event_type: 'quick_analysis_used',
    event_data: {
      analysis_id: analysisId,
      session_id: sessionId,
    },
    team_id: teamId,
    created_at: new Date().toISOString(),
  });
}

// Query to find most used quick analyses
export async function getMostUsedQuickAnalyses(
  teamId: string,
  days: number = 30
): Promise<Array<{ analysisId: string; count: number }>> {
  const { data } = await supabase
    .from('analytics_events')
    .select('event_data->analysis_id')
    .eq('event_type', 'quick_analysis_used')
    .eq('team_id', teamId)
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

  // Aggregate counts
  const counts = new Map<string, number>();
  for (const row of data || []) {
    const id = row.analysis_id;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([analysisId, count]) => ({ analysisId, count }))
    .sort((a, b) => b.count - a.count);
}
```

### UI Layout

```
┌─────────────────────────────────────────┐
│ 💬 Analyze Conversation                 │
├─────────────────────────────────────────┤
│ Quick Analysis                          │
│ ┌─────────────────┬─────────────────┐   │
│ │ 📄 Summarize    │ ⚠️ Find Issues   │   │
│ │ ~8k tokens      │ ~12k tokens     │   │
│ ├─────────────────┼─────────────────┤   │
│ │ 💡 Suggestions  │ 🔬 Deep Dive ⚠️  │   │
│ │ ~10k tokens     │ ~45k tokens     │   │
│ └─────────────────┴─────────────────┘   │
├─────────────────────────────────────────┤
│ Model: [Haiku ▼] [Sonnet] [Opus]        │
│ ...                                     │
└─────────────────────────────────────────┘
```

## Tests

### Unit Tests

```typescript
describe('QuickAnalysisButtons', () => {
  it('should render all 4 quick analysis buttons');
  it('should show token estimates for each button');
  it('should show warning icon for Deep Dive');
  it('should call onSelect with correct analysis');
  it('should disable buttons when disabled prop is true');
  it('should show tooltip on hover');
});

describe('Quick Analysis Integration', () => {
  it('should set content selections when quick analysis selected');
  it('should set recommended model');
  it('should auto-submit after selection');
  it('should track analytics event');
});
```

### E2E Tests

```typescript
describe('Quick Analysis', () => {
  it('should run Summarize quick analysis');
  it('should run Find Issues quick analysis');
  it('should show warning tooltip for Deep Dive');
  it('should use correct model for each analysis type');
});
```

## Dependencies

- Story 30-7: Interactive Chat Interface (integrates into)
- Story 30-4: Token Estimation Service
- Story 30-5: Content Extraction Service

## Future Enhancements

After collecting usage data:
1. Reorder buttons based on usage frequency
2. Add/remove quick analyses based on value
3. Personalize based on user's past analyses
4. A/B test different prompts for effectiveness

## Definition of Done

- [ ] All 4 quick analysis buttons implemented
- [ ] Token estimates displayed
- [ ] Warning shown for high-token analyses
- [ ] Analytics tracking in place
- [ ] Integrated into chat panel
- [ ] Tests passing
- [ ] Tooltips working
