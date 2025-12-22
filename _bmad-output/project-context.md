---
project_name: 'contextor'
user_name: 'Edgars'
date: '2025-12-20'
sections_completed: ['technology_stack', 'implementation_rules', 'dont_miss_rules', 'file_guide', 'cli_package', 'admin_system', 'analysis_engine']
status: 'complete'
last_validated_against: 'architecture.md (2025-12-20)'
---

# Project Context for AI Agents - Contextor

_Critical rules and patterns for consistent implementation. Focus on unobvious details._

---

## CRITICAL: Code Root Location

**All source code paths in stories are relative to: `{project-root}/app/`**

The project structure is:
```
context-coach/           ← Project root ({project-root})
├── app/                 ← Code root (Next.js project with package.json)
│   ├── app/             ← App Router routes (app/(auth), app/(dashboard))
│   ├── components/      ← React components
│   ├── lib/             ← Utilities and hooks
│   ├── supabase/        ← Migrations and Edge Functions
│   └── e2e/             ← Playwright tests
├── _bmad/               ← BMAD platform
└── _bmad-output/        ← Stories, artifacts, this file
```

When stories reference `lib/supabase/server.ts`, the actual path from project root is `app/lib/supabase/server.ts`.

---

## Technology Stack & Versions

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 15 | App Router only, no Pages Router |
| TypeScript | strict mode | No `any`, explicit null handling |
| Supabase | Latest | Auth, DB, Realtime, Edge Functions |
| Drizzle ORM | 0.45.1 | For complex queries only, not simple CRUD |
| TanStack Query | 5.90.x | `isPending` not `isLoading` (v5 change) |
| Tailwind CSS | Latest | With shadcn/ui components |
| Deployment | Cloud Run | Docker-based, `NEXT_PUBLIC_*` at build time |
| Rate Limiting | Upstash Redis | @upstash/ratelimit package |

---

## CLI Package (`@contextor/cli`)

The CLI is a separate npm package for project installation:

### Package Structure
```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── init.ts           # Main install command
│   │   ├── status.ts         # Check connection
│   │   └── uninstall.ts      # Remove config
│   └── lib/
│       ├── api-client.ts     # api.contextor.co communication
│       ├── config.ts         # Local config management
│       ├── hooks.ts          # Claude Code hook setup
│       ├── token.ts          # Install token parsing
│       └── detection.ts      # Auto-detect install state
```

### Install Token Format
```
Token: ctx_<base64-encoded-payload>
Payload: { project_id, team_id, user_id, api_key, api_endpoint }
```

### Local Files Created
| File | Purpose | Git Status |
|------|---------|------------|
| `.contextor/config.json` | Shared project config | **Committed** |
| `.contextor/.user` | Personal user config + API key | **Gitignored** |
| `.claude/settings.json` | Hook configuration | **Committed** |
| `.claude/hooks/contextor-capture.sh` | Capture script | **Committed** |

### CLI Rules
- Single command handles all scenarios: `npx @contextor/cli init <TOKEN>`
- Auto-detect: fresh install vs joining existing project
- Always validate token with api.contextor.co before proceeding
- Test capture connection before reporting success

---

## Critical Implementation Rules

### Next.js 15 App Router

- **Default to Server Components** — Only use `'use client'` when needed (events, hooks, browser APIs)
- **Route Groups** — `(auth)` for public, `(dashboard)` for protected routes
- **API Routes** — Use for external integrations only; dashboard reads use Supabase client directly
- **Middleware** — Auth redirect and session refresh in `middleware.ts`

### Supabase & Multi-Tenancy

- **RLS is mandatory** — All tables filter by `team_id` from JWT claims
- **Team context** — `auth.jwt() ->> 'team_id'` in all RLS policies
- **Client types:**
  - `lib/supabase/client.ts` — Browser (createBrowserClient)
  - `lib/supabase/server.ts` — Server Components (createServerClient with cookies)
  - `lib/supabase/admin.ts` — Service role (bypasses RLS, server-only)
- **Never expose service role key** to client

### Data Fetching Patterns

- **Server Components:** `await supabase.from('table').select()`
- **Client Components:** `useQuery({ queryKey: ['resource', id], queryFn })`
- **Mutations:** `useMutation` with `queryClient.invalidateQueries` on success
- **Real-time:** Subscribe in `useEffect`, invalidate Query cache, cleanup on unmount

### Platform Admin System

- **Access Control:** `is_super_admin` boolean flag on `users` table
- **Route Protection:** Middleware checks flag, redirects non-admins
- **RLS Bypass:** Admin uses service role client for cross-team queries
- **Admin Routes:** All under `app/(dashboard)/admin/`

```typescript
// middleware.ts - Admin protection
if (pathname.startsWith('/admin')) {
  const profile = await getProfile(user.id);
  if (!profile?.is_super_admin) {
    return NextResponse.redirect('/dashboard');
  }
}
```

### Analysis Engine

- **Processing:** Supabase Edge Functions triggered on prompt insert
- **Status Tracking:** `analysis_status` column: `pending` → `processing` → `complete` | `failed`
- **Retry Logic:** MAX_RETRIES = 3, delays: [1s, 5s, 15s]
- **Config Versioning:** Every analysis links to specific `analysis_config` version

```typescript
// Analysis status values
type AnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed';
```

### Rate Limiting

- **Package:** `@upstash/ratelimit` with `@upstash/redis`
- **Limits:**
  - Per Project: 100 prompts/minute
  - Per User: 20 prompts/minute
  - Per IP (unauthenticated): 10 requests/minute
- **Response:** HTTP 429 with `{ error: { code: 'RATE_LIMITED' } }`

### Input Validation

- **Prompt Length:** MIN = 10 chars, MAX = 100,000 chars
- **Validation Location:** `/api/prompts/capture` before any processing
- **Response:** HTTP 400 with specific error code (`PROMPT_TOO_SHORT`, `PROMPT_TOO_LONG`)

### API Response Format

```typescript
// Success
{ data: T, meta?: { count: number, page: number } }

// Error
{ error: { code: string, message: string } }
```

### Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| DB tables | snake_case plural | `team_members` |
| DB columns | snake_case | `created_at` |
| API routes | kebab-case | `/api/prompts/capture` |
| TS variables | camelCase | `teamId` |
| Components | PascalCase | `PromptCard` |
| Component files | kebab-case | `prompt-card.tsx` |

### Error Handling

- **API Routes:** Always `try/catch`, log with `[API] route-name: error`, return consistent error format
- **Client:** React Query error boundaries, `toast()` for user messages
- **Never expose** internal errors or stack traces to client

### Testing (Post-MVP)

- Co-locate tests: `component.test.tsx` next to `component.tsx`
- E2E in `/e2e/` directory
- Use Playwright for E2E

---

## Critical Don't-Miss Rules

### Must Do

- Include `team_id` in every table that stores user data
- Validate API key in `/api/prompts/capture` before any processing
- Redact secrets before any cloud storage (`lib/capture/redact-secrets.ts`)
- Use `isPending` not `isLoading` (TanStack Query v5)
- Set `team_id` in JWT claims when user switches teams
- Validate prompt length (10-100K chars) before processing
- Implement rate limiting on capture endpoint (Upstash Redis)
- Track `analysis_status` on every prompt (`pending` → `processing` → `complete`/`failed`)
- Retry failed analyses up to 3 times with exponential backoff
- Check `is_super_admin` before allowing access to `/admin/*` routes

### Never Do

- Never use `any` — use `unknown` and narrow types
- Never call Supabase admin client from client components
- Never store API keys in plaintext — always hash
- Never skip RLS policies — even for "simple" queries
- Never use `console.log` in production — use structured logging
- Never allow non-super-admins to access admin routes or service role client
- Never process prompts without validating length limits first
- Never skip rate limiting on the capture endpoint

### Edge Cases

- **Multi-team users:** Always respect current team context from JWT
- **Capture endpoint:** Must work without session (API key only)
- **Real-time:** Unsubscribe on component unmount to prevent memory leaks
- **Build-time env:** `NEXT_PUBLIC_*` are embedded at build, not runtime
- **Analysis failures:** After 3 retries, mark as `failed` and add to dead letter queue
- **CLI install states:** Handle fresh, joining, configured, and mismatch scenarios
- **Admin queries:** Use service role client to bypass RLS for cross-team data

---

## File Location Guide

| Need | Location |
|------|----------|
| Supabase client | `lib/supabase/` |
| Complex queries | `lib/db/queries/` |
| React hooks | `lib/hooks/` |
| API helpers | `lib/api/` |
| Secret redaction | `lib/capture/` |
| Rate limiting | `lib/rate-limit/` |
| Input validation | `lib/capture/validate.ts` |
| UI components | `components/ui/` |
| Feature components | `components/{feature}/` |
| Onboarding components | `components/onboarding/` |
| Admin components | `components/admin/` |
| Auth routes | `app/(auth)/` |
| Dashboard routes | `app/(dashboard)/` |
| Admin routes | `app/(dashboard)/admin/` |
| Capture API | `app/api/prompts/capture/` |
| Edge Functions | `supabase/functions/` |
| CLI package | `packages/cli/` |

---

## Key Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User profiles | `id`, `is_super_admin` |
| `teams` | Tenant container | `id`, `name` |
| `team_members` | User ↔ Team | `user_id`, `team_id`, `role` |
| `projects` | Registered projects | `team_id`, `api_key_hash` |
| `prompts` | Captured prompts | `team_id`, `user_id`, `analysis_status` |
| `prompt_analyses` | AI analysis results | `prompt_id`, `config_id` |
| `analysis_configs` | Dimension configs | `version`, `is_active` |
| `analysis_dimensions` | Scoring dimensions | `config_id`, `weight` |
