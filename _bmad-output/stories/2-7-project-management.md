# Story 2.7: Project Management

Status: ✅ Done

## Story

**As a** team admin,
**I want** to manage project settings and API keys,
**So that** I can maintain security and update project information.

## Acceptance Criteria

1. **Given** I am a team admin viewing a project
   **When** I click "Regenerate API Key"
   **Then** I see a warning "This will invalidate the current key"
   **And** upon confirmation, a new API key is generated
   **And** the old key immediately stops working
   **And** I see the new key (displayed once)

2. **Given** I update the project name or description
   **When** I save changes
   **Then** the `projects` row is updated
   **And** I see a success toast

3. **Given** I click "Archive Project"
   **When** I confirm the action
   **Then** the project is soft-deleted (archived flag)
   **And** it no longer appears in the active projects list
   **And** its API key stops working
   **And** historical data remains accessible (read-only)

4. **Given** I am a regular team member
   **When** I view a project
   **Then** I can see project details and installation instructions
   **And** I cannot regenerate keys or archive the project

## Tasks / Subtasks

- [ ] **Task 1: Create project settings page** (AC: #2, #4)
  - [ ] Create `app/(dashboard)/projects/[projectId]/settings/page.tsx`
  - [ ] Server component to fetch project and user role
  - [ ] Display project info (name, description, created date)
  - [ ] Show settings form for admins, read-only for members
  - [ ] Tabs: General, API Keys, Danger Zone (archive)
  - [ ] Add loading skeleton while fetching data
  - [ ] Handle error state with user-friendly message

- [ ] **Task 2: Create project settings form component** (AC: #2)
  - [ ] Create `components/projects/project-settings-form.tsx`
  - [ ] Form fields:
    - Project name (required, max 100 chars)
    - Description (optional, textarea)
  - [ ] Use react-hook-form + Zod validation
  - [ ] Disable inputs for non-admin users
  - [ ] Save button with loading state
  - [ ] Add aria-label attributes for accessibility
  - [ ] Support form submission via Enter key

- [ ] **Task 3: Create update project API endpoint** (AC: #2)
  - [ ] Create `app/api/projects/[projectId]/route.ts`
  - [ ] GET handler to fetch project details
  - [ ] PATCH handler to update project:
    - Validate user is team admin
    - Update name and description
    - Return updated project
  - [ ] Return proper error codes (401, 403, 404, 400)
  - [ ] Await params in Next.js 15 dynamic routes

- [ ] **Task 4: Create regenerate API key endpoint** (AC: #1)
  - [ ] Create `app/api/projects/[projectId]/regenerate-key/route.ts`
  - [ ] POST handler:
    - Validate user is team admin
    - Generate new API key
    - Hash and store new key
    - Update api_key_prefix
    - Return new key (shown once) and new Install Token
  - [ ] Old key immediately invalid (hash changed)
  - [ ] Await params in Next.js 15 dynamic routes

- [ ] **Task 5: Create regenerate key UI component** (AC: #1)
  - [ ] Create `components/projects/regenerate-key-dialog.tsx`
  - [ ] Warning message: "This will invalidate the current key"
  - [ ] Explain impact: CLI installations will stop working
  - [ ] Confirm and Cancel buttons
  - [ ] On success, show new key with copy button
  - [ ] Warning: "Save your API key now - it won't be shown again"
  - [ ] Add error state handling for failed regeneration
  - [ ] Support keyboard navigation (Escape to close)

- [ ] **Task 6: Create archive project endpoint** (AC: #3)
  - [ ] Create `app/api/projects/[projectId]/archive/route.ts`
  - [ ] POST handler:
    - Validate user is team admin
    - Set is_archived = true
    - Set api_key_hash to null (invalidates key)
    - Return success
  - [ ] Await params in Next.js 15 dynamic routes

- [ ] **Task 7: Create archive project UI component** (AC: #3)
  - [ ] Create `components/projects/archive-project-dialog.tsx`
  - [ ] Warning message: "This will archive the project and invalidate its API key"
  - [ ] Explain: "Historical data will remain accessible"
  - [ ] Require typing project name to confirm
  - [ ] On success, redirect to projects list
  - [ ] Support keyboard navigation (Escape to close)

- [ ] **Task 8: Create update project mutation hook** (AC: #2)
  - [ ] Create `lib/hooks/use-update-project.ts`
  - [ ] Use TanStack Query `useMutation`
  - [ ] Invalidate project queries on success
  - [ ] Show success toast
  - [ ] Use `isPending` not `isLoading`

- [ ] **Task 9: Create regenerate key mutation hook** (AC: #1)
  - [ ] Create `lib/hooks/use-regenerate-key.ts`
  - [ ] Use TanStack Query `useMutation`
  - [ ] On success, return new key data for display
  - [ ] Invalidate project queries
  - [ ] Handle error with toast notification

- [ ] **Task 10: Create archive project mutation hook** (AC: #3)
  - [ ] Create `lib/hooks/use-archive-project.ts`
  - [ ] Use TanStack Query `useMutation`
  - [ ] On success, redirect to projects list
  - [ ] Invalidate projects list query

- [ ] **Task 11: Implement role-based UI visibility** (AC: #4)
  - [ ] Pass user role to all settings components
  - [ ] Hide "Regenerate Key" button for non-admins
  - [ ] Hide "Archive Project" section for non-admins
  - [ ] Show read-only view of settings for non-admins
  - [ ] Show installation instructions for all members
  - [ ] Add visual indicator for read-only mode

- [ ] **Task 12: Add database migration for archive support**
  - [ ] Add `is_archived` boolean column to projects table (default false)
  - [ ] Add index on `is_archived` for query performance
  - [ ] Update RLS policies to filter archived projects by default

## Dev Notes

### Critical Architecture Constraints

**Technology Stack:**
- Next.js 15 with App Router (params must be awaited)
- Supabase with mandatory RLS
- TanStack Query 5.x (`isPending` not `isLoading`)

**Security Requirements:**
- Only admins can regenerate keys or archive projects
- Regenerated key shown only once
- Archived projects have invalidated API keys

**Supabase Client Usage:**
- Server Components: `lib/supabase/server.ts` (createServerClient with cookies)
- Client Components: `lib/supabase/client.ts` (createBrowserClient)
- API Routes: `lib/supabase/server.ts`

### Database Migration

```sql
-- Add archive support to projects table
ALTER TABLE projects ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;

-- Index for efficient filtering
CREATE INDEX idx_projects_archived ON projects(team_id, is_archived);

-- Update RLS policy to exclude archived by default
CREATE POLICY projects_active_only ON projects
  FOR SELECT USING (
    team_id = (auth.jwt() ->> 'team_id')::uuid
    AND (is_archived = FALSE OR is_archived IS NULL)
  );
```

### Update Project API

```typescript
// app/api/projects/[projectId]/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId } = await params;

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { project } });
  } catch (error) {
    console.error('[API] projects/[projectId] GET:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId } = await params;
    const body = await request.json();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const validated = updateProjectSchema.parse(body);

    // Get project to verify team access
    const { data: project } = await supabase
      .from('projects')
      .select('team_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Check if user is admin
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only admins can update projects' } },
        { status: 403 }
      );
    }

    // Update project
    const { data: updated, error } = await supabase
      .from('projects')
      .update({
        name: validated.name.trim(),
        description: validated.description?.trim() || null,
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { project: updated } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } },
        { status: 400 }
      );
    }
    console.error('[API] projects/[projectId] PATCH:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### Regenerate Key API

```typescript
// app/api/projects/[projectId]/regenerate-key/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateApiKey, hashApiKey, getApiKeyPrefix } from '@/lib/utils/api-key';
import { generateInstallToken } from '@/lib/utils/install-token';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId } = await params;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Get project to verify team access
    const { data: project } = await supabase
      .from('projects')
      .select('team_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Check if user is admin
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only admins can regenerate keys' } },
        { status: 403 }
      );
    }

    // Generate new API key
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const apiKeyPrefix = getApiKeyPrefix(apiKey);

    // Update project with new key
    const { data: updated, error } = await supabase
      .from('projects')
      .update({
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: 'REGENERATE_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    // Generate new Install Token
    const installToken = generateInstallToken({
      project_id: projectId,
      team_id: project.team_id,
      user_id: user.id,
      api_key: apiKey,
      api_endpoint: process.env.NEXT_PUBLIC_API_URL || '',
    });

    return NextResponse.json({
      data: {
        project: updated,
        apiKey, // Only returned once
        installToken,
      }
    });
  } catch (error) {
    console.error('[API] projects/[projectId]/regenerate-key:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### Archive Project API

```typescript
// app/api/projects/[projectId]/archive/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const supabase = await createClient();
    const { projectId } = await params;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Get project to verify team access
    const { data: project } = await supabase
      .from('projects')
      .select('team_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Check if user is admin
    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', project.team_id)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only admins can archive projects' } },
        { status: 403 }
      );
    }

    // Archive project and invalidate API key
    const { error } = await supabase
      .from('projects')
      .update({
        is_archived: true,
        api_key_hash: null, // Invalidates key
      })
      .eq('id', projectId);

    if (error) {
      return NextResponse.json(
        { error: { code: 'ARCHIVE_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('[API] projects/[projectId]/archive:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Project Settings Page | `app/(dashboard)/projects/[projectId]/settings/page.tsx` |
| Project Settings Form | `components/projects/project-settings-form.tsx` |
| Regenerate Key Dialog | `components/projects/regenerate-key-dialog.tsx` |
| Archive Project Dialog | `components/projects/archive-project-dialog.tsx` |
| Update Project Hook | `lib/hooks/use-update-project.ts` |
| Regenerate Key Hook | `lib/hooks/use-regenerate-key.ts` |
| Archive Project Hook | `lib/hooks/use-archive-project.ts` |
| Update Project API | `app/api/projects/[projectId]/route.ts` |
| Regenerate Key API | `app/api/projects/[projectId]/regenerate-key/route.ts` |
| Archive Project API | `app/api/projects/[projectId]/archive/route.ts` |

### Regenerate Key Dialog Component

```typescript
// components/projects/regenerate-key-dialog.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Copy, Check, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useRegenerateKey } from '@/lib/hooks/use-regenerate-key';
import { toast } from 'sonner';

interface RegenerateKeyDialogProps {
  projectId: string;
}

export function RegenerateKeyDialog({ projectId }: RegenerateKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{ apiKey: string; installToken: string } | null>(null);
  const [copied, setCopied] = useState<'key' | 'token' | null>(null);

  const { mutate: regenerateKey, isPending, error } = useRegenerateKey({
    onSuccess: (data) => {
      setNewKeyData({ apiKey: data.apiKey, installToken: data.installToken });
    },
    onError: (err) => {
      toast.error('Failed to regenerate API key. Please try again.');
    },
  });

  const handleCopy = async (text: string, type: 'key' | 'token') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClose = useCallback(() => {
    setOpen(false);
    setNewKeyData(null);
    setCopied(null);
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  if (newKeyData) {
    return (
      <AlertDialog open={open} onOpenChange={handleClose}>
        <AlertDialogContent aria-labelledby="key-dialog-title" aria-describedby="key-dialog-description">
          <AlertDialogHeader>
            <AlertDialogTitle id="key-dialog-title">New API Key Generated</AlertDialogTitle>
            <AlertDialogDescription id="key-dialog-description">
              Save your API key now. It will not be shown again.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium" htmlFor="api-key-display">API Key</label>
              <div className="flex items-center gap-2 mt-1">
                <code id="api-key-display" className="flex-1 p-2 bg-muted rounded text-sm break-all">
                  {newKeyData.apiKey}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleCopy(newKeyData.apiKey, 'key')}
                  aria-label="Copy API key"
                >
                  {copied === 'key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="install-token-display">Install Token</label>
              <div className="flex items-center gap-2 mt-1">
                <code id="install-token-display" className="flex-1 p-2 bg-muted rounded text-sm break-all">
                  {newKeyData.installToken}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleCopy(newKeyData.installToken, 'token')}
                  aria-label="Copy install token"
                >
                  {copied === 'token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction onClick={handleClose}>
              I have saved my key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Regenerate API Key</Button>
      </AlertDialogTrigger>
      <AlertDialogContent aria-labelledby="regen-dialog-title" aria-describedby="regen-dialog-description">
        <AlertDialogHeader>
          <AlertDialogTitle id="regen-dialog-title" className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" aria-hidden="true" />
            Regenerate API Key
          </AlertDialogTitle>
          <AlertDialogDescription id="regen-dialog-description">
            This will immediately invalidate the current API key. Any CLI
            installations using the old key will stop working until updated
            with the new key.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => regenerateKey({ projectId })}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Regenerating...
              </>
            ) : (
              'Regenerate Key'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Mutation Hook Pattern

```typescript
// lib/hooks/use-regenerate-key.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface RegenerateKeyResponse {
  apiKey: string;
  installToken: string;
  project: {
    id: string;
    api_key_prefix: string;
  };
}

interface UseRegenerateKeyOptions {
  onSuccess?: (data: RegenerateKeyResponse) => void;
  onError?: (error: Error) => void;
}

export function useRegenerateKey(options?: UseRegenerateKeyOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const response = await fetch(`/api/projects/${projectId}/regenerate-key`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to regenerate key');
      }
      const { data } = await response.json();
      return data as RegenerateKeyResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', data.project.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}
```

### Common Pitfalls to Avoid

1. **DO NOT** show regenerated API key more than once
2. **DO NOT** allow archived projects to validate API keys
3. **DO NOT** allow non-admins to regenerate keys or archive
4. **DO NOT** hard delete projects - always soft delete
5. **DO NOT** forget to invalidate key when archiving
6. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
7. **DO NOT** forget to await params in Next.js 15 dynamic routes
8. **DO NOT** use `Request` type - use `NextRequest` from next/server
9. **DO NOT** skip error logging with context prefix

### Verification Checklist

After completing this story, verify:
- [ ] Admin can update project name and description
- [ ] Success toast appears after save
- [ ] Admin can regenerate API key
- [ ] Warning dialog appears before regeneration
- [ ] New key is shown only once after regeneration
- [ ] Old key immediately stops working
- [ ] Admin can archive project
- [ ] Confirmation required for archive (type project name)
- [ ] Archived project removed from active list
- [ ] Archived project API key stops working
- [ ] Non-admin can view project details
- [ ] Non-admin cannot regenerate keys
- [ ] Non-admin cannot archive project
- [ ] Installation instructions visible to all members
- [ ] All dialogs support keyboard navigation (Escape to close)
- [ ] Loading states display during async operations
- [ ] Error states handled with user-friendly messages

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
