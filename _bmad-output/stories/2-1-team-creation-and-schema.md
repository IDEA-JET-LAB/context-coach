# Story 2.1: Team Creation & Schema

Status: ready-for-dev

## Story

**As a** logged-in user,
**I want** to create a new team,
**So that** I can organize my projects and invite collaborators.

## Acceptance Criteria

1. **Given** I am logged in and have no teams
   **When** I access the dashboard
   **Then** I am prompted to create my first team

2. **Given** I am on the create team page
   **When** I enter a team name and submit
   **Then** a new row is created in the `teams` table
   **And** a `team_members` row is created with my user_id, the team_id, and role = 'admin'
   **And** my JWT is updated with `team_id` claim
   **And** I am redirected to the team dashboard

3. **Given** the database schema
   **When** this story is complete
   **Then** the `teams` table exists with columns: `id`, `name`, `description`, `created_at`, `created_by`
   **And** the `team_members` table exists with: `id`, `team_id`, `user_id`, `role`, `joined_at`
   **And** RLS policies enforce team-scoped access
   **And** role enum includes: `member`, `admin`

4. **Given** form validation requirements
   **When** I submit an empty or invalid team name
   **Then** I see inline validation errors
   **And** the form is not submitted
   **And** focus moves to the first invalid field

5. **Given** an API or network error occurs
   **When** team creation fails
   **Then** I see a toast notification with an error message
   **And** I can retry the submission

## Tasks / Subtasks

- [ ] **Task 1: Create database schema for teams** (AC: #3)
  - [ ] Create SQL migration file `supabase/migrations/YYYYMMDDHHMMSS_create_teams_schema.sql`
  - [ ] Create `team_role` enum type with values: `member`, `admin`
  - [ ] Create `teams` table with columns:
    - `id` (UUID, primary key, default gen_random_uuid())
    - `name` (VARCHAR(100), NOT NULL)
    - `description` (TEXT, nullable)
    - `created_at` (TIMESTAMPTZ, default now())
    - `created_by` (UUID, references auth.users(id))
  - [ ] Create `team_members` table with columns:
    - `id` (UUID, primary key, default gen_random_uuid())
    - `team_id` (UUID, references teams(id) ON DELETE CASCADE)
    - `user_id` (UUID, references auth.users(id) ON DELETE CASCADE)
    - `role` (team_role, default 'member')
    - `joined_at` (TIMESTAMPTZ, default now())
  - [ ] Add unique constraint on (team_id, user_id) in team_members
  - [ ] Create indexes on team_members(team_id) and team_members(user_id)

- [ ] **Task 2: Implement RLS policies for teams** (AC: #3)
  - [ ] Enable RLS on `teams` table
  - [ ] Policy: Users can SELECT teams they are members of
  - [ ] Policy: Authenticated users can INSERT new teams
  - [ ] Policy: Team admins can UPDATE their teams
  - [ ] Policy: Team admins can DELETE their teams (no active projects check)

- [ ] **Task 3: Implement RLS policies for team_members** (AC: #3)
  - [ ] Enable RLS on `team_members` table
  - [ ] Policy: Users can SELECT members of teams they belong to
  - [ ] Policy: Team admins can INSERT new members
  - [ ] Policy: Team admins can UPDATE member roles
  - [ ] Policy: Team admins can DELETE members (except last admin - enforce in function)

- [ ] **Task 4: Create database function for team creation** (AC: #2)
  - [ ] Create function `create_team_with_admin(team_name TEXT, team_description TEXT)`
  - [ ] Function should:
    - Insert new team row
    - Insert team_members row with creator as 'admin'
    - Return the new team object
  - [ ] Use SECURITY DEFINER to bypass RLS during creation
  - [ ] Validate team name is not empty and <= 100 chars

- [ ] **Task 5: Create API endpoint for team creation** (AC: #2, #5)
  - [ ] Create `app/api/teams/route.ts`
  - [ ] POST handler to create new team
  - [ ] Use Supabase server client to call `create_team_with_admin` function
  - [ ] Return `{ data: { team } }` on success (HTTP 201)
  - [ ] Return `{ error: { code, message } }` on failure (HTTP 400/500)
  - [ ] Validate request body with Zod schema from `lib/validations/team.ts`
  - [ ] Handle network/database errors with appropriate error codes

- [ ] **Task 6: Implement JWT custom claims for team_id** (AC: #2)
  - [ ] Create database function `set_team_claim(team_id UUID)` to update JWT claims
  - [ ] Call `set_team_claim` within `create_team_with_admin` transaction
  - [ ] Ensure auth.jwt() ->> 'team_id' is available in RLS policies
  - [ ] Document the JWT refresh flow for frontend

- [ ] **Task 7: Create team creation UI page** (AC: #1, #2, #4, #5)
  - [ ] Create `app/(dashboard)/teams/new/page.tsx`
  - [ ] Add form with team name input (required, max 100 chars)
  - [ ] Add optional team description textarea
  - [ ] Style with shadcn/ui components (Input, Textarea, Button, Card)
  - [ ] Add client-side form validation using Zod + react-hook-form
  - [ ] Add loading state during submission (disable button, show spinner)
  - [ ] Add error toast on failure with retry option
  - [ ] Ensure keyboard navigation: Enter submits, Tab navigates fields
  - [ ] Add aria-labels and aria-describedby for form fields

- [ ] **Task 8: Create "no teams" onboarding flow** (AC: #1)
  - [ ] Create `components/onboarding/create-first-team.tsx` component
  - [ ] Display welcoming message for new users
  - [ ] Include inline team creation form or link to /teams/new
  - [ ] Update dashboard layout to check for teams and show onboarding

- [ ] **Task 9: Handle post-creation redirect and JWT refresh** (AC: #2)
  - [ ] After team creation, call Supabase to refresh session
  - [ ] Verify new JWT contains team_id claim
  - [ ] Redirect to `/dashboard` (team dashboard)
  - [ ] Invalidate any cached queries using TanStack Query

- [ ] **Task 10: Create team context hook** (AC: #2)
  - [ ] Create `lib/hooks/use-team.ts`
  - [ ] Hook should return current team from JWT or context
  - [ ] Provide `isPending` and `error` states (TanStack Query v5)
  - [ ] Use TanStack Query with `isPending` (not isLoading)

- [ ] **Task 11: Create Zod validation schema** (AC: #4)
  - [ ] Create `lib/validations/team.ts`
  - [ ] Export `createTeamSchema` with name (1-100 chars) and optional description
  - [ ] Export TypeScript types derived from schema

## Dev Notes

### Technology Stack
- Next.js 15 with App Router
- TypeScript in strict mode
- Supabase with mandatory RLS
- TanStack Query 5.x (`isPending` not `isLoading`)
- shadcn/ui + Tailwind CSS

### Multi-Tenancy Pattern
- Every data table MUST include `team_id` column
- RLS policies filter by `auth.jwt() ->> 'team_id'`
- Team context stored in JWT custom claims

### Database Schema

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_teams_schema.sql

-- Create role enum
CREATE TYPE team_role AS ENUM ('member', 'admin');

-- Create teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create team_members junction table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role team_role DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Teams RLS Policies
CREATE POLICY "Users can view their teams" ON teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Team admins can update teams" ON teams
  FOR UPDATE USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Team admins can delete teams" ON teams
  FOR DELETE USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Team Members RLS Policies
CREATE POLICY "Users can view team members" ON team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Team admins can add members" ON team_members
  FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Team admins can update members" ON team_members
  FOR UPDATE USING (
    team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'admin')
  );

CREATE POLICY "Team admins can remove members" ON team_members
  FOR DELETE USING (
    team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'admin')
  );
```

### Database Functions

```sql
-- Function to set team_id in JWT claims
CREATE OR REPLACE FUNCTION set_team_claim(team_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    raw_app_meta_data || jsonb_build_object('team_id', team_id)
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create team with admin
CREATE OR REPLACE FUNCTION create_team_with_admin(
  team_name TEXT,
  team_description TEXT DEFAULT NULL
)
RETURNS teams AS $$
DECLARE
  new_team teams;
BEGIN
  -- Validate input
  IF team_name IS NULL OR length(trim(team_name)) = 0 THEN
    RAISE EXCEPTION 'Team name is required';
  END IF;

  IF length(trim(team_name)) > 100 THEN
    RAISE EXCEPTION 'Team name must be 100 characters or less';
  END IF;

  -- Create team
  INSERT INTO teams (name, description, created_by)
  VALUES (trim(team_name), team_description, auth.uid())
  RETURNING * INTO new_team;

  -- Add creator as admin
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (new_team.id, auth.uid(), 'admin');

  -- Set JWT claim
  PERFORM set_team_claim(new_team.id);

  RETURN new_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Validation Schema

```typescript
// lib/validations/team.ts
import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string()
    .min(1, 'Team name is required')
    .max(100, 'Team name must be 100 characters or less')
    .transform(val => val.trim()),
  description: z.string().optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
```

### API Route

```typescript
// app/api/teams/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createTeamSchema } from '@/lib/validations/team';
import { ZodError } from 'zod';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const validated = createTeamSchema.parse(body);

    const { data, error } = await supabase
      .rpc('create_team_with_admin', {
        team_name: validated.name,
        team_description: validated.description,
      });

    if (error) {
      return NextResponse.json(
        { error: { code: 'TEAM_CREATION_FAILED', message: error.message } },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: { team: data } }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: error.errors[0].message } },
        { status: 400 }
      );
    }
    console.error('[API] teams: error creating team', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

### Component Locations

| Component | Path |
|-----------|------|
| Team Creation Page | `app/(dashboard)/teams/new/page.tsx` |
| First Team Onboarding | `components/onboarding/create-first-team.tsx` |
| Team Hook | `lib/hooks/use-team.ts` |
| Team API Route | `app/api/teams/route.ts` |
| Validation Schema | `lib/validations/team.ts` |

### Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| DB tables | snake_case plural | `teams`, `team_members` |
| DB columns | snake_case | `created_at`, `team_id` |
| API routes | kebab-case | `/api/teams` |
| TS variables | camelCase | `teamId`, `teamMembers` |
| Components | PascalCase | `CreateFirstTeam` |

### Common Pitfalls

1. **DO NOT** forget to enable RLS on both tables
2. **DO NOT** allow users to access teams they're not members of
3. **DO NOT** skip JWT refresh after team creation - session needs new claims
4. **DO NOT** use `isLoading` - use `isPending` (TanStack Query v5)
5. **DO NOT** create team without adding creator as admin in same transaction
6. **DO NOT** forget indexes on foreign keys for performance
7. **DO NOT** skip form validation or loading states on UI

### Accessibility Requirements

- Form inputs must have associated labels
- Error messages must be announced to screen readers (aria-live)
- Focus management: move focus to first error on validation failure
- Button states: disabled during submission with aria-disabled
- Keyboard navigation: Tab order, Enter to submit

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|

### File List

*To be filled by dev agent - list all files created/modified*
