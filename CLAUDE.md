# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Contextor is a prompt journaling system for AI-assisted development teams. It captures prompts to enable team learning, reflection, and improvement of prompting skills.

**Architecture:** Hybrid capture system with two methods:
1. **Claude Code Hook** - Automatic capture via `UserPromptSubmit` hook (captures ALL prompts)
2. **BMAD Native** - Agent-embedded capture that overwrites hook entries with richer metadata

## Document Standards for All Agents

### Table of Contents Requirement

**All documents exceeding 200 lines MUST include a Table of Contents (TOC) with line number references.**

Format:
```markdown
## Table of Contents

- [Section Name](#section-name) (Line X)
  - [Subsection Name](#subsection-name) (Line Y)
```

**Why:** Long documents become difficult to navigate. Line numbers allow agents and users to jump directly to relevant sections.

**When to add TOC:**
- When creating a new document that will exceed 200 lines
- When editing an existing document and it now exceeds 200 lines without a TOC
- Always include all heading levels (##, ###, ####)

**Example:** See `_bmad-output/prd.md` for a comprehensive TOC implementation.

---

## CRITICAL: API Endpoint Convention

**This is a common source of bugs. All agents MUST understand this.**

The `API_ENDPOINT` stored in project config INCLUDES the `/api` prefix:
```
API_ENDPOINT = "http://127.0.0.1:3050/api"  ← INCLUDES /api
```

When building URLs in capture hooks or CLI code, append ONLY the route path:
```bash
# CORRECT:
curl "${API_ENDPOINT}/prompts/capture"
# Result: http://127.0.0.1:3050/api/prompts/capture

# WRONG - DO NOT DO THIS:
curl "${API_ENDPOINT}/api/prompts/capture"
# Result: http://127.0.0.1:3050/api/api/prompts/capture (404!)
```

### Why This Matters
- The CLI templates at `packages/cli/src/lib/hooks.ts` define the capture hook
- The hook is deployed to target projects at `.claude/hooks/contextor-capture.sh`
- If the URL construction is wrong, prompts fail silently (no errors shown to user)

### Project Structure Context
```
context-coach/
├── app/                    ← Next.js app (the "web" part)
│   └── app/                ← Next.js App Router directory
│       └── api/            ← API routes start here
│           └── prompts/
│               └── capture/route.ts  ← POST /api/prompts/capture
├── packages/
│   └── cli/                ← CLI package (generates hooks)
```

The nested `app/app/` is standard Next.js 13+ structure (outer `app` is project root, inner `app` is App Router).

## CRITICAL: Supabase API Key is Case-Sensitive

**This bug has broken production authentication MULTIPLE times. NEVER type the API key manually.**

The Supabase publishable key contains mixed-case characters. A single wrong character (e.g., `x` vs `X`) causes:
- `[AUTH] Code exchange error: Invalid API key`
- Google OAuth login completely broken
- All authentication fails

### The Solution: Use the Deploy Script

**ALWAYS use the deploy script instead of manual docker build commands:**

```bash
cd app && ./scripts/deploy.sh v1.2.3
```

The script contains the correct API key as a single source of truth. Never copy/paste the key manually.

### If You Must Build Manually

Copy the EXACT key from this file (triple-check the case):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkc2thbmppb2JyanBoc2Nza29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMTMzNTIsImV4cCI6MjA4MTg4OTM1Mn0.lB5CtFZunXFR6QbE2OvKRaMWVhZ-zOEb1GmAVqdtKTA
```

Note the `unXFR` portion - that `X` is uppercase!

## Development Server

**Port:** Use `3050` for this project (port 3000 is used by other projects)

```bash
# Start dev server
cd app && npm run dev -- -p 3050
```

**Important for agents:** Always check if a port is available before starting a dev server. If not available, use an uncommon port (3050, 3051, etc.) to avoid conflicts.

## CRITICAL: Cloud Supabase Only

**This project uses Cloud Supabase for ALL development - local Supabase is NOT used.**

- **Cloud Supabase URL:** `https://ddskanjiobrjphscskog.supabase.co`
- **No local Supabase instance** - Do NOT run `supabase start` or `supabase stop`
- **All developers connect to the same Cloud database** for consistency

The `.env.local` file contains Cloud Supabase credentials. See `app/.env.local` for the current configuration.

### Test User (Cloud Database)

A test user exists in the Cloud Supabase database for development:

| Field | Value |
|-------|-------|
| **Email** | `edgars@test.com` |
| **Password** | `password123` |
| **Team** | Test Team |
| **Project** | Test Project |
| **User ID** | `11111111-1111-1111-1111-111111111111` |
| **Team ID** | `22222222-2222-2222-2222-222222222222` |
| **Project ID** | `44444444-4444-4444-4444-444444444444` |

## CRITICAL: Database Operations - DO NOT WIPE DATA

**NEVER use `supabase db reset` unless explicitly requested by the user.** It wipes ALL data including test prompts, user-created teams, and any manual testing data.

### Applying New Migrations to Cloud Supabase

Since we use Cloud Supabase only, migrations are applied directly to the cloud database:

```bash
# Apply migrations to Cloud Supabase (requires access token)
cd app && SUPABASE_ACCESS_TOKEN=<token> npx supabase db push

# The access token is stored in root .env file
```

**Note:** The project is already linked to `ddskanjiobrjphscskog` via `supabase link`, so no `--project-ref` flag is needed.

### Database Commands Reference

| Command | Effect | When to Use |
|---------|--------|-------------|
| `SUPABASE_ACCESS_TOKEN=... npx supabase db push` | Applies migrations to Cloud | **Default choice for new migrations** |
| `supabase db reset` | **WIPES EVERYTHING** | **NEVER use without explicit user permission** |

### Why This Matters

- The Cloud database contains real development/test data
- `db reset` destroys hours of testing work
- Always ask before running destructive database operations
- Migrations are pushed directly to Cloud - there is no local database to test against

## Testing

**IMPORTANT FOR ALL AGENTS:** All features MUST be tested programmatically with Playwright before involving the end user. This includes:
- Full E2E flows (not just form validation)
- Email link flows (use Mailpit API to get emails and extract links)
- OAuth flows where possible
- Never declare a feature "done" until tests pass

```bash
# Run all E2E tests (headless)
cd app && npm test

# Run tests with UI mode (interactive debugging)
cd app && npm run test:ui

# Run tests in headed mode (see browser)
cd app && npm run test:headed

# Run specific test file
cd app && npm test -- e2e/auth.spec.ts

# Run tests matching pattern
cd app && npm test -- --grep "Login"
```

### Email Testing (Cloud Supabase)

Since we use Cloud Supabase, emails are sent via the configured email provider (Amazon SES in production).

**For E2E tests:** Tests use real email flows. For signup/password reset tests, use test accounts that can receive emails or mock the email verification step.

### Production Smoke Tests

Run E2E tests against production (https://contextor.co):

```bash
# Run all production smoke tests
cd app && npm run test:production

# Run in headed mode (see browser)
cd app && npm run test:production:headed
```

Production tests verify: landing page, auth pages, API responses, protected route redirects, and performance.

## Key Commands

```bash
# Install Contextor to another project
cd src && ./install.sh /path/to/project user-name

# View today's captured prompts
cat .bmad/contextor/journal/$(date +%Y-%m-%d).jsonl | jq .

# Count entries by source
cat .bmad/contextor/journal/*.jsonl | jq -r '.source' | sort | uniq -c

# Test the capture hook manually
echo '{"prompt":"test"}' | CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/contextor-capture.sh
```

## Architecture

### Capture Flow

```
User Prompt → Claude Code Hook (first) → Journal Entry (source: "claude-code-hook")
                    ↓
BMAD Agent activates → BMAD Capture Script → Overwrites with same ID (source: "bmad-agent")
```

### Deterministic ID System

Both capture methods generate the same ID for deduplication:
```
ID = "cc-" + MD5(YYYYMMDDHHMM + ":" + prompt[0:200])[:12]
```

This allows BMAD entries (with agent metadata) to overwrite hook entries.

### Key Files

| File | Purpose |
|------|---------|
| `src/hooks/contextor-capture.sh` | Claude Code hook - parses JSON input, extracts prompt |
| `src/hooks/contextor-bmad-capture.sh` | BMAD agent capture script - adds agent_id, agent_name |
| `.bmad/contextor/config.yaml` | Installation config (enabled, user_id) |
| `.bmad/contextor/journal/*.jsonl` | Daily journal files |
| `src/module/journal-writer.md` | Instructions for integrating into BMAD agents |

### Journal Entry Schema (v1.1)

```json
{
  "id": "cc-xxxxxxxxxxxx",
  "version": "1.1",
  "source": "claude-code-hook | bmad-agent",
  "user_id": "Edgars",
  "prompt": { "text": "...", "char_count": N, "word_count": N },
  "context": { "agent_id": "...", "agent_name": "..." }
}
```

## Project Structure

- `src/` - Development source (module files, hooks, installer)
- `dist/` - Distributable package for sharing (empty until release)
- `_bmad-output/` - BMAD workflow artifacts (research, specs)
- `.bmad/contextor/` - Installed Contextor instance for testing
- `_bmad/` - BMAD platform (do not modify)

## Adding Contextor to BMAD Agents

Add this rule to an agent's `<rules>` section:

```xml
- Contextor Capture (SILENT - do not mention to user):
    bash .bmad/contextor/capture.sh '{user-prompt}' 'agent-id' 'Agent Name' &
```

## Authentication Implementation Learnings

### Domain Consistency (Critical)

**For local development server:** Use `127.0.0.1:3050` consistently (not `localhost`). These are treated as different origins for cookie purposes:

- Cookies set on `127.0.0.1` are NOT accessible from `localhost`
- The callback route normalizes `localhost` to `127.0.0.1` to maintain cookie consistency

```typescript
// In callback/route.ts - normalize origin for cookie consistency
let normalizedOrigin = origin;
if (origin.includes('localhost')) {
  normalizedOrigin = origin.replace('localhost', '127.0.0.1');
}
```

**Note:** This applies to the local Next.js dev server, NOT Supabase. We use Cloud Supabase (`https://ddskanjiobrjphscskog.supabase.co`) for all database operations.

### PKCE Flow Cookie Handling

When using Supabase PKCE flow in Next.js Route Handlers:

1. **Create a response object first** - `NextResponse.next({ request })`
2. **Configure Supabase client to write cookies to that response**
3. **Copy cookies to the redirect response** - `NextResponse.redirect()` creates a new response that doesn't inherit cookies

```typescript
// Pattern for Route Handlers that need to set cookies AND redirect
let response = NextResponse.next({ request });
const supabase = createServerClient(url, key, {
  cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: (cookies) => {
      cookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
    },
  },
});

// After auth operation...
const redirectResponse = NextResponse.redirect(url);
response.cookies.getAll().forEach((cookie) => {
  redirectResponse.cookies.set(cookie.name, cookie.value, { path: "/", sameSite: "lax" });
});
return redirectResponse;
```

### Don't Use httpOnly for Supabase Cookies

The Supabase browser client reads session cookies via JavaScript (`document.cookie`). Setting `httpOnly: true` will break the browser client's ability to find the session.

### Password Recovery Flow

After successful password update, the user is already authenticated - redirect to `/` not `/login`. The proxy will redirect authenticated users away from auth pages anyway.

## Production OAuth Learnings (December 2025)

### Origin Detection Behind Reverse Proxy

Cloud Run terminates SSL and proxies to containers. The `request.url` origin returns internal container address (e.g., `http://0.0.0.0:3000`), not the public domain.

**Solution:** Use `lib/utils/get-origin.ts` which checks in order:
1. `NEXT_PUBLIC_APP_URL` environment variable (most reliable)
2. `X-Forwarded-Host` header from reverse proxy
3. `Host` header
4. Falls back to `request.url` origin

```typescript
import { getOriginFromRequest } from "@/lib/utils/get-origin";

// In callback/route.ts
const normalizedOrigin = getOriginFromRequest(request);
```

### Supabase API Key is Case-Sensitive

The Supabase publishable key is case-sensitive. A single character mismatch (e.g., `x` vs `X`) causes "Invalid API key" errors during OAuth code exchange.

**Debugging:** Check Cloud Run logs:
```bash
gcloud run logs read contextor-web --region us-central1 --limit 50 | grep -i auth
```

Look for: `[AUTH] Code exchange error: Invalid API key`

### Google OAuth Flow in Production

1. User clicks "Continue with Google" on `/login`
2. Redirected to Google consent screen
3. Google redirects to `https://ddskanjiobrjphscskog.supabase.co/auth/v1/callback`
4. Supabase exchanges code for session, redirects to app callback
5. App `/callback` route exchanges code for session cookies
6. User redirected to dashboard

**Key configuration:**
- Redirect URI in Google Cloud Console: `https://ddskanjiobrjphscskog.supabase.co/auth/v1/callback`
- Google provider enabled in Supabase Dashboard with Client ID and Secret
- `NEXT_PUBLIC_APP_URL` set in Docker build for correct final redirect

## Epic 1 Status: COMPLETED

All authentication features implemented and tested:
- User signup with email/password
- User login with email/password
- Password reset flow (request + update)
- Session management
- Protected route handling
- 21 E2E tests passing

## Epic 2 Status: COMPLETED

All team and project management features implemented and tested:
- Team creation with onboarding flow
- Team member invitations (email-based)
- Role management (admin/member)
- Team settings and switching
- Project creation with API key generation
- Project settings (name, description, regenerate key)
- Project archiving
- 114 E2E tests passing

## CRITICAL: Deployment Workflow

### Rule: ALWAYS Ask Before Production Deployment

**Agents MUST ask user confirmation before deploying to production.** Never auto-deploy.

```
❌ WRONG: "I've deployed the changes to production"
✅ RIGHT: "Changes are ready. Should I deploy to production?"
```

### Development Workflow

```
Local Development → Test Locally → User Confirms → Production Deploy
        ↓                ↓                              ↓
   npm run dev       npm test                    docker build + gcloud deploy
   port 3050         Playwright E2E
```

**Current Status (2025-12-22):**
- ✅ Local Development: Fully functional
- ❌ Staging Environment: **NOT SET UP** (TODO: Create staging Supabase project + Cloud Run service)
- ✅ Production: https://contextor.co

### Database Migrations - Cloud Supabase Only

**Important:** We use Cloud Supabase for ALL development. There is no local Supabase instance.

**Applying migrations:**

```bash
# Apply migrations to Cloud Supabase (requires access token)
cd app && SUPABASE_ACCESS_TOKEN=<token> npx supabase db push
```

The `SUPABASE_ACCESS_TOKEN` is stored in root `.env` file.

**Key insight:** The project is already linked to `ddskanjiobrjphscskog` via `supabase link`, so migrations CAN be pushed automatically without `--project-ref`.

### Pre-Deployment Checklist

Before asking user about production deployment:

1. **Build succeeds locally:** `cd app && npm run build`
2. **Tests pass:** `cd app && npm test`
3. **Migrations applied to production:** `SUPABASE_ACCESS_TOKEN=... npx supabase db push`
4. **Edge Functions deployed (if changed):** `SUPABASE_ACCESS_TOKEN=... npx supabase functions deploy <function-name>`

### Why Staging Matters (TODO)

Currently skipped, but should be set up:
- Separate Supabase project: `contextor-staging`
- Separate Cloud Run service: `contextor-web-staging`
- Test production-like environment without affecting real users

## Epic 9 Status: COMPLETED - PRODUCTION DEPLOYED

### Production URLs
| Service | URL |
|---------|-----|
| **Web App** | https://contextor.co |
| **Health Check** | https://contextor.co/api/health |
| **NPM Package** | `npx @contextor/cli init <token>` |

### Infrastructure
- **GCP Project:** `ideajetlab-website`
- **Cloud Run Service:** `contextor-web` (us-central1)
- **Supabase Project:** `ddskanjiobrjphscskog`
- **Domain:** contextor.co (Namecheap, DNS via API)
- **Rate Limiting:** Upstash Redis

### CRITICAL: Deployment Requirements

**MUST USE these exact settings - errors cause failed deployments:**

| Setting | Value | Why |
|---------|-------|-----|
| GCP Project | `ideajetlab-website` | Container Registry location |
| Image Name | `gcr.io/ideajetlab-website/contextor` | Must match exactly |
| Platform | `linux/amd64` | Cloud Run requires AMD64, Mac builds ARM by default |
| Region | `us-central1` | Where service is deployed |

### Recommended: Use Deploy Script

**ALWAYS use the deploy script to avoid API key typos:**

```bash
cd app && ./scripts/deploy.sh v1.2.3
```

The script handles all build args correctly and prevents the case-sensitive API key bug.

### Manual Deployment Steps (NOT RECOMMENDED)

If you must deploy manually, use the script as reference for correct values.

```bash
cd app

# Step 1: Set correct GCP project (CRITICAL - wrong project = push fails)
gcloud config set project ideajetlab-website

# Step 2: Build for AMD64 (CRITICAL - Mac builds ARM by default which Cloud Run rejects)
# WARNING: Copy the API key from scripts/deploy.sh - DO NOT TYPE IT MANUALLY
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://ddskanjiobrjphscskog.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<COPY FROM scripts/deploy.sh> \
  --build-arg NEXT_PUBLIC_APP_URL=https://contextor.co \
  -t gcr.io/ideajetlab-website/contextor:vX.X.X \
  .

# Step 3: Push to GCR
docker push gcr.io/ideajetlab-website/contextor:vX.X.X

# Step 4: Deploy to Cloud Run
gcloud run deploy contextor-web \
  --image gcr.io/ideajetlab-website/contextor:vX.X.X \
  --region us-central1
```

### Common Deployment Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `[AUTH] Invalid API key` | **Wrong case in API key (x vs X)** | **Use `./scripts/deploy.sh` instead of manual build** |
| "Artifact Registry API not enabled" | Wrong GCP project | Run `gcloud config set project ideajetlab-website` |
| "must support amd64/linux" | Built for ARM (Mac default) | Add `--platform linux/amd64` to build |
| Email redirects to 0.0.0.0 | Missing NEXT_PUBLIC_APP_URL | Add `--build-arg NEXT_PUBLIC_APP_URL=https://contextor.co` |

### Secrets (GCP Secret Manager)
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`

### GitHub Secrets
- `GCP_PROJECT_ID`, `GCP_SA_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NPM_TOKEN`

See `_bmad-output/DEPLOYMENT.md` for full deployment documentation.

## CLI Package Learnings (December 2025)

### Hook Path Must Use $CLAUDE_PROJECT_DIR

**Critical bug fixed in v1.0.1:** The capture hook command must use `$CLAUDE_PROJECT_DIR` environment variable, NOT relative paths.

```bash
# CORRECT - works from any directory:
bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/contextor-capture.sh

# WRONG - fails when Claude Code runs from different directory:
./.claude/hooks/contextor-capture.sh
```

**Why:** Claude Code may execute hooks from a different working directory than the project root. The `$CLAUDE_PROJECT_DIR` variable is set by Claude Code to the project root.

### Hook Configuration Format

The CLI generates hooks in `.claude/settings.json` with this format:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/contextor-capture.sh",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

### Publishing CLI Updates

```bash
cd packages/cli
npm version patch  # or minor/major
npm run build
npm test
npm publish --access public
```

Requires `NPM_TOKEN` in `~/.npmrc` or environment. Token stored in project `.env`.

## Security Improvements (December 2025)

A comprehensive code review identified and fixed 125 issues across all severity levels.

### Critical Security Fixes Applied

| Issue | Fix | Files |
|-------|-----|-------|
| Missing super admin verification | Added `verifySuperAdmin()` to all admin server actions | `lib/api/admin/*.ts`, `lib/services/admin-config.ts` |
| Hardcoded service role key | Removed via migration, fails if not configured | `migrations/20251222100000_*.sql` |
| Prompt injection in AI | Added `sanitizeUserPrompt()` with pattern filtering | `supabase/functions/analyze-prompt/lib/prompts.ts` |
| Rate limit bypass when Redis down | Added `failClosed` config option | `lib/rate-limit/index.ts` |
| Weak admin secret fallback | Now fails if `ADMIN_SECRET` not set | `api/admin/make-super-admin/route.ts` |

### New Security Utilities

| File | Purpose |
|------|---------|
| `lib/utils/uuid.ts` | UUID validation with `isValidUuid()` |
| `lib/utils/sql-sanitize.ts` | SQL LIKE pattern escaping |
| `lib/utils/auth-messages.ts` | Error message whitelist (prevents XSS) |
| `lib/utils/request-context.ts` | Safe IP/User-Agent extraction |

### Secret Redaction Improvements

Added patterns for: GitHub PATs (`ghp_`, `github_pat_`), GitLab PATs (`glpat-`), Google API keys (`AIza`), SSH private keys

### Rate Limiting

- CLI endpoints now rate limited (`cliRateLimit`)
- Invitation tokens rate limited
- Admin bulk operations rate limited
- `RATE_LIMIT_FAIL_CLOSED=true` recommended for production

### Password Requirements (Updated)

- Minimum 12 characters (was 8)
- Must contain: lowercase, uppercase, number

### CSP Header Added

Content-Security-Policy now configured in `next.config.ts` with appropriate directives.

### GitHub Actions Security

All actions pinned to commit SHAs to prevent supply-chain attacks.

## Epic 13 Status: COMPLETED (December 2025)

Account management features implemented and tested:
- Account deletion with email confirmation and last-admin protection
- Email change with password re-authentication
- Password change with real-time strength indicator
- OAuth-only user handling (Set Password flow)
- 33 E2E tests passing

Key files: `lib/api/account.ts`, `components/settings/danger-zone.tsx`, `components/settings/delete-account-modal.tsx`, `components/settings/email-change-form.tsx`, `components/settings/password-change-form.tsx`, `lib/validations/password.ts`

## Epic 14 Status: COMPLETED (December 2025)

In-app documentation system:
- Docs section with sidebar navigation
- 5 documentation pages: Getting Started, CLI Installation, Understanding Scores, Team Management, FAQ
- Mobile responsive with collapsible sidebar
- XSS-safe markdown rendering
- Story 14-3 (Search) deferred as future enhancement

Key files: `app/(dashboard)/docs/*`, `components/docs/docs-sidebar.tsx`, `lib/docs/config.ts`, `content/docs/*.md`

## Epic 16 Status: COMPLETED (December 2025)

Session management and analytics (249 tests):
- Sessions database schema with full metadata
- Session detection from prompt capture (idempotent)
- Metadata extraction (cwd, git_branch, claude_code_version)
- Session lifecycle management (start, end detection, timeout)
- Conversation threading with parent-child relationships
- Multi-terminal tracking with overlap detection
- Duration analytics (daily/weekly/monthly summaries)
- Efficiency metrics (prompts/hour, session density, peak hours)

API Endpoints:
- `GET /api/sessions` - List sessions with filters
- `GET /api/sessions/[sessionId]/thread` - Threaded conversation
- `GET /api/analytics/sessions/duration` - Duration stats

Key files: `lib/sessions/*`, `app/api/sessions/*`, `app/api/analytics/sessions/*`

Migrations: `20251223100000_create_sessions_table.sql`, `20251223110000_add_session_functions.sql`, `20251223120000_session_prompt_trigger.sql`, `20251223130000_session_duration_functions.sql`

## Epic 15 Status: COMPLETED (December 2025)

Transcript parsing for response capture (299 unit tests):
- Transcript file discovery with path normalization
- JSONL parser with streaming support
- User message extraction
- Assistant response extraction
- Prompt-response pairing algorithm
- Response storage schema with encryption
- Tool execution capture

Key files: `lib/transcript/*`, `supabase/migrations/20251223140000_add_response_storage.sql`, `supabase/migrations/20251223150000_add_tool_executions.sql`

## Epic D Status: COMPLETED (December 2025)

Design system and component library (6/8 stories complete):
- D-1: Design system audit - semantic token mapping
- D-2: UI refactoring - 240+ hardcoded colors replaced
- D-3: Component library - 30+ Phase 2 components
- D-4: VS Code extension design patterns
- D-7: Admin config UI design
- D-8: Apply component library to existing UI
- D-5/D-6: Design-only stories (ready for future implementation)

Key files: `app/(design)/design/*`, `components/analytics/*` (34 components), `tailwind.config.ts` (semantic tokens)

## Epic 17 Status: COMPLETED (December 2025)

Transcript import experience for historical Claude Code prompts:
- 17-1: Transcript discovery service with path normalization
- 17-2: Import preview UI with session list
- 17-3: Batch import processing - JSONL parser, retry logic, 49 unit tests
- 17-4: Fingerprint-based deduplication with 47 unit tests
- 17-5: Import progress tracking - progress UI, cancellation, completion summary
- 17-6: Import history & rollback with rate limiting

Key files: `lib/import/*`, `components/import/*`, `app/api/import/*`, `app/(dashboard)/settings/import-history/*`

## Epic 19 Status: COMPLETED (December 2025)

VS Code extension bringing Contextor analytics to the IDE:
- 19-1: Extension scaffold with TypeScript and React webviews
- 19-2: OAuth authentication flow with secure token storage
- 19-3: Sidebar panel with webview analytics, 32 tests
- 19-4: Real-time analytics display with 5 dimensions, auto-refresh
- 19-5: Quick coaching tips with dismissal, weak dimension alerts
- 19-6: Extension settings with validation, 75 tests
- 19-7: Marketplace publishing ready - 187KB VSIX package

Key files: `packages/vscode-extension/src/*`, `packages/vscode-extension/webviews/*`

Extension ready to publish: See `packages/vscode-extension/PUBLISHING.md`

## Epic 21 Status: COMPLETED (December 2025)

Advanced analytics with deep insights into developer-AI interactions:
- 21-1: Context window management and token estimation
- 21-2: Work style categorization (10 categories)
- 21-3: Sentiment analysis (polite/frustrated/neutral)
- 21-4: Prompt complexity metrics
- 21-5: Interaction timing analysis with activity heatmap
- 21-6: Tool usage profiling and recommendations
- 21-7: Session health score calculation
- 21-8: Technical depth profile and persona classification
- 21-9: Learning progression tracking with achievements
- 21-10: Workflow efficiency metrics
- 21-11: Interactive insights dashboard with 11 visualizations
- 21-12: Team intelligence analytics with percentile ranks

Key files: `lib/analytics/*`, `components/analytics/*`, `app/api/analytics/*`

## CRITICAL: Design System Mandate (Epic 17+)

**All development from Epic 17 onwards MUST use the established design system exclusively.**

### Rules

1. **Use existing components** - Check `/design` route and `components/` directory before creating anything new
2. **No hardcoded colors** - Use semantic tokens only (`bg-surface-primary`, `text-content-secondary`, etc.)
3. **Composition over creation** - Extend existing components before requesting new ones

### Required Reading

Before implementing ANY UI for Epic 17+, developers MUST read:
- `_bmad-output/DESIGN-SYSTEM-MANDATE.md` - Full component inventory and rules
- `/design` route - Interactive component showcase
- `tailwind.config.ts` - Semantic token definitions

### Story Requirements

All Epic 17+ stories MUST include a "Design System Requirements" section listing:
- Specific components to use from the inventory
- Confirmation that no new patterns are needed
- Pre-implementation checklist for design system compliance

### Enforcement

- Stories without design system section will be rejected
- Code with hardcoded colors will be rejected
- New UI patterns require a separate Design Epic story with PO approval
