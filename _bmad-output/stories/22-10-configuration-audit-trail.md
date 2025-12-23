# Story 22.10: Configuration Audit Trail

Status: Ready

## Story

**As a** super admin,
**I want** a comprehensive audit trail for all configuration changes,
**So that** I can track who changed what, when, and why for compliance and debugging.

## Acceptance Criteria

1. **Given** any configuration change occurs
   **When** the change is saved
   **Then** an audit record is created with: user, action, timestamp, before/after values

2. **Given** I navigate to Admin > Audit Log
   **When** the page loads
   **Then** I see all configuration changes in reverse chronological order
   **And** I can filter by: action type, user, date range

3. **Given** I click on an audit entry
   **When** the detail view opens
   **Then** I see the full before and after state
   **And** I see a diff highlighting what changed

4. **Given** I want to find a specific change
   **When** I search the audit log
   **Then** I can search by: config name, user email, action type
   **And** results are paginated and sorted

5. **Given** audit entries exist for a long period
   **When** viewing the audit log
   **Then** entries older than 2 years are in cold storage
   **And** I can request retrieval of archived entries

6. **Given** I need compliance reporting
   **When** I export the audit log
   **Then** I can download as CSV with all fields
   **And** I can filter the export by date range

## Dependencies

- **Story 7.5**: Analysis Config Editor (config change actions)
- **Story 22.1-22.8**: All configuration features (audit sources)

## Tasks / Subtasks

- [ ] **Task 1: Create audit log database schema** (AC: #1)
  - [ ] Create migration `20251223006000_config_audit_log.sql`
  - [ ] Create `config_audit_logs` table with: id, action, entity_type, entity_id, before_state, after_state, changed_by, ip_address, user_agent, created_at
  - [ ] Add indexes for common query patterns
  - [ ] Set up partitioning by month for performance
  - [ ] Add RLS policies for super admin read-only

- [ ] **Task 2: Define audit action types** (AC: #1)
  - [ ] Create `lib/types/audit.ts` with action enum
  - [ ] Define entity types: config, dimension, template, rule, experiment, weight
  - [ ] Define action types: create, update, delete, activate, archive, etc.
  - [ ] Create TypeScript types for audit entries

- [ ] **Task 3: Create audit logging service** (AC: #1)
  - [ ] Create `lib/services/audit-log.ts`
  - [ ] Implement `logConfigChange()` function
  - [ ] Accept before/after states for diff generation
  - [ ] Extract request context (IP, user agent)
  - [ ] Handle logging failures gracefully (don't block main action)

- [ ] **Task 4: Integrate audit logging into all config services** (AC: #1)
  - [ ] Add audit calls to `admin-config.ts` (config CRUD)
  - [ ] Add audit calls to `prompt-templates.ts`
  - [ ] Add audit calls to `classification-rules.ts`
  - [ ] Add audit calls to `scoring-weights.ts`
  - [ ] Add audit calls to `team-weights.ts`
  - [ ] Add audit calls to `experiments.ts`

- [ ] **Task 5: Create audit log list page** (AC: #2)
  - [ ] Create `app/(dashboard)/admin/audit/page.tsx`
  - [ ] Query audit logs with pagination
  - [ ] Display in table: timestamp, user, action, entity, summary
  - [ ] Add filter controls for action type, user, date range

- [ ] **Task 6: Create audit entry card component** (AC: #2)
  - [ ] Create `components/admin/audit-entry-card.tsx`
  - [ ] Display action icon based on type
  - [ ] Show user avatar and email
  - [ ] Show relative timestamp with full date on hover
  - [ ] Show brief change summary

- [ ] **Task 7: Create audit detail modal** (AC: #3)
  - [ ] Create `components/admin/audit-detail-modal.tsx`
  - [ ] Display full before state (if applicable)
  - [ ] Display full after state
  - [ ] Generate and display JSON diff
  - [ ] Highlight added/removed/changed fields

- [ ] **Task 8: Create diff viewer component** (AC: #3)
  - [ ] Create `components/admin/json-diff-viewer.tsx`
  - [ ] Compare before and after JSON objects
  - [ ] Display inline diff with color coding
  - [ ] Support nested object diffing
  - [ ] Collapse unchanged sections

- [ ] **Task 9: Implement search and filtering** (AC: #4)
  - [ ] Add text search across action, entity, user
  - [ ] Add action type filter (multiselect)
  - [ ] Add user filter (autocomplete)
  - [ ] Add date range picker
  - [ ] Implement server-side filtering

- [ ] **Task 10: Implement data retention** (AC: #5)
  - [ ] Create monthly partitions for audit table
  - [ ] Set up archive job for entries > 2 years
  - [ ] Move archived entries to cold storage table
  - [ ] Add "Request Archive" button for old entries
  - [ ] Implement archive retrieval API

- [ ] **Task 11: Implement CSV export** (AC: #6)
  - [ ] Create `GET /api/admin/audit/export`
  - [ ] Accept date range parameters
  - [ ] Stream large exports
  - [ ] Include all audit fields
  - [ ] Rate limit exports

- [ ] **Task 12: Write E2E tests** (AC: #1-6)
  - [ ] Create `e2e/admin-audit-log.spec.ts`
  - [ ] Test audit entry created on config change
  - [ ] Test filter by action type
  - [ ] Test search by user
  - [ ] Test detail view shows diff
  - [ ] Test CSV export downloads file

## Dev Notes

### Database Schema

```sql
-- Migration: 20251223006000_config_audit_log.sql

-- Audit action types
CREATE TYPE audit_action AS ENUM (
  -- Config actions
  'config_created',
  'config_updated',
  'config_activated',
  'config_archived',
  'config_deleted',
  'config_duplicated',
  'config_rolled_back',

  -- Template actions
  'template_created',
  'template_updated',
  'template_published',
  'template_archived',
  'template_deleted',

  -- Rule actions
  'rule_created',
  'rule_updated',
  'rule_enabled',
  'rule_disabled',
  'rule_deleted',

  -- Category actions
  'category_created',
  'category_updated',
  'category_deleted',

  -- Weight actions
  'weight_updated',
  'team_weight_created',
  'team_weight_updated',
  'team_weight_reset',

  -- Experiment actions
  'experiment_created',
  'experiment_updated',
  'experiment_activated',
  'experiment_paused',
  'experiment_resumed',
  'experiment_completed',
  'experiment_winner_applied'
);

-- Entity types
CREATE TYPE audit_entity_type AS ENUM (
  'analysis_config',
  'prompt_template',
  'classification_rule',
  'classification_category',
  'scoring_weight',
  'team_weight_override',
  'experiment'
);

-- Main audit log table (partitioned by month)
CREATE TABLE config_audit_logs (
  id UUID DEFAULT uuid_generate_v4(),
  action audit_action NOT NULL,
  entity_type audit_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  entity_name VARCHAR(200), -- Human-readable name at time of action

  -- Change details
  before_state JSONB, -- NULL for create actions
  after_state JSONB,  -- NULL for delete actions
  change_summary TEXT, -- Human-readable summary

  -- Actor information
  changed_by UUID REFERENCES auth.users(id),
  changed_by_email VARCHAR(255),

  -- Request context
  ip_address INET,
  user_agent TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  correlation_id UUID, -- Group related changes

  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for current and next 12 months
DO $$
DECLARE
  start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
  end_date DATE;
  partition_name TEXT;
BEGIN
  FOR i IN 0..12 LOOP
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'config_audit_logs_' || TO_CHAR(start_date, 'YYYY_MM');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF config_audit_logs
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );

    start_date := end_date;
  END LOOP;
END $$;

-- Indexes
CREATE INDEX idx_audit_created_at ON config_audit_logs (created_at DESC);
CREATE INDEX idx_audit_entity ON config_audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_action ON config_audit_logs (action);
CREATE INDEX idx_audit_user ON config_audit_logs (changed_by);
CREATE INDEX idx_audit_correlation ON config_audit_logs (correlation_id);

-- Full-text search index
CREATE INDEX idx_audit_search ON config_audit_logs
  USING gin(to_tsvector('english', COALESCE(entity_name, '') || ' ' || COALESCE(change_summary, '')));

-- RLS (super admin read-only, system write)
ALTER TABLE config_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_read ON config_audit_logs
  FOR SELECT USING (true); -- All admins can read

-- No INSERT/UPDATE/DELETE policies for users - only service role can write

-- Archive table for entries > 2 years
CREATE TABLE config_audit_logs_archive (
  LIKE config_audit_logs INCLUDING ALL
);
```

### TypeScript Types

```typescript
// lib/types/audit.ts

export type AuditAction =
  // Config actions
  | 'config_created'
  | 'config_updated'
  | 'config_activated'
  | 'config_archived'
  | 'config_deleted'
  | 'config_duplicated'
  | 'config_rolled_back'
  // Template actions
  | 'template_created'
  | 'template_updated'
  | 'template_published'
  | 'template_archived'
  | 'template_deleted'
  // Rule actions
  | 'rule_created'
  | 'rule_updated'
  | 'rule_enabled'
  | 'rule_disabled'
  | 'rule_deleted'
  // Category actions
  | 'category_created'
  | 'category_updated'
  | 'category_deleted'
  // Weight actions
  | 'weight_updated'
  | 'team_weight_created'
  | 'team_weight_updated'
  | 'team_weight_reset'
  // Experiment actions
  | 'experiment_created'
  | 'experiment_updated'
  | 'experiment_activated'
  | 'experiment_paused'
  | 'experiment_resumed'
  | 'experiment_completed'
  | 'experiment_winner_applied';

export type AuditEntityType =
  | 'analysis_config'
  | 'prompt_template'
  | 'classification_rule'
  | 'classification_category'
  | 'scoring_weight'
  | 'team_weight_override'
  | 'experiment';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  change_summary: string | null;
  changed_by: string | null;
  changed_by_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  correlation_id: string | null;
}

export interface AuditLogFilters {
  action?: AuditAction[];
  entity_type?: AuditEntityType[];
  changed_by?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface CreateAuditLogInput {
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  change_summary?: string;
  correlation_id?: string;
}
```

### Audit Logging Service

```typescript
// lib/services/audit-log.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/utils/request-context';
import type { CreateAuditLogInput, AuditLogEntry, AuditLogFilters } from '@/lib/types/audit';

/**
 * Create an audit log entry for a configuration change
 *
 * @param input - Audit log data
 */
export async function logConfigChange(input: CreateAuditLogInput): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Get current user
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();

    // Get request context
    const context = await getRequestContext();

    // Generate change summary if not provided
    const changeSummary = input.change_summary || generateChangeSummary(input);

    const { error } = await supabase
      .from('config_audit_logs')
      .insert({
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        entity_name: input.entity_name,
        before_state: input.before_state,
        after_state: input.after_state,
        change_summary: changeSummary,
        changed_by: user?.id,
        changed_by_email: user?.email,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
        correlation_id: input.correlation_id,
      });

    if (error) {
      // Log but don't throw - audit failures shouldn't block main operations
      console.error('[Audit] Failed to create audit log:', error);
    }
  } catch (err) {
    console.error('[Audit] Unexpected error:', err);
  }
}

/**
 * Generate a human-readable summary of the change
 */
function generateChangeSummary(input: CreateAuditLogInput): string {
  const actionVerbs: Record<string, string> = {
    config_created: 'created',
    config_updated: 'updated',
    config_activated: 'activated',
    config_archived: 'archived',
    config_deleted: 'deleted',
    config_duplicated: 'duplicated',
    config_rolled_back: 'rolled back',
    template_created: 'created',
    template_updated: 'updated',
    template_published: 'published',
    rule_created: 'created',
    rule_updated: 'updated',
    rule_enabled: 'enabled',
    rule_disabled: 'disabled',
    weight_updated: 'updated weights',
    experiment_created: 'created',
    experiment_activated: 'started',
    experiment_paused: 'paused',
    experiment_completed: 'completed',
    experiment_winner_applied: 'applied winner',
  };

  const verb = actionVerbs[input.action] || input.action.replace(/_/g, ' ');
  const entityLabel = input.entity_type.replace(/_/g, ' ');

  return `${verb} ${entityLabel}${input.entity_name ? `: ${input.entity_name}` : ''}`;
}

/**
 * Query audit logs with filters and pagination
 */
export async function getAuditLogs(
  filters: AuditLogFilters,
  page: number = 1,
  pageSize: number = 20
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const supabase = createAdminClient();

  let query = supabase
    .from('config_audit_logs')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filters.action?.length) {
    query = query.in('action', filters.action);
  }
  if (filters.entity_type?.length) {
    query = query.in('entity_type', filters.entity_type);
  }
  if (filters.changed_by) {
    query = query.eq('changed_by', filters.changed_by);
  }
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }
  if (filters.search) {
    query = query.textSearch('entity_name', filters.search, {
      config: 'english',
      type: 'websearch',
    });
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[Audit] Query error:', error);
    return { entries: [], total: 0 };
  }

  return {
    entries: data || [],
    total: count || 0,
  };
}

/**
 * Get a single audit entry with full details
 */
export async function getAuditEntry(id: string): Promise<AuditLogEntry | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('config_audit_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[Audit] Get entry error:', error);
    return null;
  }

  return data;
}
```

### JSON Diff Viewer

```typescript
// components/admin/json-diff-viewer.tsx
'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface JsonDiffViewerProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface DiffLine {
  key: string;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  oldValue?: unknown;
  newValue?: unknown;
}

export function JsonDiffViewer({ before, after }: JsonDiffViewerProps) {
  const diff = useMemo(() => computeDiff(before || {}, after || {}), [before, after]);

  return (
    <div className="font-mono text-sm border rounded-lg overflow-hidden">
      <div className="grid grid-cols-2">
        <div className="bg-red-50 p-2 text-center font-semibold border-b border-r">
          Before
        </div>
        <div className="bg-green-50 p-2 text-center font-semibold border-b">
          After
        </div>
      </div>
      <div className="divide-y">
        {diff.map((line, i) => (
          <DiffRow key={i} line={line} />
        ))}
      </div>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  return (
    <div className="grid grid-cols-2">
      <div className={cn(
        "p-2 border-r",
        line.type === 'removed' && "bg-red-100",
        line.type === 'changed' && "bg-yellow-50"
      )}>
        {(line.type === 'removed' || line.type === 'changed' || line.type === 'unchanged') && (
          <>
            <span className="text-muted-foreground">{line.key}: </span>
            <span className={cn(
              line.type === 'removed' && "text-red-600 line-through",
              line.type === 'changed' && "text-yellow-700"
            )}>
              {formatValue(line.oldValue)}
            </span>
          </>
        )}
      </div>
      <div className={cn(
        "p-2",
        line.type === 'added' && "bg-green-100",
        line.type === 'changed' && "bg-green-50"
      )}>
        {(line.type === 'added' || line.type === 'changed' || line.type === 'unchanged') && (
          <>
            <span className="text-muted-foreground">{line.key}: </span>
            <span className={cn(
              line.type === 'added' && "text-green-600",
              line.type === 'changed' && "text-green-700 font-medium"
            )}>
              {formatValue(line.newValue)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): DiffLine[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const lines: DiffLine[] = [];

  for (const key of allKeys) {
    const oldValue = before[key];
    const newValue = after[key];

    if (!(key in before)) {
      lines.push({ key, type: 'added', newValue });
    } else if (!(key in after)) {
      lines.push({ key, type: 'removed', oldValue });
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      lines.push({ key, type: 'changed', oldValue, newValue });
    } else {
      lines.push({ key, type: 'unchanged', oldValue, newValue });
    }
  }

  // Sort: changed first, then added, then removed, then unchanged
  const order = { changed: 0, added: 1, removed: 2, unchanged: 3 };
  return lines.sort((a, b) => order[a.type] - order[b.type]);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
```

### Component File Locations

| Component | Path |
|-----------|------|
| Audit List Page | `app/(dashboard)/admin/audit/page.tsx` |
| Audit Entry Card | `components/admin/audit-entry-card.tsx` |
| Audit Detail Modal | `components/admin/audit-detail-modal.tsx` |
| JSON Diff Viewer | `components/admin/json-diff-viewer.tsx` |
| Audit Filters | `components/admin/audit-filters.tsx` |
| Export API | `app/api/admin/audit/export/route.ts` |
| Audit Service | `lib/services/audit-log.ts` |
| Types | `lib/types/audit.ts` |

### Integration Pattern

```typescript
// Example: Integrating audit into config update

import { logConfigChange } from '@/lib/services/audit-log';

export async function updateAnalysisConfig(id: string, input: ConfigInput) {
  // Get before state
  const before = await getConfig(id);

  // Perform update
  const after = await performUpdate(id, input);

  // Log audit (async, non-blocking)
  logConfigChange({
    action: 'config_updated',
    entity_type: 'analysis_config',
    entity_id: id,
    entity_name: after.name,
    before_state: before,
    after_state: after,
  }).catch(console.error); // Don't await, don't throw

  return after;
}
```

### Retention Policy

| Age | Storage | Access |
|-----|---------|--------|
| 0-6 months | Hot (main table) | Instant |
| 6-24 months | Warm (partitions) | Fast |
| 24+ months | Cold (archive table) | Request required |

### Verification Checklist

After completing this story, verify:
- [ ] Audit entry created for every config change
- [ ] Before/after states captured correctly
- [ ] Filter by action type works
- [ ] Filter by user works
- [ ] Filter by date range works
- [ ] Search finds matching entries
- [ ] Detail modal shows full states
- [ ] Diff viewer highlights changes
- [ ] CSV export includes all fields
- [ ] Pagination works correctly
- [ ] Old entries move to archive
- [ ] Archive retrieval works


## Design System Requirements

**MANDATORY:** This story MUST use existing design system components exclusively.

### Pre-Implementation Checklist
- [ ] Reviewed `_bmad-output/DESIGN-SYSTEM-MANDATE.md` for component inventory
- [ ] Checked `/design` route for component examples
- [ ] Identified required components from the inventory below
- [ ] Confirmed no hardcoded colors - using semantic tokens only
- [ ] No new UI patterns needed (or Design Epic story created)

### Required Components
<!-- Dev agent: Fill in specific components needed from DESIGN-SYSTEM-MANDATE.md -->
- Review `/design` route and `components/` directory before implementation
- Use semantic tokens: `bg-surface-*`, `text-content-*`, `border-border-*`

### Styling Rules
- NO hardcoded colors (no `bg-zinc-*`, `text-gray-*`, etc.)
- Use existing components from `components/` directory
- Extend existing components before creating new ones

## Dev Agent Record

### Agent Model Used
{{agent_model_name_version}}

### Completion Notes List
*To be filled by dev agent after implementation*

### Change Log
| Date | Change | Author |
|------|--------|--------|

### File List
*To be filled by dev agent - list all files created/modified*
