# Story 1.1: Project Initialization

Status: ready-for-dev
Estimated Time: 2-3 hours

## Story

**As a** developer,
**I want** to initialize the Contextor project with the official Supabase starter template,
**So that** I have a properly configured foundation with authentication, database, and deployment ready.

## Acceptance Criteria

1. **Given** a new project directory
   **When** I run `npx create-next-app@latest contextor -e with-supabase`
   **Then** the project is created with Next.js 15, TypeScript strict mode, and Tailwind CSS
   **And** Supabase client configuration is in place (`lib/supabase/`)
   **And** the `middleware.ts` handles auth redirects
   **And** the `app/(auth)/` and `app/(dashboard)/` route groups exist

2. **Given** a local Supabase instance
   **When** I run `supabase init` and `supabase start`
   **Then** local development environment is ready
   **And** `.env.local` contains Supabase connection strings

3. **Given** the initial database setup
   **When** I apply the first migration
   **Then** the `users` table extends `auth.users` with profile fields (`name`, `avatar_url`, `is_super_admin`)
   **And** RLS is enabled on all tables
   **And** basic RLS policies are in place

## Tasks / Subtasks

- [ ] **Task 1: Create Next.js project with Supabase template** (AC: #1)
  - [ ] Run `npx create-next-app@latest contextor -e with-supabase`
  - [ ] Verify project structure matches expected layout
  - [ ] Verify `next.config.ts` (not `.js` or `.mjs`) exists
  - [ ] Confirm `app/` directory exists (not `pages/`)
  - [ ] Verify `package.json` shows `"next": "^15.x.x"`
  - [ ] Confirm TypeScript strict mode in `tsconfig.json`:
    ```json
    {
      "compilerOptions": {
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "forceConsistentCasingInFileNames": true
      }
    }
    ```
  - [ ] Confirm Tailwind CSS is configured in `tailwind.config.ts`

- [ ] **Task 2: Initialize shadcn/ui component library** (AC: #1)
  - [ ] Run `npx shadcn@latest init` with default settings
  - [ ] Verify `components.json` is created with correct paths
  - [ ] Install base components: `npx shadcn@latest add button input card`
  - [ ] Confirm components are in `components/ui/`

- [ ] **Task 3: Set up local Supabase development environment** (AC: #2)
  - [ ] Ensure Supabase CLI v1.200+ is installed (`supabase --version`)
  - [ ] Run `supabase init` to create `supabase/` directory
  - [ ] Run `supabase start` to launch local Supabase containers
  - [ ] Copy local Supabase credentials to `.env.local`
  - [ ] Create `.env.example` with template for team sharing
  - [ ] Verify Supabase Studio is accessible at `localhost:54323`

- [ ] **Task 4: Create initial database migration** (AC: #3)
  - [ ] Create migration file: `supabase/migrations/00001_initial_setup.sql`
  - [ ] Extend `auth.users` with public `users` table (profile fields)
  - [ ] Add `is_super_admin` boolean column (default: false)
  - [ ] Enable RLS on `users` table
  - [ ] Create basic RLS policies for user self-access
  - [ ] Apply migration with `supabase db push`

- [ ] **Task 5: Verify Supabase client configuration** (AC: #1)
  - [ ] Confirm `lib/supabase/client.ts` exists (browser client)
  - [ ] Confirm `lib/supabase/server.ts` exists (server component client)
  - [ ] Verify middleware refreshes session on each request
  - [ ] Test auth flow works with email/password signup

- [ ] **Task 6: Validate project structure** (AC: #1)
  - [ ] Confirm `app/(auth)/` route group exists with login/signup
  - [ ] Confirm `app/(dashboard)/` route group exists
  - [ ] Confirm `components/ui/` exists for shadcn/ui components
  - [ ] Add missing directories from architecture spec

## Dev Notes

### Critical Architecture Constraints

**Technology Stack (MUST USE EXACT VERSIONS):**
- Next.js 15 with App Router (NO Pages Router)
- TypeScript in strict mode
- Tailwind CSS + shadcn/ui (Radix + Tailwind)
- Supabase Auth with supabase-ssr (cookie-based)
- Supabase CLI v1.200+ for local development

**Starter Command (DO NOT DEVIATE):**
```bash
npx create-next-app@latest contextor -e with-supabase
```

**What the Starter Provides:**
TypeScript strict, Tailwind, Supabase Auth with supabase-ssr, App Router.

**What You Must Add:**
- shadcn/ui initialization (Task 2)
- React Query for data fetching/caching (Story 1.2+)
- Supabase Realtime subscriptions (Story 6.2)
- RLS policies for multi-tenancy (Story 2.1)

### Database Schema: Users Table

```sql
-- Create public users table extending auth.users
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  avatar_url TEXT,
  is_super_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (excluding is_super_admin)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile row
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Prevent is_super_admin modification via trigger
CREATE OR REPLACE FUNCTION prevent_admin_self_promotion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_super_admin IS DISTINCT FROM NEW.is_super_admin THEN
    IF NOT OLD.is_super_admin THEN
      RAISE EXCEPTION 'Cannot modify is_super_admin status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_admin_promotion
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION prevent_admin_self_promotion();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Migration Naming Convention

Format: `XXXXX_description.sql` where XXXXX is zero-padded sequence number.
- Use snake_case for descriptions
- Keep descriptions short but descriptive
- Examples: `00001_initial_setup.sql`, `00002_add_teams.sql`

### Project Structure After This Story

```
contextor/
├── README.md
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json
├── .env.local                 # Local Supabase credentials
├── .env.example               # Template for team
│
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 00001_initial_setup.sql
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── signup/
│   │   │   └── page.tsx
│   │   └── callback/
│   │       └── route.ts
│   └── (dashboard)/
│       ├── layout.tsx
│       └── page.tsx
│
├── components/
│   └── ui/                    # shadcn/ui components
│
├── lib/
│   └── supabase/
│       ├── client.ts          # Browser client
│       └── server.ts          # Server component client
│
└── middleware.ts              # Auth redirects, session refresh
```

### Environment Variables

**.env.local (DO NOT COMMIT):**
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key
```

**.env.example (COMMIT TO GIT - template for team):**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Naming Conventions (From Architecture)

| Context | Convention | Example |
|---------|------------|---------|
| Database tables | snake_case, plural | `users`, `team_members` |
| Database columns | snake_case | `user_id`, `created_at` |
| TypeScript variables | camelCase | `userId`, `promptText` |
| React components | PascalCase | `PromptCard`, `TeamSettings` |
| Component files | kebab-case.tsx | `prompt-card.tsx` |

### References

- [Source: _bmad-output/architecture.md#Starter-Template-Evaluation]
- [Source: _bmad-output/architecture.md#Project-Structure-Boundaries]
- [Source: _bmad-output/epics.md#Story-1.1-Project-Initialization]
- [Source: _bmad-output/project-context.md#Technology-Stack-Versions]

### Implementation Guidelines

1. Use App Router exclusively (`app/` directory)
2. Leverage Supabase Auth for all authentication flows
3. Enable RLS on all tables before adding any data
4. Keep TypeScript in strict mode with no `any` types
5. Store `.env.local` locally only (already in `.gitignore`)

### Verification Checklist

After completing this story, verify:
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes successfully
- [ ] Supabase Studio shows `users` table with RLS enabled
- [ ] Can create account via `/signup`
- [ ] Can login via `/login`
- [ ] Protected routes redirect to login when unauthenticated
- [ ] Auth callback handles OAuth flow
- [ ] New signup creates corresponding row in `public.users` (verify in Supabase Studio)
- [ ] `users.name` is populated from signup metadata if provided
- [ ] `users.is_super_admin` defaults to `false`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### File List

*To be filled by dev agent - list all files created/modified*
