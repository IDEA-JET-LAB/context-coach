# Phase 3: Conversation Intelligence - Epic Breakdown

**Validation Status:** COMPLETE (2025-12-25)
**All Stories:** 21 stories validated and ready for development
**Issues Fixed:** 17 issues identified and resolved during validation

See `_bmad-output/HANDOFF-PHASE3-EPIC-PLANNING.md` for detailed handoff notes.

---

## Table of Contents

- [Overview](#overview) (Line 10)
- [Priority Order](#priority-order) (Line 20)
- [Epic 24: Schema Extensions](#epic-24-schema-extensions) (Line 35)
- [Epic 25: Conversations API](#epic-25-conversations-api) (Line 80)
- [Epic 26: Enhanced Capture Pipeline](#epic-26-enhanced-capture-pipeline) (Line 130)
- [Epic 27: Context-Aware Analysis](#epic-27-context-aware-analysis) (Line 180)
- [Epic 28: Project Mapping (Deferred)](#epic-28-project-mapping-deferred) (Line 230)
- [Epic 29: Team Analytics (Deferred)](#epic-29-team-analytics-deferred) (Line 250)

---

## Overview

Phase 3 transforms Contextor from prompt-by-prompt analysis to **conversation-aware coaching**. The key insight is that prompts must be evaluated in context — "Yes" is a perfect response when Claude asks "Should I proceed?" but meaningless as an opening prompt.

**Core Principle Changes:**
1. **Two-Hook Capture** — Stop hook captures responses, UserPromptSubmit captures prompts
2. **Response Before Prompt** — Response is stored BEFORE the next prompt arrives (natural conversation order)
3. **Context-Aware Scoring** — Analysis queries DB for full conversation history
4. **Prompt Classification** — Some prompts (selection, confirmation) are not scored

---

## Priority Order

| Priority | Epic | Rationale |
|----------|------|-----------|
| **P0** | Epic 24: Schema Extensions | Foundation - must come first |
| **P0** | Epic 25: Conversations API | Connect existing UI to real data |
| **P0** | Epic 26: Enhanced Capture | Get response data flowing |
| **P1** | Epic 27: Context-Aware Analysis | Intelligence layer |
| **P2** | Epic 28: Project Mapping | Deferred - not needed for E2E |
| **P2** | Epic 29: Team Analytics | Deferred - not needed for E2E |

---

## Epic 24: Schema Extensions

**Priority:** P0 (Foundation)
**Goal:** Add database columns and functions needed for Phase 3 features

### Why First?
All other epics depend on these schema changes. We extend existing tables (no new tables except project_mappings which is deferred).

### Stories

#### Story 24-1: Sessions Table Extensions
Add columns to sessions table for conversation-level metadata.

**New Columns:**
- `primary_stage` — Detected project stage (architecture, development, debugging)
- `has_debugging_loop` — Boolean flag for loop detection
- `conversation_score` — Aggregate score (excluding selection/confirmation)
- `stage_breakdown` — JSONB of stage percentages
- `user_message_count` — Count of user messages (not tool results)

---

#### Story 24-2: Prompts Table Extensions
Add columns for prompt classification and threading.

**New Columns:**
- `prompt_type` — Classification (initiating, continuation, selection, etc.)
- `prompt_type_confidence` — Classification confidence score
- `message_uuid` — UUID from Claude Code transcript
- `parent_message_uuid` — For threading
- `is_in_debugging_loop` — Boolean flag
- `detected_stage` — Stage at time of prompt

---

#### Story 24-3: Prompt Responses Table Extensions
Add columns for thinking and tool metadata.

**New Columns:**
- `thinking_summary` — Compressed thinking (500 chars)
- `thinking_word_count` — Original word count
- `tools_used` — JSONB array of tool names/ids

---

#### Story 24-4: Session Aggregation Functions
Create database functions for real-time session statistics.

**Functions:**
- `update_session_stats(session_uuid)` — Recalculate aggregates
- `calculate_conversation_score(session_uuid)` — Score excluding skipped prompts

---

#### Story 24-5: Apply Migrations
Create and apply migration files safely.

**Files:**
- `20251225100000_phase3_schema_extensions.sql`

---

## Epic 25: Conversations API

**Priority:** P0 (Core Experience)
**Goal:** API endpoints to serve the conversations UI with real data

### Why Second?
The UI already exists with mock data. This epic connects it to real database queries.

### Stories

#### Story 25-1: Response Capture Endpoint
New endpoint for Stop hook to send response data.

**Endpoint:** `POST /api/responses/capture`
**Input:** session_id, message_uuid, response_text, thinking_summary, tools_used, model, usage, stop_reason

---

#### Story 25-2: Conversations List Endpoint
Endpoint to list conversations (sessions) with Phase 3 fields.

**Endpoint:** `GET /api/conversations`
**Query Params:** project_id, stage, has_loop, date_from, date_to, limit, offset
**Response:** Sessions with primary_stage, has_debugging_loop, conversation_score

---

#### Story 25-3: Conversation Thread Endpoint
Endpoint to get threaded messages for a conversation.

**Endpoint:** `GET /api/conversations/[sessionId]`
**Response:** Messages in order with prompt_type, scores, response text, tools

---

#### Story 25-4: Conversation Context Endpoint
Endpoint for analysis to retrieve conversation context.

**Endpoint:** `GET /api/sessions/[id]/context`
**Query Params:** token_budget, message_limit
**Response:** Recent messages formatted for LLM analysis

---

#### Story 25-5: Connect Conversations UI
Wire up existing UI components to real API endpoints.

**Components to Update:**
- ConversationList → /api/conversations
- ConversationThread → /api/conversations/[id]
- Message cards → real response data

---

## Epic 26: Enhanced Capture Pipeline

**Priority:** P0 (Data Flow)
**Goal:** Implement two-hook capture for responses and prompts

### Why Third?
With schema ready and API ready, we need data flowing through the system.

### Stories

#### Story 26-1: Stop Hook Script
Create contextor-response.sh to capture responses.

**Script:** `.claude/hooks/contextor-response.sh`
**Trigger:** Stop hook fires when Claude finishes responding
**Input:** `{transcript_path}` via stdin
**Action:** Read last assistant message, send to /api/responses/capture

---

#### Story 26-2: CLI Hook Configuration
Update CLI to configure both Stop and UserPromptSubmit hooks.

**Changes to packages/cli:**
- Add Stop hook to settings.json configuration
- Create contextor-response.sh alongside contextor-capture.sh
- Idempotent installation (don't duplicate hooks)

---

#### Story 26-3: Update Prompt Capture Hook
Simplify existing hook now that response is captured separately.

**Changes:**
- Remove any response-related logic
- Ensure session_id is passed
- Trigger analysis which queries DB for context

---

#### Story 26-4: Response Extraction Logic
Implement transcript parsing for response data.

**Extract:**
- Text content (from content[].type === 'text')
- Thinking content (from content[].type === 'thinking')
- Tool uses (from content[].type === 'tool_use')
- Model, usage, stop_reason

---

#### Story 26-5: Thinking Compression
Implement thinking summary compression.

**Logic:**
- Truncate to configurable length (default 500 chars)
- Break at sentence boundary if possible
- Store original word count

---

## Epic 27: Context-Aware Analysis

**Priority:** P1 (Intelligence)
**Goal:** Implement prompt classification and context-aware scoring

### Why Fourth?
With data flowing and stored, we can now analyze with full context.

### Stories

#### Story 27-1: Prompt Classification Service
Implement heuristic + LLM classification.

**Types:** initiating, continuation, selection, correction, confirmation, clarification
**Scoring Weights:** selection/confirmation = 0 (skip scoring)

---

#### Story 27-2: Heuristic Classification
Fast pattern matching for common cases.

**Patterns:**
- Selection: matches option pattern, short
- Confirmation: "yes", "proceed", "go ahead", etc.
- Correction: "no,", "instead", "actually"
- First message: initiating

---

#### Story 27-3: Context Building for Analysis
Build conversation context for LLM analysis.

**Context Includes:**
- Recent messages (within token budget)
- Last response summary
- Detected options from last response
- Session metadata (stage, loop status)

---

#### Story 27-4: Context-Aware Scoring
Update analysis to use conversation context.

**Changes:**
- Pass context to analysis LLM
- Adjust expectations based on prompt_type
- Skip scoring for selection/confirmation

---

#### Story 27-5: Update Analysis Pipeline
Integrate classification into existing pipeline.

**Flow:**
1. Prompt captured → classify prompt type
2. If scoringWeight = 0 → mark as 'skipped', no analysis
3. If scoringWeight > 0 → build context → analyze with context

---

#### Story 27-6: Conversation Score Aggregation
Calculate aggregate scores excluding skipped prompts.

**Logic:**
- Query prompts WHERE prompt_type NOT IN ('selection', 'confirmation')
- Calculate weighted average
- Update session.conversation_score

---

## Epic 28: Project Mapping (Deferred)

**Priority:** P2
**Status:** Deferred - not needed for initial E2E testing

### Overview
Map Claude Code project paths to Contextor projects for automatic association.

### Stories (To Be Written)
- 28-1: Project Mappings Table
- 28-2: Auto-Match Logic
- 28-3: Mapping Confirmation UI
- 28-4: Apply Mappings on Capture

---

## Epic 29: Team Analytics (Deferred)

**Priority:** P2
**Status:** Deferred - not needed for initial E2E testing

### Overview
Team-level conversation analytics and mentorship features.

### Stories (To Be Written)
- 29-1: Team Conversation Dashboard
- 29-2: Stage Distribution Analytics
- 29-3: Debugging Loop Alerts
- 29-4: Team Comparison Metrics

---

## Implementation Notes

### Design System Mandate
All UI components MUST use the established design system. See `_bmad-output/DESIGN-SYSTEM-MANDATE.md`.

### Two-Hook Architecture
```
Stop hook → /api/responses/capture → Store response
UserPromptSubmit → /api/prompts/capture → Store prompt → Trigger analysis
Analysis → Query DB for context → Classify → Score (if applicable)
```

### Key Files
| Component | Location |
|-----------|----------|
| Stop hook script | `.claude/hooks/contextor-response.sh` |
| Prompt hook script | `.claude/hooks/contextor-capture.sh` |
| Response capture API | `app/api/responses/capture/route.ts` |
| Conversations API | `app/api/conversations/route.ts` |
| Classification service | `lib/analysis/promptClassifier.ts` |
| Context builder | `lib/analysis/conversationContext.ts` |

---

## Dependencies

```
Epic 24 (Schema)
    ↓
Epic 25 (API) ←──┬── Epic 26 (Capture)
    ↓            │
    └────────────┴─→ Epic 27 (Analysis)
```

Epic 24 must complete first. Epics 25 and 26 can run in parallel. Epic 27 depends on both.
