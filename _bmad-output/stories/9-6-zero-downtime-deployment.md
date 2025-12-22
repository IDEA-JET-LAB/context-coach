# Story 9.6: Zero-Downtime Deployment Strategy

Status: Ready for Dev
Solo Dev: Yes
Epic: 9 - Production Deployment & Infrastructure
Depends On: Story 9.2 (Cloud Run), Story 9.4 (CI/CD)

## Story

**As a** solo developer with production users,
**I want** deployments with zero downtime,
**So that** users aren't disrupted when I ship updates.

## Acceptance Criteria

1. **Given** a new deployment
   **When** Cloud Run deploys a new revision
   **Then** traffic is gradually shifted (canary pattern)
   **And** the old revision continues serving requests
   **And** new revision must pass health checks before receiving traffic

2. **Given** the `/api/health` endpoint
   **When** Cloud Run performs health checks
   **Then** the endpoint returns HTTP 200 with `{ status: 'ok' }`
   **And** checks include: database connectivity, basic app functionality

3. **Given** a database migration
   **When** schema changes are needed
   **Then** migrations are applied BEFORE deployment
   **And** only additive changes are made (new columns, new tables)
   **And** destructive changes (drops, renames) are deferred

4. **Given** a deployment failure
   **When** health checks fail for the new revision
   **Then** traffic remains on the old revision
   **And** the failed revision is marked unhealthy
   **And** rollback is automatic (no manual intervention)

## Tasks / Subtasks

- [ ] **Task 1: Create health check endpoint** (AC: #2)
  - [ ] Create `app/api/health/route.ts`
  - [ ] Check database connectivity
  - [ ] Return appropriate status codes
  - [ ] See Dev Notes for implementation

- [ ] **Task 2: Configure Cloud Run health checks** (AC: #1, #4)
  - [ ] Update deploy command with startup probe:
    ```bash
    gcloud run deploy contextor-web \
      --startup-cpu-boost \
      --cpu-throttling \
      ...
    ```
  - [ ] Cloud Run automatically uses HTTP health checks

- [ ] **Task 3: Document migration strategy** (AC: #3)
  - [ ] Create migration guidelines in CLAUDE.md or docs
  - [ ] Document additive-only pattern
  - [ ] Document multi-phase migration for breaking changes
  - [ ] Add pre-deployment checklist

- [ ] **Task 4: Test rollback procedure** (AC: #4)
  - [ ] Deploy a working version
  - [ ] Deploy a "broken" version (e.g., wrong env var)
  - [ ] Verify traffic stays on old revision
  - [ ] Practice manual rollback command
  - [ ] Document the rollback procedure

- [ ] **Task 5: Configure traffic management** (AC: #1)
  - [ ] By default, Cloud Run sends 100% to new revision
  - [ ] For critical deployments, consider gradual rollout:
    ```bash
    gcloud run deploy contextor-web \
      --no-traffic \
      --tag canary

    # Then gradually shift
    gcloud run services update-traffic contextor-web \
      --to-tags=canary=10
    ```

- [ ] **Task 6: Add deployment verification to CI/CD** (AC: #1, #2)
  - [ ] Update GitHub Actions to verify health after deploy
  - [ ] Add curl check for /api/health
  - [ ] Fail workflow if health check fails

## Dev Notes

### Health Check Endpoint

```typescript
// app/api/health/route.ts
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    database: false,
    timestamp: new Date().toISOString(),
  };

  try {
    // Check database connectivity
    const supabase = await createClient();
    const { error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single();

    checks.database = !error;

    if (!checks.database) {
      return Response.json(
        { status: 'unhealthy', checks },
        { status: 503 }
      );
    }

    return Response.json({
      status: 'ok',
      checks,
    });
  } catch (error) {
    return Response.json(
      {
        status: 'error',
        message: 'Health check failed',
        checks
      },
      { status: 503 }
    );
  }
}
```

### Migration Strategy: Additive Only

**Safe migrations (do these anytime):**
```sql
-- Add new column with default
ALTER TABLE users ADD COLUMN new_feature BOOLEAN DEFAULT false;

-- Add new table
CREATE TABLE new_features (...);

-- Add new index
CREATE INDEX idx_users_email ON users(email);

-- Add new RLS policy
CREATE POLICY new_policy ON users ...;
```

**Dangerous migrations (require multi-phase):**
```sql
-- DON'T do these directly in production:
ALTER TABLE users DROP COLUMN old_column;
ALTER TABLE users RENAME COLUMN old TO new;
DROP TABLE old_table;
```

### Multi-Phase Migration Pattern

For breaking changes, follow this pattern:

**Phase 1: Expand (Deploy 1)**
```sql
-- Add new column, keep old
ALTER TABLE users ADD COLUMN display_name VARCHAR(100);
```
```typescript
// Code writes to BOTH columns
await supabase.from('users').update({
  name: value,           // old
  display_name: value,   // new
});
```

**Phase 2: Migrate Data**
```sql
-- Backfill existing data
UPDATE users SET display_name = name WHERE display_name IS NULL;
```

**Phase 3: Contract (Deploy 2)**
```typescript
// Code reads from NEW column only
const { data } = await supabase
  .from('users')
  .select('display_name');
```

**Phase 4: Cleanup (Much Later)**
```sql
-- Only after verifying everything works
ALTER TABLE users DROP COLUMN name;
```

### Rollback Procedure

```bash
# 1. List recent revisions
gcloud run revisions list \
  --service contextor-web \
  --region us-central1 \
  --limit 5

# 2. Identify the last working revision
# Look for one with traffic > 0 or check timestamps

# 3. Rollback to specific revision
gcloud run services update-traffic contextor-web \
  --region us-central1 \
  --to-revisions=contextor-web-00005-abc=100

# 4. Verify
curl https://contextor.co/api/health
```

### Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests pass locally
- [ ] Migrations are additive-only (or multi-phase planned)
- [ ] Migrations applied to production Supabase FIRST
- [ ] No console.log with sensitive data
- [ ] Environment variables documented
- [ ] Rollback revision identified

### Cloud Run Deployment Behavior

By default, Cloud Run:
1. Deploys new revision
2. Runs startup health check
3. If healthy, shifts 100% traffic to new revision
4. Keeps old revision available for rollback
5. If unhealthy, new revision gets 0% traffic

To be more conservative:
```bash
# Deploy without traffic
gcloud run deploy contextor-web \
  --image gcr.io/PROJECT/contextor:v2 \
  --no-traffic \
  --tag canary

# Test canary URL
curl https://canary---contextor-web-xyz.run.app

# Gradually shift traffic
gcloud run services update-traffic contextor-web \
  --to-tags=canary=10  # 10% to canary

# If good, shift more
gcloud run services update-traffic contextor-web \
  --to-tags=canary=50

# Finally, full rollout
gcloud run services update-traffic contextor-web \
  --to-latest
```

### Troubleshooting

**Health check fails after deploy:**
- Check Cloud Run logs for startup errors
- Verify environment variables are set
- Check database connectivity
- Review recent code changes

**Traffic not shifting:**
- Check revision health in Cloud Run console
- Look for errors in Logs Explorer
- Verify health endpoint returns 200

**Need emergency rollback:**
```bash
# Quick rollback to previous
gcloud run services update-traffic contextor-web \
  --region us-central1 \
  --to-revisions=PREVIOUS_REVISION=100
```

## Dependencies

- Story 9.2: Cloud Run service deployed
- Story 9.4: CI/CD pipeline (for deployment verification)

## Definition of Done

- [ ] `/api/health` endpoint created and tested
- [ ] Health check verifies database connectivity
- [ ] Cloud Run startup probe configured
- [ ] Rollback procedure tested and documented
- [ ] Migration strategy documented
- [ ] CI/CD verifies deployment health
- [ ] Pre-deployment checklist created
