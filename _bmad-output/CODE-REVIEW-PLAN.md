# Contextor Code Review Plan

**Created:** 2025-12-22
**Status:** APPROVED - Ready for execution
**Model:** Opus 4.5 for all subagents

---

## Codebase Overview

| Category | Count |
|----------|-------|
| **TypeScript/TSX Files** | 343 files |
| **CLI Package Files** | 19 files |
| **Database Migrations** | 20 migrations |
| **E2E Test Files** | 29 specs (8,462 lines) |
| **Epics Implemented** | 9 (all complete) |

---

## Layer 1: Cross-Cutting Concerns (Sequential)

### 1A: Security & Authentication Audit

**Focus:** Vulnerabilities, auth bypass, injection, secrets handling

| File Category | Files to Review |
|---------------|-----------------|
| **Auth Routes** | `app/(auth)/callback/route.ts`, `app/(auth)/*/page.tsx` |
| **Auth Lib** | `lib/auth/admin.ts`, `lib/auth/session.ts`, `lib/auth/security-headers.ts` |
| **API Key Validation** | `lib/api/validate-api-key.ts`, `lib/utils/api-key.ts` |
| **Secret Redaction** | `lib/capture/redact-secrets.ts` + `.test.ts` |
| **Rate Limiting** | `lib/rate-limit/index.ts` |
| **RLS Migrations** | `20251220100000_rls_security_foundation.sql`, `20251220230000_fix_team_members_rls.sql` |
| **Supabase Clients** | `lib/supabase/admin.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts` |

### 1B: Database Schema & Data Integrity

**Focus:** Schema design, RLS policies, migration correctness

| Files to Review |
|-----------------|
| All 20 migration files in `supabase/migrations/` |
| `lib/db/queries/*.ts` (7 files) |

---

## Layer 2: Domain Reviews (Parallel Subagents)

### Subagent A: Authentication Domain (Epic 1)

**Scope:** User registration, login, OAuth, password reset, sessions

| Category | Files |
|----------|-------|
| **Pages** | `app/(auth)/login/page.tsx`, `signup/page.tsx`, `verify-email/page.tsx`, `reset-password/*.tsx`, `error/page.tsx` |
| **Components** | `components/login-form.tsx`, `sign-up-form.tsx`, `forgot-password-form.tsx`, `update-password-form.tsx`, `auth-button.tsx`, `auth/google-auth-button.tsx`, `auth/auth-error-toast.tsx`, `auth/access-denied-handler.tsx` |
| **Lib** | `lib/validations/auth.ts`, `lib/validations/profile.ts` |
| **Tests** | `e2e/auth.spec.ts`, `e2e/password-recovery.spec.ts` |

**Review Questions:**
- OAuth flow correctness (Google)
- Password reset token handling
- Session cookie security
- Error message information leakage

---

### Subagent B: Team & Project Management (Epic 2)

**Scope:** Teams, members, roles, invitations, projects, API keys

| Category | Files |
|----------|-------|
| **Team API** | `api/teams/route.ts`, `api/teams/[teamId]/route.ts`, `members/route.ts`, `members/[memberId]/route.ts`, `invitations/route.ts`, `leave/route.ts`, `switch/route.ts` |
| **Project API** | `api/projects/route.ts`, `api/projects/[projectId]/route.ts`, `archive/route.ts`, `regenerate-key/route.ts` |
| **Invitation API** | `api/invitations/[token]/route.ts`, `accept/route.ts` |
| **Team Components** | `components/team/*.tsx` (5 files), `components/team-settings/*.tsx` (2 files), `components/layout/team-switcher.tsx` |
| **Project Components** | `components/projects/*.tsx` (8 files) |
| **Pages** | `(dashboard)/team/page.tsx`, `teams/new/page.tsx`, `teams/[teamId]/settings/page.tsx`, `projects/*.tsx` (5 pages) |
| **Hooks** | `lib/hooks/use-teams.ts`, `use-team-members.ts`, `use-current-team.ts`, `use-switch-team.ts`, `use-create-team.ts`, `use-update-team.ts`, `use-projects.ts`, `use-create-project.ts`, `use-update-project.ts`, `use-archive-project.ts`, `use-regenerate-key.ts`, `use-invitations.ts` |
| **Validations** | `lib/validations/team.ts`, `lib/validations/project.ts`, `lib/validations/invitation.ts` |
| **Tests** | `e2e/team-*.spec.ts` (5 files), `e2e/project-*.spec.ts` (3 files) |

**Review Questions:**
- Role-based access control correctness
- Invitation token security
- API key generation entropy
- Team isolation (RLS)

---

### Subagent C: CLI Package (Epic 3)

**Scope:** NPM package, token validation, hook installation

| Files |
|-------|
| `packages/cli/src/bin/contextor.ts` |
| `packages/cli/src/commands/init.ts`, `status.ts`, `uninstall.ts` |
| `packages/cli/src/lib/api-client.ts`, `config.ts`, `detection.ts`, `gitignore.ts`, `hooks.ts`, `messages.ts`, `token.ts` |
| `packages/cli/src/lib/__tests__/*.test.ts` (8 test files) |
| `app/api/cli/*.ts` (3 API routes) |

**Review Questions:**
- Token validation flow security
- Hook file generation correctness
- Idempotent re-runs
- Error handling and messaging

---

### Subagent D: Prompt Capture Pipeline (Epic 4)

**Scope:** Capture API, validation, storage, redaction

| Category | Files |
|----------|-------|
| **Capture API** | `api/prompts/capture/route.ts` |
| **Capture Lib** | `lib/capture/store-prompt.ts`, `classify-prompt.ts`, `word-count.ts`, `constants.ts`, `errors.ts`, `retry.ts`, `redact-secrets.ts` |
| **Capture Tests** | `lib/capture/*.test.ts` (5 test files) |
| **Validations** | `lib/validations/capture.ts` |
| **E2E** | `e2e/capture-api.spec.ts`, `e2e/prompt-storage.spec.ts` |
| **Migration** | `20251221000000_create_prompts_table.sql`, `20251221120000_add_retry_columns_to_prompts.sql`, `20251221220000_add_prompt_classification.sql` |

**Review Questions:**
- API key validation before storage
- Secret redaction completeness
- Rate limiting effectiveness
- Error recovery and retry logic

---

### Subagent E: AI Analysis Engine (Epic 5)

**Scope:** Edge Function, scoring, suggestions, config versioning

| Category | Files |
|----------|-------|
| **Edge Function** | `supabase/functions/analyze-prompt/index.ts`, `lib/ai-client.ts`, `lib/prompts.ts`, `lib/scoring.ts`, `lib/suggestion-formatter.ts`, `lib/fallback-suggestions.ts`, `lib/error-classifier.ts`, `lib/retry-scheduler.ts` |
| **Types** | `lib/types/analysis.ts`, `lib/types/analysis-config.ts` |
| **DB Queries** | `lib/db/queries/analyses.ts`, `lib/db/queries/analysis-config.ts` |
| **Migrations** | `20251221100000_create_analysis_configs_table.sql`, `20251221100001_seed_default_analysis_config.sql`, `20251221110000_create_prompt_analyses_table.sql`, `20251221210000_create_analyze_prompt_trigger.sql` |

**Review Questions:**
- AI prompt injection risks
- Scoring algorithm consistency
- Config version isolation
- Retry and fallback behavior

---

### Subagent F: Dashboard, Feed & Analytics (Epic 6)

**Scope:** Feed, filters, prompt detail, charts, onboarding

| Category | Files |
|----------|-------|
| **Feed Components** | `components/feed/*.tsx` (18 files) |
| **Prompt Detail** | `components/prompt-detail/*.tsx` (5 files) |
| **Analytics** | `components/analytics/*.tsx` (14 files) |
| **Onboarding** | `components/onboarding/*.tsx` (9 files) |
| **Dashboard** | `components/dashboard/*.tsx` (3 files) |
| **Pages** | `(dashboard)/home/page.tsx`, `prompts/*.tsx` (2), `analytics/page.tsx`, `settings/page.tsx` |
| **Hooks** | `use-prompts.ts`, `use-prompt.ts`, `use-realtime-prompts.ts`, `use-team-average.ts`, `use-realtime-team-average.ts`, `use-persisted-filters.ts`, `use-onboarding-*.ts` (3), `use-*-analytics.ts` (4) |
| **Types** | `lib/types/prompt.ts`, `lib/types/filters.ts` |
| **Tests** | `e2e/prompt-*.spec.ts` (3), `e2e/feed-*.spec.ts`, `e2e/*-analytics.spec.ts` (2), `e2e/onboarding-*.spec.ts`, `e2e/empty-states.spec.ts`, `e2e/dashboard-layout.spec.ts` |

**Review Questions:**
- Real-time subscription management
- Filter state persistence
- Score calculation accuracy
- Accessibility compliance

---

### Subagent G: Platform Administration (Epic 7)

**Scope:** Super admin features, user/team management, system health

| Category | Files |
|----------|-------|
| **Admin API** | `api/admin/*.ts` (6 routes) |
| **Admin Components** | `components/admin/*.tsx` (20 files) |
| **Admin Pages** | `(dashboard)/admin/*.tsx` (10 pages + layout) |
| **Services** | `lib/services/admin-users.ts`, `lib/services/admin-config.ts` |
| **DB Queries** | `lib/db/queries/admin-*.ts`, `system-*.ts`, `dead-letter.ts` |
| **Hooks** | `use-admin-stats.ts`, `use-admin-health.ts` |
| **Migrations** | `20251221200000_add_user_status_columns.sql`, `20251221200001_create_admin_audit_logs.sql`, `20251221200002_add_email_to_users.sql` |
| **Tests** | `e2e/admin-*.spec.ts` (6 files) |

**Review Questions:**
- Super admin privilege escalation protection
- Audit log completeness
- Cross-team data access controls
- System health accuracy

---

### Subagent H: Infrastructure & Deployment (Epic 9)

**Scope:** Docker, CI/CD, production config, monitoring

| Files |
|-------|
| `app/Dockerfile` |
| `app/proxy.ts` |
| `.github/workflows/*.yml` (if exists) |
| `app/package.json` (scripts section) |
| `lib/utils/get-origin.ts` |
| `e2e/production-smoke.spec.ts`, `e2e/rate-limiting.spec.ts` |

**Review Questions:**
- Docker security (non-root, minimal image)
- Environment variable handling
- Production secrets management
- Health check correctness

---

## Layer 3: Integration Review (Sequential)

After all domain reviews complete:

| Focus Area | Files |
|------------|-------|
| **Cross-domain data flow** | API routes that span domains |
| **Error propagation** | How errors bubble up across layers |
| **Type consistency** | `types/` folder alignment with API responses |
| **Test coverage gaps** | Missing integration tests between domains |

---

## Execution Plan

| Phase | Subagents | Model | Parallel? |
|-------|-----------|-------|-----------|
| **Layer 1A** | Security Audit | Opus 4.5 | No (Sequential) |
| **Layer 1B** | Schema Review | Opus 4.5 | No (Sequential) |
| **Layer 2** | A, B, C, D, E, F, G, H | Opus 4.5 | **Yes (8 parallel)** |
| **Layer 3** | Integration Review | Opus 4.5 | No (Sequential) |

---

## Expected Output Per Subagent

Each subagent produces:
- Security findings (Critical/High/Medium/Low)
- Code quality issues
- Architecture concerns
- Specific recommendations with file:line references
