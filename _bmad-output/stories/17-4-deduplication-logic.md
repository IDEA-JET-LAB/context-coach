# Story 17.4: Deduplication Logic

Status: 🔲 Ready

## Story

**As a** user who may have already captured some prompts via hooks,
**I want** the import to skip prompts that already exist in the database,
**So that** I don't have duplicate entries in my prompt history.

## PRD Alignment Note

This story does not directly map to PRD 17.4 ("Onboarding Integration"). The numbering discrepancy is intentional:

- **Deduplication was extracted as a separate story** for technical modularity. It represents foundational logic that must exist before batch import processing can work correctly.
- **This is a prerequisite for Story 17-3** (Batch Import Processing). Conceptually, think of this as Story 17-3.1 - a sub-component of the batch processing system.
- **PRD's "Onboarding Integration" (17.4)** is covered by the existing onboarding flow, which can trigger import when users complete initial setup. That functionality builds on top of Stories 17-1 through 17-6.

## Dependencies

- **Prerequisite for:** Story 17-3 (Batch Import Processing) - batch import requires deduplication logic to avoid inserting duplicate prompts
- **Uses schema from:** Story 15-6 (Response Storage Schema) - for the `prompts` table structure
- **Integrates with:** Existing capture hook flow (`/api/prompts/capture`) - both systems must generate identical fingerprints

## Acceptance Criteria

1. **Given** a prompt is being imported
   **When** an identical prompt already exists (same user, text, timestamp)
   **Then** the import skips the duplicate
   **And** the duplicate is counted in the "skipped" total, not "failed"

2. **Given** the import is processing prompts
   **When** generating fingerprints for deduplication
   **Then** fingerprints are computed using: user_id + timestamp (minute precision) + first 200 chars of text

3. **Given** a batch of prompts is being uploaded
   **When** some prompts in the batch are duplicates
   **Then** only new prompts are inserted
   **And** the response indicates how many were new vs skipped

4. **Given** the same prompt was captured via hook and is in historical import
   **When** the historical import runs
   **Then** the hook-captured version is kept (not overwritten)
   **And** no error is raised

5. **Given** a prompt text is very similar but not identical
   **When** comparing for duplicates
   **Then** they are treated as separate prompts
   **And** only exact matches are deduplicated

6. **Given** the import summary is displayed
   **When** import completes
   **Then** I see separate counts for: imported, duplicates skipped, failed

## Tasks / Subtasks

- [ ] **Task 1: Create fingerprint generator** (AC: #2)
  - [ ] Create `lib/import/fingerprint.ts` file
  - [ ] Implement `generatePromptFingerprint()` function
  - [ ] Use MD5 or xxhash for fast hashing
  - [ ] Truncate timestamp to minute precision
  - [ ] Use first 200 characters of prompt text
  - [ ] Include user_id in fingerprint

- [ ] **Task 2: Add fingerprint column to prompts table** (AC: #1, #2)
  - [ ] Create migration to add `fingerprint` column
  - [ ] Add unique constraint on fingerprint (or partial index)
  - [ ] Backfill fingerprints for existing prompts (migration script)

- [ ] **Task 3: Update batch insert with deduplication** (AC: #1, #3)
  - [ ] Modify batch insert to use `ON CONFLICT DO NOTHING`
  - [ ] Pre-compute fingerprints before batch insert
  - [ ] Track which prompts were actually inserted vs skipped
  - [ ] Return accurate counts in response

- [ ] **Task 4: Implement pre-check for large batches** (AC: #3)
  - [ ] Create `checkExistingFingerprints()` function
  - [ ] Query database for existing fingerprints in batch
  - [ ] Filter out duplicates before insert attempt
  - [ ] Optimize for batch lookup performance

- [ ] **Task 5: Update import result types** (AC: #6)
  - [ ] Add `skipped` count to ImportResult type
  - [ ] Update orchestrator to track skipped totals
  - [ ] Update UI to display skipped count

- [ ] **Task 6: Update capture hook to generate fingerprints** (AC: #4)
  - [ ] Ensure real-time capture also generates fingerprints
  - [ ] Use same fingerprint algorithm as import
  - [ ] This ensures hook-captured prompts block duplicate imports

- [ ] **Task 7: Add fingerprint index for performance** (AC: #3)
  - [ ] Create index on fingerprint column
  - [ ] Consider partial index (WHERE source = 'historical_import')
  - [ ] Test query performance with large datasets

## Dev Notes

### Critical Architecture Constraints

**Fingerprint Algorithm:** Must be deterministic and consistent between hook capture and historical import. Both systems must generate identical fingerprints for the same prompt.

### Fingerprint Generation

Based on CLAUDE.md deterministic ID system (simplified for import):

```typescript
// lib/import/fingerprint.ts
import { createHash } from 'crypto';

/**
 * Generates a deterministic fingerprint for a prompt.
 * Used to detect and skip duplicate imports.
 *
 * Components:
 * - user_id: Ensures user isolation
 * - timestamp: Minute precision (YYYYMMDDHHMM)
 * - text: First 200 characters of prompt text
 */
export function generatePromptFingerprint(
  userId: string,
  timestamp: Date | string,
  text: string
): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  // Format: YYYYMMDDHHMM (minute precision)
  const timeComponent = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
  ].join('');

  // First 200 chars of text, normalized
  const textComponent = normalizeText(text).substring(0, 200);

  // Generate fingerprint
  const input = `${userId}:${timeComponent}:${textComponent}`;
  return createHash('md5').update(input).digest('hex').substring(0, 16);
}

/**
 * Normalize text for consistent fingerprinting.
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Lowercase (for comparison only)
 */
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
```

### Database Migration

```sql
-- migrations/YYYYMMDDHHMMSS_add_prompt_fingerprint.sql

-- Add fingerprint column
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(16);

-- Create unique index for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_fingerprint
  ON prompts (fingerprint)
  WHERE fingerprint IS NOT NULL;

-- Create function to generate fingerprint on insert
CREATE OR REPLACE FUNCTION generate_prompt_fingerprint()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fingerprint IS NULL THEN
    NEW.fingerprint := encode(
      digest(
        NEW.user_id::text || ':' ||
        to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MI') || ':' ||
        lower(left(regexp_replace(NEW.text, '\s+', ' ', 'g'), 200)),
        'md5'
      ),
      'hex'
    )::varchar(16);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic fingerprint generation
CREATE TRIGGER tr_prompts_fingerprint
  BEFORE INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION generate_prompt_fingerprint();

-- Backfill existing prompts
UPDATE prompts
SET fingerprint = encode(
  digest(
    user_id::text || ':' ||
    to_char(created_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MI') || ':' ||
    lower(left(regexp_replace(text, '\s+', ' ', 'g'), 200)),
    'md5'
  ),
  'hex'
)::varchar(16)
WHERE fingerprint IS NULL;
```

### Updated Batch Insert with Deduplication

```typescript
// app/api/import/batch/route.ts (updated)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: BatchUploadRequest = await request.json();

    // Pre-compute fingerprints
    const promptsWithFingerprints = body.pairs.map(pair => ({
      ...pair,
      fingerprint: generatePromptFingerprint(
        user.id,
        pair.prompt.timestamp,
        pair.prompt.text
      ),
    }));

    // Check for existing fingerprints
    const fingerprints = promptsWithFingerprints.map(p => p.fingerprint);
    const { data: existing } = await supabase
      .from('prompts')
      .select('fingerprint')
      .in('fingerprint', fingerprints);

    const existingSet = new Set(existing?.map(e => e.fingerprint) || []);
    const newPrompts = promptsWithFingerprints.filter(
      p => !existingSet.has(p.fingerprint)
    );

    if (newPrompts.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        skipped: body.pairs.length,
      });
    }

    // Insert only new prompts
    const promptsToInsert = newPrompts.map(p => ({
      team_id: teamId,
      user_id: user.id,
      text: p.prompt.text,
      char_count: p.prompt.text.length,
      word_count: p.prompt.text.split(/\s+/).length,
      created_at: p.prompt.timestamp,
      analysis_status: 'pending',
      source: 'historical_import',
      import_id: body.importId,
      fingerprint: p.fingerprint,
    }));

    // Use ON CONFLICT DO NOTHING as safety net
    const { data: inserted, error } = await supabase
      .from('prompts')
      .upsert(promptsToInsert, {
        onConflict: 'fingerprint',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      throw error;
    }

    const insertedCount = inserted?.length || 0;
    const skippedCount = body.pairs.length - insertedCount;

    return NextResponse.json({
      success: true,
      imported: insertedCount,
      skipped: skippedCount,
    });
  } catch (error) {
    console.error('Batch upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Updated Import Types

```typescript
// lib/import/types.ts (additions)
export interface ImportResult {
  success: number;
  failed: number;
  skipped: number; // NEW: count of duplicates
  failedSessions: string[];
}

export interface BatchUploadResult {
  success: boolean;
  imported: number;
  skipped: number;
  error?: string;
}
```

### Pre-Check Function for Large Batches

```typescript
// lib/import/dedup.ts
import type { PromptResponsePair } from './types';
import { generatePromptFingerprint } from './fingerprint';

interface DedupResult {
  newPairs: PromptResponsePair[];
  duplicateCount: number;
}

export async function filterDuplicates(
  userId: string,
  pairs: PromptResponsePair[],
  supabase: SupabaseClient
): Promise<DedupResult> {
  // Generate fingerprints for all pairs
  const fingerprintsMap = new Map<string, PromptResponsePair>();
  for (const pair of pairs) {
    const fp = generatePromptFingerprint(userId, pair.prompt.timestamp, pair.prompt.text);
    fingerprintsMap.set(fp, pair);
  }

  const allFingerprints = Array.from(fingerprintsMap.keys());

  // Query in chunks of 1000 to avoid query size limits
  const CHUNK_SIZE = 1000;
  const existingFingerprints = new Set<string>();

  for (let i = 0; i < allFingerprints.length; i += CHUNK_SIZE) {
    const chunk = allFingerprints.slice(i, i + CHUNK_SIZE);
    const { data } = await supabase
      .from('prompts')
      .select('fingerprint')
      .in('fingerprint', chunk);

    data?.forEach(d => existingFingerprints.add(d.fingerprint));
  }

  // Filter out existing
  const newPairs: PromptResponsePair[] = [];
  for (const [fp, pair] of fingerprintsMap) {
    if (!existingFingerprints.has(fp)) {
      newPairs.push(pair);
    }
  }

  return {
    newPairs,
    duplicateCount: pairs.length - newPairs.length,
  };
}
```

### Update Capture Hook for Fingerprint Generation

The existing capture flow in `app/api/prompts/capture/route.ts` should also generate fingerprints:

```typescript
// Ensure capture route generates fingerprint
const fingerprint = generatePromptFingerprint(
  user.id,
  new Date().toISOString(),
  promptText
);

const { error: insertError } = await supabase
  .from('prompts')
  .insert({
    team_id: teamId,
    project_id: projectId,
    user_id: user.id,
    text: promptText,
    // ... other fields
    fingerprint, // Add fingerprint
  });
```

### File Locations

| File | Purpose |
|------|---------|
| `lib/import/fingerprint.ts` | Fingerprint generation function |
| `lib/import/dedup.ts` | Deduplication filtering logic |
| `supabase/migrations/XXXX_add_fingerprint.sql` | Database migration |
| `app/api/import/batch/route.ts` | Updated batch endpoint |
| `app/api/prompts/capture/route.ts` | Updated capture endpoint |

### Fingerprint Algorithm Reference

| Component | Format | Example |
|-----------|--------|---------|
| User ID | UUID | `11111111-1111-1111-1111-111111111111` |
| Timestamp | YYYYMMDDHHMM (UTC) | `202501151030` |
| Text | First 200 chars, normalized | `write a function that...` |
| Output | MD5 hex, first 16 chars | `a1b2c3d4e5f67890` |

### Edge Cases to Handle

1. **Empty text**: Return empty string for text component
2. **Unicode characters**: Preserve in normalization
3. **Very short text**: Use full text if < 200 chars
4. **Timezone differences**: Always use UTC
5. **Null timestamp**: Use current time as fallback

### Common Pitfalls to Avoid

1. **DO NOT** use different algorithms in capture vs import
2. **DO NOT** include milliseconds in timestamp (minute precision only)
3. **DO NOT** forget to normalize text (trim, collapse spaces)
4. **DO NOT** use case-sensitive comparison (normalize to lowercase)
5. **DO NOT** query all fingerprints at once for large imports (chunk it)
6. **DO NOT** treat skipped as failed - they are different categories
7. **DO NOT** block on dedup check - do it in pre-filtering step

### Verification Checklist

After completing this story, verify:
- [ ] Fingerprint generates consistently for same input
- [ ] Same prompt from hook and import produces same fingerprint
- [ ] Duplicate prompts in import are skipped (not inserted)
- [ ] Batch insert reports correct imported vs skipped counts
- [ ] Existing prompts from hooks are not overwritten
- [ ] Import summary shows separate skipped count
- [ ] Very similar (but not identical) prompts are not deduplicated
- [ ] Performance is acceptable with 1000+ prompt batches
- [ ] Fingerprint index is created in migration
- [ ] Existing prompts have fingerprints backfilled


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
