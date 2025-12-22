# Story 2.6: Project Creation

Status: ✅ Done

## Story

**As a** team admin,
**I want** to create a new project with an API key,
**So that** developers can install Contextor in their repositories.

## Dependencies

- **Story 2.1** (Team Creation): `teams` and `team_members` tables must exist
- **Story 1.7** (Session & Security): JWT session with `team_id` claim must be functional

## Acceptance Criteria

1. **Given** I am a team admin on the projects page
   **When** I click "New Project"
   **Then** I see a form with project name and description fields
   **And** the form is keyboard accessible (Tab navigation, Enter to submit)

2. **Given** I submit a valid project name
   **When** the project is created
   **Then** a new `projects` row is created with `team_id`
   **And** a unique API key is generated (format: `ctx_live_xxxx`)
   **And** the API key hash is stored (never plaintext)
   **And** an Install Token is generated for the CLI
   **And** I see the project success page with installation instructions

3. **Given** the database schema
   **When** this story is complete
   **Then** the `projects` table exists with: `id`, `team_id`, `name`, `description`, `api_key_hash`, `api_key_prefix`, `created_at`, `created_by`, `is_archived`
   **And** RLS policies enforce team-scoped access

4. **Given** I enter invalid input
   **When** validation fails
   **Then** inline error messages display below the invalid field
   **And** focus moves to the first invalid field

5. **Given** I am not a team admin
   **When** I try to access the new project page
   **Then** I see an error message and am redirected to the projects list

## Technical Requirements

### Database Schema

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  api_key_hash VARCHAR(64) NOT NULL UNIQUE,
  api_key_prefix VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT false
);

CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_projects_api_key_hash ON projects(api_key_hash);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Team members can view projects" ON projects
FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  OR auth.role() = 'service_role'
);

CREATE POLICY "Team admins can create projects" ON projects
FOR INSERT WITH CHECK (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Team admins can update projects" ON projects
FOR UPDATE USING (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

### TypeScript Types

```typescript
// types/project.ts
export interface Project {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  api_key_prefix: string;
  created_at: string;
  created_by: string | null;
  is_archived: boolean;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface CreateProjectResponse {
  project: Project;
  apiKey: string;      // Shown only once
  installToken: string;
}

// Zod validation schemas
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
});
```

### API Key Generation

```typescript
// lib/utils/api-key.ts
import crypto from 'crypto';

const API_KEY_PREFIX = 'ctx_live_';

export function generateApiKey(): string {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${API_KEY_PREFIX}${randomPart}`;
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, 16);
}

export function maskApiKey(prefix: string): string {
  return `${prefix}${'*'.repeat(20)}`;
}
```

### Install Token

```typescript
// lib/utils/install-token.ts
interface InstallTokenPayload {
  project_id: string;
  team_id: string;
  user_id: string;
  api_key: string;
  api_endpoint: string;
}

export function generateInstallToken(payload: InstallTokenPayload): string {
  const jsonPayload = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonPayload).toString('base64url');
  return `ctx_${base64Payload}`;
}
```

## Tasks

- [ ] **Task 1: Database Migration** (AC: #3)
  - Create `supabase/migrations/YYYYMMDDHHMMSS_create_projects.sql`
  - Create table with all columns, indexes, and RLS policies
  - Test RLS policies with different user roles

- [ ] **Task 2: API Key Utilities** (AC: #2)
  - Create `lib/utils/api-key.ts` with generate, hash, prefix, mask functions
  - Create `lib/utils/install-token.ts` with generate and parse functions

- [ ] **Task 3: Project Creation API** (AC: #2, #4, #5)
  - Create `app/api/projects/route.ts`
  - POST: Validate admin role, generate API key, create project, return Install Token
  - GET: List team's projects (non-archived)
  - Return proper error codes (401, 403, 400)

- [ ] **Task 4: New Project Form** (AC: #1, #4)
  - Create `components/projects/new-project-form.tsx`
  - Use react-hook-form + Zod validation
  - Inline error messages below fields
  - Loading state on submit button
  - Keyboard accessible (Tab, Enter, Escape)

- [ ] **Task 5: New Project Page** (AC: #1, #5)
  - Create `app/(dashboard)/projects/new/page.tsx`
  - Server component verifies team admin role
  - Redirect non-admins to projects list with toast message

- [ ] **Task 6: Project Success Page** (AC: #2)
  - Create `app/(dashboard)/projects/[projectId]/created/page.tsx`
  - Display API key with copy button and one-time warning
  - Display Install Token with copy button
  - Show CLI installation command
  - Continue button to project detail page

- [ ] **Task 7: Projects List Page** (AC: #1)
  - Create `app/(dashboard)/projects/page.tsx`
  - Display project cards with name, description, created date
  - "New Project" button (visible only to admins)
  - Empty state with guidance

- [ ] **Task 8: Project Detail Page** (AC: #2)
  - Create `app/(dashboard)/projects/[projectId]/page.tsx`
  - Show project info and masked API key
  - Show installation instructions with Install Token

- [ ] **Task 9: Create Project Mutation Hook** (AC: #2)
  - Create `lib/hooks/use-create-project.ts`
  - Use TanStack Query `useMutation` with `isPending`
  - On success: invalidate projects list, redirect to success page

## File Locations

| Component | Path |
|-----------|------|
| Migration | `supabase/migrations/YYYYMMDDHHMMSS_create_projects.sql` |
| API Key Utils | `lib/utils/api-key.ts` |
| Install Token Utils | `lib/utils/install-token.ts` |
| Projects API | `app/api/projects/route.ts` |
| New Project Form | `components/projects/new-project-form.tsx` |
| Project Card | `components/projects/project-card.tsx` |
| Projects List Page | `app/(dashboard)/projects/page.tsx` |
| New Project Page | `app/(dashboard)/projects/new/page.tsx` |
| Project Created Page | `app/(dashboard)/projects/[projectId]/created/page.tsx` |
| Project Detail Page | `app/(dashboard)/projects/[projectId]/page.tsx` |
| Create Project Hook | `lib/hooks/use-create-project.ts` |

## Dev Notes

### Security Requirements

- API keys MUST be hashed before storage (SHA-256)
- Full API key shown only once at creation
- Install Token contains API key - treat as sensitive
- Never log or expose the full API key after initial display

### UI/UX Patterns

**Form Accessibility:**
- All form inputs have associated labels with `htmlFor`
- Error messages use `aria-describedby` linking to the input
- Focus management: auto-focus first field on mount, move focus to first error on validation failure
- Submit with Enter key, cancel with Escape key

**Loading States:**
- Submit button shows spinner and "Creating..." text when `isPending`
- Disable form inputs during submission
- Page-level loading: show skeleton cards on projects list

**Error States:**
- Inline validation errors appear below field in red text
- API errors display in toast notification
- Network errors show retry option

**Success Page:**
- Yellow warning banner: "Save your API key now - it won't be shown again"
- Copy buttons with "Copied!" feedback
- Clear CLI command with syntax highlighting

### Common Pitfalls

1. **DO NOT** store API keys in plaintext - always hash
2. **DO NOT** log API keys - they are sensitive
3. **DO NOT** show API key more than once - warn user
4. **DO NOT** allow non-admins to create projects
5. **DO NOT** forget team_id in project creation
6. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)

### API Response Format

```typescript
// Success
{ data: { project, apiKey, installToken } }

// Error
{ error: { code: 'ERROR_CODE', message: 'Human readable message' } }
```

Error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NO_TEAM`, `VALIDATION_ERROR`, `CREATE_FAILED`

## Verification Checklist

- [ ] `projects` table exists with correct schema
- [ ] RLS policies prevent cross-team access
- [ ] Admin can create new project
- [ ] Non-admin cannot create project (redirected with message)
- [ ] API key is generated in correct format (ctx_live_xxx)
- [ ] API key is hashed before storage
- [ ] API key is shown only once at creation with warning
- [ ] Install Token is generated correctly
- [ ] Form has proper keyboard navigation
- [ ] Inline validation errors display correctly
- [ ] Loading states work during submission
- [ ] Projects list shows team's projects
- [ ] Empty state displays when no projects exist

## Test Scenarios

1. **Happy Path:** Admin creates project, sees API key, copies Install Token
2. **Validation Error:** Empty name shows inline error, focus moves to field
3. **Permission Denied:** Non-admin accessing /projects/new redirected with message
4. **Duplicate Project:** Creating project with same name (allowed, names not unique)
5. **API Key Security:** API key not visible on subsequent page visits
6. **Form Accessibility:** Tab through all fields, submit with Enter

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
