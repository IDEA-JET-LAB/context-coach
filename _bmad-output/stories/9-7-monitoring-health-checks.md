# Story 9.7: Monitoring & Health Checks

Status: Ready for Dev
Solo Dev: Yes
Epic: 9 - Production Deployment & Infrastructure
Depends On: Story 9.2 (Cloud Run), Story 9.6 (Health endpoint)

## Story

**As a** solo developer,
**I want** visibility into production health,
**So that** I can detect and respond to issues quickly without constant manual checking.

## Acceptance Criteria

1. **Given** the production deployment
   **When** I access Google Cloud Console
   **Then** I can see Cloud Run metrics: request count, latency, error rate, CPU, memory

2. **Given** Supabase dashboard
   **When** I access it
   **Then** I can see: database connections, query performance, auth events, realtime connections

3. **Given** application logs
   **When** errors occur
   **Then** they are captured in Cloud Logging
   **And** logs include: request ID, user ID (if authenticated), error stack trace
   **And** logs follow the format: `[CONTEXT] action: details`

4. **Given** the need for uptime monitoring
   **When** I configure external monitoring
   **Then** a service pings `/api/health` every 5 minutes
   **And** I am notified on failure via email or Slack

## Tasks / Subtasks

- [ ] **Task 1: Set up structured logging** (AC: #3)
  - [ ] Create `lib/utils/logger.ts`
  - [ ] Implement log/error/warn functions
  - [ ] Use JSON format for Cloud Logging compatibility
  - [ ] Add request context where available

- [ ] **Task 2: Add logging to key operations** (AC: #3)
  - [ ] Add logging to capture API endpoint
  - [ ] Add logging to auth operations
  - [ ] Add error logging with stack traces
  - [ ] Ensure no sensitive data in logs

- [ ] **Task 3: Explore Cloud Run metrics** (AC: #1)
  - [ ] Go to Cloud Run > contextor-web > Metrics
  - [ ] Familiarize with available metrics:
    - [ ] Request count
    - [ ] Request latency (P50, P95, P99)
    - [ ] Container instance count
    - [ ] CPU and memory utilization
    - [ ] Error rate (4xx, 5xx)
  - [ ] Create a mental baseline of normal values

- [ ] **Task 4: Explore Cloud Logging** (AC: #3)
  - [ ] Go to Logging > Logs Explorer
  - [ ] Create useful queries:
    - [ ] All errors: `severity>=ERROR`
    - [ ] Specific service: `resource.labels.service_name="contextor-web"`
    - [ ] Request logs: `httpRequest.requestUrl:"/api/"`
  - [ ] Save queries for quick access

- [ ] **Task 5: Set up uptime monitoring** (AC: #4)
  - [ ] Choose a free monitoring service:
    - [ ] UptimeRobot (free tier: 50 monitors, 5-min interval)
    - [ ] Freshping (free tier: 50 monitors)
    - [ ] Checkly (free tier: 5 monitors)
  - [ ] Create monitor for `https://contextor.co/api/health`
  - [ ] Configure alert via email
  - [ ] Test alert by temporarily breaking health endpoint

- [ ] **Task 6: Explore Supabase monitoring** (AC: #2)
  - [ ] Go to Supabase Dashboard
  - [ ] Review available metrics:
    - [ ] Database > Reports (query performance)
    - [ ] Authentication > Users (sign-ups, sign-ins)
    - [ ] Realtime > Connections
    - [ ] Edge Functions > Logs
  - [ ] Note any built-in alerts

- [ ] **Task 7: Create monitoring checklist** (AC: #1, #2, #3)
  - [ ] Document what to check during incidents
  - [ ] Document normal baseline values
  - [ ] Create quick-reference for common issues

## Dev Notes

### Structured Logger

```typescript
// lib/utils/logger.ts

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

interface LogEntry {
  severity: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

function createLogEntry(
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>
): LogEntry {
  return {
    severity: level,
    message: `[${context}] ${message}`,
    timestamp: new Date().toISOString(),
    context,
    ...data,
  };
}

export function log(
  context: string,
  message: string,
  data?: Record<string, unknown>
) {
  const entry = createLogEntry('INFO', context, message, data);
  console.log(JSON.stringify(entry));
}

export function warn(
  context: string,
  message: string,
  data?: Record<string, unknown>
) {
  const entry = createLogEntry('WARNING', context, message, data);
  console.warn(JSON.stringify(entry));
}

export function error(
  context: string,
  message: string,
  err?: Error,
  data?: Record<string, unknown>
) {
  const entry = createLogEntry('ERROR', context, message, {
    ...data,
    error: err?.message,
    stack: err?.stack,
  });
  console.error(JSON.stringify(entry));
}

// Usage examples:
// log('API', 'Prompt captured', { promptId: 'xxx', projectId: 'yyy' });
// error('AUTH', 'Login failed', err, { email: 'user@...' });
```

### Adding Logging to API Routes

```typescript
// Example: app/api/prompts/capture/route.ts
import { log, error } from '@/lib/utils/logger';

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    log('CAPTURE', 'Request received', { requestId });

    // ... validation and processing ...

    log('CAPTURE', 'Prompt stored', {
      requestId,
      promptId: newPrompt.id,
      projectId
    });

    return Response.json({ success: true });

  } catch (err) {
    error('CAPTURE', 'Failed to capture prompt', err as Error, { requestId });

    return Response.json(
      { error: 'Capture failed' },
      { status: 500 }
    );
  }
}
```

### Cloud Logging Queries

Save these in Logs Explorer for quick access:

**All errors:**
```
resource.type="cloud_run_revision"
resource.labels.service_name="contextor-web"
severity>=ERROR
```

**API requests:**
```
resource.type="cloud_run_revision"
resource.labels.service_name="contextor-web"
httpRequest.requestUrl:"/api/"
```

**Specific context:**
```
resource.type="cloud_run_revision"
jsonPayload.context="CAPTURE"
```

**Recent errors with stack traces:**
```
resource.type="cloud_run_revision"
severity=ERROR
jsonPayload.stack:*
```

### UptimeRobot Setup

1. Go to https://uptimerobot.com/
2. Create free account
3. Add New Monitor:
   - Monitor Type: HTTP(s)
   - Friendly Name: Contextor Production
   - URL: https://contextor.co/api/health
   - Monitoring Interval: 5 minutes
4. Add Alert Contact (your email)
5. Create monitor

### Monitoring Checklist (for incidents)

When something seems wrong:

1. **Check external monitor** - Is the site up at all?
2. **Cloud Run Metrics** - Any spike in errors or latency?
3. **Cloud Run Logs** - Search for recent errors
4. **Supabase Dashboard** - Database healthy? Auth working?
5. **Recent deployments** - Did something just deploy?

### Normal Baseline Values (update after go-live)

| Metric | Normal Range | Alert Threshold |
|--------|-------------|-----------------|
| Request latency (P95) | < 500ms | > 2s |
| Error rate | < 1% | > 5% |
| CPU utilization | < 50% | > 80% |
| Memory utilization | < 70% | > 90% |
| Health check | 100% up | < 99% |

### Future Enhancements (Post-MVP)

When you have more users and budget:

1. **Sentry** - Real-time error tracking with context
   - Client-side and server-side
   - Stack traces with source maps
   - User impact analysis

2. **Cloud Monitoring Alerts** - Automated alerts
   - Latency threshold alerts
   - Error rate alerts
   - Budget alerts

3. **Datadog/New Relic** - Full APM
   - Distributed tracing
   - Performance profiling
   - Custom dashboards

For now, the free tier of external monitoring + Cloud Logging is sufficient for a solo developer.

### Cost Considerations

- Cloud Logging: First 50GB/month free, then $0.50/GB
- Cloud Run metrics: Free
- UptimeRobot: Free tier (50 monitors, 5-min interval)
- Supabase metrics: Included in plan

## Dependencies

- Story 9.2: Cloud Run deployed
- Story 9.6: Health endpoint created

## Definition of Done

- [ ] Structured logger created
- [ ] Logging added to capture API
- [ ] Logging added to error boundaries
- [ ] Cloud Run metrics explored
- [ ] Cloud Logging queries saved
- [ ] External uptime monitor configured
- [ ] Alert notification tested
- [ ] Supabase monitoring explored
- [ ] Monitoring checklist documented
