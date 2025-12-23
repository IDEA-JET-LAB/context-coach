# Epic 20 Validation Report: Pre-Submission Coaching

**Validation Date:** 2025-12-23
**Validator:** PM Agent (Claude Opus 4.5)
**Epic:** Epic 20 - Pre-Submission Coaching
**Priority:** P3
**Dependencies:** Epic 19 (VS Code Extension)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total Stories** | 5 |
| **PASS** | 2 (40%) |
| **NEEDS_WORK** | 3 (60%) |
| **BLOCKED** | 0 (0%) |
| **Overall Status** | NEEDS_WORK |

### Verdict

Epic 20 stories are **mostly well-structured** but have several alignment issues with PRD requirements. Three stories require updates before implementation can begin. Key issues include missing PRD requirements (Edit button, side-by-side diff), inconsistent story numbering, and incomplete configuration mode mapping.

---

## Story-by-Story Results

### Story 20-1: Blocking Hook Implementation

| Field | Value |
|-------|-------|
| **Status** | PASS |
| **PRD Alignment** | PASS |
| **Architecture Alignment** | PASS |

**Issues:**
| Severity | Description | Recommendation |
|----------|-------------|----------------|
| Medium | Dependency on "Story 3.5: Claude Code Hook Configuration" needs verification | Verify Story 3.5 exists or update reference |
| Low | Story numbering inconsistency - implements PRD Story 20.2 but numbered 20-1 | Document rationale or renumber |
| Low | PRD 3-mode config (always/low scores/never) partially covered by sensitivity | Consider adding coaching_mode enum |
| Low | User bypass flow not fully documented | Add note clarifying extension handles bypass |

**Missing Requirements:** Full 3-mode configuration, explicit bypass flow documentation
**Extra Requirements (Good):** Performance budget breakdown, fail-open logging

**Notes:** Well-structured story with production-ready hook script template. Correctly implements exit code 2 blocking, <100ms performance requirement, and fail-open pattern.

---

### Story 20-2: Fast Heuristics Engine

| Field | Value |
|-------|-------|
| **Status** | NEEDS_WORK |
| **PRD Alignment** | PARTIAL |
| **Architecture Alignment** | PASS |

**Issues:**
| Severity | Description | Recommendation |
|----------|-------------|----------------|
| Medium | Story numbering mismatch - content matches PRD Story 20.1 but numbered 20-2 | Rename to 20-1-fast-heuristics-engine.md OR document rationale |
| Low | File location: architecture says `lib/heuristics/` but story uses `packages/cli/src/lib/heuristics/` | Clarify - CLI path is correct for hook usage |
| Low | Missing "file references" heuristic from PRD Story 20.1 | Add file reference pattern detection |
| Low | Missing Priority and Story Points fields | Add Priority: P3, estimate Story Points |

**Missing Requirements:** File references check from PRD
**Extra Requirements (Good):** Sensitivity levels, suggestion generator, CLI binary

**Heuristics Coverage:**
- PRD Required: prompt_length, file_references, question_marks, vague_words
- Implemented: too_vague, missing_goal, ambiguous, too_long, no_context
- Missing: file_references

**Notes:** Comprehensive implementation with excellent code examples. Uses stricter 50ms target (architecture) vs 100ms (PRD).

---

### Story 20-3: Improvement Suggestions Display

| Field | Value |
|-------|-------|
| **Status** | NEEDS_WORK |
| **PRD Alignment** | PARTIAL |
| **Architecture Alignment** | PASS |

**Issues:**
| Severity | Description | Recommendation |
|----------|-------------|----------------|
| High | Missing "Edit" button that opens prompt in editor (PRD requires this) | Add Task 7 for Edit functionality |
| Medium | Side-by-side diff view marked as "optional" but PRD requires it | Upgrade diff view from optional to required |
| Low | Missing Priority field | Add Priority: P3 |
| Low | Missing Story Points estimate | Add Story Points |
| Low | Wireframe shows "Skip & Submit" but AC #5 describes "dismiss" without resubmit | Align terminology |

**Missing Requirements:**
1. Edit button that opens prompt in editor
2. Side-by-side diff view (currently optional, should be required)

**Extra Requirements:** None

**Notes:** Excellent wireframe and code examples. Strong architecture alignment with correct file paths and VS Code patterns. Needs two PRD requirements added.

---

### Story 20-4: User Override Flow

| Field | Value |
|-------|-------|
| **Status** | PASS |
| **PRD Alignment** | PASS |
| **Architecture Alignment** | PASS |

**Issues:** None

**Missing Requirements:** None
**Extra Requirements:** None

**Notes:** Well-structured and complete. Correctly implements:
- Hash-based verification with 60-second TTL
- Skip action workflow
- Bypass flag recognition by hook
- Analytics tracking with `coaching_skipped` flag
- Keyboard shortcuts (Enter/Escape)
- Edge cases documented (hash mismatch, TTL expiration, multiple bypasses)

---

### Story 20-5: Coaching Preferences

| Field | Value |
|-------|-------|
| **Status** | NEEDS_WORK |
| **PRD Alignment** | PARTIAL |
| **Architecture Alignment** | PARTIAL |

**Issues:**
| Severity | Description | Recommendation |
|----------|-------------|----------------|
| Medium | PRD specifies "always ask, only on low scores, never" but story implements boolean + sensitivity | Add `coaching_mode` enum: 'always' \| 'low_scores_only' \| 'never' |
| Low | Architecture doesn't define coaching preferences schema | Update architecture-phase2.md with schema |
| Low | Missing Priority and Story Points | Add Priority: P3, estimate Story Points |
| Low | VS Code panel integration mentioned but Story 19.x not in dependencies | Add Epic 19 dependency |

**Missing Requirements:**
1. "Only on low scores" configuration mode from PRD 20.2

**Extra Requirements (Good):**
1. `show_terminal_hints` setting
2. `team_coaching_defaults` table for team-level overrides
3. VS Code status bar integration

**Notes:** Comprehensive story with complete database schema, API implementation, UI component, and CLI sync. The boolean + sensitivity approach achieves similar behavior to PRD modes but doesn't match the PRD mental model exactly.

---

## Consolidated Issues Summary

### Critical/High Priority (Must Fix)

| Story | Issue | Impact |
|-------|-------|--------|
| 20-3 | Missing Edit button | PRD requirement gap |

### Medium Priority (Should Fix)

| Story | Issue | Impact |
|-------|-------|--------|
| 20-2 | Story numbering mismatch | Tracking confusion |
| 20-3 | Side-by-side diff optional vs required | PRD requirement gap |
| 20-5 | Configuration mode mismatch | PRD alignment |
| 20-1 | Dependency verification needed | Implementation clarity |

### Low Priority (Nice to Fix)

| Story | Issue | Impact |
|-------|-------|--------|
| All | Missing Priority/Story Points | Sprint planning |
| 20-2 | Missing file references heuristic | Feature gap |
| 20-5 | Architecture schema missing | Documentation |

---

## Recommendations

### Immediate Actions

1. **Story 20-3**: Add Edit button functionality (new Task 7) and upgrade diff view to required
2. **Story 20-2**: Add file references heuristic pattern
3. **Story 20-5**: Add `coaching_mode` enum to match PRD exactly

### Documentation Updates

1. Resolve story numbering (20-1 vs 20-2 content swap or document rationale)
2. Add Priority (P3) and Story Points to all stories
3. Update architecture-phase2.md with coaching_preferences schema

### Dependency Clarification

1. Verify Story 3.5 (Phase 1 hook infrastructure) exists
2. Add Epic 19 dependency to Story 20-5 for VS Code integration

---

## PRD Coverage Matrix

| PRD Requirement | Story | Status |
|-----------------|-------|--------|
| Hook blocking with exit code 2 | 20-1 | Covered |
| Write suggestion to temp file | 20-1 | Covered |
| Show message "See VS Code panel" | 20-1 | Covered |
| User can bypass | 20-4 | Covered |
| Configurable: always/low scores/never | 20-5 | PARTIAL - needs mode enum |
| Local heuristic rules (no API) | 20-2 | Covered |
| Check prompt length | 20-2 | Covered |
| Check file references | 20-2 | MISSING |
| Check question marks | 20-2 | Covered |
| Check vague words | 20-2 | Covered |
| < 100ms execution | 20-2 | Covered (50ms) |
| Panel shows original prompt | 20-3 | Covered |
| Panel shows improvements | 20-3 | Covered |
| Side-by-side diff view | 20-3 | PARTIAL - optional |
| Accept/Copy to clipboard | 20-3 | Covered |
| Edit opens in editor | 20-3 | MISSING |
| Skip resubmits original | 20-3, 20-4 | Covered |

---

## Approval Status

| Story | Ready for Development? |
|-------|------------------------|
| 20-1 | YES (minor issues acceptable) |
| 20-2 | NO - needs file references heuristic |
| 20-3 | NO - needs Edit button, diff upgrade |
| 20-4 | YES |
| 20-5 | NO - needs coaching_mode enum |

**Epic 20 Overall: NOT READY** - 3 of 5 stories need updates before implementation.

---

*Report generated by PM Agent - Contextor Phase 2 Validation*
