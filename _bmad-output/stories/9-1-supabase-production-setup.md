# Story 9.1: Supabase Production Project Setup

Status: Ready for Dev
Solo Dev: Yes
Epic: 9 - Production Deployment & Infrastructure
Depends On: Epics 1-8 complete

> **ℹ️ NOTE:** As of December 2025, **this project uses Cloud Supabase for ALL development** (not just production). See `CLAUDE.md` for current setup.

## Story

**As a** solo developer,
**I want** to set up a production Supabase project,
**So that** user data is stored securely in a managed cloud database.

## Acceptance Criteria

1. **Given** access to Supabase dashboard
   **When** I create a new project
   **Then** a new production project is created with a unique `project-ref`
   **And** the project is in a production-suitable region (e.g., `us-east-1`)
   **And** database connection strings are generated

2. **Given** the local migrations in `supabase/migrations/`
   **When** I run `supabase link --project-ref <ref>` and `supabase db push`
   **Then** all migrations are applied to production
   **And** RLS policies are active
   **And** all tables match local schema

3. **Given** the production database
   **When** I configure Auth providers
   **Then** Email/password auth is enabled
   **And** Google OAuth is configured with production credentials
   **And** Redirect URLs point to `https://contextor.co/*`

4. **Given** Edge Functions in `supabase/functions/`
   **When** I run `supabase functions deploy`
   **Then** the `analyze-prompt` function is deployed
   **And** it can access production environment variables

## Tasks / Subtasks

- [ ] **Task 1: Create Supabase production project** (AC: #1)
  - [ ] Log into Supabase dashboard at https://supabase.com/dashboard
  - [ ] Click "New Project" in your organization
  - [ ] Choose project name: `contextor-prod`
  - [ ] Select region closest to target users (e.g., `us-east-1` or `eu-west-1`)
  - [ ] Set a strong database password and save it securely
  - [ ] Wait for project to provision (2-3 minutes)
  - [ ] Note the `project-ref` from the URL or Settings

- [ ] **Task 2: Link local project to production** (AC: #2)
  - [ ] Run `supabase link --project-ref <your-project-ref>`
  - [ ] Enter database password when prompted
  - [ ] Verify link with `supabase db remote list`
  - [ ] Check migration status with `supabase migration list`

- [ ] **Task 3: Push migrations to production** (AC: #2)
  - [ ] Review all local migrations for production readiness
  - [ ] Remove any dev-only data from migrations (test users, etc.)
  - [ ] Run `supabase db push` to apply all migrations
  - [ ] Verify tables in Supabase Table Editor
  - [ ] Verify RLS policies in Authentication > Policies

- [ ] **Task 4: Configure Auth providers** (AC: #3)
  - [ ] Go to Authentication > Providers
  - [ ] Enable Email provider (already enabled by default)
  - [ ] Configure Email templates (Settings > Auth > Email Templates):
    - [ ] Customize confirmation email
    - [ ] Customize password reset email
    - [ ] Set "From" address to hello@contextor.co (after domain verification)
  - [ ] Enable Google OAuth:
    - [ ] Create Google Cloud OAuth credentials (see Dev Notes)
    - [ ] Add Client ID and Secret to Supabase
    - [ ] Add authorized redirect: `https://contextor.co/auth/callback`

- [ ] **Task 5: Configure Auth settings** (AC: #3)
  - [ ] Go to Authentication > Settings
  - [ ] Set Site URL to `https://contextor.co`
  - [ ] Add redirect URLs:
    - [ ] `https://contextor.co/**`
    - [ ] `https://www.contextor.co/**`
  - [ ] Configure JWT expiry (86400 seconds = 24 hours)
  - [ ] Enable "Confirm email" for new signups

- [ ] **Task 6: Deploy Edge Functions** (AC: #4)
  - [ ] Review Edge Functions in `supabase/functions/`
  - [ ] Set function secrets:
    ```bash
    supabase secrets set OPENAI_API_KEY=sk-...
    ```
  - [ ] Deploy functions:
    ```bash
    supabase functions deploy analyze-prompt
    ```
  - [ ] Test function with `supabase functions invoke analyze-prompt --body '{}'`

- [ ] **Task 7: Store production credentials** (AC: #1)
  - [ ] Go to Settings > API
  - [ ] Copy and securely store:
    - [ ] `NEXT_PUBLIC_SUPABASE_URL`
    - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - [ ] `SUPABASE_SERVICE_ROLE_KEY` (never expose publicly)
  - [ ] Add to password manager or secrets vault

## Dev Notes

### Google OAuth Setup (Google Cloud Console)

1. Go to https://console.cloud.google.com/
2. Create or select project
3. Go to APIs & Services > Credentials
4. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: Contextor Production
   - Authorized JavaScript origins: `https://contextor.co`
   - Authorized redirect URIs:
     - `https://<project-ref>.supabase.co/auth/v1/callback`
5. Copy Client ID and Client Secret to Supabase

### Production Checklist

- [ ] Database password is strong and stored securely
- [ ] All migrations applied without errors
- [ ] RLS policies verified for all tables
- [ ] Email templates customized
- [ ] OAuth providers configured with production URLs
- [ ] Edge Functions deployed and tested
- [ ] Service role key stored securely (NEVER in client code)

### Supabase CLI Commands Reference

```bash
# Link to production
supabase link --project-ref <ref>

# Check connection
supabase db remote list

# Push migrations
supabase db push

# List migrations
supabase migration list

# Deploy functions
supabase functions deploy <function-name>

# Set secrets
supabase secrets set KEY=value

# Generate types
supabase gen types typescript --linked > types/supabase.ts
```

### Environment Variables for Production

```env
# Add to Cloud Run secrets (Story 9.5)
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Dependencies

- Local Supabase development complete (Epic 1)
- All migrations tested locally
- Google Cloud project for OAuth

## Definition of Done

- [ ] Production Supabase project created and accessible
- [ ] All migrations applied to production
- [ ] RLS policies active and verified
- [ ] Email/password auth working
- [ ] Google OAuth configured (can test after domain setup)
- [ ] Edge Functions deployed
- [ ] Production credentials stored securely

## Session Restart Notes

When restarting a session to work on this story:
1. Read `CLAUDE.md` first - contains critical API endpoint conventions
2. The production API endpoint will be: `https://contextor.co/api`
3. See Story 9.5 and 9.8 for API_ENDPOINT usage details
