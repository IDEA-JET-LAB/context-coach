---
title: 'Import Enrichment for Existing Prompts'
slug: 'import-enrichment'
created: '2026-01-09'
status: 'implemented'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
tech_stack: ['TypeScript', 'Supabase', 'Next.js API Routes', 'Vitest']
files_to_modify: [
  'app/lib/import/types.ts',
  'app/lib/import/parser.ts',
  'app/app/api/import/batch/route.ts'
]
code_patterns: [
  'fingerprint-based matching',
  'streaming JSONL parsing',
  'encrypted response storage via RPC',
  'batch processing with retry'
]
test_patterns: [
  'unit tests in __tests__/ directories',
  'vitest for unit tests',
  'mock supabase client'
]
---

# Tech-Spec: Import Enrichment for Existing Prompts

**Created:** 2026-01-09

## Overview

### Problem Statement

Older live-captured prompts are missing response metadata (thinking, tools, model, tokens) that exists in Claude Code transcript files. The current import pipeline skips duplicate prompts (matched by fingerprint), which means users cannot backfill richer data from historical transcripts. Users want to enrich existing records without creating duplicates.

### Solution

Modify the import pipeline to detect fingerprint matches and ENRICH existing records instead of skipping them. When a fingerprint match is found:
1. Update the `prompts` table with metadata (model, input_tokens, output_tokens, has_thinking)
2. Insert or overwrite the `prompt_responses` record with full response data

This becomes the default behavior for ALL projects and ALL users.

### Scope

**In Scope:**
- Fingerprint-based matching (existing mechanism)
- Update `prompts` table: model, input_tokens, output_tokens, has_thinking
- Insert/overwrite `prompt_responses` when import has response data
- Simple UI feedback: "X new, Y enriched, Z skipped"
- Default behavior for all projects, all users

**Out of Scope:**
- Field-level merge (we overwrite, not merge)
- Detailed enrichment breakdown in UI
- Manual selection of which records to enrich
- Rollback of enriched data

## Context for Development

### Codebase Patterns

**Import Pipeline Flow:**
```
Transcript JSONL → parser.ts (extract pairs) → dedup.ts (add fingerprints)
    → batch.ts (orchestrate) → POST /api/import/batch → DB insert/update
```

**Key Discovery: Partial Enrichment Already Exists**

The batch route (`route.ts:269-291`) already handles one enrichment case:
- If fingerprint matches AND existing prompt has NO response AND import HAS response → INSERT response

Current gap: If existing prompt HAS a response (even incomplete), import is SKIPPED entirely.

**Thinking Extraction Gap:**
- Live capture hook (`.claude/hooks/contextor-response.sh`) extracts thinking blocks
- Import parser (`parser.ts`) ignores thinking blocks - only extracts `text` and `tool_use`
- Batch route hardcodes `p_has_thinking: false`

### Files to Reference

| File | Purpose | Key Lines |
| ---- | ------- | --------- |
| `app/lib/import/parser.ts` | JSONL parsing, extracts user/assistant content | `extractAssistantContent()` ignores thinking |
| `app/lib/import/types.ts` | TypeScript interfaces for import | `PromptResponsePair.response` missing thinking field |
| `app/app/api/import/batch/route.ts` | API endpoint for batch import | Lines 269-291: existing enrichment logic |
| `app/lib/import/dedup.ts` | Deduplication logic | `filterDuplicates()` returns only NEW pairs |
| `app/supabase/migrations/20251223140000_add_response_storage.sql` | `prompt_responses` table | `insert_encrypted_response` RPC |
| `.claude/hooks/contextor-response.sh` | Live capture hook | Lines 77-83: thinking extraction (reference) |

### Technical Decisions

1. **Overwrite strategy**: When import has response data and DB already has response, DELETE existing response and INSERT new one (cleaner than UPDATE with encryption)

2. **Prompt metadata update**: Use simple UPDATE query for `prompts` table fields (model, input_tokens, output_tokens, has_thinking)

3. **Thinking extraction**: Add to `parser.ts` - extract `type: "thinking"` blocks same as `type: "text"`

4. **No separate "enrich" endpoint**: Reuse existing `/api/import/batch` with modified logic - keeps API surface minimal

5. **UI feedback**: Add `enriched` count to `BatchUploadResponse` alongside existing `imported`, `skipped`, `updated`

## Implementation Plan

### Tasks

- [x] **Task 1: Add thinking fields to import types**
  - File: `app/lib/import/types.ts`
  - Action: Add `thinking` field to `ParsedMessage` interface (line ~181)
  - Action: Add `thinking` field to `PromptResponsePair.response` interface (line ~208)
  - Notes: Match field structure from live capture: `{ text: string, summary: string, wordCount: number }`

- [x] **Task 2: Extract thinking content in parser**
  - File: `app/lib/import/parser.ts`
  - Action: Add `extractThinkingContent()` function similar to `extractAssistantContent()`
  - Action: Update `parseJsonlFile()` (line ~224) to extract thinking blocks with `type: "thinking"`
  - Action: Populate `thinking` field in parsed assistant messages
  - Notes: Reference `.claude/hooks/contextor-response.sh` lines 77-83 for extraction pattern

- [x] **Task 3: Add unit tests for thinking extraction**
  - File: `app/lib/import/__tests__/parser.test.ts`
  - Action: Add test case for messages with thinking blocks
  - Action: Add test case for messages without thinking (should return undefined)
  - Action: Add test case for multiple thinking blocks (should concatenate)
  - Notes: Follow existing test patterns in file

- [x] **Task 4: Modify batch route enrichment logic**
  - File: `app/app/api/import/batch/route.ts`
  - Action: Change `existingPairsNeedingResponses` logic (line ~283) to include prompts that HAVE responses but import has richer data
  - Action: Add new category `existingPairsToEnrich` for prompts with existing responses
  - Action: For enrichment: DELETE existing `prompt_responses` row, then INSERT new one
  - Notes: "Richer" = import has response AND (has thinking OR has more tools OR has model)

- [x] **Task 5: Add prompt metadata update for enriched prompts**
  - File: `app/app/api/import/batch/route.ts`
  - Action: After response enrichment, UPDATE `prompts` table with: model, input_tokens, output_tokens, has_thinking
  - Action: Only update fields that are NULL in DB but present in import
  - Notes: Use single batch UPDATE query for efficiency

- [x] **Task 6: Update response counts and API response**
  - File: `app/app/api/import/batch/route.ts`
  - Action: Add `enriched` count to track prompts that were enriched (vs just getting responses added)
  - Action: Update `BatchUploadResponse` return to include `enriched` count
  - File: `app/lib/import/types.ts`
  - Action: Add `enriched?: number` to `BatchUploadResponse` interface

- [x] **Task 7: Use thinking data when inserting responses**
  - File: `app/app/api/import/batch/route.ts`
  - Action: Update `insert_encrypted_response` RPC calls (lines ~357, ~424) to use actual `has_thinking` value from import
  - Action: Pass thinking text for storage if available
  - Notes: Currently hardcoded to `p_has_thinking: false`

### Acceptance Criteria

- [ ] **AC 1**: Given a prompt exists in DB without a response, when importing a transcript with that prompt and a response, then the response is added and `updated` count increments

- [ ] **AC 2**: Given a prompt exists in DB with a basic response (no thinking), when importing a transcript with that prompt and a response WITH thinking, then the existing response is replaced with the richer one and `enriched` count increments

- [ ] **AC 3**: Given a prompt exists in DB with model=NULL, when importing a transcript with that prompt and model="claude-3-opus", then the prompt's model field is updated to "claude-3-opus"

- [ ] **AC 4**: Given a prompt exists in DB with a complete response (thinking, tools, model), when importing a transcript with that same prompt, then the import is skipped (no overwrite of equal data) and `skipped` count increments

- [ ] **AC 5**: Given transcripts with thinking blocks, when parsing via import, then thinking content is extracted and available in the parsed response

- [ ] **AC 6**: Given a batch import completes, when checking the API response, then it includes `imported`, `skipped`, `updated`, and `enriched` counts

- [ ] **AC 7**: Given an import with 100 prompts (50 new, 30 to enrich, 20 already complete), when import finishes, then counts show imported=50, enriched=30, skipped=20

## Additional Context

### Dependencies

- Existing fingerprint matching infrastructure (no changes needed)
- `prompt_responses` table with encryption functions (no schema changes)
- `insert_encrypted_response` RPC function (no changes needed)
- Import batch API endpoint (modified in this spec)

### Testing Strategy

**Unit Tests:**
- `parser.test.ts`: Add tests for thinking extraction
- Test JSONL with thinking blocks extracts correctly
- Test JSONL without thinking returns undefined

**Integration Tests (manual):**
1. Import transcripts for a project with existing live-captured prompts
2. Verify older prompts are enriched with thinking/tools data
3. Verify new prompts are inserted normally
4. Verify already-complete prompts are skipped
5. Verify counts in import summary are accurate

**Edge Cases to Test:**
- Empty thinking blocks (should not count as "has thinking")
- Multiple thinking blocks in one turn (should concatenate)
- Response with tools but no text (should still import)

### Notes

**User Preference Captured:**
- Overwrite existing response data when import has richer data (not field-level merge)
- Simple counts for UI: "47 new, 12 enriched, 8 skipped"

**Risk Items:**
- Large imports may take longer due to additional UPDATE queries - monitor performance
- Response deletion + insertion is not atomic - consider wrapping in transaction if issues arise

**Future Considerations (Out of Scope):**
- Could add "dry run" mode to preview what would be enriched
- Could add rollback capability for enriched data
- Could add per-prompt selection for which to enrich
