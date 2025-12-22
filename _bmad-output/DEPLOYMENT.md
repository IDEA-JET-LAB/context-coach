# Contextor Production Deployment Guide

> Last Updated: 2025-12-21
> Epic 9 Complete - All systems operational

## Production URLs

| Service | URL | Status |
|---------|-----|--------|
| Web Application | https://contextor.co | Live |
| Health Check | https://contextor.co/api/health | `{"status":"ok"}` |
| Cloud Run Direct | https://contextor-web-414341493974.us-central1.run.app | Live |
| NPM Package | https://www.npmjs.com/package/@contextor/cli | v1.0.0 |

---

## Infrastructure Overview

### Google Cloud Platform (GCP)

**Project:** `ideajetlab-website`
**Region:** `us-central1`

| Resource | Details |
|----------|---------|
| Cloud Run Service | `contextor-web` |
| Container Registry | `gcr.io/ideajetlab-website/contextor-web` |
| Secret Manager | 4 secrets (see below) |
| Service Account | `github-actions-deploy@ideajetlab-website.iam.gserviceaccount.com` |

**GCP Secret Manager Secrets:**
```
SUPABASE_SERVICE_ROLE_KEY  - Supabase service role JWT
OPENAI_API_KEY             - OpenAI API key for prompt analysis
UPSTASH_REDIS_URL          - https://model-lemming-42073.upstash.io
UPSTASH_REDIS_TOKEN        - Upstash REST API token
```

### Supabase

**Project ID:** `ddskanjiobrjphscskog`
**Dashboard:** https://supabase.com/dashboard/project/ddskanjiobrjphscskog
**API URL:** https://ddskanjiobrjphscskog.supabase.co

**Database Tables:**
- `prompts` - Captured prompts from CLI
- `prompt_analyses` - AI analysis results
- `teams`, `team_members` - Team management
- `projects` - Project registrations
- `analysis_configs` - Scoring configuration

### Upstash Redis

**Database:** `model-lemming-42073`
**Purpose:** Rate limiting for capture API
**Console:** https://console.upstash.com

### Namecheap DNS

**Domain:** `contextor.co`
**API Access:** Enabled for programmatic DNS management

**Current DNS Records:**
```
@     A      216.239.32.21   (Cloud Run)
@     A      216.239.34.21   (Cloud Run)
@     A      216.239.36.21   (Cloud Run)
@     A      216.239.38.21   (Cloud Run)
www   CNAME  contextor.co.
@     TXT    google-site-verification=anHDIKbU2AqAHg240LxrzGCpwUPFyKLIy_VaT0vAwvY
```

### NPM Registry

**Package:** `@contextor/cli`
**Version:** 1.0.0
**Organization:** `@contextor`
**Install Command:** `npx @contextor/cli init <token>`

---

## GitHub Repository Secrets

Repository: `IDEA-JET-LAB/context-coach`

| Secret | Purpose |
|--------|---------|
| `GCP_PROJECT_ID` | `ideajetlab-website` |
| `GCP_SA_KEY` | Service account JSON for deployments |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ddskanjiobrjphscskog.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `NPM_TOKEN` | NPM automation token for @contextor org |

---

## Deployment Process

### Automatic (CI/CD)

Push to `main` branch triggers:
1. **Test Job** - Lint, type check
2. **Deploy Job** - Build Docker, push to GCR, deploy to Cloud Run

```bash
git push origin main
# Workflow: .github/workflows/deploy.yml
```

### Manual Deployment

```bash
# 1. Build Docker image (from app/ directory)
cd app
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://ddskanjiobrjphscskog.supabase.co \
  --build-arg "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>" \
  -t gcr.io/ideajetlab-website/contextor-web:latest \
  --push .

# 2. Deploy to Cloud Run
gcloud run deploy contextor-web \
  --image gcr.io/ideajetlab-website/contextor-web:latest \
  --region us-central1 \
  --project ideajetlab-website \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_SUPABASE_URL=https://ddskanjiobrjphscskog.supabase.co,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>,NODE_ENV=production" \
  --set-secrets="SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,UPSTASH_REDIS_URL=UPSTASH_REDIS_URL:latest,UPSTASH_REDIS_TOKEN=UPSTASH_REDIS_TOKEN:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest"
```

### NPM Package Publishing

```bash
cd packages/cli
npm run build
npm publish --access public
# Requires NPM_TOKEN in .npmrc or environment
```

---

## Environment Variables

### Build-Time (Baked into client bundle)
```
NEXT_PUBLIC_SUPABASE_URL=https://ddskanjiobrjphscskog.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

### Runtime (Injected by Cloud Run from Secret Manager)
```
SUPABASE_SERVICE_ROLE_KEY=<from-secret-manager>
OPENAI_API_KEY=<from-secret-manager>
UPSTASH_REDIS_URL=<from-secret-manager>
UPSTASH_REDIS_TOKEN=<from-secret-manager>
NODE_ENV=production
```

---

## Troubleshooting

### Health Check Failing

```bash
# Check health endpoint
curl https://contextor.co/api/health

# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=contextor-web" \
  --project=ideajetlab-website --limit=20
```

**Common Issues:**
- Database table not found → Check Supabase migrations
- Missing env vars → Verify Cloud Run configuration
- Secret access denied → Check service account permissions

### DNS Issues

```bash
# Verify DNS propagation
dig A contextor.co @8.8.8.8

# Check domain mapping
gcloud beta run domain-mappings describe --domain=contextor.co --region=us-central1 --project=ideajetlab-website
```

### Docker Build Issues

```bash
# Ensure amd64 platform (not ARM)
docker buildx build --platform linux/amd64 ...

# Check GCR authentication
gcloud auth configure-docker
```

---

## API Access Credentials

All credentials stored in root `.env` file (NOT committed):

```bash
# GCP - authenticated via gcloud CLI
gcloud auth login

# Supabase
SUPABASE_ACCESS_TOKEN=sbp_...

# Namecheap API
NAMECHEAP_API_USER=explorer80
NAMECHEAP_API_KEY=...

# NPM
NPM_TOKEN=npm_...

# AWS (if needed)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## Service Account Permissions

`github-actions-deploy@ideajetlab-website.iam.gserviceaccount.com`:
- `roles/run.admin` - Deploy Cloud Run services
- `roles/storage.admin` - Push to Container Registry
- `roles/iam.serviceAccountUser` - Act as service account
- `roles/secretmanager.secretAccessor` - Read secrets

---

## Quick Reference Commands

```bash
# Check deployment status
gcloud run services describe contextor-web --region=us-central1 --project=ideajetlab-website

# View recent revisions
gcloud run revisions list --service=contextor-web --region=us-central1 --project=ideajetlab-website

# Check secrets
gcloud secrets list --project=ideajetlab-website

# Update a secret
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=- --project=ideajetlab-website

# DNS management via Namecheap API
curl -s "https://api.namecheap.com/xml.response?ApiUser=explorer80&ApiKey=<key>&UserName=explorer80&ClientIp=<ip>&Command=namecheap.domains.dns.getHosts&SLD=contextor&TLD=co"
```

---

## Architecture Diagram

```
                                    ┌─────────────────┐
                                    │   contextor.co  │
                                    │   (Namecheap)   │
                                    └────────┬────────┘
                                             │ DNS A Records
                                             ▼
┌─────────────────┐              ┌─────────────────────┐
│  GitHub Actions │──── push ───▶│    Cloud Run        │
│  (CI/CD)        │              │    contextor-web    │
└─────────────────┘              │    (us-central1)    │
        │                        └──────────┬──────────┘
        │                                   │
        ▼                                   ▼
┌─────────────────┐              ┌─────────────────────┐
│  Container      │              │   GCP Secret        │
│  Registry (GCR) │              │   Manager           │
└─────────────────┘              └─────────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
          ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
          │    Supabase     │    │  Upstash Redis  │    │    OpenAI       │
          │   (Postgres)    │    │  (Rate Limit)   │    │   (Analysis)    │
          └─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Pending Items

1. **Google OAuth** - Configure in Supabase for Gmail login
2. **UptimeRobot** - Set up external monitoring (optional)
3. **Production Seed Data** - Create first admin user

---

## Contact

- **Repository:** https://github.com/IDEA-JET-LAB/context-coach
- **NPM:** https://www.npmjs.com/org/contextor
