# Session Log: Cloud Import Batch Deduplication Fix

**Date:** 2025-01-08
**Issue:** Cloud import consistently returning "0 imported, 2 skipped" regardless of project

## Problem Summary

The VS Code extension's cloud import feature was failing to import any prompts. The API would process 21 JSONL files, find 28 prompt-response pairs, but ultimately import 0 prompts with the error:

```
"duplicate key value violates unique constraint \"idx_prompts_fingerprint\""
```

## Root Cause Analysis

### Investigation Steps

1. **Created programmatic test** (`test-import-node.mjs`) to reproduce the issue without manual VS Code testing
2. **Added debug logging** to the API endpoint to trace the flow
3. **Discovered the issue**: 28 prompts found, 26 should be inserted, but batch insert failed with duplicate key error
4. **Created fingerprint analysis script** (`test-fingerprint-dups.mjs`) to check for duplicates within the batch

### Root Cause

Multiple "Warmup" prompts from Claude Code agent subprocesses had **identical fingerprints**:

```
Fingerprint eae0634c3446 appears 4 times:
  - agent-a4caef9.jsonl @ 2025-12-25T19:24:09: "Warmup..."
  - agent-a9760e7.jsonl @ 2025-12-25T19:24:45: "Warmup..."
  - agent-a9bb501.jsonl @ 2025-12-25T19:24:09: "Warmup..."
  - agent-afb0df4.jsonl @ 2025-12-25T19:24:45: "Warmup..."
```

The fingerprint algorithm uses `MD5(userId + minuteTimestamp + first200chars)`. When multiple agent files contain the same "Warmup" prompt text at the same minute, they generate identical fingerprints.

When the batch insert tried to insert all prompts at once, PostgreSQL rejected the entire batch due to the unique constraint on `idx_prompts_fingerprint`.

## Fix Applied

**File:** `app/app/api/import/upload/route.ts`
**Lines:** 540-568

Added batch-internal deduplication before database insert:

```typescript
// Track fingerprints seen in this batch to avoid duplicates within the import
const seenFingerprintsInBatch = new Set<string>();

for (const pair of allPairs) {
  if (isGarbagePrompt(pair.prompt.text)) {
    skippedCount++;
    skippedGarbage++;
    continue;
  }

  // Check for duplicates within the current import batch
  if (seenFingerprintsInBatch.has(pair.fingerprint)) {
    skippedCount++;
    skippedBatchDuplicate++;
    continue;
  }

  const existingPromptId = existingFingerprintMap.get(pair.fingerprint);
  if (existingPromptId) {
    // ... existing dedup logic
  } else {
    newPairs.push(pair);
    seenFingerprintsInBatch.add(pair.fingerprint);  // Track for batch dedup
  }
}
```

### New Debug Fields Added

The API response now includes detailed debug information:

```json
{
  "debug": {
    "totalPairsFound": 28,
    "newPairsCount": 18,
    "existingNeedingResponses": 0,
    "skippedGarbage": 2,
    "skippedDuplicate": 0,
    "skippedBatchDuplicate": 8,
    "existingFingerprints": 0,
    "insertErrors": []
  }
}
```

## Test Results

### First Import (after fix)
```json
{
  "success": true,
  "imported": 18,
  "skipped": 10,
  "responses": 16,
  "debug": {
    "totalPairsFound": 28,
    "skippedGarbage": 2,
    "skippedBatchDuplicate": 8,
    "insertErrors": []
  }
}
```

### Second Import (idempotency test)
```json
{
  "success": true,
  "imported": 0,
  "skipped": 28,
  "debug": {
    "totalPairsFound": 28,
    "skippedDuplicate": 26,
    "existingFingerprints": 18
  }
}
```

## Files Created/Modified

### Modified
- `app/app/api/import/upload/route.ts` - Added batch deduplication logic

### Test Scripts Created (can be deleted)
- `test-import-node.mjs` - Node.js script that mimics VS Code extension behavior
- `test-fingerprint-dups.mjs` - Diagnostic script to find duplicate fingerprints
- `test-server-parse.mjs` - Test server-side parsing logic
- `test-parse-content.mjs` - Debug content escaping

## VS Code Extension

Version bumped: **0.1.12 → 0.1.13**
Rebuilt: `contextor-vscode-0.1.13.vsix` (329.48 KB)

The extension code itself was not changed - the fix was entirely server-side.

## Math Verification

- 28 total prompt-response pairs found in 21 JSONL files
- -2 garbage prompts ("Warmup" filtered by `isGarbagePrompt`)
- -8 batch duplicates (same fingerprint within import batch)
- = 18 prompts successfully imported

On re-import:
- 28 pairs found
- 18 already exist in database (skipped as duplicates)
- 2 garbage + 8 batch duplicates = 10 more skipped
- = 0 new imports (correct idempotent behavior)
