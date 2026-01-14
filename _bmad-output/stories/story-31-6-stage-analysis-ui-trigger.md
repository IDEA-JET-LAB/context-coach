# Story 31-6: Stage Analysis UI Trigger

## Story Info
- **Epic:** 31 - Project Stage Analytics
- **Priority:** P1
- **Points:** 2
- **Status:** Done

## Description

Add button to conversations view to trigger stage analysis for a project. This provides the user-facing entry point to run stage detection on demand.

## Acceptance Criteria

- [x] Add "Analyze Stages" button to project conversations page header
- [x] Show processing state while analysis runs (spinner, progress)
- [x] Show success/error feedback via toast
- [x] Disable button while analysis in progress
- [x] Show "Last analyzed: X" timestamp when available
- [x] Refresh conversation list after analysis completes

## Technical Details

### Component Location

The button should be added to the conversations page header, near the existing filters.

```
┌─────────────────────────────────────────────────────────────────┐
│ Conversations                              [Analyze Stages ▼]   │
│ Last analyzed: 5 min ago                   [Filters...]         │
├─────────────────────────────────────────────────────────────────┤
│ ...conversation list...                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Component

```typescript
// components/conversations/StageAnalysisButton.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";

interface StageAnalysisButtonProps {
  projectId: string;
  lastAnalyzedAt: string | null;
  onAnalysisComplete?: () => void;
}

export function StageAnalysisButton({
  projectId,
  lastAnalyzedAt,
  onAnalysisComplete,
}: StageAnalysisButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    processed: number;
  } | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setProgress(null);

    try {
      // Trigger analysis
      const response = await fetch(`/api/projects/${projectId}/analyze-stages`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      const data = result.data;

      toast({
        title: "Stage Analysis Complete",
        description: `Analyzed ${data.processedSessions} sessions, ${data.totalPrompts} prompts`,
        duration: 5000,
      });

      // Trigger refresh
      onAnalysisComplete?.();

    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsAnalyzing(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Last analyzed timestamp */}
      {lastAnalyzedAt && !isAnalyzing && (
        <span className="text-xs text-muted-foreground">
          Last analyzed: {formatDistanceToNow(new Date(lastAnalyzedAt), { addSuffix: true })}
        </span>
      )}

      {/* Progress indicator */}
      {isAnalyzing && progress && (
        <span className="text-xs text-muted-foreground">
          {progress.processed} / {progress.total} sessions
        </span>
      )}

      {/* Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        className="gap-2"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <BarChart3 className="h-4 w-4" />
            Analyze Stages
          </>
        )}
      </Button>
    </div>
  );
}
```

### Integration with Conversations Page

```typescript
// In app/(dashboard)/conversations/page.tsx or ConversationsPageClient.tsx

import { StageAnalysisButton } from "@/components/conversations/StageAnalysisButton";

// In the header section:
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-bold">Conversations</h1>
  <div className="flex items-center gap-4">
    <StageAnalysisButton
      projectId={currentProjectId}
      lastAnalyzedAt={stageAnalysisStatus?.lastAnalyzedAt}
      onAnalysisComplete={() => {
        // Refetch conversations to show updated stage badges
        refetchConversations();
      }}
    />
    {/* Existing filters */}
  </div>
</div>
```

### Hook for Analysis Status

```typescript
// lib/hooks/use-stage-analysis-status.ts

import { useQuery } from '@tanstack/react-query';

interface StageAnalysisStatus {
  totalSessions: number;
  analyzedSessions: number;
  pendingSessions: number;
  lastAnalyzedAt: string | null;
}

export function useStageAnalysisStatus(projectId: string) {
  return useQuery<StageAnalysisStatus>({
    queryKey: ['stage-analysis-status', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/analyze-stages`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const json = await response.json();
      return json.data;
    },
    staleTime: 60_000, // 1 minute
  });
}
```

## UI States

1. **Idle**: Button shows "Analyze Stages" with chart icon
2. **Processing**: Button disabled, shows spinner and "Analyzing..."
3. **Success**: Toast notification with summary, button returns to idle
4. **Error**: Toast notification with error, button returns to idle

## Tests

### Component Tests

```typescript
describe('StageAnalysisButton', () => {
  it('should render with "Analyze Stages" label');
  it('should show last analyzed timestamp when available');
  it('should disable button while analyzing');
  it('should show spinner during analysis');
  it('should call onAnalysisComplete after success');
  it('should show error toast on failure');
});
```

### E2E Tests

```typescript
describe('Stage Analysis UI', () => {
  it('should trigger analysis when button clicked');
  it('should show progress during analysis');
  it('should refresh conversation list after analysis');
});
```

## Dependencies

- Story 31-2: Stage Persistence (POST API endpoint)
- Story 31-5: Project Stage API (GET status endpoint)

## Definition of Done

- [x] Button component implemented
- [x] Integration with conversations page
- [x] Loading states working
- [x] Success/error feedback via toast
- [x] Refresh after completion
- [x] Component tests passing
- [x] E2E test passing
