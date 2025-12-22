# Story 9.2: Google Cloud Run Setup

Status: Ready for Dev
Solo Dev: Yes
Epic: 9 - Production Deployment & Infrastructure
Depends On: Story 9.1 (Supabase credentials needed for testing)

## Story

**As a** solo developer,
**I want** to deploy the Next.js app to Google Cloud Run,
**So that** the application scales automatically and I only pay for what I use.

## Acceptance Criteria

1. **Given** a Google Cloud project
   **When** I enable required APIs
   **Then** Cloud Run, Container Registry, and Cloud Build APIs are enabled

2. **Given** the Dockerfile in the project root
   **When** I build and push the container
   **Then** the image is stored in Google Container Registry (or Artifact Registry)
   **And** the image tag follows semantic versioning

3. **Given** a Cloud Run service
   **When** I create/deploy the service
   **Then** it runs the Next.js container
   **And** minimum instances = 0 (scale to zero for cost savings)
   **And** maximum instances = 10 (MVP limit)
   **And** memory = 512MB, CPU = 1

4. **Given** the service is deployed
   **When** I test the default Cloud Run URL
   **Then** the application loads correctly
   **And** all API routes respond

## Tasks / Subtasks

- [ ] **Task 1: Set up Google Cloud project** (AC: #1)
  - [ ] Go to https://console.cloud.google.com/
  - [ ] Create new project or select existing: `contextor-prod`
  - [ ] Note the Project ID (needed for commands)
  - [ ] Enable billing for the project
  - [ ] Enable required APIs:
    ```bash
    gcloud services enable run.googleapis.com
    gcloud services enable containerregistry.googleapis.com
    gcloud services enable cloudbuild.googleapis.com
    ```

- [ ] **Task 2: Install and configure gcloud CLI** (AC: #1)
  - [ ] Install gcloud CLI if not present: https://cloud.google.com/sdk/docs/install
  - [ ] Run `gcloud init` and authenticate
  - [ ] Set default project: `gcloud config set project contextor-prod`
  - [ ] Set default region: `gcloud config set run/region us-central1`
  - [ ] Configure Docker auth: `gcloud auth configure-docker`

- [ ] **Task 3: Create production Dockerfile** (AC: #2)
  - [ ] Create `Dockerfile` in project root (see Dev Notes)
  - [ ] Create `.dockerignore` to exclude unnecessary files
  - [ ] Update `next.config.ts` to enable standalone output:
    ```typescript
    const nextConfig = {
      output: 'standalone',
      // ... other config
    };
    ```

- [ ] **Task 4: Build and test Docker image locally** (AC: #2)
  - [ ] Build image: `docker build -t contextor:local .`
  - [ ] Run locally: `docker run -p 3000:3000 --env-file .env.local contextor:local`
  - [ ] Verify app loads at http://localhost:3000
  - [ ] Test API routes work
  - [ ] Check image size (aim for < 500MB)

- [ ] **Task 5: Push image to Container Registry** (AC: #2)
  - [ ] Tag image for GCR:
    ```bash
    docker tag contextor:local gcr.io/contextor-prod/contextor:v1.0.0
    ```
  - [ ] Push to registry:
    ```bash
    docker push gcr.io/contextor-prod/contextor:v1.0.0
    ```
  - [ ] Verify in Console: Container Registry > Images

- [ ] **Task 6: Deploy to Cloud Run** (AC: #3, #4)
  - [ ] Deploy service:
    ```bash
    gcloud run deploy contextor-web \
      --image gcr.io/contextor-prod/contextor:v1.0.0 \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --min-instances 0 \
      --max-instances 10 \
      --memory 512Mi \
      --cpu 1 \
      --port 3000
    ```
  - [ ] Note the service URL provided
  - [ ] Test the Cloud Run URL in browser

- [ ] **Task 7: Configure environment variables** (AC: #3)
  - [ ] Set environment variables (non-sensitive):
    ```bash
    gcloud run services update contextor-web \
      --set-env-vars "NODE_ENV=production"
    ```
  - [ ] Secrets will be added in Story 9.5

- [ ] **Task 8: Verify deployment** (AC: #4)
  - [ ] Open Cloud Run URL in browser
  - [ ] Verify landing page loads
  - [ ] Test `/api/health` endpoint
  - [ ] Check Cloud Run logs for errors
  - [ ] Verify cold start time is acceptable (< 5s)

## Dev Notes

### Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
```

### .dockerignore

```
node_modules
.next
.git
.gitignore
*.md
.env*
.claude
_bmad*
e2e
playwright-report
test-results
```

### next.config.ts Update

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // ... existing config
};

export default nextConfig;
```

### Useful gcloud Commands

```bash
# List services
gcloud run services list

# Get service details
gcloud run services describe contextor-web

# View logs
gcloud run logs read contextor-web --limit 50

# Update service
gcloud run services update contextor-web --memory 1Gi

# Delete service (if needed)
gcloud run services delete contextor-web
```

### Cost Optimization (Solo Dev)

- **Min instances = 0**: Scale to zero when no traffic (free when idle)
- **Max instances = 10**: Prevent runaway costs from traffic spikes
- **Memory = 512Mi**: Sufficient for Next.js, upgrade if needed
- **CPU = 1**: Single CPU is fine for MVP traffic

### Troubleshooting

**Container fails to start:**
- Check logs: `gcloud run logs read contextor-web`
- Verify PORT=3000 is exposed
- Check environment variables are set

**Slow cold starts:**
- Consider `--min-instances 1` for production (costs ~$15/month)
- Optimize Docker image size
- Check for heavy initialization in app

**Build fails:**
- Verify `npm ci` works locally
- Check all dependencies are in package.json
- Ensure `.dockerignore` doesn't exclude needed files

## Dependencies

- Story 9.1: Supabase production setup (for testing)
- Google Cloud billing enabled
- Docker installed locally

## Definition of Done

- [ ] Google Cloud project configured with required APIs
- [ ] Dockerfile created and tested locally
- [ ] Image pushed to Container Registry
- [ ] Cloud Run service deployed and accessible
- [ ] Default Cloud Run URL returns the app
- [ ] `/api/health` endpoint responds
- [ ] Logs show no errors
