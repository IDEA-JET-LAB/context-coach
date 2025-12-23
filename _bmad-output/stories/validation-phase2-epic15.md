# Epic 15: Response Capture & Context Extraction - Validation Report

**Validated:** 2025-12-23
**Validator:** PM Agent (Implementation Readiness Check)
**Total Stories:** 7

## Summary

| Metric | Value |
|--------|-------|
| **Stories Ready** | 3/7 (43%) |
| **Stories Need Work** | 4/7 (57%) |
| **Blocked** | 0 |

---

## Critical Cross-Epic Issue

⚠️ **Story 15-6 has a cross-epic dependency issue:** It references `sessions` table (FK on `prompts.session_uuid`) which is created in Epic 16 Story 16-1. Migration order must be: Epic 16-1 BEFORE Epic 15-6.

---

## Story Results

### Story 15-1: Transcript File Discovery
**Status:** ⚠️ **NEEDS WORK**

**Validation Summary:**
| Criterion | Status |
|-----------|--------|
| Structure | PASS |
| AC Quality | Needs Work |
| Technical | Needs Work |
| Completeness | Partial |
| Consistency | Needs Work |

**Critical Issues:**
1. **Story scope mismatch with PRD:** This story describes "transcript file discovery" but PRD Story 15.1 is "Stop Hook Integration" (adding Stop hook to `.claude/settings.json`)
2. **Path denormalization bug:** The function incorrectly handles hyphens in paths
3. AC says "returns error if directory doesn't exist" but code returns empty result

**Recommendations:**
1. Rename/reassign this story to Epic 17 (Historical Import) as Story 17.1
2. Create new Story 15.1 for "Stop Hook Integration" per PRD
3. Fix path denormalization logic

---

### Story 15-2: JSONL Parser Implementation
**Status:** ✅ **READY**

**Validation Summary:**
| Criterion | Status |
|-----------|--------|
| Structure | PASS |
| AC Quality | PASS |
| Technical | PASS |
| Completeness | Minor Issues |
| Consistency | PASS |

**Strengths:**
- Excellent technical alignment with architecture (8 message types, streaming, content blocks)
- All ACs testable with Given/When/Then format

**Minor Issues:**
1. Missing priority and time estimate fields
2. PRD requires "Apply redaction" but story focuses on parsing only (redaction handled by 14.5)
3. Missing dependency declaration on Story 15.1

**Recommendations:**
- Add dependency on Story 15.1
- Add note clarifying redaction is handled by Epic 14.5

---

### Story 15-3: User Message Extraction
**Status:** ✅ **READY**

**Validation Summary:**
| Criterion | Status |
|-----------|--------|
| Structure | PASS |
| AC Quality | PASS |
| Technical | PASS |
| Completeness | Partial |
| Consistency | PASS |

**Minor Issues:**
1. Missing priority (should be P0 from Epic 15)
2. Missing effort estimate
3. Missing explicit dependency on Story 15.2
4. Timestamp validation threshold ("too old") not defined

**Recommendations:**
- Add priority and estimate
- Add dependency on Story 15.2

---

### Story 15-4: Assistant Response Extraction
**Status:** ⚠️ **NEEDS WORK**

**Validation Summary:**
| Criterion | Status |
|-----------|--------|
| Structure | PASS |
| AC Quality | PASS |
| Technical | PASS |
| Completeness | Needs Work |
| Consistency | Needs Work |

**Issues Found:**
1. Missing story priority and dependencies
2. **Story title mismatch with PRD:** File is "Assistant Response Extraction" but PRD 15.4 is "Enhanced Analysis with Response Context"
3. Missing edge case ACs (empty content array, malformed tool_use blocks)

**Recommendations:**
1. Add priority, story points, dependencies
2. Clarify story numbering alignment with PRD
3. Add edge case ACs

---

### Story 15-5: Prompt-Response Pairing
**Status:** ⚠️ **NEEDS WORK**

**Validation Summary:**
| Criterion | Status |
|-----------|--------|
| Structure | PASS |
| AC Quality | Partial |
| Technical | PASS |
| Completeness | Needs Work |
| Consistency | Needs Work |

**Critical Issues:**
1. **Story number mismatch:** File is 15-5 but PRD defines Story 15.3 as "Prompt-Response Pairing"
2. **Implementation approach differs from PRD:** PRD specifies correlation ID approach, story uses `parentUuid`
3. Missing priority and estimates

**Recommendations:**
1. Clarify story numbering (is this 15.3 or 15.5?)
2. Document whether `parentUuid` approach supersedes correlation ID
3. Add priority and estimates

---

### Story 15-6: Response Storage Schema
**Status:** ⚠️ **NEEDS WORK**

**Validation Summary:**
| Criterion | Status |
|-----------|--------|
| Structure | PASS |
| AC Quality | PASS |
| Technical | Needs Work |
| Completeness | Partial |
| Consistency | Needs Work |

**Critical Issues:**
1. **Blocking:** FK references `sessions(id)` but `sessions` table is created in Epic 16 Story 16-1
2. Missing RPC functions (`insert_encrypted_response`, `get_decrypted_response`)
3. PRD schema differs from story (TEXT vs BYTEA, JSONB vs TEXT[])
4. RLS policy incomplete (only SELECT, missing INSERT/UPDATE/DELETE)

**Recommendations:**
1. Remove `session_uuid` FK or add explicit dependency on 16-1 with migration ordering
2. Add missing RPC functions
3. Document schema differences from PRD as intentional improvements

---

### Story 15-7: Tool Execution Capture
**Status:** ✅ **READY** (with minor improvements)

**Validation Summary:**
| Criterion | Status |
|-----------|--------|
| Structure | PASS |
| AC Quality | PASS |
| Technical | PASS |
| Completeness | Partial |
| Consistency | PASS |

**Minor Issues:**
1. Missing story metadata (priority, story points)
2. Missing edge case AC for tool_use without matching tool_result
3. Error detection is simplistic (string matching for "Error")

**Recommendations:**
- Add story metadata
- Add edge case AC for unmatched tool_use

---

## PRD Alignment Issues

| Story File | PRD Definition | Issue |
|------------|----------------|-------|
| 15-1 | "Stop Hook Integration" | Story describes discovery, not hook integration |
| 15-4 | "Enhanced Analysis with Response Context" | Story describes extraction, not analysis enhancement |
| 15-5 | "Prompt-Response Pairing" | Story number mismatch (15.3 vs 15.5) |

## Action Items

| Priority | Story | Action |
|----------|-------|--------|
| CRITICAL | 15-6 | Resolve `sessions` table dependency (Epic 16-1 must run first) |
| HIGH | 15-1 | Reassign to Epic 17 or create proper 15.1 per PRD |
| HIGH | 15-5 | Clarify story numbering and correlation ID approach |
| HIGH | 15-6 | Add missing RPC functions |
| MEDIUM | 15-4 | Add missing metadata and edge cases |
| LOW | All | Add priority and estimates to all stories |
