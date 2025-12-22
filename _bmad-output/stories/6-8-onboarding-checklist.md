# Story 6.8: Onboarding Checklist

Status: ✅ Done

## Story

**As a** new user,
**I want** to see a setup checklist,
**So that** I know what steps remain to start using Contextor.

## Acceptance Criteria

1. **Given** I am a new user
   **When** I first access the dashboard
   **Then** I see an onboarding checklist with steps: Create Team, Create Project, Install CLI, Capture First Prompt

2. **Given** a checklist step is completed
   **When** the system detects completion
   **Then** the step is marked with a checkmark
   **And** progress indicator updates

3. **Given** all steps are complete
   **When** I dismiss the checklist
   **Then** it disappears and doesn't return
   **And** a congratulatory message is shown

## Tasks / Subtasks

- [ ] **Task 1: Create onboarding checklist component** (AC: #1)
  - [ ] Create `components/onboarding/onboarding-checklist.tsx`
  - [ ] Display 4 steps with icons and labels:
    - Create Team
    - Create Project
    - Install CLI
    - Capture First Prompt
  - [ ] Style with dark mode colors (#0a0a0a background, #1a1a1a cards)
  - [ ] Position on dashboard (card or floating panel)
  - [ ] Add progress indicator (e.g., "2 of 4 complete")
  - [ ] Add ARIA labels for screen reader accessibility

- [ ] **Task 2: Create useOnboardingStatus hook** (AC: #1, #2)
  - [ ] Create `lib/hooks/use-onboarding-status.ts`
  - [ ] Detect team creation: check `team_members` table
  - [ ] Detect project creation: check `projects` table
  - [ ] Detect CLI installation: check for project with captured prompts
  - [ ] Detect first prompt: check `prompts` table for current user
  - [ ] Use TanStack Query with `isPending` (NOT `isLoading`)

- [ ] **Task 3: Implement step completion detection** (AC: #2)
  - [ ] Create `lib/utils/onboarding-steps.ts` with detection logic
  - [ ] Check team membership for "Create Team"
  - [ ] Check projects existence for "Create Project"
  - [ ] Check prompt count > 0 for "Install CLI" and "Capture First Prompt"
  - [ ] Return boolean for each step

- [ ] **Task 4: Create step item component** (AC: #1, #2)
  - [ ] Create `components/onboarding/step-item.tsx`
  - [ ] Display step icon, label, and status
  - [ ] Show checkmark when complete (teal-500)
  - [ ] Show empty circle when pending (gray border)
  - [ ] Add link/button to complete action
  - [ ] Subtle animation on completion
  - [ ] Support keyboard navigation (Tab, Enter)

- [ ] **Task 5: Create progress indicator** (AC: #2)
  - [ ] Create `components/onboarding/progress-indicator.tsx`
  - [ ] Display "X of 4 complete" text
  - [ ] Add visual progress bar
  - [ ] Apply color based on progress (teal-500 gradient)
  - [ ] Animate on progress change

- [ ] **Task 6: Implement checklist dismissal** (AC: #3)
  - [ ] Add dismiss button (X or "Got it!" button)
  - [ ] Store dismissal in localStorage with hydration-safe pattern
  - [ ] Check dismissal state before rendering checklist
  - [ ] Handle SSR/hydration mismatch with mounted state

- [ ] **Task 7: Show congratulatory message** (AC: #3)
  - [ ] Create `components/onboarding/celebration-message.tsx`
  - [ ] Display "You're all set!" message
  - [ ] Show brief summary of next steps
  - [ ] Auto-hide after 10 seconds or on click
  - [ ] Use teal accent styling

- [ ] **Task 8: Integrate with dashboard layout** (AC: #1)
  - [ ] Check if user is new (first login or no prompts)
  - [ ] Render checklist in dashboard when appropriate
  - [ ] Position above feed or as side panel
  - [ ] Handle responsive layout (mobile: full width, desktop: card)

- [ ] **Task 9: Create step action buttons** (AC: #1)
  - [ ] Add "Create Team" button linking to `/dashboard/team/create`
  - [ ] Add "Create Project" button linking to `/dashboard/projects/create`
  - [ ] Add "Install CLI" button triggering install modal
  - [ ] Create `components/onboarding/install-cli-modal.tsx` for CLI instructions
  - [ ] Add "View Feed" button for last step (passive)

- [ ] **Task 10: Subscribe to real-time completion updates** (AC: #2)
  - [ ] Use Supabase Realtime to detect new team/project/prompt
  - [ ] Invalidate TanStack Query cache on real-time events
  - [ ] Update checklist immediately when step completes
  - [ ] Smooth transition animations
  - [ ] Clean up subscriptions on unmount

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- TanStack Query 5.x - use `isPending` not `isLoading`
- Supabase Realtime for live updates
- localStorage for dismissal state (with hydration safety)
- TypeScript strict mode
- Next.js 15 App Router

**Database Tables Used:**
- `team_members` - Check user team membership
- `projects` - Check team projects (filtered by RLS)
- `prompts` - Check captured prompts (filtered by RLS)

### Component File Locations

| Component | Path |
|-----------|------|
| Onboarding Checklist | `components/onboarding/onboarding-checklist.tsx` |
| Step Item | `components/onboarding/step-item.tsx` |
| Progress Indicator | `components/onboarding/progress-indicator.tsx` |
| Celebration Message | `components/onboarding/celebration-message.tsx` |
| Install CLI Modal | `components/onboarding/install-cli-modal.tsx` |
| Checklist Skeleton | `components/onboarding/onboarding-checklist-skeleton.tsx` |
| useOnboardingStatus | `lib/hooks/use-onboarding-status.ts` |
| useOnboardingDismissed | `lib/hooks/use-onboarding-dismissed.ts` |
| Onboarding utils | `lib/utils/onboarding-steps.ts` |

### Onboarding Steps Detection Logic

| Step | Detection Logic | Action |
|------|----------------|--------|
| Create Team | `team_members` has entry for user | Link to team creation |
| Create Project | `projects` has entry for team | Link to project creation |
| Install CLI | User has at least 1 prompt | Show install command modal |
| Capture First Prompt | User has at least 1 prompt | Passive (automatic) |

### Onboarding Checklist Component

```typescript
// components/onboarding/onboarding-checklist.tsx
'use client';

import { useOnboardingStatus } from '@/lib/hooks/use-onboarding-status';
import { StepItem } from './step-item';
import { ProgressIndicator } from './progress-indicator';
import { OnboardingChecklistSkeleton } from './onboarding-checklist-skeleton';
import { CelebrationMessage } from './celebration-message';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Users, FolderOpen, Terminal, MessageSquare } from 'lucide-react';

interface OnboardingChecklistProps {
  onDismiss: () => void;
}

const STEPS = [
  { id: 'create-team', label: 'Create your team', icon: Users, href: '/dashboard/team/create' },
  { id: 'create-project', label: 'Create a project', icon: FolderOpen, href: '/dashboard/projects/create' },
  { id: 'install-cli', label: 'Install CLI in your project', icon: Terminal, action: 'showInstall' },
  { id: 'capture-prompt', label: 'Capture your first prompt', icon: MessageSquare, passive: true },
] as const;

export function OnboardingChecklist({ onDismiss }: OnboardingChecklistProps) {
  const { data: status, isPending } = useOnboardingStatus();

  if (isPending) {
    return <OnboardingChecklistSkeleton />;
  }

  const completedCount = status
    ? Object.values(status).filter(Boolean).length
    : 0;

  const allComplete = completedCount === STEPS.length;

  if (allComplete) {
    return <CelebrationMessage onDismiss={onDismiss} />;
  }

  return (
    <div
      className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4"
      role="region"
      aria-label="Setup checklist"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-[#fafafa]">Get Started</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          aria-label="Dismiss checklist"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ProgressIndicator completed={completedCount} total={STEPS.length} />

      <div className="mt-4 space-y-2" role="list">
        {STEPS.map((step) => (
          <StepItem
            key={step.id}
            icon={step.icon}
            label={step.label}
            completed={status?.[step.id as keyof typeof status] ?? false}
            href={step.href}
            action={step.action}
          />
        ))}
      </div>
    </div>
  );
}
```

### Onboarding Status Hook

```typescript
// lib/hooks/use-onboarding-status.ts
'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useEffect } from 'react';

interface OnboardingStatus {
  'create-team': boolean;
  'create-project': boolean;
  'install-cli': boolean;
  'capture-prompt': boolean;
}

export function useOnboardingStatus() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('onboarding-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_members' },
        () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'projects' },
        () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prompts' },
        () => queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  return useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async (): Promise<OnboardingStatus> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check team membership
      const { data: teams } = await supabase
        .from('team_members')
        .select('id, team_id')
        .eq('user_id', user.id)
        .limit(1);

      const hasTeam = (teams?.length ?? 0) > 0;
      const teamId = teams?.[0]?.team_id ?? null;

      // Check projects (RLS filters by team_id from JWT)
      let hasProject = false;
      if (teamId) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('team_id', teamId)
          .limit(1);
        hasProject = (projects?.length ?? 0) > 0;
      }

      // Check for prompts (indicates CLI is installed and working)
      const { data: prompts } = await supabase
        .from('prompts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const hasCapturedPrompt = (prompts?.length ?? 0) > 0;

      return {
        'create-team': hasTeam,
        'create-project': hasProject,
        'install-cli': hasCapturedPrompt,
        'capture-prompt': hasCapturedPrompt,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
```

### Step Item Component

```typescript
// components/onboarding/step-item.tsx
'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StepItemProps {
  icon: LucideIcon;
  label: string;
  completed: boolean;
  href?: string;
  action?: string;
}

export function StepItem({ icon: Icon, label, completed, href, action }: StepItemProps) {
  const content = (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-md transition-colors',
        completed
          ? 'text-muted-foreground'
          : 'text-[#fafafa] hover:bg-[#2a2a2a] cursor-pointer'
      )}
      role="listitem"
      aria-label={`${label} - ${completed ? 'completed' : 'pending'}`}
    >
      <div className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full',
        completed
          ? 'bg-teal-500'
          : 'border border-[#3a3a3a]'
      )}>
        {completed ? (
          <Check className="h-4 w-4 text-white" aria-hidden="true" />
        ) : (
          <Icon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <span className={cn(
        'text-sm',
        completed && 'line-through'
      )}>
        {label}
      </span>
    </div>
  );

  if (href && !completed) {
    return (
      <Link href={href} tabIndex={0}>
        {content}
      </Link>
    );
  }

  return content;
}
```

### Progress Indicator Component

```typescript
// components/onboarding/progress-indicator.tsx
'use client';

interface ProgressIndicatorProps {
  completed: number;
  total: number;
}

export function ProgressIndicator({ completed, total }: ProgressIndicatorProps) {
  const percentage = (completed / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="text-teal-500 font-medium" aria-live="polite">
          {completed} of {total}
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-[#2a2a2a] overflow-hidden"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Setup progress: ${completed} of ${total} steps complete`}
      >
        <div
          className="h-full rounded-full bg-teal-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

### Celebration Message Component

```typescript
// components/onboarding/celebration-message.tsx
'use client';

import { useEffect } from 'react';
import { PartyPopper, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CelebrationMessageProps {
  onDismiss: () => void;
}

export function CelebrationMessage({ onDismiss }: CelebrationMessageProps) {
  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 10000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-4"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-teal-500" aria-hidden="true" />
          <h3 className="font-medium text-teal-500">You're all set!</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          aria-label="Dismiss celebration message"
        >
          <X className="h-4 w-4 text-teal-500" />
        </Button>
      </div>
      <p className="text-sm text-teal-100">
        Your prompts will now be captured and analyzed automatically.
        Check your feed to see your scores and improve your prompting skills!
      </p>
    </div>
  );
}
```

### Dismissal State Management (Hydration-Safe)

```typescript
// lib/hooks/use-onboarding-dismissed.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'contextor-onboarding-dismissed';

export function useOnboardingDismissed() {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only access localStorage after hydration
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    setDismissed(stored === 'true');
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  }, []);

  // Return not dismissed during SSR to avoid hydration mismatch
  return {
    dismissed: mounted ? dismissed : false,
    dismiss,
    loaded: mounted
  };
}
```

### Checklist Skeleton Component

```typescript
// components/onboarding/onboarding-checklist-skeleton.tsx
'use client';

export function OnboardingChecklistSkeleton() {
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-24 bg-[#2a2a2a] rounded" />
        <div className="h-6 w-6 bg-[#2a2a2a] rounded" />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <div className="h-4 w-16 bg-[#2a2a2a] rounded" />
          <div className="h-4 w-12 bg-[#2a2a2a] rounded" />
        </div>
        <div className="h-2 bg-[#2a2a2a] rounded-full" />
      </div>

      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="h-6 w-6 bg-[#2a2a2a] rounded-full" />
            <div className="h-4 flex-1 bg-[#2a2a2a] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Install CLI Modal Component

```typescript
// components/onboarding/install-cli-modal.tsx
'use client';

import { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface InstallCliModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installToken?: string;
}

export function InstallCliModal({ open, onOpenChange, installToken }: InstallCliModalProps) {
  const [copied, setCopied] = useState(false);

  const installCommand = `npx @contextor/cli init ${installToken || '<YOUR_INSTALL_TOKEN>'}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#fafafa]">
            <Terminal className="h-5 w-5" />
            Install Contextor CLI
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Run this command in your project directory to start capturing prompts.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="relative">
            <pre className="p-4 bg-[#0a0a0a] rounded-lg text-sm text-[#fafafa] overflow-x-auto">
              <code>{installCommand}</code>
            </pre>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleCopy}
              aria-label={copied ? 'Copied!' : 'Copy command'}
            >
              {copied ? (
                <Check className="h-4 w-4 text-teal-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            After running this command, your prompts will automatically appear in your dashboard.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Dashboard Integration Example

```typescript
// app/(dashboard)/prompts/page.tsx - Integration pattern
'use client';

import { useOnboardingDismissed } from '@/lib/hooks/use-onboarding-dismissed';
import { OnboardingChecklist } from '@/components/onboarding/onboarding-checklist';

export default function PromptsPage() {
  const { dismissed, dismiss, loaded } = useOnboardingDismissed();

  return (
    <div className="space-y-6">
      {/* Only render checklist after hydration and if not dismissed */}
      {loaded && !dismissed && (
        <OnboardingChecklist onDismiss={dismiss} />
      )}

      {/* Rest of the page content */}
    </div>
  );
}
```

### Common Pitfalls to Avoid

1. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
2. **DO NOT** show checklist to users who have already dismissed it
3. **DO NOT** forget to handle the case where user has prompts but no team (edge case)
4. **DO NOT** make the checklist intrusive - it should help, not block
5. **DO NOT** forget real-time updates when steps complete
6. **DO NOT** forget to store dismissal state
7. **DO NOT** access localStorage before hydration (causes mismatch errors)
8. **DO NOT** forget to clean up Supabase Realtime subscriptions on unmount
9. **DO NOT** forget ARIA labels for accessibility

### Verification Checklist

After completing this story, verify:
- [ ] New users see onboarding checklist on dashboard
- [ ] Checklist shows 4 steps with correct labels
- [ ] Progress indicator shows X of 4 complete
- [ ] Completed steps show green checkmark
- [ ] Pending steps are clickable with appropriate actions
- [ ] Step completion updates in real-time
- [ ] All steps complete shows celebration message
- [ ] Dismiss button hides checklist
- [ ] Dismissed checklist does not return
- [ ] Returning users with all steps complete see no checklist
- [ ] Mobile responsive layout works
- [ ] No hydration mismatch errors in console
- [ ] Keyboard navigation works (Tab through steps)
- [ ] Screen reader announces progress correctly

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
