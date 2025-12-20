# Story 1.7: Session & Security Foundation

Status: ready-for-dev

## Story

**As a** platform operator,
**I want** secure session management and data protection,
**So that** user data is protected and access is properly controlled.

## Acceptance Criteria

1. **Given** a user logs in
   **When** their session is created
   **Then** JWT tokens are issued with 24-hour expiry
   **And** refresh tokens are stored securely (httpOnly cookies)
   **And** `middleware.ts` refreshes sessions on each request

2. **Given** the `users` table
   **When** RLS is evaluated
   **Then** users can only read/update their own profile
   **And** the `is_super_admin` field is read-only (cannot be self-modified)

3. **Given** data at rest in Supabase
   **When** encryption is configured
   **Then** all data is encrypted with AES-256 (Supabase default)

4. **Given** API communications
   **When** requests are made
   **Then** all traffic uses HTTPS/TLS 1.3

5. **Given** the foundation for future tables
   **When** new tables are created in subsequent stories
   **Then** they inherit the RLS-first approach with `team_id` scoping

## Tasks / Subtasks

- [ ] **Task 1: Configure JWT token settings in Supabase** (AC: #1)
  - [ ] Verify Supabase Auth JWT expiry is set to 24 hours (86400 seconds)
  - [ ] Confirm refresh token rotation is enabled in Supabase dashboard
  - [ ] Document JWT claim structure for team_id (to be populated in Story 2.1)
  - [ ] Verify JWT secret is properly configured and not using default

- [ ] **Task 2: Implement session refresh middleware** (AC: #1)
  - [ ] Update `middleware.ts` to refresh sessions on each protected route request
  - [ ] Implement session validation using `supabase.auth.getSession()`
  - [ ] Handle expired session redirect to `/login` with message
  - [ ] Ensure middleware runs on all protected routes under `/(dashboard)/`
  - [ ] Add structured logging for security events

- [ ] **Task 3: Configure secure cookie settings** (AC: #1)
  - [ ] Verify Supabase client uses httpOnly cookies for refresh tokens
  - [ ] Confirm `sameSite` cookie attribute is set to `lax` or `strict`
  - [ ] Ensure `secure` flag is enabled for production (HTTPS only)
  - [ ] Verify cookie path is correctly scoped

- [ ] **Task 4: Validate and enhance users table RLS policies** (AC: #2)
  - [ ] Verify users can SELECT only their own profile
  - [ ] Verify users can UPDATE only their own profile
  - [ ] Create policy preventing `is_super_admin` self-modification
  - [ ] Test RLS policies with direct SQL queries
  - [ ] Document RLS policy patterns for future tables

- [ ] **Task 5: Create RLS policy templates for team-scoped tables** (AC: #5)
  - [ ] Create migration file with RLS helper functions
  - [ ] Create template policy for team-scoped SELECT
  - [ ] Create template policy for team-scoped INSERT
  - [ ] Create template policy for team-scoped UPDATE
  - [ ] Create template policy for team-scoped DELETE
  - [ ] Add super admin bypass policy template

- [ ] **Task 6: Verify HTTPS/TLS configuration** (AC: #4)
  - [ ] Confirm Supabase project uses TLS 1.3 for all connections
  - [ ] Verify Next.js production build enforces HTTPS
  - [ ] Add HSTS header configuration for production
  - [ ] Document TLS verification steps for deployment

- [ ] **Task 7: Document data-at-rest encryption** (AC: #3)
  - [ ] Verify Supabase project has AES-256 encryption enabled (default)
  - [ ] Document which data types are encrypted at rest
  - [ ] Create security documentation for compliance purposes
  - [ ] Add encryption verification to deployment checklist

- [ ] **Task 8: Create security configuration module** (AC: #1, #4)
  - [ ] Create `lib/auth/session.ts` for session utilities with TypeScript types
  - [ ] Create `lib/auth/security-headers.ts` for security headers with environment-aware logic
  - [ ] Add Content-Security-Policy header configuration
  - [ ] Add X-Frame-Options, X-Content-Type-Options headers
  - [ ] Configure CORS for API routes with proper origin handling

## Dev Notes

### Critical Architecture Constraints

**Security Requirements from PRD (FR51-FR54, NFR-S1 to NFR-S7):**
- FR51: System encrypts prompt data at rest (AES-256)
- FR52: System enforces row-level security (users see only their team's data)
- FR53: System enforces HTTPS/TLS 1.3 for all communications
- FR54: System retains data according to tier-based retention policies
- NFR-S1: AES-256 encryption at rest
- NFR-S2: TLS 1.3 for all communications
- NFR-S3: JWT tokens with 24-hour expiry
- NFR-S4: Row-level security on all data tables
- NFR-S5: API key hashing (never store plaintext)
- NFR-S6: Secret redaction before cloud storage
- NFR-S7: Rate limiting on capture endpoint

### JWT Configuration

**Supabase JWT Settings (via Dashboard or CLI):**
```javascript
// Expected JWT structure after Story 2.1 adds team context
{
  "aud": "authenticated",
  "exp": 1734700000,  // 24 hours from issue
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "team_id": "team-uuid",  // Added in Story 2.1
  "app_metadata": {
    "provider": "email"
  },
  "user_metadata": {
    "name": "User Name"
  }
}
```

**JWT Expiry Configuration:**
```bash
# In supabase/config.toml (for local development)
[auth]
jwt_expiry = 86400  # 24 hours in seconds
```

### Middleware Session Refresh Pattern

Follow the middleware session refresh pattern from architecture.md#Authentication-Security. Key implementation points specific to this story:

```typescript
// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh session - this is CRITICAL for security
  const { data: { session }, error } = await supabase.auth.getSession()

  // Log security events for monitoring
  if (error) {
    console.error('[AUTH] session-refresh-error:', error.message)
  }

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/(dashboard)') ||
      request.nextUrl.pathname.match(/^\/(prompts|analytics|team|projects|settings|admin)/)) {
    if (!session) {
      console.log('[AUTH] session-expired: redirect=/login')
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('message', 'Your session has expired. Please log in again.')
      return NextResponse.redirect(redirectUrl)
    }
    console.log('[AUTH] session-refresh: user_id=%s status=success', session.user.id)
  }

  // Redirect authenticated users away from auth pages
  if (session && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/prompts', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Future Optimization:** Consider debouncing session refresh to only refresh if session is close to expiry (e.g., < 1 hour remaining) for high-traffic scenarios.

### RLS Policy Templates for Team-Scoped Tables

```sql
-- supabase/migrations/20251220100000_rls_security_foundation.sql

-- Helper function to get current user's team_id from JWT
CREATE OR REPLACE FUNCTION public.current_team_id()
RETURNS UUID AS $$
BEGIN
  RETURN (auth.jwt() ->> 'team_id')::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_super_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Template: Team-scoped SELECT policy
-- Usage: Apply to tables with team_id column
-- CREATE POLICY "Team members can view" ON table_name
--   FOR SELECT USING (team_id = public.current_team_id() OR public.is_super_admin());

-- Template: Team-scoped INSERT policy
-- CREATE POLICY "Team members can insert" ON table_name
--   FOR INSERT WITH CHECK (team_id = public.current_team_id());

-- Template: Team-scoped UPDATE policy
-- CREATE POLICY "Team members can update" ON table_name
--   FOR UPDATE USING (team_id = public.current_team_id())
--   WITH CHECK (team_id = public.current_team_id());

-- Template: Team-scoped DELETE policy (admin only)
-- CREATE POLICY "Team admins can delete" ON table_name
--   FOR DELETE USING (
--     team_id = public.current_team_id()
--     AND EXISTS (
--       SELECT 1 FROM public.team_members
--       WHERE team_id = table_name.team_id
--       AND user_id = auth.uid()
--       AND role = 'admin'
--     )
--   );

-- ============================================
-- ENHANCED USERS TABLE RLS POLICIES
-- ============================================

-- Drop existing policies if they exist (from Story 1.1)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Prevent self-admin-promotion" ON public.users;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
  ON public.users FOR SELECT
  USING (public.is_super_admin());

-- Users can update their own profile (except is_super_admin)
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Cannot change is_super_admin unless already super admin
      is_super_admin IS NOT DISTINCT FROM (
        SELECT u.is_super_admin FROM public.users u WHERE u.id = auth.uid()
      )
      OR public.is_super_admin()
    )
  );

-- Super admins can update any profile
CREATE POLICY "Super admins can update all profiles"
  ON public.users FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
```

### Security Headers Configuration

**Prerequisite:** Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set before using these modules.

```typescript
// lib/auth/security-headers.ts

const isProduction = process.env.NODE_ENV === 'production'

// Base security headers (applied in all environments)
const baseHeaders: Record<string, string> = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS filter in older browsers
  'X-XSS-Protection': '1; mode=block',

  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy (disable unused features)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Needed for Next.js
    "style-src 'self' 'unsafe-inline'",  // Needed for Tailwind
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
  ].join('; '),
}

// Production-only headers
const productionHeaders: Record<string, string> = {
  // HSTS - enforce HTTPS (production only to avoid local dev issues)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

/**
 * Returns security headers appropriate for the current environment.
 * HSTS is only included in production to prevent local development issues.
 */
export function getSecurityHeaders(): Record<string, string> {
  if (isProduction) {
    return { ...baseHeaders, ...productionHeaders }
  }
  return baseHeaders
}

// Static export for next.config.ts (uses all headers)
export const securityHeaders = { ...baseHeaders, ...productionHeaders }
```

```typescript
// next.config.ts - Add security headers and CORS
import type { NextConfig } from 'next'

const isProduction = process.env.NODE_ENV === 'production'

// Allowed origins for CORS (configure per environment)
const ALLOWED_ORIGINS = isProduction
  ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.contextor.co']
  : ['http://localhost:3000', 'http://127.0.0.1:3000']

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Security headers for all routes
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Only add HSTS in production
          ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
        ],
      },
      // CORS headers for API routes
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: ALLOWED_ORIGINS.join(', ') },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-API-Key' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ]
  },
}

export default nextConfig
```

### Session Utilities

**Prerequisite:** `lib/supabase/server.ts` is created in Story 1.1 and exports a `createClient` function that uses `createServerClient` from `@supabase/ssr` with proper cookie handling for Server Components.

```typescript
// lib/auth/session.ts
import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// User profile type from the users table
interface UserProfile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  is_super_admin: boolean
  created_at: string
  updated_at: string
}

/**
 * Get the current session, or null if not authenticated.
 * Logs errors for monitoring but returns null gracefully.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error) {
    console.error('[AUTH] getSession error:', error.message)
    return null
  }

  return session
}

/**
 * Require an active session or redirect to login.
 * Use this in Server Components that require authentication.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession()

  if (!session) {
    redirect('/login?message=Your session has expired. Please log in again.')
  }

  return session
}

/**
 * Get the current authenticated user, or null if not authenticated.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    console.error('[AUTH] getUser error:', error.message)
    return null
  }

  return user
}

/**
 * Get the user's profile from the users table.
 * Returns null if not authenticated or profile doesn't exist.
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('[AUTH] getUserProfile error:', error.message)
    return null
  }

  return profile as UserProfile
}

/**
 * Check if the current user is a platform super admin.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const profile = await getUserProfile()
  return profile?.is_super_admin ?? false
}

/**
 * Require super admin access or redirect.
 * Use this in Server Components that require admin privileges.
 */
export async function requireSuperAdmin(): Promise<UserProfile> {
  const profile = await getUserProfile()

  if (!profile) {
    redirect('/login?message=Your session has expired. Please log in again.')
  }

  if (!profile.is_super_admin) {
    console.warn('[AUTH] non-admin attempted admin access: user_id=%s', profile.id)
    redirect('/prompts?message=You do not have access to this area.')
  }

  return profile
}
```

### Environment Variable Validation

```typescript
// lib/env.ts - Validate required environment variables
function validateEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Ensure these are set in .env.local or your deployment environment.'
    )
  }
}

// Validate on module load (fails fast)
validateEnv()

export const env = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
} as const
```

### Project Structure After This Story

```
contextor/
├── lib/
│   ├── auth/
│   │   ├── session.ts           # Session utilities with types
│   │   └── security-headers.ts  # Environment-aware security headers
│   ├── env.ts                   # Environment validation
│   └── supabase/
│       ├── client.ts            # Browser client (from Story 1.1)
│       └── server.ts            # Server component client (from Story 1.1)
│
├── supabase/
│   └── migrations/
│       ├── 20251219XXXXXX_initial_setup.sql           # From Story 1.1
│       └── 20251220100000_rls_security_foundation.sql # RLS helpers + users RLS
│
├── middleware.ts                # Session refresh + route protection
└── next.config.ts               # Security headers + CORS
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `lib/auth/session.ts` | Create | Session management utilities with TypeScript types |
| `lib/auth/security-headers.ts` | Create | Environment-aware security header configuration |
| `lib/env.ts` | Create | Environment variable validation |
| `middleware.ts` | Modify | Add session refresh, security logging |
| `next.config.ts` | Modify | Add security headers, CORS configuration |
| `supabase/migrations/20251220100000_rls_security_foundation.sql` | Create | RLS helpers + enhanced users RLS |

### Naming Conventions (From Architecture)

| Context | Convention | Example |
|---------|------------|---------|
| Database functions | snake_case | `current_team_id`, `is_super_admin` |
| Database policies | Descriptive string | "Team members can view" |
| TypeScript files | kebab-case.ts | `security-headers.ts` |
| TypeScript functions | camelCase | `getSession`, `requireSession` |

### Critical Pitfalls

1. **Session refresh is mandatory** - Tokens MUST be refreshed on each request to prevent silent expiry
2. **is_super_admin protection** - Users CANNOT modify their own admin flag; RLS enforces this
3. **SECURITY DEFINER for helpers** - RLS helper functions must use `SECURITY DEFINER`, not `SECURITY INVOKER`

### RLS Verification Tests

Run these tests in Supabase SQL Editor to verify policies work correctly:

```sql
-- Test: User can only SELECT own profile
-- Should return only user-uuid-1's profile
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'user-uuid-1';
SELECT id, email FROM public.users;

-- Test: User cannot modify is_super_admin
-- Should fail or leave is_super_admin unchanged
UPDATE public.users SET is_super_admin = TRUE WHERE id = 'user-uuid-1';

-- Test: Super admin bypass works
-- Should return all profiles
SET LOCAL request.jwt.claim.sub = 'super-admin-uuid';
SELECT COUNT(*) FROM public.users;
```

### Verification Checklist

After completing this story, verify:
- [ ] JWT tokens have 24-hour expiry (check in browser dev tools)
- [ ] Refresh tokens are stored in httpOnly cookies (not accessible via JS)
- [ ] Middleware refreshes session on protected route access
- [ ] Expired sessions redirect to login with message
- [ ] Users can only view/update their own profile via RLS
- [ ] Users CANNOT modify their own `is_super_admin` field
- [ ] RLS helper functions (`current_team_id`, `is_super_admin`) work correctly
- [ ] Security headers are present in all responses
- [ ] HSTS header only present in production
- [ ] CORS headers correctly configured for API routes
- [ ] HTTPS is enforced in production builds
- [ ] No sensitive data is exposed in error messages
- [ ] Session utilities work correctly in Server Components
- [ ] All migrations apply without errors
- [ ] Security events logged with structured format

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### File List

*To be filled by dev agent - list all files created/modified*
