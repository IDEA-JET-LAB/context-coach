# Story 6.4: Prompt Detail View

Status: ready-for-dev

## Story

**As a** user,
**I want** to see detailed analysis for a prompt,
**So that** I understand my scores and how to improve.

## Acceptance Criteria

1. **Given** I click on a prompt in the feed
   **When** the detail view opens
   **Then** I see the full prompt text
   **And** the overall score prominently displayed
   **And** a breakdown of all 5 dimension scores with bars

2. **Given** the dimension breakdown
   **When** I view each dimension
   **Then** I see: dimension name, score (1-10), visual bar, specific suggestion

3. **Given** the suggestions
   **When** they are displayed
   **Then** they use coaching-positive language
   **And** they reference specific parts of my prompt

4. **Given** I want to return to the feed
   **When** I click back or press Escape
   **Then** I return to the feed at my previous scroll position

## Tasks / Subtasks

- [ ] **Task 1: Create prompt detail modal/sheet** (AC: #1, #4)
  - [ ] Create `components/feed/prompt-detail.tsx` component
  - [ ] Use shadcn/ui Sheet (slide-in panel) or Dialog (modal)
  - [ ] Handle open/close state from parent feed component
  - [ ] Add close button and backdrop click to close
  - [ ] Listen for Escape key to close
  - [ ] Preserve scroll position when returning to feed

- [ ] **Task 2: Display full prompt text** (AC: #1)
  - [ ] Create scrollable text container for long prompts
  - [ ] Style with monospace or readable font
  - [ ] Add copy-to-clipboard button for prompt text
  - [ ] Handle very long prompts (100K chars max) gracefully
  - [ ] Apply dark mode styling

- [ ] **Task 3: Create overall score display** (AC: #1)
  - [ ] Create prominent score display at top of detail view
  - [ ] Use large circular badge with score number
  - [ ] Apply color coding (Teal 7-10, Amber 4-6, Coral 1-3)
  - [ ] Show score label (e.g., "Overall Score")
  - [ ] Add score context (e.g., "Great prompt!" or "Room for improvement")

- [ ] **Task 4: Create DimensionBar component** (AC: #2)
  - [ ] Create `components/feed/dimension-bar.tsx` component
  - [ ] Display dimension name on left
  - [ ] Show score number (1-10)
  - [ ] Render visual progress bar filled to score percentage
  - [ ] Apply color gradient based on score range
  - [ ] Animate bar fill on mount
  - [ ] Add ARIA attributes for accessibility

- [ ] **Task 5: Display 5 dimension scores** (AC: #2)
  - [ ] Fetch dimension data from `prompt_analyses` table
  - [ ] Map dimension scores to DimensionBar components
  - [ ] Display all 5 dimensions: Clarity, Context, Specificity, Goal, Constraints
  - [ ] Show dimension descriptions on hover or info icon
  - [ ] Handle missing dimensions gracefully

- [ ] **Task 6: Display dimension suggestions** (AC: #2, #3)
  - [ ] Create `components/feed/dimension-suggestion.tsx` component
  - [ ] Show suggestion text below each dimension bar
  - [ ] Style with coaching-positive tone indicator
  - [ ] Reference specific parts of prompt (highlight quotes)
  - [ ] Collapse long suggestions with "Show more"

- [ ] **Task 7: Implement scroll position preservation** (AC: #4)
  - [ ] Store scroll position before opening detail
  - [ ] Restore scroll position when closing detail
  - [ ] Use React state or ref to track position
  - [ ] Handle edge cases (content height changes)

- [ ] **Task 8: Add keyboard navigation** (AC: #4)
  - [ ] Listen for Escape key to close detail view
  - [ ] Optionally: arrow keys to navigate between prompts
  - [ ] Focus management for accessibility
  - [ ] Trap focus inside modal when open

- [ ] **Task 9: Fetch detailed analysis data** (AC: #1, #2)
  - [ ] Create `lib/hooks/use-prompt-detail.ts` hook
  - [ ] Fetch full prompt and analysis on detail open
  - [ ] Include dimension scores and suggestions
  - [ ] Use TanStack Query with `isPending`
  - [ ] Cache detail data for quick re-access (staleTime: 5 min)

- [ ] **Task 10: Create loading skeleton** (AC: #1, #2)
  - [ ] Create `components/feed/detail-skeleton.tsx` component
  - [ ] Match layout of actual content
  - [ ] Animate skeleton pulse effect

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- Next.js 15 with App Router
- TanStack Query 5.x - use `isPending` not `isLoading`
- shadcn/ui components (Sheet or Dialog)
- TypeScript strict mode

**The 5 Analysis Dimensions (from Architecture):**
1. **Clarity** - How clear and understandable is the prompt (weight: 25%)
2. **Context** - How much relevant context is provided (weight: 25%)
3. **Specificity** - How specific and detailed are the requirements (weight: 20%)
4. **Goal** - How well-defined is the desired outcome (weight: 15%)
5. **Constraints** - How well are constraints/boundaries specified (weight: 15%)

**Score Color Mapping:**
- Teal (#14b8a6 / `teal-500`): 7-10 (Good to Excellent)
- Amber (#f59e0b / `amber-500`): 4-6 (Needs Improvement)
- Coral (#f87171 / `red-400`): 1-3 (Poor)

### TypeScript Interfaces

```typescript
// Types for prompt detail data
interface DimensionScore {
  dimension_id: string;
  name: 'Clarity' | 'Context' | 'Specificity' | 'Goal' | 'Constraints';
  score: number;        // 1-10
  suggestion: string;   // Coaching-positive improvement suggestion
  weight: number;       // Percentage weight for overall score
}

interface PromptAnalysis {
  id: string;
  prompt_id: string;
  config_id: string;
  overall_score: number;
  dimension_scores: DimensionScore[];
  suggestions: string[];
  created_at: string;
}

interface PromptDetail {
  id: string;
  text: string;
  char_count: number;
  word_count: number;
  analysis_status: 'pending' | 'processing' | 'complete' | 'failed';
  analysis: PromptAnalysis | null;
  created_at: string;
}
```

### Prompt Detail Component

```typescript
// components/feed/prompt-detail.tsx
'use client';

import { useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DimensionBar } from './dimension-bar';
import { DetailSkeleton } from './detail-skeleton';
import { ScoreBadge } from './score-badge';
import { usePromptDetail } from '@/lib/hooks/use-prompt-detail';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PromptDetailProps {
  promptId: string | null;
  onClose: () => void;
}

export function PromptDetail({ promptId, onClose }: PromptDetailProps) {
  const { data: prompt, isPending, error } = usePromptDetail(promptId);

  // Handle Escape key - Sheet handles this natively, but explicit for clarity
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyPrompt = async () => {
    if (prompt?.text) {
      await navigator.clipboard.writeText(prompt.text);
      toast.success('Prompt copied to clipboard');
    }
  };

  return (
    <Sheet open={!!promptId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full sm:max-w-xl bg-[#0a0a0a] border-[#2a2a2a]"
        aria-describedby="prompt-detail-description"
      >
        <SheetHeader>
          <SheetTitle className="text-[#fafafa]">Prompt Analysis</SheetTitle>
        </SheetHeader>
        <p id="prompt-detail-description" className="sr-only">
          Detailed analysis of your prompt with scores and suggestions
        </p>

        {isPending ? (
          <DetailSkeleton />
        ) : error ? (
          <div className="mt-6 text-center">
            <p className="text-red-400">Failed to load prompt details</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </div>
        ) : prompt ? (
          <div className="mt-6 space-y-6">
            {/* Overall Score */}
            <div className="flex items-center justify-center">
              <div className="text-center">
                <ScoreBadge
                  score={prompt.analysis?.overall_score}
                  status={prompt.analysis_status}
                  size="lg"
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  {getScoreLabel(prompt.analysis?.overall_score)}
                </p>
              </div>
            </div>

            {/* Prompt Text */}
            <div className="rounded-lg bg-[#1a1a1a] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Prompt ({prompt.char_count?.toLocaleString()} chars)
                </span>
                <Button variant="ghost" size="sm" onClick={copyPrompt} aria-label="Copy prompt text">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-[#fafafa] whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                {prompt.text}
              </p>
            </div>

            {/* Dimension Breakdown */}
            {prompt.analysis?.dimension_scores && (
              <div className="space-y-4">
                <h3 className="font-medium text-[#fafafa]">Dimension Scores</h3>
                {prompt.analysis.dimension_scores.map((dim) => (
                  <DimensionBar
                    key={dim.dimension_id}
                    name={dim.name}
                    score={dim.score}
                    suggestion={dim.suggestion}
                    weight={dim.weight}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground mt-6">Prompt not found</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function getScoreLabel(score?: number): string {
  if (score === undefined || score === null) return '';
  if (score >= 9) return 'Excellent prompt!';
  if (score >= 7) return 'Great prompt!';
  if (score >= 5) return 'Good prompt with room to improve';
  if (score >= 3) return 'Consider adding more context';
  return 'Review the suggestions below';
}
```

### Dimension Bar Component

```typescript
// components/feed/dimension-bar.tsx
'use client';

import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DimensionBarProps {
  name: string;
  score: number;
  suggestion?: string;
  weight?: number;
}

const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  Clarity: 'How clear and understandable is the prompt',
  Context: 'How much relevant context is provided',
  Specificity: 'How specific and detailed are the requirements',
  Goal: 'How well-defined is the desired outcome',
  Constraints: 'How well are constraints and boundaries specified',
};

function getBarColor(score: number): string {
  if (score >= 7) return 'bg-teal-500';
  if (score >= 4) return 'bg-amber-500';
  return 'bg-red-400';
}

export function DimensionBar({ name, score, suggestion, weight }: DimensionBarProps) {
  const percentage = (score / 10) * 100;
  const description = DIMENSION_DESCRIPTIONS[name];

  return (
    <div className="space-y-2" role="group" aria-label={`${name} dimension score`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#fafafa]">{name}</span>
          {weight && (
            <span className="text-xs text-muted-foreground">({weight}%)</span>
          )}
          {description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button aria-label={`Info about ${name}`}>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <span
          className={cn(
            'text-sm font-bold',
            score >= 7 ? 'text-teal-500' : score >= 4 ? 'text-amber-500' : 'text-red-400'
          )}
          aria-label={`Score: ${score} out of 10`}
        >
          {score.toFixed(1)}
        </span>
      </div>

      {/* Progress Bar */}
      <div
        className="h-2 rounded-full bg-[#2a2a2a] overflow-hidden"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-label={`${name} score`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            getBarColor(score)
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Suggestion */}
      {suggestion && (
        <p className="text-xs text-muted-foreground italic pl-1">
          {suggestion}
        </p>
      )}
    </div>
  );
}
```

### Detail Skeleton Component

```typescript
// components/feed/detail-skeleton.tsx
'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function DetailSkeleton() {
  return (
    <div className="mt-6 space-y-6 animate-pulse">
      {/* Score skeleton */}
      <div className="flex justify-center">
        <Skeleton className="h-20 w-20 rounded-full" />
      </div>

      {/* Prompt text skeleton */}
      <div className="rounded-lg bg-[#1a1a1a] p-4 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-20 w-full" />
      </div>

      {/* Dimension bars skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-8" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### usePromptDetail Hook

```typescript
// lib/hooks/use-prompt-detail.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { PromptDetail } from '@/types';

export function usePromptDetail(promptId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['prompt-detail', promptId],
    queryFn: async (): Promise<PromptDetail | null> => {
      if (!promptId) return null;

      const { data, error } = await supabase
        .from('prompts')
        .select(`
          id,
          text,
          char_count,
          word_count,
          analysis_status,
          created_at,
          analysis:prompt_analyses(
            id,
            config_id,
            overall_score,
            dimension_scores,
            suggestions,
            created_at
          )
        `)
        .eq('id', promptId)
        .single();

      if (error) throw error;

      // Transform nested analysis array to single object
      return {
        ...data,
        analysis: data.analysis?.[0] || null,
      } as PromptDetail;
    },
    enabled: !!promptId,
    staleTime: 5 * 60 * 1000, // 5 minutes - analyses don't change
  });
}
```

### Scroll Position Preservation (Parent Component Integration)

```typescript
// In feed page or parent component - app/(dashboard)/prompts/page.tsx
'use client';

import { useRef, useCallback, useState } from 'react';
import { PromptDetail } from '@/components/feed/prompt-detail';

export function FeedPage() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  const openDetail = useCallback((promptId: string) => {
    // Store current scroll position
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
    setSelectedPromptId(promptId);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedPromptId(null);
    // Restore scroll position after render
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollPositionRef.current;
      }
    });
  }, []);

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto h-full">
      {/* Feed content - pass openDetail to PromptCard onClick */}
      <PromptDetail promptId={selectedPromptId} onClose={closeDetail} />
    </div>
  );
}
```

### Score Context Labels

| Score Range | Label | Color |
|-------------|-------|-------|
| 9-10 | "Excellent prompt!" | Teal |
| 7-8 | "Great prompt!" | Teal |
| 5-6 | "Good prompt with room to improve" | Amber |
| 3-4 | "Consider adding more context" | Amber |
| 1-2 | "Review the suggestions below" | Coral |

### Component File Locations

| Component | Path |
|-----------|------|
| Prompt Detail | `components/feed/prompt-detail.tsx` |
| Dimension Bar | `components/feed/dimension-bar.tsx` |
| Detail Skeleton | `components/feed/detail-skeleton.tsx` |
| usePromptDetail Hook | `lib/hooks/use-prompt-detail.ts` |

### shadcn/ui Components Required

```bash
npx shadcn@latest add sheet dialog tooltip skeleton
```

### Database Query

```sql
SELECT
  p.id,
  p.text,
  p.char_count,
  p.word_count,
  p.analysis_status,
  p.created_at,
  pa.id as analysis_id,
  pa.config_id,
  pa.overall_score,
  pa.dimension_scores,
  pa.suggestions,
  pa.created_at as analyzed_at
FROM prompts p
LEFT JOIN prompt_analyses pa ON pa.prompt_id = p.id
WHERE p.id = $prompt_id;
```

### Dependencies on Other Stories

- **Story 6.2** (Prompt Feed): Provides the feed that triggers detail view
- **Story 6.5** (Score Display): May share ScoreBadge component
- **Story 5.4** (Analysis Storage): Provides the `prompt_analyses` data structure

### Common Pitfalls to Avoid

1. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
2. **DO NOT** forget to handle Escape key for closing
3. **DO NOT** lose scroll position when returning to feed
4. **DO NOT** forget to trap focus in modal for accessibility
5. **DO NOT** hardcode dimension names - use the 5 from architecture
6. **DO NOT** forget loading skeleton for detail view
7. **DO NOT** forget error state handling
8. **DO NOT** forget ARIA attributes for accessibility

### Verification Checklist

After completing this story, verify:
- [ ] Clicking prompt opens detail view
- [ ] Full prompt text is displayed and scrollable
- [ ] Copy button copies prompt to clipboard
- [ ] Overall score is prominently displayed with correct color
- [ ] All 5 dimensions show with bars and scores
- [ ] Dimension bars animate on open
- [ ] Suggestions display below each dimension
- [ ] Suggestions use coaching-positive language
- [ ] Escape key closes detail view
- [ ] Close button works
- [ ] Backdrop click closes detail view
- [ ] Scroll position preserved when returning to feed
- [ ] Loading skeleton shows while fetching
- [ ] Error state displays when fetch fails
- [ ] Screen reader can navigate the component

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
