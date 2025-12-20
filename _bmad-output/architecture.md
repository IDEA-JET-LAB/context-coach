---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - '_bmad-output/prd.md'
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2025-12-19'
project_name: 'contextor'
user_name: 'Edgars'
date: '2025-12-19'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
54 functional requirements spanning 8 capability areas. The core flow is:
User Registration → Team/Project Setup → Prompt Capture → AI Analysis → Dashboard Visualization

The AI Analysis Engine (FR27-FR35) is the differentiating feature — real-time, dimension-based scoring with configurable templates and versioning.

**Non-Functional Requirements:**
- Performance: Dashboard < 2s load, analysis < 30s, feed updates < 500ms
- Security: AES-256 at rest, TLS 1.3, RLS, secret redaction before storage
- Scalability: MVP 500 users / 50K prompts/month → Growth 5K users / 500K prompts/month
- Reliability: 95%+ capture rate, 99%+ analysis completion, 99.5% uptime

**Scale & Complexity:**
- Primary domain: Full-stack SaaS (Next.js/React + Supabase)
- Complexity level: Medium-High
- Estimated architectural components: 8-10 major subsystems

### Technical Constraints & Dependencies

- **Supabase as managed backend** — Auth, Database, Realtime, Storage
- **Cloud-only storage** — No local SQLite, all data in Supabase
- **Row-Level Security** — Tenant isolation at database level
- **Queue-based analysis** — Async processing for burst capacity
- **Hook-based capture** — Depends on Claude Code `UserPromptSubmit` hook API

### Cross-Cutting Concerns Identified

1. **Authentication/Authorization** — JWT-based, ties to RLS policies, multi-team context
2. **Real-time subscriptions** — Supabase Realtime for live updates across dashboard
3. **Secret redaction pipeline** — Must execute before any cloud storage
4. **Analysis versioning** — Every prompt links to specific analysis config version
5. **Multi-team user context** — Current team selection affects all data access
6. **API key management** — Project-level keys for capture endpoints

## Starter Template Evaluation

### Primary Technology Domain

Full-stack SaaS application based on project requirements:
- Next.js for React-based dashboard with SSR/RSC
- Supabase for Auth, Database, Realtime, Storage
- Google Cloud Run for deployment

### Starter Options Considered

| Starter | Pros | Cons |
|---------|------|------|
| **Official Supabase Starter** | Official, clean, minimal | Needs additional setup for SaaS features |
| Razikus SaaS Template | Feature-rich, RLS examples | May have opinionated patterns to refactor |
| Nextbase Lite | Testing included | More complex setup |

### Selected Starter: Official Supabase Starter

**Rationale:** Clean foundation with official support. Contextor has specific architectural needs (analysis engine, team multi-tenancy) that benefit from building up rather than stripping down a heavy template.

**Initialization Command:**

```bash
npx create-next-app@latest contextor -e with-supabase
```

**Architectural Decisions Provided by Starter:**

| Decision | Provided |
|----------|----------|
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Auth** | Supabase Auth with supabase-ssr (cookie-based) |
| **Routing** | Next.js App Router |
| **Components** | shadcn/ui (Radix + Tailwind) |

**Additions Needed:**
- React Query for data fetching/caching
- Supabase Realtime subscriptions for dashboard
- Queue processing for analysis engine (likely Supabase Edge Functions or external)
- RLS policies for multi-tenancy

**Deployment Target:** Google Cloud Run (containerized)

**Note:** Project initialization should be the first implementation story.

## Core Architectural Decisions

### Decision Summary

| Category | Decision | Version | Rationale |
|----------|----------|---------|-----------|
| Database Access | Supabase client + Drizzle ORM | 0.45.1 | Supabase for real-time/RLS, Drizzle for complex type-safe queries |
| Multi-tenancy | Team-scoped RLS | - | team_id in JWT claims, no join overhead |
| API Layer | Supabase client + Next.js API routes | Next.js 15 | Direct client for reads, API routes for capture webhook |
| Analysis Processing | Supabase Edge Functions | - | Triggered on prompt insert, serverless scale |
| State Management | TanStack Query | 5.90.x | Server state caching, auto-refetch |
| Real-time | Supabase Realtime | - | Native subscriptions for dashboard updates |
| CI/CD | GitHub Actions → Cloud Run | - | Flexible, well-documented |
| Secrets | Cloud Run secrets | - | Simple for MVP, upgrade path to GCP Secret Manager |

### Data Architecture

**Database Access Pattern:**
- **Primary:** Supabase JS client for CRUD operations, real-time subscriptions, and RLS-enforced queries
- **Complex Queries:** Drizzle ORM (v0.45.1) for type-safe joins, aggregations, and analytics queries
- **Migrations:** Supabase CLI migrations (SQL-based)

**Multi-Tenant RLS Strategy:**
- All tables include `team_id` column as tenant boundary
- JWT claims include user's current `team_id` (set on team switch)
- RLS policies: `auth.jwt() ->> 'team_id' = team_id`
- No cross-team data access without explicit sharing

**Key Tables:**
- `users` — Profile data (extends Supabase auth.users)
- `teams` — Tenant container
- `team_members` — User ↔ Team relationship with role
- `projects` — Registered projects with API keys
- `prompts` — Captured prompts with metadata
- `analyses` — AI analysis results (versioned)
- `analysis_configs` — Dimension definitions and weights

### Authentication & Security

**Auth Flow:**
- Supabase Auth with supabase-ssr (cookie-based)
- Providers: Email/password + Gmail OAuth (per PRD)
- Session: JWT with 24-hour expiry, refresh tokens
- Team context: Current team_id stored in JWT claims

**Authorization:**
- Role-based via `team_members.role` (member, admin)
- Platform super-admin: Separate flag in users table
- RLS enforces team boundaries at database level

**API Security:**
- Capture endpoint: Project API key authentication (hashed storage)
- Dashboard: Supabase session (RLS)
- Rate limiting: Implemented at API route level

### API & Communication Patterns

**Dashboard Data Flow:**
```
Browser → Supabase Client → PostgreSQL (RLS filtered)
         ↓
    Realtime subscription for live updates
```

**Capture Data Flow:**
```
Claude Code Hook → POST /api/prompts/capture (API key auth)
                          ↓
                   Secret redaction
                          ↓
                   Insert to Supabase
                          ↓
                   Edge Function trigger → AI Analysis
                          ↓
                   Analysis result inserted
                          ↓
                   Realtime pushes to dashboard
```

**Error Handling:**
- Consistent error schema: `{ error: string, code: string, details?: object }`
- Client-side: React Query error boundaries
- Capture endpoint: Queue failed requests for retry

### Frontend Architecture

**State Management:**
- **Server State:** TanStack Query v5 for all Supabase data
- **Real-time:** Supabase Realtime subscriptions integrated with Query cache invalidation
- **UI State:** React useState/useReducer (no global store needed for MVP)

**Component Architecture:**
- shadcn/ui as base component library
- Feature-based folder structure: `/app/(dashboard)/prompts/`, `/app/(dashboard)/analytics/`
- Server Components for initial data fetch, Client Components for interactivity

**Key Dashboard Views:**
- Prompt feed (real-time, filterable)
- Prompt detail (analysis breakdown)
- Analytics (trends, comparisons)
- Team management
- Admin panel (super-admin only)

### Infrastructure & Deployment

**Deployment Pipeline:**
```
Push to main → GitHub Actions → Build Docker image → Deploy to Cloud Run
```

**Environment Configuration:**
- Development: `.env.local`
- Production: Cloud Run secrets (injected at runtime)
- Build-time: `NEXT_PUBLIC_*` vars set in Dockerfile ARGs

**Monitoring (Post-MVP):**
- Cloud Run metrics (CPU, memory, requests)
- Supabase dashboard (database, auth, realtime)
- Application logging via Cloud Logging

### Deferred Decisions (Post-MVP)

| Decision | Rationale for Deferral |
|----------|------------------------|
| CDN/Edge caching | Optimize after traffic patterns known |
| Queue service (Cloud Tasks) | Edge Functions sufficient for MVP scale |
| GCP Secret Manager | Cloud Run secrets adequate initially |
| APM tooling (Sentry, etc.) | Add when user base grows |

## Implementation Patterns & Consistency Rules

### Naming Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Database tables | snake_case, plural | `prompts`, `team_members` |
| Database columns | snake_case | `user_id`, `created_at` |
| API routes | kebab-case, plural | `/api/prompts/capture` |
| Query parameters | snake_case | `team_id`, `page_size` |
| TypeScript variables | camelCase | `userId`, `promptText` |
| React components | PascalCase | `PromptCard`, `TeamSettings` |
| Component files | kebab-case.tsx | `prompt-card.tsx` |
| Utility functions | camelCase | `formatDate()`, `redactSecrets()` |

### API Response Patterns

**Success Response:**
```json
{ "data": { ... }, "meta": { "count": N, "page": N } }
```

**Error Response:**
```json
{ "error": { "code": "ERROR_CODE", "message": "Human readable message" } }
```

**HTTP Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request (validation errors)
- 401: Unauthorized (missing/invalid auth)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 500: Internal Server Error

### Data Format Standards

- **Dates:** ISO 8601 strings in JSON (`2025-12-19T10:30:00Z`)
- **IDs:** UUIDs from Supabase
- **Booleans:** `true`/`false` (never 1/0)
- **Nulls:** Explicit `null`, never `undefined` in JSON
- **JSON fields:** camelCase (transformed from snake_case at API boundary)

### Component Patterns

**Default to Server Components:**
- Use `async` components for data fetching
- Move interactivity to leaf components

**Client Components when needed:**
- Event handlers (onClick, onChange)
- Browser APIs (localStorage, window)
- React hooks (useState, useEffect)
- Real-time subscriptions

**File colocation:**
- Component + styles + tests in same directory
- Co-locate feature-specific hooks with components

### State Management Rules

**Server State (TanStack Query):**
- All Supabase data fetched via useQuery
- Mutations via useMutation with cache invalidation
- Query keys: `['resource', ...identifiers]`

**Real-time Updates:**
- Supabase Realtime subscriptions in useEffect
- Invalidate React Query cache on changes
- Unsubscribe in cleanup function

**UI State:**
- Local useState for component-specific state
- URL state for filters/pagination (useSearchParams)

### Error Handling Rules

**API Routes:**
- Always wrap in try/catch
- Log errors with context: `[API] route-name: error`
- Return consistent error response format
- Never expose internal error details to client

**Client Components:**
- React Query error boundaries for fetch errors
- toast() for user-facing error messages
- Graceful degradation over error screens

### Logging Standards

**Format:** `[CONTEXT] action: details`

**Examples:**
- `[API] prompts/capture: received prompt from project abc123`
- `[EDGE] analyze: starting analysis for prompt xyz`
- `[AUTH] login: user authenticated via gmail`

**Levels:**
- `console.error` — Errors requiring attention
- `console.warn` — Unexpected but handled situations
- `console.log` — Significant events (use sparingly in prod)

### Testing Patterns (Post-MVP)

- Tests co-located: `component.test.tsx` next to `component.tsx`
- Integration tests in `__tests__/` directories
- E2E tests in `/e2e/` at project root

## Project Structure & Boundaries

### Complete Project Directory Structure

```
contextor/
├── README.md
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json
├── drizzle.config.ts
├── Dockerfile
├── .env.example
├── .gitignore
│
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── functions/
│       └── analyze-prompt/
│
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── callback/
│   │   └── reset-password/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── prompts/
│   │   ├── analytics/
│   │   ├── team/
│   │   ├── projects/
│   │   ├── settings/
│   │   └── admin/                    # Platform Super Admin only
│   │       ├── layout.tsx            # Admin layout with nav
│   │       ├── page.tsx              # Admin dashboard/overview
│   │       ├── users/                # User management
│   │       │   └── page.tsx
│   │       ├── teams/                # All teams overview
│   │       │   └── page.tsx
│   │       ├── analytics/            # System-wide analytics
│   │       │   └── page.tsx
│   │       ├── analysis-config/      # AI analysis configuration
│   │       │   ├── page.tsx          # Config list/overview
│   │       │   ├── [id]/             # Edit specific config
│   │       │   └── new/              # Create new config
│   │       └── system/               # System health & monitoring
│   │           └── page.tsx
│   └── api/
│       ├── prompts/capture/
│       ├── projects/[id]/api-key/
│       └── health/
│
├── components/
│   ├── ui/
│   ├── layout/
│   │   └── TeamSwitcher.tsx         # Team context header (FR69)
│   ├── prompts/
│   │   ├── EmptyPromptFeed.tsx      # Empty state (FR67)
│   │   ├── PromptCard.tsx           # With analysis status (FR68, FR74)
│   │   └── ScoreDisplay.tsx         # Score with team avg (FR70)
│   ├── onboarding/                  # Onboarding UX (FR66)
│   │   ├── OnboardingChecklist.tsx
│   │   ├── OnboardingStep.tsx
│   │   ├── InstallInstructions.tsx
│   │   └── PrivacyChoiceModal.tsx   # First join modal (FR71)
│   ├── analytics/
│   ├── team/
│   ├── projects/
│   └── shared/
│
├── lib/
│   ├── supabase/
│   ├── db/
│   ├── auth/
│   ├── api/
│   ├── capture/
│   │   ├── redact-secrets.ts
│   │   └── validate.ts              # Input validation (FR72)
│   ├── rate-limit/                  # Rate limiting (FR72)
│   │   └── index.ts
│   ├── hooks/
│   └── utils/
│
├── types/
├── middleware.ts
└── e2e/
```

### Architectural Boundaries

**API Boundaries:**

| Endpoint | Auth Method | Access Scope |
|----------|-------------|--------------|
| `POST /api/prompts/capture` | API Key | External (hooks) |
| `POST /api/projects/[id]/api-key` | Session | Team admin |
| `GET /api/health` | None | Public (Cloud Run) |
| All other routes | Session (cookie) | RLS-scoped |

**Component Boundaries:**

| Type | Responsibility | Examples |
|------|----------------|----------|
| Server Components | Data fetch, initial render | `prompt-list.tsx`, `page.tsx` |
| Client Components | Interactivity, real-time | `prompt-filters.tsx`, `realtime-feed.tsx` |
| API Routes | External integrations, mutations | `/api/prompts/capture` |
| Edge Functions | Async processing | `analyze-prompt` |

**Data Boundaries:**

| Layer | Isolation Mechanism |
|-------|---------------------|
| Database | RLS policies filter by `team_id` |
| JWT | `team_id` claim set on team switch |
| API | Session middleware validates access |
| Admin | Service role client bypasses RLS |

### Requirements to Structure Mapping

| PRD Feature Area | Primary Directories |
|------------------|---------------------|
| User & Auth (FR1-FR6) | `app/(auth)/`, `lib/auth/` |
| Team Management (FR7-FR13) | `app/(dashboard)/team/`, `components/team/` |
| Project Management (FR14-FR19) | `app/(dashboard)/projects/`, `app/api/projects/` |
| **Project Installation (FR55-FR65)** | **`packages/cli/`** (separate npm package) |
| Prompt Capture (FR20-FR26) | `app/api/prompts/capture/`, `lib/capture/` |
| AI Analysis (FR27-FR35) | `supabase/functions/analyze-prompt/` |
| Dashboard & Viz (FR36-FR45) | `app/(dashboard)/prompts/`, `components/prompts/` |
| Platform Admin (FR46-FR50) | `app/(dashboard)/admin/` |
| **Onboarding UX (FR66-FR71)** | `components/onboarding/`, `components/layout/` |
| **Analysis Reliability (FR72-FR74)** | `lib/rate-limit/`, `lib/capture/validate.ts`, Edge Functions |

### Key File Responsibilities

| File | Purpose |
|------|---------|
| `middleware.ts` | Redirect unauthenticated users, refresh session |
| `lib/supabase/server.ts` | Create authenticated Supabase client for Server Components |
| `lib/capture/redact-secrets.ts` | Remove sensitive data before storage |
| `lib/hooks/use-realtime.ts` | Subscribe to Supabase changes, invalidate Query cache |
| `supabase/functions/analyze-prompt/index.ts` | Call AI API, score prompt, insert analysis |

### Platform Admin Architecture (Super Admin Only)

**Access Control:**
- Platform Super Admin is a flag on the `users` table: `is_super_admin: boolean`
- Only users with `is_super_admin = true` can access `/admin/*` routes
- Middleware checks this flag and redirects non-admins to dashboard

```typescript
// middleware.ts - Admin route protection
if (pathname.startsWith('/admin')) {
  const { data: user } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_super_admin) {
    return NextResponse.redirect('/dashboard');
  }
}
```

**Admin Pages Overview:**

| Route | Purpose | PRD Reference |
|-------|---------|---------------|
| `/admin` | Admin dashboard with key metrics | FR47 |
| `/admin/users` | View/manage all platform users | FR46, FR48 |
| `/admin/teams` | View all teams, member counts | FR46 |
| `/admin/analytics` | System-wide usage analytics | FR47 |
| `/admin/analysis-config` | Configure AI analysis dimensions | FR32-FR35, FR49 |
| `/admin/analysis-config/new` | Create new analysis config version | FR35 |
| `/admin/analysis-config/[id]` | Edit existing config | FR32-FR34 |
| `/admin/system` | System health, API metrics | FR50 |

**Analysis Configuration Data Model:**

```typescript
// Analysis dimension configuration
interface AnalysisDimension {
  id: string;
  name: string;                    // e.g., "Clarity", "Context", "Specificity"
  description: string;             // Shown to users in breakdown
  weight: number;                  // Percentage weight (all must sum to 100)
  enabled: boolean;                // Can disable without deleting
  prompt_template: string;         // AI prompt for scoring this dimension
  scoring_criteria: string;        // What constitutes 1-10 score
  created_at: Date;
  updated_at: Date;
}

// Analysis configuration version
interface AnalysisConfig {
  id: string;
  version: string;                 // e.g., "1.0", "1.1", "2.0"
  name: string;                    // e.g., "Default v1", "Detailed Analysis"
  dimensions: AnalysisDimension[];
  system_prompt: string;           // Base system prompt for AI
  model: string;                   // e.g., "gpt-4o-mini", "claude-3-haiku"
  is_active: boolean;              // Only one config active at a time
  created_by: string;              // Super admin who created it
  created_at: Date;
  activated_at: Date | null;
}
```

**Admin UI Components:**

```
components/
└── admin/
    ├── AdminLayout.tsx           # Sidebar nav, header
    ├── AdminNav.tsx              # Admin navigation menu
    ├── stats/
    │   ├── StatCard.tsx          # Metric display card
    │   ├── UsageChart.tsx        # Usage over time
    │   └── SystemHealth.tsx      # Health indicators
    ├── users/
    │   ├── UserTable.tsx         # All users list
    │   ├── UserActions.tsx       # Disable/delete actions
    │   └── UserDetail.tsx        # Single user view
    ├── teams/
    │   ├── TeamTable.tsx         # All teams list
    │   └── TeamDetail.tsx        # Team overview
    ├── analysis/
    │   ├── ConfigList.tsx        # All config versions
    │   ├── ConfigEditor.tsx      # Edit config form
    │   ├── DimensionEditor.tsx   # Edit single dimension
    │   ├── PromptTemplateEditor.tsx  # Edit AI prompts
    │   └── ConfigPreview.tsx     # Test config on sample prompt
    ├── ab-tests/                 # A/B Testing (FR72-FR73)
    │   ├── ABTestList.tsx
    │   ├── ABTestCreate.tsx
    │   ├── ABTestDetail.tsx
    │   ├── ABTestResults.tsx
    │   ├── ScoreDistributionChart.tsx
    │   └── SampleComparison.tsx
    └── usage/                    # Cost/Token Tracking (FR74-FR75)
        ├── UsageOverview.tsx
        ├── UsageByUserTable.tsx
        ├── UsageByTeamTable.tsx
        ├── UsageTrendChart.tsx
        ├── CostProjection.tsx
        └── ModelComparison.tsx
```

**Admin API Routes:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/users` | GET | List all users (paginated) |
| `/api/admin/users/[id]` | PATCH | Update user (disable, etc.) |
| `/api/admin/users/[id]` | DELETE | Delete user account |
| `/api/admin/teams` | GET | List all teams |
| `/api/admin/analytics` | GET | System-wide metrics |
| `/api/admin/analysis-config` | GET | List all config versions |
| `/api/admin/analysis-config` | POST | Create new config |
| `/api/admin/analysis-config/[id]` | PUT | Update config |
| `/api/admin/analysis-config/[id]/activate` | POST | Set as active config |
| `/api/admin/system/health` | GET | System health metrics |

**Database Schema Additions:**

```sql
-- Super admin flag on users table
ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;

-- Analysis configuration tables
CREATE TABLE analysis_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  system_prompt TEXT NOT NULL,
  model VARCHAR(50) NOT NULL DEFAULT 'gpt-4o-mini',
  is_active BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

CREATE TABLE analysis_dimensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID REFERENCES analysis_configs(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  enabled BOOLEAN DEFAULT TRUE,
  prompt_template TEXT NOT NULL,
  scoring_criteria TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one active config
CREATE UNIQUE INDEX one_active_config ON analysis_configs (is_active) WHERE is_active = TRUE;

-- RLS: Only super admins can access admin tables
CREATE POLICY admin_only ON analysis_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );
```

**Admin Dashboard Metrics (FR47, FR50):**

| Metric | Source | Refresh |
|--------|--------|---------|
| Total users | `users` table count | Real-time |
| Total teams | `teams` table count | Real-time |
| Active users (24h) | `prompts` with recent timestamps | Hourly |
| Prompts today | `prompts` table count | Real-time |
| Prompts this month | `prompts` table count | Hourly |
| Avg analysis time | `prompt_analyses` timestamps | Hourly |
| Analysis success rate | Analyzed / Total prompts | Hourly |
| API error rate | Error logs | Real-time |
| Storage usage | Supabase metrics | Daily |

### CLI Package Architecture (`@contextor/cli`)

**Package Structure:**
```
packages/cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   ├── init.ts           # Main installation command (handles all scenarios)
│   │   ├── status.ts         # Check connection status
│   │   └── uninstall.ts      # Remove local config
│   ├── lib/
│   │   ├── api-client.ts     # Contextor API communication (api.contextor.co)
│   │   ├── config.ts         # Local config management (shared + personal)
│   │   ├── hooks.ts          # Claude Code hook setup
│   │   ├── token.ts          # Install token parsing and validation
│   │   └── detection.ts      # Auto-detect installation state
│   └── utils/
│       ├── gitignore.ts      # Update .gitignore safely
│       └── logger.ts         # Colored console output
└── bin/
    └── contextor.js          # Executable entry
```

**Install Token Structure:**
```
Token: ctx_<base64-encoded-payload>

Payload (decoded):
{
  "project_id": "proj_abc123",
  "team_id": "team_xyz",
  "user_id": "user_456",
  "api_key": "sk_live_...",
  "api_endpoint": "https://api.contextor.co"
}
```

**CLI Installation Flow (Single Command):**
```
User runs: npx @contextor/cli init <INSTALL_TOKEN>
                    │
                    ▼
        ┌──────────────────────┐
        │ Parse & validate     │ ◄── Decode token, verify signature
        │ Install Token        │
        └──────────────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │ Validate with API    │ ◄── POST api.contextor.co/cli/validate
        │ (token + project)    │     Returns: project name, team name
        └──────────────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │ Detect installation  │ ◄── Check .contextor/config.json exists?
        │ state                │     Check .contextor/.user exists?
        └──────────────────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
    ┌───────────┐       ┌───────────┐
    │ FRESH     │       │ JOINING   │
    │ INSTALL   │       │ PROJECT   │
    └───────────┘       └───────────┘
          │                   │
          ▼                   ▼
    ┌───────────┐       ┌───────────┐
    │ Create    │       │ Verify    │
    │ config +  │       │ config    │
    │ .user +   │       │ matches   │
    │ hooks     │       │ token     │
    └───────────┘       └───────────┘
          │                   │
          │                   ▼
          │             ┌───────────┐
          │             │ Create    │
          │             │ .user     │
          │             │ only      │
          │             └───────────┘
          │                   │
          └─────────┬─────────┘
                    ▼
        ┌──────────────────────┐
        │ Update .gitignore    │ ◄── Add .contextor/.user if missing
        └──────────────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │ Test capture         │ ◄── Send test prompt, verify receipt
        │ connection           │
        └──────────────────────┘
                    │
                    ▼
        ┌──────────────────────┐
        │ Display success      │ ◄── Show dashboard URL: app.contextor.co
        └──────────────────────┘
```

**Auto-Detection Logic:**

```typescript
// detection.ts
type InstallState = 'fresh' | 'joining' | 'configured' | 'mismatch';

function detectState(token: Token): InstallState {
  const configExists = fs.existsSync('.contextor/config.json');
  const userExists = fs.existsSync('.contextor/.user');

  if (!configExists) return 'fresh';

  const config = readConfig();
  if (config.project_id !== token.project_id) return 'mismatch';

  if (!userExists) return 'joining';

  const user = readUser();
  if (user.user_id === token.user_id) return 'configured';

  return 'joining'; // Different user, create new .user
}
```

**API Endpoints:**

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `api.contextor.co/cli/validate` | POST | Token | Validate install token, return project/team info |
| `api.contextor.co/cli/test-capture` | POST | API Key | Test capture connectivity |
| `api.contextor.co/prompts/capture` | POST | API Key | Actual prompt capture endpoint |

**Local Files Created:**

| File | Purpose | Git Status |
|------|---------|------------|
| `.contextor/config.json` | Shared project config | **Committed** |
| `.contextor/.user` | Personal user config + API key | **Gitignored** |
| `.claude/settings.json` | Hook configuration | **Committed** |
| `.claude/hooks/contextor-capture.sh` | Capture script | **Committed** |

**File Contents:**

```json
// .contextor/config.json (COMMITTED - shared across team)
{
  "project_id": "proj_abc123",
  "project_name": "My App",
  "team_id": "team_xyz",
  "team_name": "IdeaJetLab",
  "api_endpoint": "https://api.contextor.co",
  "created_at": "2025-12-20T10:30:00Z",
  "created_by": "user_456"
}

// .contextor/.user (GITIGNORED - personal per developer)
{
  "user_id": "user_456",
  "user_name": "Edgars",
  "api_key": "sk_live_xxxxx",
  "configured_at": "2025-12-20T10:30:00Z"
}
```

**CLI Command (Single Command):**
```bash
# One command handles all scenarios
npx @contextor/cli init <INSTALL_TOKEN>

# Optional: Check status
npx @contextor/cli status

# Optional: Remove configuration
npx @contextor/cli uninstall
```

**CLI Output Examples:**

```bash
# Fresh install
$ npx @contextor/cli init ctx_eyJwcm9qZWN0...

✓ Token validated
✓ Project: My App (team: IdeaJetLab)
✓ Created .contextor/config.json
✓ Created .contextor/.user
✓ Updated .gitignore
✓ Configured Claude Code hook
✓ Connection test passed

🎉 Contextor is ready!
   Dashboard: https://app.contextor.co/projects/proj_abc123
   Your prompts will appear there automatically.

# Joining existing project
$ npx @contextor/cli init ctx_eyJwcm9qZWN0...

✓ Token validated
✓ Project: My App (team: IdeaJetLab)
✓ Project already configured
✓ Created .contextor/.user (your personal config)
✓ Hooks already in place
✓ Connection test passed

🎉 Contextor is ready!
   Dashboard: https://app.contextor.co/projects/proj_abc123
   Your prompts will appear there automatically.

# Already configured
$ npx @contextor/cli init ctx_eyJwcm9qZWN0...

✓ Already configured for user Edgars
✓ Project: My App (team: IdeaJetLab)
✓ Connection test passed

No changes needed. Run 'npx @contextor/cli status' for details.
```

## MVP Features: UX & Reliability

### Analysis Status & Retry Logic (FR73-FR74)

**Database Schema:**
```sql
-- Add analysis status to prompts table
ALTER TABLE prompts ADD COLUMN analysis_status VARCHAR(20) DEFAULT 'pending';
-- Values: pending, processing, complete, failed

-- Add retry tracking
ALTER TABLE prompts ADD COLUMN analysis_attempts INTEGER DEFAULT 0;
ALTER TABLE prompts ADD COLUMN last_analysis_error TEXT;
```

**Edge Function Retry Logic:**
```typescript
// In analyze-prompt function
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // ms

async function analyzeWithRetry(promptId: string): Promise<void> {
  const { data: prompt } = await supabase
    .from('prompts')
    .select('*, analysis_attempts')
    .eq('id', promptId)
    .single();

  if (prompt.analysis_attempts >= MAX_RETRIES) {
    await supabase
      .from('prompts')
      .update({ analysis_status: 'failed' })
      .eq('id', promptId);
    return;
  }

  try {
    await supabase
      .from('prompts')
      .update({
        analysis_status: 'processing',
        analysis_attempts: prompt.analysis_attempts + 1
      })
      .eq('id', promptId);

    const analysis = await performAnalysis(prompt);

    await supabase
      .from('prompts')
      .update({ analysis_status: 'complete' })
      .eq('id', promptId);

  } catch (error) {
    await supabase
      .from('prompts')
      .update({
        analysis_status: 'pending',
        last_analysis_error: error.message
      })
      .eq('id', promptId);

    // Schedule retry with exponential backoff
    const delay = RETRY_DELAYS[prompt.analysis_attempts] || 30000;
    await scheduleRetry(promptId, delay);
  }
}
```

**Dead Letter Queue:**
```sql
-- View for failed analyses requiring manual review
CREATE VIEW failed_analyses AS
SELECT p.id, p.text, p.analysis_attempts, p.last_analysis_error, p.created_at
FROM prompts p
WHERE p.analysis_status = 'failed'
ORDER BY p.created_at DESC;
```

---

### Rate Limiting (FR72)

**Specification:**
| Scope | Limit | Window |
|-------|-------|--------|
| Per Project | 100 prompts | per minute |
| Per User | 20 prompts | per minute |
| Per IP (unauthenticated) | 10 requests | per minute |

**Implementation (API Route):**
```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export const projectRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: 'ratelimit:project',
});

export const userRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'ratelimit:user',
});

// In /api/prompts/capture
const { success: projectOk } = await projectRateLimit.limit(projectId);
const { success: userOk } = await userRateLimit.limit(userId);

if (!projectOk || !userOk) {
  return Response.json(
    { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    { status: 429 }
  );
}
```

**Environment Variables:**
```
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx
```

---

### Input Validation (FR72)

**Prompt Length Limits:**
```typescript
// lib/capture/validate.ts
const MAX_PROMPT_LENGTH = 100_000; // 100K characters
const MIN_PROMPT_LENGTH = 10;      // Reject empty/trivial prompts

export function validatePrompt(text: string): ValidationResult {
  if (!text || text.length < MIN_PROMPT_LENGTH) {
    return { valid: false, error: 'Prompt too short (min 10 characters)' };
  }

  if (text.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: 'Prompt too long (max 100K characters)' };
  }

  return { valid: true };
}
```

**API Response:**
```json
{
  "error": {
    "code": "PROMPT_TOO_LONG",
    "message": "Prompt exceeds maximum length of 100,000 characters",
    "details": { "length": 150000, "max": 100000 }
  }
}
```

---

### Onboarding UX Components (FR66-FR71)

**Onboarding Checklist Component:**
```
components/
└── onboarding/
    ├── OnboardingChecklist.tsx    # Sidebar checklist widget
    ├── OnboardingStep.tsx         # Individual step component
    ├── InstallInstructions.tsx    # Copy-paste CLI commands
    └── TeamContextBadge.tsx       # Current team indicator
```

**Checklist State (stored in localStorage + verified against DB):**
```typescript
interface OnboardingState {
  accountCreated: boolean;      // Always true if logged in
  projectInstalled: boolean;    // Check: user has at least 1 project
  firstPromptCaptured: boolean; // Check: user has at least 1 prompt
  firstAnalysisViewed: boolean; // Track: user clicked on analysis
}
```

**Empty State for Prompt Feed:**
```tsx
// components/prompts/EmptyPromptFeed.tsx
export function EmptyPromptFeed({ hasProjects }: { hasProjects: boolean }) {
  if (!hasProjects) {
    return (
      <EmptyState
        icon={<FolderPlus />}
        title="No projects yet"
        description="Create a project to start capturing prompts"
        action={<CreateProjectButton />}
      />
    );
  }

  return (
    <EmptyState
      icon={<Terminal />}
      title="Waiting for your first prompt"
      description="Install Contextor in your project to start capturing"
      action={<InstallInstructions />}
    />
  );
}
```

**Analysis Loading State:**
```tsx
// components/prompts/PromptCard.tsx
function AnalysisStatus({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline">Queued</Badge>;
    case 'processing':
      return (
        <Badge variant="outline" className="animate-pulse">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Analyzing...
        </Badge>
      );
    case 'failed':
      return <Badge variant="destructive">Analysis failed</Badge>;
    case 'complete':
      return null; // Show actual analysis
  }
}
```

**Team Context Header:**
```tsx
// components/layout/TeamSwitcher.tsx
// Shows current team name with dropdown to switch
// Appears in dashboard header, always visible
```

**Score with Team Average:**
```tsx
// components/prompts/ScoreDisplay.tsx
export function ScoreDisplay({ score, teamAverage }: Props) {
  const comparison = score > teamAverage ? 'above' : score < teamAverage ? 'below' : 'at';

  return (
    <div>
      <span className="text-2xl font-bold">{score}/10</span>
      <span className="text-sm text-muted-foreground ml-2">
        ({comparison} team avg of {teamAverage.toFixed(1)})
      </span>
    </div>
  );
}
```

---

## Post-MVP Features Architecture

*The following features are architected for future implementation after MVP validation.*

### Privacy Toggle

**Database Schema:**
```sql
-- Add privacy flag to users table
ALTER TABLE users ADD COLUMN prompt_privacy_mode BOOLEAN DEFAULT FALSE;
```

**RLS Policy Update:**
```sql
-- Team members see prompt.text only if privacy mode is OFF or they own the prompt
CREATE POLICY team_prompt_visibility ON prompts
  FOR SELECT USING (
    -- User can always see their own prompts
    user_id = auth.uid()
    OR
    -- Team members see prompts where privacy is OFF
    (
      team_id = (auth.jwt() ->> 'team_id')::uuid
      AND NOT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = prompts.user_id
        AND u.prompt_privacy_mode = TRUE
      )
    )
  );

-- Analysis is always visible to team (scores, suggestions, dimensions)
CREATE POLICY team_analysis_visibility ON prompt_analyses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prompts p
      WHERE p.id = prompt_analyses.prompt_id
      AND p.team_id = (auth.jwt() ->> 'team_id')::uuid
    )
  );
```

**API Response Transformation:**
```typescript
// When returning prompts to non-owners with privacy mode ON
function transformPromptForTeam(prompt: Prompt, requesterId: string): Prompt {
  if (prompt.user_id !== requesterId && prompt.user.prompt_privacy_mode) {
    return {
      ...prompt,
      text: '[Private - analysis only visible]',
      // Keep all analysis fields visible
    };
  }
  return prompt;
}
```

**UI Components:**
- Settings page toggle: "Share prompt text with team"
- Visual indicator on private prompts in team feed (lock icon)

---

### Email Infrastructure (FR68-FR70)

**Technology Choice:** Resend (recommended)
- Native React Email support
- Simple API, generous free tier
- Good Supabase/Next.js integration

**Project Structure:**
```
lib/
└── email/
    ├── client.ts              # Resend client initialization
    ├── send.ts                # Email sending utilities
    ├── templates/
    │   ├── welcome.tsx        # Welcome email (after signup)
    │   ├── first-milestone.tsx  # "10 prompts captured!"
    │   ├── weekly-digest.tsx  # Weekly activity summary
    │   └── components/        # Shared email components
    │       ├── header.tsx
    │       ├── footer.tsx
    │       └── stats-card.tsx
    └── triggers.ts            # Email trigger logic

supabase/
└── functions/
    ├── send-milestone-email/  # Triggered on prompt count
    └── send-weekly-digest/    # Scheduled cron
```

**Database Schema:**
```sql
CREATE TABLE email_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weekly_digest BOOLEAN DEFAULT TRUE,
  milestone_emails BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  template VARCHAR(50) NOT NULL,
  subject VARCHAR(200),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent',  -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  metadata JSONB
);

-- Index for checking recent emails (prevent duplicates)
CREATE INDEX idx_email_logs_user_template ON email_logs(user_id, template, sent_at);
```

**Milestone Email Trigger (Edge Function):**
```typescript
// supabase/functions/check-milestones/index.ts
// Triggered by database webhook on prompt insert

const MILESTONES = [10, 50, 100, 500];

export async function checkMilestones(promptUserId: string) {
  const { count } = await supabase
    .from('prompts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', promptUserId);

  if (MILESTONES.includes(count)) {
    await sendMilestoneEmail(promptUserId, count);
  }
}
```

**Weekly Digest Cron (Supabase):**
```sql
-- In supabase/config.toml or via dashboard
SELECT cron.schedule(
  'weekly-digest',
  '0 9 * * 1',  -- Every Monday at 9am UTC
  $$SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/send-weekly-digest',
    headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'
  )$$
);
```

**Environment Variables:**
```
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=Contextor <hello@contextor.co>
```

---

### A/B Testing Implementation (FR72-FR73)

**Database Schema:**
```sql
CREATE TABLE ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  hypothesis TEXT,  -- What we're trying to prove
  config_version_a UUID NOT NULL REFERENCES analysis_configs(id),
  config_version_b UUID NOT NULL REFERENCES analysis_configs(id),
  traffic_split INTEGER DEFAULT 50 CHECK (traffic_split BETWEEN 1 AND 99),
  status VARCHAR(20) DEFAULT 'draft',  -- draft, running, paused, completed
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner VARCHAR(1),  -- 'A', 'B', or NULL
  conclusion TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ab_test_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  assigned_version CHAR(1) NOT NULL CHECK (assigned_version IN ('A', 'B')),
  config_id UUID NOT NULL REFERENCES analysis_configs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(test_id, prompt_id)
);

-- Index for quick lookups
CREATE INDEX idx_ab_assignments_test ON ab_test_assignments(test_id);
CREATE INDEX idx_ab_assignments_prompt ON ab_test_assignments(prompt_id);

-- RLS: Only super admins can manage A/B tests
CREATE POLICY admin_ab_tests ON ab_tests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = TRUE)
  );
```

**API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/ab-tests` | GET | List all A/B tests |
| `/api/admin/ab-tests` | POST | Create new A/B test |
| `/api/admin/ab-tests/[id]` | GET | Get test details with results |
| `/api/admin/ab-tests/[id]` | PATCH | Update test (name, description) |
| `/api/admin/ab-tests/[id]/start` | POST | Start running test |
| `/api/admin/ab-tests/[id]/pause` | POST | Pause test |
| `/api/admin/ab-tests/[id]/complete` | POST | End test, record winner |
| `/api/admin/ab-tests/[id]/results` | GET | Detailed results data |

**Analysis Assignment Logic (Edge Function):**
```typescript
// In analyze-prompt function
async function getAnalysisConfig(promptId: string): Promise<AnalysisConfig> {
  // Check for running A/B test
  const { data: runningTest } = await supabase
    .from('ab_tests')
    .select('*')
    .eq('status', 'running')
    .single();

  if (!runningTest) {
    // No A/B test, use active config
    return getActiveConfig();
  }

  // Random assignment based on traffic split
  const assignToB = Math.random() * 100 < runningTest.traffic_split;
  const assignedVersion = assignToB ? 'B' : 'A';
  const configId = assignToB
    ? runningTest.config_version_b
    : runningTest.config_version_a;

  // Record assignment
  await supabase.from('ab_test_assignments').insert({
    test_id: runningTest.id,
    prompt_id: promptId,
    assigned_version: assignedVersion,
    config_id: configId
  });

  return getConfigById(configId);
}
```

**Results Calculation:**
```typescript
interface ABTestResults {
  testId: string;
  versionA: {
    promptCount: number;
    avgOverallScore: number;
    scoreDistribution: number[];  // [0-2, 2-4, 4-6, 6-8, 8-10]
    avgDimensionScores: Record<string, number>;
  };
  versionB: {
    // Same structure
  };
  statisticalSignificance: number;  // p-value
  recommendation: 'A' | 'B' | 'inconclusive';
}
```

**Admin UI Components:**
```
components/admin/ab-tests/
├── ABTestList.tsx         # List all tests with status
├── ABTestCreate.tsx       # Create new test form
├── ABTestDetail.tsx       # Single test view with results
├── ABTestResults.tsx      # Charts and comparisons
├── ScoreDistributionChart.tsx  # Side-by-side histograms
└── SampleComparison.tsx   # Same prompt, different analyses
```

---

### Admin LLM Selection (FR71)

**Database Schema:**
```sql
-- Supported LLM models (seeded by migrations)
CREATE TABLE supported_llm_models (
  id VARCHAR(50) PRIMARY KEY,  -- 'gpt-4o-mini', 'claude-3-haiku', etc.
  display_name VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,  -- 'openai', 'anthropic'
  cost_per_1k_input DECIMAL(10,6) NOT NULL,
  cost_per_1k_output DECIMAL(10,6) NOT NULL,
  max_tokens INTEGER DEFAULT 4096,
  is_enabled BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO supported_llm_models (id, display_name, provider, cost_per_1k_input, cost_per_1k_output, is_enabled, sort_order) VALUES
  ('gpt-4o-mini', 'GPT-4o Mini', 'openai', 0.00015, 0.0006, TRUE, 1),
  ('gpt-4o', 'GPT-4o', 'openai', 0.0025, 0.01, TRUE, 2),
  ('claude-3-haiku-20240307', 'Claude 3 Haiku', 'anthropic', 0.00025, 0.00125, TRUE, 3),
  ('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'anthropic', 0.003, 0.015, FALSE, 4);

-- Update analysis_configs to reference model
ALTER TABLE analysis_configs
  ADD COLUMN model VARCHAR(50) NOT NULL DEFAULT 'gpt-4o-mini'
  REFERENCES supported_llm_models(id);
```

**Admin UI:**
- Dropdown in analysis config editor showing enabled models
- Display cost per 1K tokens for transparency
- Disable expensive models initially (enable as budget allows)

**Edge Function Update:**
```typescript
// analyze-prompt function selects provider based on config.model
async function callLLM(config: AnalysisConfig, prompt: string) {
  const model = config.model;
  const modelInfo = await getModelInfo(model);

  if (modelInfo.provider === 'openai') {
    return callOpenAI(model, prompt);
  } else if (modelInfo.provider === 'anthropic') {
    return callAnthropic(model, prompt);
  }
}
```

---

### Cost/Token Tracking (FR74-FR75)

**Database Schema:**
```sql
CREATE TABLE analysis_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES prompt_analyses(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  team_id UUID NOT NULL REFERENCES teams(id),
  model VARCHAR(50) NOT NULL REFERENCES supported_llm_models(id),
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  estimated_cost_usd DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient aggregation
CREATE INDEX idx_usage_user_date ON analysis_usage(user_id, created_at);
CREATE INDEX idx_usage_team_date ON analysis_usage(team_id, created_at);
CREATE INDEX idx_usage_model ON analysis_usage(model, created_at);

-- Materialized view for dashboard (refresh periodically)
CREATE MATERIALIZED VIEW usage_daily_summary AS
SELECT
  date_trunc('day', created_at) as date,
  user_id,
  team_id,
  model,
  COUNT(*) as analysis_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost_usd) as total_cost_usd
FROM analysis_usage
GROUP BY date_trunc('day', created_at), user_id, team_id, model;

CREATE UNIQUE INDEX idx_usage_daily_summary
  ON usage_daily_summary(date, user_id, team_id, model);
```

**Cost Calculation (Edge Function):**
```typescript
// In analyze-prompt function
async function recordUsage(
  promptId: string,
  analysisId: string,
  userId: string,
  teamId: string,
  model: string,
  usage: { input_tokens: number; output_tokens: number }
) {
  const modelPricing = await supabase
    .from('supported_llm_models')
    .select('cost_per_1k_input, cost_per_1k_output')
    .eq('id', model)
    .single();

  const cost =
    (usage.input_tokens / 1000) * modelPricing.data.cost_per_1k_input +
    (usage.output_tokens / 1000) * modelPricing.data.cost_per_1k_output;

  await supabase.from('analysis_usage').insert({
    prompt_id: promptId,
    analysis_id: analysisId,
    user_id: userId,
    team_id: teamId,
    model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    estimated_cost_usd: cost
  });
}
```

**Admin API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/usage` | GET | Aggregated usage stats |
| `/api/admin/usage/by-user` | GET | Per-user breakdown |
| `/api/admin/usage/by-team` | GET | Per-team breakdown |
| `/api/admin/usage/by-model` | GET | Per-model breakdown |
| `/api/admin/usage/projections` | GET | Monthly cost projections |

**Admin Dashboard Widgets:**

| Widget | Query | Purpose |
|--------|-------|---------|
| **Total Cost (Month)** | `SUM(estimated_cost_usd) WHERE created_at > start_of_month` | Budget tracking |
| **Cost by Team** | `GROUP BY team_id` | Identify heavy users |
| **Cost by User** | `GROUP BY user_id` | Individual tracking |
| **Cost by Model** | `GROUP BY model` | Model efficiency |
| **Daily Trend** | `GROUP BY date` | Usage patterns |
| **Avg Cost/Prompt** | `AVG(estimated_cost_usd)` | Pricing basis |
| **Projected Monthly** | `current_rate * days_remaining` | Forecasting |

**Pricing Insights Query:**
```sql
-- Average cost per active user (for pricing decisions)
SELECT
  COUNT(DISTINCT user_id) as active_users,
  SUM(estimated_cost_usd) as total_cost,
  SUM(estimated_cost_usd) / COUNT(DISTINCT user_id) as cost_per_user,
  AVG(estimated_cost_usd) as avg_cost_per_analysis
FROM analysis_usage
WHERE created_at > NOW() - INTERVAL '30 days';
```

**Admin UI Components:**
```
components/admin/usage/
├── UsageOverview.tsx       # Summary cards
├── UsageByUserTable.tsx    # Sortable user table
├── UsageByTeamTable.tsx    # Team breakdown
├── UsageTrendChart.tsx     # Line chart over time
├── CostProjection.tsx      # Forecast widget
└── ModelComparison.tsx     # Cost efficiency by model
```

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices (Next.js 15, Supabase, Drizzle ORM, TanStack Query, Tailwind/shadcn/ui, Cloud Run) are compatible and well-integrated. No version conflicts detected.

**Pattern Consistency:** Implementation patterns align with technology stack conventions. Naming, structure, and communication patterns are internally consistent.

**Structure Alignment:** Project structure follows Next.js 15 App Router conventions and properly supports all architectural decisions.

### Requirements Coverage ✅

**Functional Requirements:** All 74 MVP FRs are architecturally supported with clear implementation paths. Post-MVP features (Privacy, Email, A/B Testing, LLM Selection, Cost Tracking) are documented in the Post-MVP Features Architecture section.

**Non-Functional Requirements:** Performance, security, scalability, reliability, and integration requirements are addressed through technology choices and patterns.

### Implementation Readiness ✅

**Decision Completeness:** All critical decisions documented with verified versions.

**Structure Completeness:** Full project tree defined with 50+ files and directories.

**Pattern Completeness:** Naming, structure, communication, and process patterns fully specified.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context analyzed (74 MVP FRs, NFRs identified)
- [x] Scale assessed (Medium-High complexity SaaS)
- [x] Technical constraints identified (Supabase, Cloud Run)
- [x] Cross-cutting concerns mapped (Auth, RLS, Realtime, Redaction, Rate Limiting)

**✅ Architectural Decisions**
- [x] Technology stack specified with versions
- [x] Data architecture defined (Supabase + Drizzle)
- [x] Auth/security patterns established
- [x] API and communication patterns defined
- [x] Frontend architecture specified

**✅ Implementation Patterns**
- [x] Naming conventions for all contexts
- [x] API response format standardized
- [x] Error handling patterns documented
- [x] Component patterns defined
- [x] State management rules established

**✅ Project Structure**
- [x] Complete directory tree defined
- [x] Component boundaries established
- [x] Requirements mapped to directories
- [x] Integration points documented

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Clean, modern stack with excellent tooling
- Supabase provides auth, database, and realtime in one platform
- RLS-based multi-tenancy is robust and proven
- Clear separation of concerns in project structure

**Areas for Future Enhancement:**
- Monitoring and observability (post-MVP)
- Advanced caching strategies (as traffic grows)
- Test infrastructure (integration, E2E)

### Implementation Handoff

**AI Agent Guidelines:**
1. Follow all architectural decisions exactly as documented
2. Use implementation patterns consistently across all components
3. Respect project structure and naming conventions
4. Refer to this document for architectural questions

**First Implementation Step:**
```bash
npx create-next-app@latest contextor -e with-supabase
```

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2025-12-19
**Document Location:** `_bmad-output/architecture.md`

### Final Architecture Deliverables

**📋 Complete Architecture Document**
- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**🏗️ Implementation Ready Foundation**
- 15+ architectural decisions made
- 20+ implementation patterns defined
- 8 architectural component areas specified
- 54 functional requirements fully supported

**📚 AI Agent Implementation Guide**
- Technology stack with verified versions
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries
- Integration patterns and communication standards

### Development Sequence

1. Initialize project: `npx create-next-app@latest contextor -e with-supabase`
2. Set up Supabase project and link to local development
3. Create database migrations for core tables
4. Implement authentication flow
5. Build capture endpoint and secret redaction
6. Implement dashboard with real-time updates
7. Add AI analysis Edge Function
8. Deploy to Google Cloud Run

### Quality Assurance Checklist

**✅ Architecture Coherence**
- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**
- [x] All 74 MVP functional requirements are supported
- [x] All non-functional requirements are addressed
- [x] Cross-cutting concerns are handled
- [x] Integration points are defined
- [x] Post-MVP features documented for future implementation

**✅ Implementation Readiness**
- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

---

**Architecture Status:** ✅ READY FOR IMPLEMENTATION

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.

