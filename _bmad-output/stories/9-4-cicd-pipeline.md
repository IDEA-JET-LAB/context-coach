# Story 9.4: CI/CD Pipeline (GitHub Actions)

Status: Ready for Dev
Solo Dev: Yes
Epic: 9 - Production Deployment & Infrastructure
Depends On: Story 9.2 (Cloud Run), Story 9.5 (Secrets)

## Story

**As a** solo developer,
**I want** automated deployments on push to main,
**So that** code changes are deployed consistently without manual steps.

## Acceptance Criteria

1. **Given** a push to the `main` branch
   **When** the GitHub Action triggers
   **Then** the following steps run:
   1. Checkout code
   2. Run linting and type checking
   3. Run tests (unit + E2E)
   4. Build Docker image
   5. Push to Container Registry
   6. Deploy to Cloud Run

2. **Given** a pull request
   **When** the PR is opened or updated
   **Then** only steps 1-3 run (no deployment)
   **And** status checks report pass/fail

3. **Given** deployment to Cloud Run
   **When** the new revision is deployed
   **Then** traffic shifts gradually (canary deployment)
   **And** health checks pass before full traffic shift
   **And** old revision is kept for rollback

4. **Given** a deployment failure
   **When** health checks fail
   **Then** the deployment is rolled back automatically
   **And** I am notified via GitHub notification

## Tasks / Subtasks

- [ ] **Task 1: Create GCP service account for CI/CD** (AC: #1)
  - [ ] Go to Google Cloud Console > IAM & Admin > Service Accounts
  - [ ] Create new service account: `github-actions-deployer`
  - [ ] Grant roles:
    - [ ] Cloud Run Admin
    - [ ] Storage Admin (for Container Registry)
    - [ ] Service Account User
  - [ ] Create and download JSON key
  - [ ] Add key as GitHub Secret: `GCP_SA_KEY`

- [ ] **Task 2: Add GitHub Secrets** (AC: #1)
  - [ ] Go to GitHub repo > Settings > Secrets and variables > Actions
  - [ ] Add secrets:
    - [ ] `GCP_SA_KEY`: Service account JSON key (entire file content)
    - [ ] `GCP_PROJECT_ID`: Your GCP project ID

- [ ] **Task 3: Create CI workflow for PRs** (AC: #2)
  - [ ] Create `.github/workflows/ci.yml`
  - [ ] Configure to run on pull requests
  - [ ] Include: lint, type-check, unit tests
  - [ ] See Dev Notes for workflow file

- [ ] **Task 4: Create deploy workflow for main** (AC: #1, #3)
  - [ ] Create `.github/workflows/deploy.yml`
  - [ ] Configure to run on push to main
  - [ ] Include: test, build, push, deploy
  - [ ] See Dev Notes for workflow file

- [ ] **Task 5: Add health check configuration** (AC: #3)
  - [ ] Ensure `/api/health` endpoint exists and works
  - [ ] Configure Cloud Run startup probe in deploy command
  - [ ] Set appropriate timeout for cold starts

- [ ] **Task 6: Test CI workflow** (AC: #2)
  - [ ] Create a test branch
  - [ ] Open a PR
  - [ ] Verify CI runs and passes
  - [ ] Check status checks appear on PR

- [ ] **Task 7: Test deploy workflow** (AC: #1, #3, #4)
  - [ ] Merge a PR to main
  - [ ] Watch Actions tab for deployment
  - [ ] Verify new revision appears in Cloud Run
  - [ ] Verify app works at https://contextor.co
  - [ ] Check that old revision is available for rollback

- [ ] **Task 8: Add deployment badge to README** (AC: #1)
  - [ ] Add status badge to README.md:
    ```markdown
    ![Deploy](https://github.com/your-username/contextor/actions/workflows/deploy.yml/badge.svg)
    ```

## Dev Notes

### CI Workflow (.github/workflows/ci.yml)

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: app/package-lock.json

      - name: Install dependencies
        working-directory: app
        run: npm ci

      - name: Lint
        working-directory: app
        run: npm run lint

      - name: Type check
        working-directory: app
        run: npm run type-check

      - name: Unit tests
        working-directory: app
        run: npm run test:unit
        if: hashFiles('app/vitest.config.ts') != ''
```

### Deploy Workflow (.github/workflows/deploy.yml)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: contextor-web
  REGION: us-central1

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: app/package-lock.json

      - name: Install dependencies
        working-directory: app
        run: npm ci

      - name: Lint
        working-directory: app
        run: npm run lint

      - name: Type check
        working-directory: app
        run: npm run type-check

  deploy:
    needs: test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker

      - name: Build Docker image
        working-directory: app
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }} \
            --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }} \
            -t gcr.io/$PROJECT_ID/$SERVICE_NAME:${{ github.sha }} \
            -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
            .

      - name: Push Docker image
        run: |
          docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:${{ github.sha }}
          docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy $SERVICE_NAME \
            --image gcr.io/$PROJECT_ID/$SERVICE_NAME:${{ github.sha }} \
            --region $REGION \
            --platform managed \
            --allow-unauthenticated \
            --min-instances 0 \
            --max-instances 10 \
            --memory 512Mi \
            --cpu 1 \
            --port 3000

      - name: Verify deployment
        run: |
          SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')
          curl -f "$SERVICE_URL/api/health" || exit 1
          echo "Deployment verified at $SERVICE_URL"
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `GCP_SA_KEY` | Service account JSON key (full file content) |
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

### npm Scripts (add to package.json)

```json
{
  "scripts": {
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test:unit": "vitest run",
    "test": "playwright test"
  }
}
```

### Rollback Procedure

If a deployment goes wrong:

```bash
# List recent revisions
gcloud run revisions list --service contextor-web --region us-central1

# Rollback to specific revision
gcloud run services update-traffic contextor-web \
  --to-revisions=contextor-web-00005-abc=100 \
  --region us-central1

# Or rollback to previous
gcloud run services update-traffic contextor-web \
  --to-latest \
  --region us-central1
```

### Troubleshooting

**Workflow doesn't trigger:**
- Check branch name matches exactly (`main` not `master`)
- Verify workflow file is in `.github/workflows/`
- Check workflow syntax with: https://rhysd.github.io/actionlint/

**Docker build fails:**
- Check Dockerfile path is correct
- Verify all required files are not in .dockerignore
- Test build locally first

**Deployment fails:**
- Check service account permissions
- Verify secrets are set correctly
- Check Cloud Run logs for errors

**Health check fails:**
- Ensure /api/health endpoint exists
- Check endpoint returns 200 status
- Increase timeout if cold start is slow

## Dependencies

- Story 9.2: Cloud Run service exists
- Story 9.3: Domain configured (for final verification)
- GitHub repository set up

## Definition of Done

- [ ] Service account created with correct permissions
- [ ] GitHub Secrets configured
- [ ] CI workflow runs on PRs
- [ ] Deploy workflow runs on push to main
- [ ] Deployment creates new Cloud Run revision
- [ ] Health check verifies deployment
- [ ] Rollback procedure documented and tested
- [ ] Status badge added to README
