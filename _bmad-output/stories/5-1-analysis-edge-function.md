# Story 5.1: Analysis Edge Function

Status: ✅ Done

> **⚠️ OUTDATED DOCUMENTATION:** This story references local Supabase development (`supabase start`, `localhost:54321`). As of December 2025, **this project uses Cloud Supabase only**. See `CLAUDE.md` for current setup.

## Story
**As a** system,
**I want** an Edge Function to process prompts,
**So that** analysis runs asynchronously without blocking capture.

## Acceptance Criteria
1. **Given** a new prompt is inserted
   **When** the database trigger fires
   **Then** the `analyze-prompt` Edge Function is invoked
   **And** it receives the prompt_id

2. **Given** the Edge Function
   **When** it starts processing
   **Then** it updates `prompts.analysis_status` to 'processing'
   **And** it loads the active `analysis_config`

3. **Given** the Edge Function structure
   **When** this story is complete
   **Then** `supabase/functions/analyze-prompt/index.ts` exists
   **And** it can be deployed to Supabase

## Tasks / Subtasks
- [ ] **Task 1: Create Edge Function scaffold** (AC: #3)
  - [ ] Create `supabase/functions/analyze-prompt/index.ts`
  - [ ] Set up Deno imports for Supabase client and edge function helpers
  - [ ] Create request handler with CORS headers for all methods (OPTIONS, POST)
  - [ ] Add TypeScript types for request payload (`{ prompt_id: string }`)
  - [ ] Add error handling wrapper with typed catch block

- [ ] **Task 2: Create database trigger for prompt insert** (AC: #1)
  - [ ] Create migration file `supabase/migrations/YYYYMMDDHHMMSS_create_analyze_prompt_trigger.sql`
  - [ ] Enable `pg_net` extension for HTTP calls
  - [ ] Write `trigger_analyze_prompt()` PL/pgSQL function with SECURITY DEFINER
  - [ ] Configure trigger to fire AFTER INSERT on `prompts` table
  - [ ] Trigger calls Edge Function only when `analysis_status = 'pending'`
  - [ ] Handle pg_net failure gracefully (log but don't fail insert)

- [ ] **Task 3: Implement status update to 'processing'** (AC: #2)
  - [ ] Import Supabase admin client (service role) in Edge Function
  - [ ] Validate prompt_id exists and is valid UUID format
  - [ ] Fetch prompt to verify it exists (return 404 if not found)
  - [ ] Check current status is 'pending' (return 409 if already processing/complete)
  - [ ] Update `prompts.analysis_status` to 'processing' atomically

- [ ] **Task 4: Implement active config loading** (AC: #2)
  - [ ] Query `analysis_configs` table where `is_active = true`
  - [ ] Load associated `analysis_dimensions` for the active config (enabled only)
  - [ ] Validate config exists and has at least one enabled dimension
  - [ ] Return 500 with `NO_ACTIVE_CONFIG` error code if none found
  - [ ] Store config_id for linking to analysis results

- [ ] **Task 5: Create deployment configuration** (AC: #3)
  - [ ] Add environment variable references for Supabase URL and service key
  - [ ] Document deployment command: `supabase functions deploy analyze-prompt`
  - [ ] Test local development with `supabase functions serve`

- [ ] **Task 6: Add logging and observability** (AC: #1, #2, #3)
  - [ ] Use structured logging format: `[analyze-prompt] action: details`
  - [ ] Log prompt_id, config_id, and processing start time
  - [ ] Add timing metrics for performance monitoring
  - [ ] Log errors with context including prompt_id

## Dev Notes

### Technology Stack
- **Runtime:** Supabase Edge Functions (Deno)
- **Language:** TypeScript strict mode
- **Database Extension:** pg_net for HTTP calls from triggers
- **Client:** Service role client (bypasses RLS)

### Analysis Status Flow
```
prompt inserted -> trigger fires -> Edge Function invoked
                                        |
                                        v
                            status: 'pending' -> 'processing'
                                        |
                            (Story 5.2-5.4 continue from here)
```

### Edge Function Implementation

```typescript
// supabase/functions/analyze-prompt/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface AnalyzeRequest {
  prompt_id: string;
}

interface AnalysisConfig {
  id: string;
  version: number;
  name: string;
  system_prompt: string;
  model: string;
  is_active: boolean;
  analysis_dimensions: AnalysisDimension[];
}

interface AnalysisDimension {
  id: string;
  config_id: string;
  name: string;
  description: string;
  weight: number;
  prompt_template: string;
  scoring_criteria: string;
  enabled: boolean;
  sort_order: number;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Response helpers
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status: number) {
  return jsonResponse({ error: { code, message } }, status);
}

// UUID validation
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { prompt_id } = (await req.json()) as AnalyzeRequest;

    // Validate prompt_id
    if (!prompt_id) {
      console.error('[analyze-prompt] error: missing prompt_id');
      return errorResponse('MISSING_PROMPT_ID', 'prompt_id is required', 400);
    }

    if (!isValidUUID(prompt_id)) {
      console.error('[analyze-prompt] error: invalid prompt_id format');
      return errorResponse('INVALID_PROMPT_ID', 'prompt_id must be a valid UUID', 400);
    }

    console.log(`[analyze-prompt] start: processing ${prompt_id}`);

    // Initialize Supabase client with service role
    const supabase: SupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch prompt and verify it exists
    const { data: prompt, error: fetchError } = await supabase
      .from('prompts')
      .select('id, analysis_status')
      .eq('id', prompt_id)
      .single();

    if (fetchError || !prompt) {
      console.error(`[analyze-prompt] error: prompt not found ${prompt_id}`);
      return errorResponse('PROMPT_NOT_FOUND', 'Prompt does not exist', 404);
    }

    // Check idempotency - skip if not pending
    if (prompt.analysis_status !== 'pending') {
      console.log(`[analyze-prompt] skip: prompt ${prompt_id} status is ${prompt.analysis_status}`);
      return jsonResponse({
        success: true,
        prompt_id,
        skipped: true,
        reason: `Prompt status is already '${prompt.analysis_status}'`,
      });
    }

    // Update status to processing (atomic update with status check)
    const { error: updateError, count } = await supabase
      .from('prompts')
      .update({ analysis_status: 'processing' })
      .eq('id', prompt_id)
      .eq('analysis_status', 'pending');

    if (updateError) {
      console.error(`[analyze-prompt] error: status update failed`, updateError);
      throw updateError;
    }

    if (count === 0) {
      // Race condition - another process started
      console.log(`[analyze-prompt] skip: prompt ${prompt_id} already being processed`);
      return jsonResponse({
        success: true,
        prompt_id,
        skipped: true,
        reason: 'Prompt is already being processed',
      });
    }

    // Load active config with dimensions
    const { data: config, error: configError } = await supabase
      .from('analysis_configs')
      .select(`
        *,
        analysis_dimensions(*)
      `)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.error('[analyze-prompt] error: no active analysis config found');
      // Reset status to pending for retry
      await supabase
        .from('prompts')
        .update({ analysis_status: 'pending' })
        .eq('id', prompt_id);
      return errorResponse('NO_ACTIVE_CONFIG', 'No active analysis configuration found', 500);
    }

    // Filter to enabled dimensions only
    const enabledDimensions = config.analysis_dimensions.filter(
      (d: AnalysisDimension) => d.enabled
    );

    if (enabledDimensions.length === 0) {
      console.error('[analyze-prompt] error: no enabled dimensions in config');
      await supabase
        .from('prompts')
        .update({ analysis_status: 'pending' })
        .eq('id', prompt_id);
      return errorResponse('NO_ENABLED_DIMENSIONS', 'Analysis config has no enabled dimensions', 500);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[analyze-prompt] ready: prompt ${prompt_id}, config ${config.id}, ${enabledDimensions.length} dimensions, ${elapsed}ms`);

    // Continue with analysis (Stories 5.2-5.4)
    // Placeholder: actual AI analysis will be implemented in subsequent stories

    return jsonResponse({
      success: true,
      prompt_id,
      config_id: config.id,
      dimensions_count: enabledDimensions.length,
      processing_time_ms: elapsed,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[analyze-prompt] error:', errorMessage);
    return errorResponse('ANALYSIS_FAILED', errorMessage, 500);
  }
});
```

### Database Trigger Implementation

```sql
-- Migration: YYYYMMDDHHMMSS_create_analyze_prompt_trigger.sql

-- Enable pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Trigger function to invoke Edge Function
CREATE OR REPLACE FUNCTION trigger_analyze_prompt()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Only trigger for new prompts with pending status
  IF NEW.analysis_status = 'pending' THEN
    -- Fire-and-forget HTTP call to Edge Function
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/analyze-prompt',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object('prompt_id', NEW.id)
    ) INTO request_id;

    -- Log request ID for debugging (optional)
    RAISE LOG 'analyze-prompt trigger: prompt_id=%, request_id=%', NEW.id, request_id;
  END IF;

  -- Always return NEW to complete the insert
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'analyze-prompt trigger failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on prompts table
DROP TRIGGER IF EXISTS on_prompt_insert_analyze ON prompts;
CREATE TRIGGER on_prompt_insert_analyze
  AFTER INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_analyze_prompt();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION trigger_analyze_prompt() TO service_role;
```

### Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `SUPABASE_URL` | Auto-injected | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected | Admin access (bypasses RLS) |

### File Structure

| File | Path |
|------|------|
| Edge Function | `supabase/functions/analyze-prompt/index.ts` |
| Migration | `supabase/migrations/YYYYMMDDHHMMSS_create_analyze_prompt_trigger.sql` |

### Local Development

```bash
# Start Supabase locally
supabase start

# Serve Edge Functions locally
supabase functions serve analyze-prompt --env-file .env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/analyze-prompt \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"prompt_id": "test-uuid-here"}'

# Deploy to production
supabase functions deploy analyze-prompt
```

### Security Requirements
1. **Service Role Key:** Only used server-side in Edge Functions, never exposed to client
2. **RLS Bypass:** Edge Function uses service role for cross-team prompt access
3. **Input Validation:** Validate prompt_id format before any database query
4. **Idempotency:** Check current status to prevent duplicate processing
5. **CORS:** Include headers for browser-based testing during development

### Error Handling Matrix

| Scenario | HTTP Status | Error Code | Action |
|----------|-------------|------------|--------|
| Missing prompt_id | 400 | MISSING_PROMPT_ID | Return error |
| Invalid UUID format | 400 | INVALID_PROMPT_ID | Return error |
| Prompt not found | 404 | PROMPT_NOT_FOUND | Return error |
| Already processing | 200 | - | Return skipped=true |
| No active config | 500 | NO_ACTIVE_CONFIG | Reset to pending, return error |
| No enabled dimensions | 500 | NO_ENABLED_DIMENSIONS | Reset to pending, return error |
| Database error | 500 | ANALYSIS_FAILED | Log and return error |

### Verification Checklist
- [ ] Edge Function file exists at `supabase/functions/analyze-prompt/index.ts`
- [ ] Function deploys successfully with `supabase functions deploy`
- [ ] Database trigger is created and fires on INSERT
- [ ] Prompt_id validation rejects invalid formats
- [ ] Returns 404 for non-existent prompts
- [ ] Returns skipped response for non-pending prompts
- [ ] Status updates to 'processing' atomically
- [ ] Active config loads with enabled dimensions only
- [ ] Errors are logged with `[analyze-prompt]` prefix
- [ ] Function returns appropriate status codes

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Completion Notes List

*To be filled by dev agent after implementation*

### Change Log

| Date | Change | Author |
|------|--------|--------|
| | | |

### File List

*To be filled by dev agent - list all files created/modified*
