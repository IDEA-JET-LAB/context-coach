# Story 9.5: Environment & Secrets Management

Status: Ready for Dev
Solo Dev: Yes
Epic: 9 - Production Deployment & Infrastructure
Depends On: Story 9.1 (Supabase), Story 9.2 (Cloud Run)

## Story

**As a** solo developer,
**I want** secure environment variable management,
**So that** secrets are never exposed in code, logs, or container images.

## Acceptance Criteria

1. **Given** production secrets
   **When** they are configured
   **Then** the following are stored in Cloud Run secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `UPSTASH_REDIS_URL`
   - `UPSTASH_REDIS_TOKEN`
   - `OPENAI_API_KEY` (for analysis)

2. **Given** Cloud Run service
   **When** secrets are attached
   **Then** they are injected as environment variables at runtime
   **And** they are not visible in container image
   **And** they can be rotated without redeployment

3. **Given** build-time variables
   **When** the Docker build runs
   **Then** `NEXT_PUBLIC_*` variables are set via build args
   **And** they are baked into the client bundle
   **And** they do NOT contain secrets

4. **Given** local development
   **When** `.env.local` is used
   **Then** it contains local Supabase credentials
   **And** it is in `.gitignore`
   **And** `.env.example` documents required variables

## Tasks / Subtasks

- [ ] **Task 1: Create Upstash Redis for rate limiting** (AC: #1)
  - [ ] Go to https://console.upstash.com/
  - [ ] Create new Redis database
  - [ ] Select region close to Cloud Run (e.g., us-central1)
  - [ ] Note the credentials:
    - [ ] `UPSTASH_REDIS_URL`
    - [ ] `UPSTASH_REDIS_TOKEN`
  - [ ] Test connection from local machine

- [ ] **Task 2: Get OpenAI API key** (AC: #1)
  - [ ] Go to https://platform.openai.com/api-keys
  - [ ] Create new API key for production
  - [ ] Set usage limits to prevent surprises
  - [ ] Note the key: `OPENAI_API_KEY`

- [ ] **Task 3: Create Cloud Run secrets** (AC: #1, #2)
  - [ ] Enable Secret Manager API:
    ```bash
    gcloud services enable secretmanager.googleapis.com
    ```
  - [ ] Create secrets:
    ```bash
    # Supabase
    echo -n "https://xxx.supabase.co" | \
      gcloud secrets create SUPABASE_URL --data-file=-

    echo -n "eyJ..." | \
      gcloud secrets create SUPABASE_ANON_KEY --data-file=-

    echo -n "eyJ..." | \
      gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-

    # Upstash Redis
    echo -n "https://xxx.upstash.io" | \
      gcloud secrets create UPSTASH_REDIS_URL --data-file=-

    echo -n "xxx" | \
      gcloud secrets create UPSTASH_REDIS_TOKEN --data-file=-

    # OpenAI
    echo -n "sk-..." | \
      gcloud secrets create OPENAI_API_KEY --data-file=-
    ```

- [ ] **Task 4: Grant Cloud Run access to secrets** (AC: #2)
  - [ ] Get the Cloud Run service account:
    ```bash
    gcloud run services describe contextor-web \
      --region us-central1 \
      --format 'value(spec.template.spec.serviceAccountName)'
    ```
  - [ ] Grant access to each secret:
    ```bash
    gcloud secrets add-iam-policy-binding SUPABASE_URL \
      --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
      --role="roles/secretmanager.secretAccessor"

    # Repeat for all secrets...
    ```

- [ ] **Task 5: Attach secrets to Cloud Run service** (AC: #2)
  - [ ] Update the deploy command to include secrets:
    ```bash
    gcloud run deploy contextor-web \
      --image gcr.io/PROJECT_ID/contextor:latest \
      --region us-central1 \
      --set-secrets="SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
      --set-secrets="UPSTASH_REDIS_URL=UPSTASH_REDIS_URL:latest" \
      --set-secrets="UPSTASH_REDIS_TOKEN=UPSTASH_REDIS_TOKEN:latest" \
      --set-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest"
    ```

- [ ] **Task 6: Update GitHub Actions for build-time vars** (AC: #3)
  - [ ] Add to GitHub Secrets:
    - [ ] `NEXT_PUBLIC_SUPABASE_URL`
    - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] Update deploy workflow to pass build args
  - [ ] Verify client-side env vars work

- [ ] **Task 7: Create .env.example** (AC: #4)
  - [ ] Create `app/.env.example` with all required variables
  - [ ] Add comments explaining each variable
  - [ ] Verify `.env.local` is in `.gitignore`

- [ ] **Task 8: Test secrets in production** (AC: #2)
  - [ ] Deploy with secrets attached
  - [ ] Verify app can connect to Supabase
  - [ ] Verify rate limiting works (Upstash)
  - [ ] Verify analysis works (OpenAI)
  - [ ] Check logs for any exposed secrets (should be none)

## Dev Notes

### CRITICAL: API Endpoint Convention

**Read this before configuring production URLs.**

The `API_ENDPOINT` stored in project config INCLUDES the `/api` prefix:
```
API_ENDPOINT = "https://contextor.co/api"  ← INCLUDES /api
```

When the CLI generates capture hooks, it appends ONLY the route path:
```bash
# CORRECT:
curl "${API_ENDPOINT}/prompts/capture"
# Result: https://contextor.co/api/prompts/capture

# WRONG - DO NOT DO THIS:
curl "${API_ENDPOINT}/api/prompts/capture"
# Result: https://contextor.co/api/api/prompts/capture (404!)
```

This applies to:
- Production: `https://contextor.co/api`
- Local dev: `http://127.0.0.1:3050/api`

### .env.example

```env
# ===========================================
# Contextor Environment Variables
# ===========================================
# Copy this file to .env.local for local development
# Production values are stored in Google Cloud Secret Manager

# Supabase (Required)
# Get from: Supabase Dashboard > Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase Service Role (Server-side only, NEVER expose to client)
# Get from: Supabase Dashboard > Settings > API > service_role
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Rate Limiting - Upstash Redis (Required for capture API)
# Get from: Upstash Console > Redis > Details
UPSTASH_REDIS_URL=https://your-redis.upstash.io
UPSTASH_REDIS_TOKEN=your-token

# AI Analysis - OpenAI (Required for prompt analysis)
# Get from: OpenAI Platform > API Keys
OPENAI_API_KEY=sk-...

# Email - Resend (Optional, for email notifications)
# Get from: Resend Dashboard > API Keys
# RESEND_API_KEY=re_...
```

### Secret Manager Commands

```bash
# List all secrets
gcloud secrets list

# View secret details
gcloud secrets describe SECRET_NAME

# View secret value (careful!)
gcloud secrets versions access latest --secret=SECRET_NAME

# Update secret value
echo -n "new-value" | \
  gcloud secrets versions add SECRET_NAME --data-file=-

# Delete a secret
gcloud secrets delete SECRET_NAME
```

### Cloud Run Secrets Syntax

```bash
# Attach as environment variable
--set-secrets="ENV_VAR_NAME=SECRET_NAME:latest"

# Attach as mounted file
--set-secrets="/path/to/file=SECRET_NAME:latest"

# Multiple secrets
--set-secrets="VAR1=SECRET1:latest,VAR2=SECRET2:latest"
```

### Updated Deploy Command (Full)

```bash
gcloud run deploy contextor-web \
  --image gcr.io/PROJECT_ID/contextor:$GITHUB_SHA \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --port 3000 \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest" \
  --set-secrets="UPSTASH_REDIS_URL=UPSTASH_REDIS_URL:latest" \
  --set-secrets="UPSTASH_REDIS_TOKEN=UPSTASH_REDIS_TOKEN:latest" \
  --set-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

### Security Best Practices

1. **Never log secrets** - Use structured logging that excludes env vars
2. **Rotate regularly** - Update secrets quarterly at minimum
3. **Minimal access** - Only grant secretAccessor role to services that need it
4. **Use latest version** - Always reference `:latest` for automatic updates
5. **Audit access** - Review Secret Manager audit logs periodically

### Troubleshooting

**"Permission denied" accessing secret:**
- Check service account has `roles/secretmanager.secretAccessor`
- Verify correct project is targeted
- Check secret name spelling

**Secret not available in app:**
- Verify `--set-secrets` syntax is correct
- Check Cloud Run logs for mount errors
- Redeploy after adding secrets

**Build-time vs runtime:**
- `NEXT_PUBLIC_*` = build-time, baked into JS bundle
- All other secrets = runtime, injected by Cloud Run

## Dependencies

- Story 9.1: Supabase production credentials
- Story 9.2: Cloud Run service deployed
- Story 9.4: CI/CD pipeline (for build-time vars)

## Definition of Done

- [ ] Upstash Redis created and tested
- [ ] OpenAI API key created with limits
- [ ] All secrets stored in Secret Manager
- [ ] Cloud Run service can access secrets
- [ ] Secrets attached to Cloud Run deployment
- [ ] GitHub Actions passes build-time vars
- [ ] .env.example created with documentation
- [ ] Production app works with all services
- [ ] No secrets visible in logs or images
