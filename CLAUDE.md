# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Contextor is a prompt journaling system for AI-assisted development teams. It captures prompts to enable team learning, reflection, and improvement of prompting skills.

**Architecture:** Hybrid capture system with two methods:
1. **Claude Code Hook** - Automatic capture via `UserPromptSubmit` hook (captures ALL prompts)
2. **BMAD Native** - Agent-embedded capture that overwrites hook entries with richer metadata

## Development Server

**Port:** Use `3050` for this project (port 3000 is used by other projects)

```bash
# Start dev server
cd app && npm run dev -- -p 3050
```

**Important for agents:** Always check if a port is available before starting a dev server. If not available, use an uncommon port (3050, 3051, etc.) to avoid conflicts.

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

### Mailpit API (for testing email flows)
- Mailpit URL: http://127.0.0.1:54324
- API: http://127.0.0.1:54324/api/v1/messages
- Use this to fetch emails and extract verification/reset links in tests

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

**Always use `127.0.0.1` instead of `localhost` for local development.** These are treated as different origins for cookie purposes:

- Cookies set on `127.0.0.1` are NOT accessible from `localhost`
- Supabase config, Playwright config, and all redirects must use the same domain
- The callback route normalizes `localhost` to `127.0.0.1` to maintain cookie consistency

```typescript
// In callback/route.ts - normalize origin for cookie consistency
let normalizedOrigin = origin;
if (origin.includes('localhost')) {
  normalizedOrigin = origin.replace('localhost', '127.0.0.1');
}
```

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

## Epic 1 Status: COMPLETED

All authentication features implemented and tested:
- User signup with email/password
- User login with email/password
- Password reset flow (request + update)
- Session management
- Protected route handling
- 21 E2E tests passing
