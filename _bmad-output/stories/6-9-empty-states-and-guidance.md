# Story 6.9: Empty States & Guidance

Epic: 6 - Dashboard, Feed & Analytics
Status: ✅ Done
FRs: FR67, FR68, FR74

## Story

**As a** user with no data,
**I want** helpful empty states,
**So that** I know how to get started.

## Acceptance Criteria

1. **Given** I have no projects
   **When** I view the Projects page
   **Then** I see "No projects yet" with a "Create Project" button

2. **Given** I have no prompts
   **When** I view the Feed
   **Then** I see "Waiting for your first prompt"
   **And** installation instructions with copy-paste CLI command

3. **Given** an analysis is pending
   **When** I view the prompt
   **Then** I see "Analyzing..." with a spinner
   **And** estimated time if available

4. **Given** an analysis failed
   **When** I view the prompt
   **Then** I see "Analysis failed" with option to retry

## Tasks / Subtasks

- [ ] **Task 1: Create empty state wrapper component** (AC: #1, #2)
  - [ ] Create `components/ui/empty-state.tsx`
  - [ ] Accept icon, title, description, and action props
  - [ ] Center content with appropriate spacing
  - [ ] Style with dark mode colors (#0a0a0a background)
  - [ ] Support optional illustration/graphic
  - [ ] Ensure WCAG AA color contrast (4.5:1 for text)
  - [ ] Add proper ARIA labels for accessibility

- [ ] **Task 2: Create empty projects state** (AC: #1)
  - [ ] Create `components/projects/empty-projects.tsx`
  - [ ] Display "No projects yet" message
  - [ ] Add folder icon illustration
  - [ ] Include "Create Project" primary button
  - [ ] Add brief description of what projects are for
  - [ ] Test keyboard navigation to Create button

- [ ] **Task 3: Create empty feed state** (AC: #2)
  - [ ] Create `components/feed/empty-feed.tsx`
  - [ ] Display "Waiting for your first prompt" message
  - [ ] Add visual illustration (e.g., inbox icon)
  - [ ] Explain what will appear once prompts are captured
  - [ ] Link to CLI installation instructions

- [ ] **Task 4: Create CLI install instructions component** (AC: #2)
  - [ ] Create `components/onboarding/cli-instructions.tsx`
  - [ ] Display `npx @contextor/cli init <TOKEN>` command
  - [ ] Add copy-to-clipboard button with keyboard support
  - [ ] Show success toast on copy using `sonner`
  - [ ] Include link to detailed documentation
  - [ ] Handle loading state while token generates

- [ ] **Task 5: Create install token generation server action** (AC: #2)
  - [ ] Create `lib/actions/generate-install-token.ts` server action
  - [ ] Generate token format: `ctx_<base64-encoded-payload>`
  - [ ] Include project_id, team_id, user_id, api_key, api_endpoint in payload
  - [ ] Implement time-limited expiry (e.g., 24 hours)
  - [ ] Verify user has access to the project before generating
  - [ ] Create `lib/hooks/use-install-token.ts` hook using TanStack Query

- [ ] **Task 6: Create analyzing state component** (AC: #3)
  - [ ] Create `components/feed/analyzing-state.tsx`
  - [ ] Display "Analyzing..." text with spinner
  - [ ] Show pulsing animation using Tailwind `animate-spin`
  - [ ] Display estimated time if available from backend
  - [ ] Apply muted styling to indicate in-progress

- [ ] **Task 7: Create analysis failed state component** (AC: #4)
  - [ ] Create `components/feed/analysis-failed.tsx`
  - [ ] Display "Analysis failed" error message
  - [ ] Show warning icon in coral/red color (red-400/red-500)
  - [ ] Include "Retry" button with loading state
  - [ ] Add "Learn more" link for common failure reasons

- [ ] **Task 8: Implement retry analysis server action** (AC: #4)
  - [ ] Create `lib/actions/retry-analysis.ts` server action
  - [ ] Verify user has access to the prompt via team_id
  - [ ] Reset prompt status to `pending` and retry_count to 0
  - [ ] Use `revalidatePath` to refresh dashboard data
  - [ ] Handle retry failures gracefully with toast notification

- [ ] **Task 9: Create empty team state** (AC: #1)
  - [ ] Create `components/team/empty-team.tsx`
  - [ ] Display "No team members yet" message
  - [ ] Add "Invite Members" button
  - [ ] Show for team admins only
  - [ ] Brief explanation of team benefits

- [ ] **Task 10: Create empty analytics state** (AC: #1, #2)
  - [ ] Create `components/analytics/empty-analytics.tsx`
  - [ ] Display "Not enough data yet" message
  - [ ] Show how many prompts needed for analytics (minimum 5)
  - [ ] Link to feed to see captured prompts
  - [ ] Encouraging message about building history

## Dev Notes

### Technology Stack Requirements

| Technology | Version | Key Notes |
|------------|---------|-----------|
| Next.js | 15 | App Router, Server Components default |
| TanStack Query | 5.x | Use `isPending` NOT `isLoading` |
| TypeScript | strict | No `any`, explicit null handling |
| Tailwind CSS | Latest | Dark mode: #0a0a0a background |
| shadcn/ui | Latest | Button, Badge components |
| sonner | Latest | Toast notifications |

### Analysis Status Values

```typescript
type AnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed';
```

### Empty State Wrapper Component

```typescript
// components/ui/empty-state.tsx
'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
      role="status"
      aria-label={title}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1a1a1a]">
        <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-medium text-[#fafafa]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && (
        <Button
          className="mt-6"
          onClick={action.onClick}
          asChild={!!action.href}
        >
          {action.href ? (
            <a href={action.href}>{action.label}</a>
          ) : (
            action.label
          )}
        </Button>
      )}
      {children && <div className="mt-6 w-full max-w-md">{children}</div>}
    </div>
  );
}
```

### Empty Projects State

```typescript
// components/projects/empty-projects.tsx
'use client';

import { FolderOpen } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function EmptyProjects() {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No projects yet"
      description="Projects help you organize prompts by codebase or application. Create your first project to get started."
      action={{
        label: 'Create Project',
        href: '/dashboard/projects/create',
      }}
    />
  );
}
```

### Empty Feed State with CLI Instructions

```typescript
// components/feed/empty-feed.tsx
'use client';

import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { CliInstructions } from '@/components/onboarding/cli-instructions';

interface EmptyFeedProps {
  projectId?: string;
}

export function EmptyFeed({ projectId }: EmptyFeedProps) {
  return (
    <EmptyState
      icon={Inbox}
      title="Waiting for your first prompt"
      description="Once you start using Claude with the Contextor CLI installed, your prompts will appear here with scores and insights."
    >
      <CliInstructions projectId={projectId} />
    </EmptyState>
  );
}
```

### CLI Instructions Component

```typescript
// components/onboarding/cli-instructions.tsx
'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useInstallToken } from '@/lib/hooks/use-install-token';

interface CliInstructionsProps {
  projectId?: string;
}

export function CliInstructions({ projectId }: CliInstructionsProps) {
  const [copied, setCopied] = useState(false);
  const { data: token, isPending } = useInstallToken(projectId);

  const command = `npx @contextor/cli init ${token ?? '<YOUR_TOKEN>'}`;

  const copyCommand = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    toast.success('Command copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <p className="text-sm text-muted-foreground mb-3">
        Run this command in your project directory:
      </p>

      <div className="flex items-center gap-2 rounded-md bg-[#0a0a0a] p-3 font-mono text-sm">
        {isPending ? (
          <div className="h-5 w-full animate-pulse rounded bg-[#2a2a2a]" />
        ) : (
          <>
            <code className="flex-1 text-teal-500 overflow-x-auto">
              {command}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyCommand}
              className="shrink-0"
              aria-label={copied ? 'Copied' : 'Copy command to clipboard'}
            >
              {copied ? (
                <Check className="h-4 w-4 text-teal-500" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </>
        )}
      </div>

      <a
        href="https://docs.contextor.com/cli"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#fafafa]"
      >
        View full documentation
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  );
}
```

### Install Token Hook

```typescript
// lib/hooks/use-install-token.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { generateInstallToken } from '@/lib/actions/generate-install-token';

export function useInstallToken(projectId?: string) {
  return useQuery({
    queryKey: ['install-token', projectId],
    queryFn: () => generateInstallToken(projectId),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

### Install Token Generation Server Action

```typescript
// lib/actions/generate-install-token.ts
'use server';

import { createClient } from '@/lib/supabase/server';

export async function generateInstallToken(projectId?: string): Promise<string> {
  const supabase = await createClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Get user's current team from JWT claims
  const teamId = user.user_metadata?.team_id;
  if (!teamId) {
    throw new Error('No team selected');
  }

  // If projectId provided, verify user has access
  if (projectId) {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, team_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project || project.team_id !== teamId) {
      throw new Error('Project not found or access denied');
    }
  }

  // Generate token payload
  const payload = {
    project_id: projectId,
    team_id: teamId,
    user_id: user.id,
    api_key: `sk_live_${crypto.randomUUID().replace(/-/g, '')}`,
    api_endpoint: process.env.NEXT_PUBLIC_API_URL || 'https://api.contextor.co',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };

  // Encode as base64
  const token = `ctx_${Buffer.from(JSON.stringify(payload)).toString('base64')}`;

  return token;
}
```

### Analyzing State Component

```typescript
// components/feed/analyzing-state.tsx
'use client';

import { Loader2 } from 'lucide-react';

interface AnalyzingStateProps {
  estimatedTime?: number; // seconds
}

export function AnalyzingState({ estimatedTime }: AnalyzingStateProps) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <div>
        <p className="text-sm">Analyzing...</p>
        {estimatedTime && (
          <p className="text-xs">
            Estimated time: ~{estimatedTime}s
          </p>
        )}
      </div>
    </div>
  );
}
```

### Analysis Failed State Component

```typescript
// components/feed/analysis-failed.tsx
'use client';

import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { retryAnalysis } from '@/lib/actions/retry-analysis';
import { toast } from 'sonner';

interface AnalysisFailedProps {
  promptId: string;
  errorMessage?: string;
}

export function AnalysisFailed({ promptId, errorMessage }: AnalysisFailedProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryAnalysis(promptId);
      toast.success('Analysis retry queued');
    } catch (error) {
      toast.error('Failed to retry analysis');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex items-center gap-3" role="alert">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
        <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-red-400">Analysis failed</p>
        {errorMessage && (
          <p className="text-xs text-muted-foreground">{errorMessage}</p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRetry}
        disabled={retrying}
        aria-label={retrying ? 'Retrying analysis' : 'Retry analysis'}
      >
        {retrying ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
            Retry
          </>
        )}
      </Button>
    </div>
  );
}
```

### Retry Analysis Server Action

```typescript
// lib/actions/retry-analysis.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function retryAnalysis(promptId: string) {
  const supabase = await createClient();

  // Verify user has access to this prompt via team
  const { data: prompt, error: fetchError } = await supabase
    .from('prompts')
    .select('id, team_id')
    .eq('id', promptId)
    .single();

  if (fetchError || !prompt) {
    throw new Error('Prompt not found');
  }

  // Reset status to pending
  const { error: updateError } = await supabase
    .from('prompts')
    .update({
      analysis_status: 'pending',
      retry_count: 0,
    })
    .eq('id', promptId);

  if (updateError) {
    throw new Error('Failed to reset analysis status');
  }

  // The Edge Function will pick up the pending prompt
  // and process it automatically via database trigger

  revalidatePath('/dashboard');
}
```

### Empty Analytics State

```typescript
// components/analytics/empty-analytics.tsx
'use client';

import { BarChart2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyAnalyticsProps {
  promptCount: number;
  minimumRequired?: number;
}

export function EmptyAnalytics({
  promptCount,
  minimumRequired = 5,
}: EmptyAnalyticsProps) {
  const remaining = minimumRequired - promptCount;

  return (
    <EmptyState
      icon={BarChart2}
      title="Not enough data yet"
      description={
        promptCount === 0
          ? 'Start capturing prompts to build your analytics history.'
          : `You need ${remaining} more prompt${remaining === 1 ? '' : 's'} to see trends and analytics.`
      }
      action={{
        label: 'View Feed',
        href: '/dashboard',
      }}
    />
  );
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Empty State Wrapper | `components/ui/empty-state.tsx` |
| Empty Projects | `components/projects/empty-projects.tsx` |
| Empty Feed | `components/feed/empty-feed.tsx` |
| CLI Instructions | `components/onboarding/cli-instructions.tsx` |
| Analyzing State | `components/feed/analyzing-state.tsx` |
| Analysis Failed | `components/feed/analysis-failed.tsx` |
| Empty Team | `components/team/empty-team.tsx` |
| Empty Analytics | `components/analytics/empty-analytics.tsx` |
| Retry Analysis Action | `lib/actions/retry-analysis.ts` |
| Generate Token Action | `lib/actions/generate-install-token.ts` |
| useInstallToken Hook | `lib/hooks/use-install-token.ts` |

### Empty State Triggers

| Page | Condition | Component |
|------|-----------|-----------|
| Projects | No projects in team | EmptyProjects |
| Feed | No prompts for user | EmptyFeed |
| Analytics | Less than 5 prompts | EmptyAnalytics |
| Team | No team members (admin only) | EmptyTeam |

### Analysis Status Display

| Status | Display | Component |
|--------|---------|-----------|
| pending | "Queued" + clock | AnalyzingState |
| processing | "Analyzing..." + spinner | AnalyzingState |
| complete | Score badge | ScoreBadge (from Story 6.5) |
| failed | "Failed" + retry | AnalysisFailed |

### Responsive Design Notes

- Desktop (1024px+): Centered empty states with max-w-md
- Tablet: Same layout, slightly reduced padding
- Mobile (<768px): Full-width with 16px horizontal padding
- All empty states stack vertically on mobile

### Accessibility Requirements

- All empty states must have `role="status"` or `role="alert"` (for errors)
- Icon decorations use `aria-hidden="true"`
- Action buttons have clear `aria-label` attributes
- Color contrast meets WCAG AA (4.5:1 for text)
- Keyboard navigation works for all interactive elements

### Common Pitfalls to Avoid

1. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
2. **DO NOT** show generic "No data" - provide actionable guidance
3. **DO NOT** forget to handle loading states in CLI instructions
4. **DO NOT** allow unlimited retries - analysis has max 3 retries (handled by Edge Function)
5. **DO NOT** expose install tokens publicly - they contain API keys
6. **DO NOT** forget to revalidate after retry action
7. **DO NOT** forget `Loader2` import when using spinner

### Verification Checklist

After completing this story, verify:
- [ ] Empty projects page shows "No projects yet" with create button
- [ ] Empty feed shows "Waiting for first prompt" with CLI instructions
- [ ] CLI command is copy-able and shows success toast
- [ ] Install token is generated correctly with 24-hour expiry
- [ ] Analyzing state shows spinner and estimated time
- [ ] Failed analysis shows error with retry button
- [ ] Retry button works and shows loading state
- [ ] Empty analytics shows prompt count needed
- [ ] All empty states use consistent styling
- [ ] All empty states have actionable next steps
- [ ] Mobile responsive layouts work
- [ ] Keyboard navigation works for all components
- [ ] Screen readers announce status changes correctly

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
