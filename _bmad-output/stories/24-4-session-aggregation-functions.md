# Story 24-4: Session Aggregation Functions

Status: Review

## Story

**As a** developer working on Phase 3 conversation intelligence,
**I want** database functions for real-time session statistics calculation,
**So that** session aggregates are updated efficiently and conversation scores are accurate.

## Acceptance Criteria

1. **Given** a session with prompts
   **When** `update_session_stats(session_uuid)` is called
   **Then** `user_message_count` is recalculated from prompts
   **And** `stage_breakdown` JSONB is updated with stage counts
   **And** `primary_stage` is set to the most common stage
   **And** `has_debugging_loop` is updated based on prompt flags

2. **Given** a session with analyzed prompts
   **When** `calculate_conversation_score(session_uuid)` is called
   **Then** the score is calculated excluding prompts with prompt_type IN ('selection', 'confirmation')
   **And** the weighted average uses prompt_type scoring weights
   **And** the result is stored in `conversation_score`

3. **Given** a new prompt is inserted with session_uuid
   **When** the trigger fires
   **Then** `update_session_aggregates()` function is called
   **And** `user_message_count` is incremented appropriately
   **And** `ended_at` is updated to the prompt's timestamp

4. **Given** prompt analysis is complete
   **When** a prompt's analysis is stored
   **Then** the session's conversation_score should be recalculated
   **And** the update is efficient (not full rescan)

5. **Given** the aggregation functions
   **When** they are called concurrently
   **Then** no race conditions occur
   **And** final values are consistent

## Tasks / Subtasks

- [x] **Task 1: Create update_session_stats function** (AC: #1)
  - [x] Create function that recalculates all session aggregates
  - [x] Calculate user_message_count excluding tool_result types
  - [x] Build stage_breakdown JSONB from prompts.detected_stage
  - [x] Determine primary_stage from highest count in breakdown
  - [x] Set has_debugging_loop from prompts.is_in_debugging_loop

- [x] **Task 2: Create calculate_conversation_score function** (AC: #2)
  - [x] Create function that calculates weighted average score
  - [x] Exclude selection and confirmation prompt types (via get_prompt_scoring_weight)
  - [x] Apply scoring weights based on prompt_classification
  - [x] Handle sessions with no scorable prompts gracefully (returns NULL)

- [x] **Task 3: Update session aggregates trigger** (AC: #3)
  - [x] Created update_session_aggregates trigger function
  - [x] Increment user_message_count for non-tool_result prompts
  - [x] Update ended_at timestamp
  - [x] Efficient incremental update (no full recalculation)

- [x] **Task 4: Create analysis complete trigger** (AC: #4)
  - [x] Create trigger on prompt_analyses table (INSERT OR UPDATE OF overall_score)
  - [x] Call calculate_conversation_score for the session
  - [x] Trigger fires only when score changes

- [x] **Task 5: Add concurrency safety** (AC: #5)
  - [x] Use SELECT FOR UPDATE in update_session_stats and calculate_conversation_score
  - [x] Prevents race conditions during concurrent updates

- [x] **Task 6: Create migration file**
  - [x] Create `app/supabase/migrations/20251225230000_session_aggregation_functions.sql`
  - [x] Include all functions and triggers
  - [x] Add function comments

## Dev Notes

### Technology Stack
- PostgreSQL 15.x (Supabase)
- PL/pgSQL for functions
- Triggers for automatic updates

### Migration Dependency

**CRITICAL:** Story 24-2 MUST be applied before this migration because the `update_session_aggregates()` trigger function references the `prompts.prompt_type` column. If 24-2 has not been applied, the trigger creation will fail with a "column does not exist" error. The migration order in Story 24-5 ensures this dependency is respected.

### Database Functions

```sql
-- 20251225230000_session_aggregation_functions.sql
-- Phase 3: Session aggregation functions for conversation intelligence

-- ============================================
-- SCORING WEIGHTS BY PROMPT TYPE
-- ============================================
-- Returns the scoring weight for a given prompt type
-- selection and confirmation = 0 (skip scoring)

CREATE OR REPLACE FUNCTION get_prompt_scoring_weight(p_prompt_type VARCHAR(50))
RETURNS DECIMAL(3,2) AS $$
BEGIN
  RETURN CASE p_prompt_type
    WHEN 'initiating' THEN 1.00
    WHEN 'continuation' THEN 0.70
    WHEN 'selection' THEN 0.00      -- Skip scoring
    WHEN 'correction' THEN 0.80
    WHEN 'confirmation' THEN 0.00   -- Skip scoring
    WHEN 'clarification' THEN 0.60
    WHEN 'tool_result' THEN 0.00    -- Not a user prompt
    ELSE 1.00                        -- Default full weight for NULL/unknown
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_prompt_scoring_weight(VARCHAR) IS
  'Returns the scoring weight (0.00-1.00) for a prompt type. Selection/confirmation return 0 to skip scoring.';

-- ============================================
-- UPDATE SESSION STATS (FULL RECALCULATION)
-- ============================================
-- Recalculates all session aggregates from prompts

CREATE OR REPLACE FUNCTION update_session_stats(p_session_uuid UUID)
RETURNS VOID AS $$
DECLARE
  v_user_count INTEGER;
  v_breakdown JSONB;
  v_primary_stage VARCHAR(50);
  v_has_loop BOOLEAN;
BEGIN
  -- Lock the session row to prevent concurrent updates
  PERFORM 1 FROM sessions WHERE id = p_session_uuid FOR UPDATE;

  -- Count user messages (exclude tool_result)
  SELECT COUNT(*) INTO v_user_count
  FROM prompts
  WHERE session_uuid = p_session_uuid
  AND (prompt_type IS NULL OR prompt_type != 'tool_result');

  -- Build stage breakdown
  SELECT COALESCE(jsonb_object_agg(detected_stage, cnt), '{}'::jsonb)
  INTO v_breakdown
  FROM (
    SELECT detected_stage, COUNT(*) as cnt
    FROM prompts
    WHERE session_uuid = p_session_uuid
    AND detected_stage IS NOT NULL
    GROUP BY detected_stage
  ) stage_counts;

  -- Determine primary stage (most common)
  SELECT detected_stage INTO v_primary_stage
  FROM prompts
  WHERE session_uuid = p_session_uuid
  AND detected_stage IS NOT NULL
  GROUP BY detected_stage
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Check for debugging loop (any prompt flagged)
  SELECT EXISTS (
    SELECT 1 FROM prompts
    WHERE session_uuid = p_session_uuid
    AND is_in_debugging_loop = TRUE
  ) INTO v_has_loop;

  -- Update session
  UPDATE sessions SET
    user_message_count = v_user_count,
    stage_breakdown = v_breakdown,
    primary_stage = v_primary_stage,
    has_debugging_loop = v_has_loop,
    updated_at = NOW()
  WHERE id = p_session_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_session_stats(UUID) IS
  'Recalculates all session aggregates: user_message_count, stage_breakdown, primary_stage, has_debugging_loop. Use for full refresh.';

-- Grant execute
GRANT EXECUTE ON FUNCTION update_session_stats(UUID) TO service_role;

-- ============================================
-- CALCULATE CONVERSATION SCORE
-- ============================================
-- Calculates weighted average score excluding selection/confirmation

CREATE OR REPLACE FUNCTION calculate_conversation_score(p_session_uuid UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_score DECIMAL(5,2);
BEGIN
  -- Lock the session row
  PERFORM 1 FROM sessions WHERE id = p_session_uuid FOR UPDATE;

  -- Calculate weighted average of prompt scores
  -- Excludes prompts with 0 weight (selection, confirmation, tool_result)
  SELECT
    CASE
      WHEN SUM(get_prompt_scoring_weight(p.prompt_type)) = 0 THEN NULL
      ELSE ROUND(
        SUM(pa.overall_score * get_prompt_scoring_weight(p.prompt_type)) /
        NULLIF(SUM(get_prompt_scoring_weight(p.prompt_type)), 0),
        2
      )
    END
  INTO v_score
  FROM prompts p
  JOIN prompt_analyses pa ON pa.prompt_id = p.id
  WHERE p.session_uuid = p_session_uuid
  AND get_prompt_scoring_weight(p.prompt_type) > 0;

  -- Update session
  UPDATE sessions SET
    conversation_score = v_score,
    updated_at = NOW()
  WHERE id = p_session_uuid;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_conversation_score(UUID) IS
  'Calculates the weighted average conversation score, excluding selection/confirmation prompts. Updates sessions.conversation_score.';

-- Grant execute
GRANT EXECUTE ON FUNCTION calculate_conversation_score(UUID) TO service_role;

-- ============================================
-- UPDATE SESSION AGGREGATES TRIGGER
-- ============================================
-- Efficient incremental update on prompt insert

CREATE OR REPLACE FUNCTION update_session_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if session_uuid is set
  IF NEW.session_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Increment counts and update timestamp
  UPDATE sessions SET
    total_prompts = total_prompts + 1,
    user_message_count = CASE
      WHEN NEW.prompt_type IS NULL OR NEW.prompt_type != 'tool_result'
      THEN user_message_count + 1
      ELSE user_message_count
    END,
    ended_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.session_uuid;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_session_aggregates() IS
  'Trigger function for incremental session updates on prompt insert. Increments counts and updates ended_at.';

-- Drop existing trigger if exists, then recreate
DROP TRIGGER IF EXISTS on_prompt_insert_update_session ON prompts;

CREATE TRIGGER on_prompt_insert_update_session
  AFTER INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_session_aggregates();

-- ============================================
-- ANALYSIS COMPLETE TRIGGER
-- ============================================
-- Recalculate conversation score when analysis is stored

CREATE OR REPLACE FUNCTION on_analysis_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_session_uuid UUID;
BEGIN
  -- Get the session UUID for this prompt
  SELECT session_uuid INTO v_session_uuid
  FROM prompts
  WHERE id = NEW.prompt_id;

  -- Recalculate score if session exists
  IF v_session_uuid IS NOT NULL THEN
    PERFORM calculate_conversation_score(v_session_uuid);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION on_analysis_complete() IS
  'Trigger function that recalculates conversation score when prompt analysis is stored.';

-- Drop existing trigger if exists, then recreate
DROP TRIGGER IF EXISTS on_prompt_analysis_insert ON prompt_analyses;

CREATE TRIGGER on_prompt_analysis_insert
  AFTER INSERT OR UPDATE OF overall_score ON prompt_analyses
  FOR EACH ROW
  EXECUTE FUNCTION on_analysis_complete();

-- ============================================
-- COMPLETION NOTICE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '=== PHASE 3: SESSION AGGREGATION FUNCTIONS COMPLETE ===';
  RAISE NOTICE 'Created functions: get_prompt_scoring_weight, update_session_stats, calculate_conversation_score';
  RAISE NOTICE 'Updated trigger: update_session_aggregates';
  RAISE NOTICE 'Created trigger: on_analysis_complete for prompt_analyses';
  RAISE NOTICE '======================================================';
END $$;
```

### Function Specifications

| Function | Input | Output | Purpose |
|----------|-------|--------|---------|
| `get_prompt_scoring_weight` | prompt_type | DECIMAL | Returns weight (0-1) |
| `update_session_stats` | session_uuid | VOID | Full stats recalculation |
| `calculate_conversation_score` | session_uuid | DECIMAL | Weighted score calculation |
| `update_session_aggregates` | TRIGGER | NEW | Incremental update on insert |
| `on_analysis_complete` | TRIGGER | NEW | Score update on analysis |

### Scoring Weight Matrix

| Prompt Type | Weight | Rationale |
|-------------|--------|-----------|
| initiating | 1.00 | Full responsibility for quality |
| continuation | 0.70 | Context-dependent, less control |
| selection | 0.00 | Skip - just picking an option |
| correction | 0.80 | Important but reactive |
| confirmation | 0.00 | Skip - just saying yes |
| clarification | 0.60 | Asks questions, moderate impact |
| tool_result | 0.00 | System message, not user |
| NULL/unknown | 1.00 | Legacy prompts, full weight |

### Common Pitfalls

1. **DO NOT** forget FOR UPDATE to prevent race conditions
2. **DO NOT** recalculate full stats on every prompt insert (use incremental)
3. **DO NOT** divide by zero when no scorable prompts exist
4. **DO NOT** skip NULL handling for optional columns
5. **DO NOT** use serializable isolation (deadlock risk)

### Testing Checklist

- [ ] get_prompt_scoring_weight returns correct weights for all types
- [ ] update_session_stats correctly calculates all aggregates
- [ ] calculate_conversation_score excludes 0-weight prompts
- [ ] calculate_conversation_score handles empty sessions
- [ ] update_session_aggregates trigger fires on prompt insert
- [ ] on_analysis_complete trigger fires on analysis insert/update
- [ ] Concurrent updates don't cause race conditions
- [ ] Session with no scorable prompts has NULL conversation_score
- [ ] primary_stage correctly identifies most common stage
- [ ] has_debugging_loop correctly detects loop flags

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- **Uses prompt_classification:** Functions reference `prompt_classification` (from 24-2) instead of `prompt_type` which is used for command detection. Added fallback checks for legacy `prompt_type` column.
- **Scoring returns INTEGER:** `calculate_conversation_score` returns INTEGER (matching sessions.conversation_score column) not DECIMAL.
- **Trigger on UPDATE:** Analysis trigger fires on INSERT OR UPDATE OF overall_score to handle re-analysis.
- **Concurrency safety:** Both stats functions use SELECT FOR UPDATE to prevent race conditions.
- **DEPENDENCY:** This migration requires 24-2 to be applied first (references prompt_classification column).

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-26 | Created session aggregation functions migration | Dev Agent (Amelia) |

### File List

- **Created:** `app/supabase/migrations/20251225230000_session_aggregation_functions.sql`
