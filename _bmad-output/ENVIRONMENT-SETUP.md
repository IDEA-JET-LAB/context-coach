# Environment Setup Guide

**Last verified:** December 2025
**Status:** Production running at https://contextor.co

## CRITICAL: Cloud Supabase Only

**This project uses Cloud Supabase for ALL development - local Supabase is NOT used.**

| Service | Development & Production |
|---------|-------------------------|
| Supabase | Cloud (ddskanjiobrjphscskog.supabase.co) |
| Email | Amazon SES (via Supabase) |
| Redis | Upstash Redis (rate limiting) |
| App URL | Production: contextor.co / Local dev server: 127.0.0.1:3050 |
| OAuth | Google OAuth enabled |

**Why Cloud-only:**
- Consistent data across all development
- No need to sync local/production schemas
- Real OAuth and email flows during development
- Simplified setup (no Docker containers for Supabase)

---

## Local Development Setup

### 1. Prerequisites

- Node.js 18+
- Access to the Cloud Supabase credentials (in `app/.env.local`)

### 2. Environment File

The `.env.local` file should already contain Cloud Supabase credentials:

```bash
# Cloud Supabase (used for ALL development)
NEXT_PUBLIC_SUPABASE_URL=https://ddskanjiobrjphscskog.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

If you need to set up a fresh environment, copy from `.env.example` and get the Cloud credentials from the team.

### 3. Run Development Server

```bash
cd app
npm run dev -- -p 3050
```

Access the app at: http://127.0.0.1:3050

### 4. Emails

Emails are sent via Amazon SES (configured in Supabase Dashboard). For testing, use email addresses that can actually receive emails.

**Note:** Do NOT run `supabase start` or any local Supabase commands.

---

## Production Setup (Cloud Run)

### Infrastructure Details

| Component | Value |
|-----------|-------|
| GCP Project | `ideajetlab-website` |
| Container Registry | `gcr.io/ideajetlab-website/contextor` |
| Cloud Run Service | `contextor-web` |
| Region | `us-central1` |
| Supabase Project | `ddskanjiobrjphscskog` |
| Domain | contextor.co (Namecheap) |

### Environment Variables in Cloud Run

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | https://ddskanjiobrjphscskog.supabase.co | Build-time (baked in) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... | Build-time (baked in) |
| `NEXT_PUBLIC_APP_URL` | https://contextor.co | Build-time (for callbacks) |
| `SUPABASE_SERVICE_ROLE_KEY` | (secret) | Runtime - GCP Secret Manager |
| `UPSTASH_REDIS_URL` | (from Upstash) | Runtime |
| `UPSTASH_REDIS_TOKEN` | (from Upstash) | Runtime - GCP Secret Manager |
| `OPENAI_API_KEY` | (from OpenAI) | Runtime - GCP Secret Manager |

### Build & Deploy

**CRITICAL: Always use these exact settings:**

```bash
cd app

# Step 1: Set correct GCP project (REQUIRED)
gcloud config set project ideajetlab-website

# Step 2: Build with correct platform and env vars
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://ddskanjiobrjphscskog.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkc2thbmppb2JyanBoc2Nza29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMTMzNTIsImV4cCI6MjA4MTg4OTM1Mn0.lB5CtFZunXFR6QbE2OvKRaMWVhZ-zOEb1GmAVqdtKTA \
  --build-arg NEXT_PUBLIC_APP_URL=https://contextor.co \
  -t gcr.io/ideajetlab-website/contextor:vX.X.X \
  .

# Step 3: Push to Container Registry
docker push gcr.io/ideajetlab-website/contextor:vX.X.X

# Step 4: Deploy to Cloud Run
gcloud run deploy contextor-web \
  --image gcr.io/ideajetlab-website/contextor:vX.X.X \
  --region us-central1

# Step 5: Verify health
curl https://contextor.co/api/health
```

---

## Google OAuth Setup (VERIFIED WORKING)

### Current Configuration

| Setting | Value |
|---------|-------|
| Google Cloud Project | ideajetlab-website |
| OAuth Client Type | Web application |
| Redirect URI | https://ddskanjiobrjphscskog.supabase.co/auth/v1/callback |

### Setup Steps

#### 1. Create OAuth Credentials in Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `ideajetlab-website`
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Select **Web application**
6. Add authorized redirect URI:
   ```
   https://ddskanjiobrjphscskog.supabase.co/auth/v1/callback
   ```
7. Copy the **Client ID** and **Client Secret**

#### 2. Configure Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ddskanjiobrjphscskog)
2. Navigate to **Authentication > Providers**
3. Enable **Google**
4. Enter the **Client ID** and **Client Secret** from step 1
5. Save

#### 3. Test

The "Continue with Google" button should now work on the login/signup pages at https://contextor.co/login.

### Troubleshooting OAuth

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Authentication failed" error | Invalid API key baked into image | Verify publishable key is correct, rebuild Docker image |
| Redirect to wrong URL after OAuth | Missing NEXT_PUBLIC_APP_URL | Add `--build-arg NEXT_PUBLIC_APP_URL=https://contextor.co` |
| "Invalid redirect URI" | Mismatch in Google Console | Ensure URI is exactly: `https://ddskanjiobrjphscskog.supabase.co/auth/v1/callback` |

---

## Amazon SES Email Setup

Email is configured in Supabase Dashboard under **Project Settings > Auth > SMTP Settings**:

| Setting | Value |
|---------|-------|
| Sender email | noreply@contextor.co |
| Host | email-smtp.eu-west-1.amazonaws.com |
| Port | 587 |
| Username | (AWS SES SMTP user) |
| Password | (AWS SES SMTP password) |

**Note:** SES is currently in sandbox mode - only verified email addresses can receive emails.
To move to production, request production access in AWS SES Console.

---

## Troubleshooting

### Email Redirects to Wrong URL (0.0.0.0:3000)

**Root cause:** Behind Cloud Run's reverse proxy, `request.url` returns the container's internal address, not the public URL.

**Fix applied:** Created `lib/utils/get-origin.ts` utility that checks (in order):
1. `NEXT_PUBLIC_APP_URL` environment variable
2. `X-Forwarded-Host` header from reverse proxy
3. `Host` header
4. Falls back to `request.url` origin

**Prevention:** Always include `--build-arg NEXT_PUBLIC_APP_URL=https://contextor.co` in Docker build.

### Google OAuth "Authentication failed"

**Common causes:**
1. Wrong Supabase publishable key baked into Docker image
2. Typo in the key (case-sensitive)

**Debugging:**
```bash
# Check Cloud Run logs for specific error
gcloud run logs read contextor-web --region us-central1 --limit 50 | grep -i auth
```

Look for: `[AUTH] Code exchange error: Invalid API key`

**Fix:** Verify the publishable key character-by-character and rebuild.

### Rate Limiting Errors

Ensure Upstash Redis credentials are configured in Cloud Run:
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`

### Wrong Architecture / Wrong Project Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Artifact Registry API not enabled in project X" | Wrong GCP project | `gcloud config set project ideajetlab-website` |
| "Container manifest type must support amd64/linux" | Built for ARM (Mac default) | Add `--platform linux/amd64` to docker build |

---

## Key Learnings

### NEXT_PUBLIC_ Variables Are Build-Time

Variables prefixed with `NEXT_PUBLIC_` are baked into the client JavaScript bundle at build time. They cannot be changed at runtime for client components.

**Implication:** If any `NEXT_PUBLIC_` variable changes, you MUST rebuild the Docker image.

### Mac Builds ARM by Default

Docker on Mac (M1/M2/M3) builds for `linux/arm64` by default. Cloud Run requires `linux/amd64`.

**Always use:** `--platform linux/amd64`

### Supabase Publishable Key is Case-Sensitive

A single character case mismatch (e.g., `x` vs `X`) will cause "Invalid API key" errors. Double-check all characters.

### Reverse Proxy Origin Detection

Cloud Run terminates SSL and proxies to your container. The `request.url` origin will be the container's internal address (e.g., `http://0.0.0.0:3000`), not the public domain.

Use `X-Forwarded-Host` or explicit `NEXT_PUBLIC_APP_URL` for correct origin detection.
