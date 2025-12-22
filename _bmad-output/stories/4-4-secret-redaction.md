# Story 4.4: Secret Redaction

Status: ✅ Done

## Story
**As a** platform operator,
**I want** secrets redacted from prompts before storage,
**So that** sensitive data is never persisted in the database.

## Technical Context

**File Location:** `lib/capture/redact-secrets.ts`

**Integration Point:** Called by `/api/prompts/capture` AFTER validation, BEFORE database write

**Architecture Reference:** This module is part of the capture pipeline. See `lib/capture/` in architecture for related files (`validate.ts`).

**Function Signature:**
```typescript
export function redactSecrets(text: string): {
  redactedText: string;
  redactionCount: number;
  redactedPatterns: string[]; // e.g., ['api_key', 'jwt']
}
```

## Acceptance Criteria

1. **Given** a prompt containing API key patterns
   **When** the redaction pipeline runs
   **Then** the following patterns are replaced with `[REDACTED]`:
   - Stripe keys: `sk_live_*`, `sk_test_*`, `pk_live_*`, `pk_test_*`
   - AWS keys: `AKIA*` (20 chars), AWS secret keys (40 chars alphanumeric)
   - OpenAI keys: `sk-*` (48+ chars)
   - Generic API keys: `api_key=*`, `apikey=*`, `api-key:*`

2. **Given** a prompt containing authentication secrets
   **When** the redaction pipeline runs
   **Then** the following patterns are replaced:
   - Passwords in URLs: `://user:password@host` becomes `://user:[REDACTED]@host`
   - JWT tokens: `eyJ*` (base64 JSON Web Tokens with 2+ segments)
   - Bearer tokens: `Bearer *` in authorization contexts
   - Basic auth: `Basic *` (base64 encoded credentials)

3. **Given** a prompt containing environment variable assignments
   **When** the redaction pipeline runs
   **Then** values are redacted for patterns like:
   - `SECRET_KEY=value` (uppercase with underscores)
   - `export API_TOKEN="value"`
   - `.env` style: `DATABASE_URL=postgres://...`

4. **Given** the redaction module
   **When** processing any prompt
   **Then** redaction happens BEFORE any database write (enforced by capture API order)
   **And** the function returns metadata about what was redacted (count, pattern types)
   **And** original text is never logged or stored

5. **Given** a prompt with no secrets
   **When** redaction runs
   **Then** the prompt text is unchanged
   **And** `redactionCount` returns 0

6. **Given** a prompt with text that looks like a secret but is not
   **When** redaction runs
   **Then** common false positives are handled:
   - Code comments explaining secret formats
   - Documentation examples with placeholder text
   - The literal string `[REDACTED]` is not double-redacted

## Tasks

- [x] **Task 1: Create redact-secrets.ts with pattern definitions** (AC: #1, #2, #3)
  - Define regex patterns for each secret type (Stripe, AWS, OpenAI, JWT, URL passwords, env vars)
  - Use named capture groups for pattern identification
  - Ensure patterns handle common variations (quotes, whitespace)

- [x] **Task 2: Implement redaction function** (AC: #4, #5, #6)
  - Apply all patterns in sequence to input text
  - Replace matches with `[REDACTED]` (single replacement string)
  - Track redaction count and pattern types for logging
  - Return both redacted text and metadata
  - Handle edge cases: empty string, already redacted text

- [x] **Task 3: Write unit tests** (AC: #1-6)
  - Test each secret pattern type individually
  - Test combined secrets in single prompt
  - Test no-secret prompts remain unchanged
  - Test false positive handling
  - Test large prompts (up to 100K chars) for performance

## Technical Notes

**Regex Pattern Examples:**
```typescript
const patterns = {
  stripeKey: /\b(sk_live_|sk_test_|pk_live_|pk_test_)[a-zA-Z0-9]{24,}\b/g,
  awsAccessKey: /\bAKIA[A-Z0-9]{16}\b/g,
  awsSecretKey: /\b[A-Za-z0-9/+=]{40}\b/g, // Requires context
  openaiKey: /\bsk-[a-zA-Z0-9]{48,}\b/g,
  jwt: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  urlPassword: /:\/\/([^:]+):([^@]+)@/g, // Capture group 2 is password
  envVar: /\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*)=["']?([^"'\s]+)/gi
};
```

**Error Handling:**
- Never throw on malformed input - return original text if regex fails
- Log redaction summary (count only, never content): `[CAPTURE] redact: removed 3 secrets`

**TypeScript Requirements:**
- Strict mode compliance (no `any`)
- Export types for function signature
- Handle `null`/`undefined` input gracefully

## Dev Checklist
- [x] File created at `lib/capture/redact-secrets.ts`
- [x] Function exported with correct signature
- [x] All pattern types implemented
- [x] Unit tests pass (36 tests)
- [x] No secrets in logs (verified - only count logged)
- [ ] Integration with capture API verified (deferred to Story 4.5)
