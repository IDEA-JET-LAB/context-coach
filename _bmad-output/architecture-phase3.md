# Phase 3 Architecture: Conversation Intelligence Platform

**Version:** 1.0
**Date:** 2025-12-25
**Status:** Draft
**Author:** Winston (Architect Agent)

---

## Table of Contents

- [Executive Summary](#executive-summary) (Line 20)
- [Architecture Principles](#architecture-principles) (Line 45)
- [Current State Analysis](#current-state-analysis) (Line 70)
  - [Existing Database Schema](#existing-database-schema) (Line 75)
  - [Existing Services](#existing-services) (Line 150)
  - [Existing VS Code Extension](#existing-vs-code-extension) (Line 180)
- [Phase 3 Schema Extensions](#phase-3-schema-extensions) (Line 220)
  - [Sessions Table Extensions](#sessions-table-extensions) (Line 225)
  - [Prompts Table Extensions](#prompts-table-extensions) (Line 280)
  - [Prompt Responses Extensions](#prompt-responses-extensions) (Line 320)
  - [Project Mappings Table (New)](#project-mappings-table-new) (Line 360)
  - [Migration Strategy](#migration-strategy) (Line 420)
- [Context-Aware Analysis Engine](#context-aware-analysis-engine) (Line 470)
  - [Prompt Classification System](#prompt-classification-system) (Line 475)
  - [Conversation Context Retrieval](#conversation-context-retrieval) (Line 540)
  - [Debugging Loop Detection](#debugging-loop-detection) (Line 600)
  - [Project Stage Detection](#project-stage-detection) (Line 680)
- [Enhanced Capture Pipeline](#enhanced-capture-pipeline) (Line 740)
  - [Response Completion Detection](#response-completion-detection) (Line 745)
  - [Thinking Summary Compression](#thinking-summary-compression) (Line 800)
  - [Capture Flow Architecture](#capture-flow-architecture) (Line 850)
- [API Extensions](#api-extensions) (Line 920)
- [VS Code Extension Enhancements](#vs-code-extension-enhancements) (Line 1020)
- [Data Flow Diagrams](#data-flow-diagrams) (Line 1100)
- [Performance Considerations](#performance-considerations) (Line 1180)
- [Security Considerations](#security-considerations) (Line 1240)
- [Implementation Roadmap](#implementation-roadmap) (Line 1280)

---

## Executive Summary

Phase 3 transforms Contextor from prompt-level analysis to **conversation-centric context engineering coaching**. This architecture document defines how we extend the existing implementation to support:

1. **Context-Aware Analysis** — Evaluate prompts within conversation context, not in isolation
2. **Prompt Classification** — Categorize prompts (initiating, continuation, selection, correction)
3. **Pattern Detection** — Identify debugging loops, project stages, effort distribution
4. **Rich Capture** — Full responses, thinking summaries, tool metadata
5. **Chat-Like UI** — Navigate by conversation, not prompt list

### Critical Architectural Decision

**The PRD proposed creating a new `conversations` table. This is UNNECESSARY.**

The existing `sessions` table already serves as "conversations":
- 1:1 mapping with Claude Code's `sessionId`
- Already has `user_id`, `team_id`, `project_id`
- Already has metadata: `git_branch`, `cwd`, `claude_code_version`, `slug`
- Already has timing: `started_at`, `ended_at`
- Already has aggregates: `total_prompts`, `total_tokens`

**We extend `sessions` with additional columns rather than creating a redundant table.**

---

## Architecture Principles

### 1. Build on Existing Schema

Phase 2 established a solid foundation. Phase 3 extends it:
- Add columns to existing tables vs. creating redundant structures
- Maintain backward compatibility with Phase 2 features
- Use migrations that preserve existing data

### 2. Minimize Breaking Changes

- All new columns are nullable or have defaults
- New RLS policies extend, not replace, existing ones
- API endpoints add new fields without removing old ones

### 3. Progressive Enhancement

- Features degrade gracefully for data without new fields
- Historical prompts work in new UI (just without enhanced metadata)
- Import can backfill enhanced metadata over time

### 4. Performance by Design

- Denormalize for read performance where appropriate
- Use triggers for aggregate updates vs. N+1 queries
- Index new columns used in WHERE/ORDER BY clauses

---

## Current State Analysis

### Existing Database Schema

**Key Tables and Their Roles:**

| Table | Purpose | Rows (Est.) |
|-------|---------|-------------|
| `sessions` | Groups prompts by Claude Code session | 1,000+ |
| `prompts` | Individual user prompts | 10,000+ |
| `prompt_responses` | Encrypted LLM responses | 5,000+ |
| `tool_executions` | Tool usage per response | 20,000+ |
| `prompt_analyses` | 5-dimension scoring | 5,000+ |
| `historical_imports` | Import tracking/rollback | 100+ |

**sessions table (current):**

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,         -- Claude Code's sessionId
  user_id UUID NOT NULL,
  team_id UUID NOT NULL,
  project_id UUID,                          -- Already supports project linking
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  end_reason TEXT,                          -- 'completed', 'abandoned', 'interrupted'
  git_branch TEXT,
  claude_code_version TEXT,
  slug TEXT,                                -- Human-readable name
  cwd TEXT,                                 -- Working directory
  total_prompts INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**prompts table (current extensions):**

```sql
-- Session linking
session_uuid UUID REFERENCES sessions(id),
sequence_number INTEGER,
parent_prompt_id UUID REFERENCES prompts(id),

-- Token tracking
model TEXT,
input_tokens INTEGER,
output_tokens INTEGER,
has_thinking BOOLEAN DEFAULT FALSE,

-- Import tracking
fingerprint TEXT UNIQUE,
import_id UUID REFERENCES historical_imports(id)
```

**prompt_responses table (current):**

```sql
CREATE TABLE prompt_responses (
  id UUID PRIMARY KEY,
  prompt_id UUID NOT NULL REFERENCES prompts(id),
  response_text_encrypted BYTEA,            -- AES-256 encrypted
  tool_count INTEGER DEFAULT 0,
  tools_used TEXT[] DEFAULT '{}',
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  has_thinking BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**tool_executions table (current):**

```sql
CREATE TABLE tool_executions (
  id UUID PRIMARY KEY,
  response_id UUID NOT NULL REFERENCES prompt_responses(id),
  tool_name TEXT NOT NULL,
  tool_id TEXT,                              -- Claude's toolu_01... ID
  input_summary TEXT NOT NULL,
  input_full JSONB,
  output_summary TEXT,
  result_matched BOOLEAN DEFAULT FALSE,
  success BOOLEAN,
  execution_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Existing Services

**Backend Services (app/lib/):**

| Service | Purpose |
|---------|---------|
| `lib/sessions/` | Session CRUD, threading, duration analytics |
| `lib/transcript/` | JSONL parsing, user/assistant extraction |
| `lib/import/` | Batch import, fingerprinting, deduplication |
| `lib/analytics/` | 11 dimension analytics, team intelligence |

**API Endpoints (47 total):**

Key endpoints for Phase 3 extension:
- `POST /api/prompts/capture` — Main capture endpoint
- `GET /api/sessions` — List sessions with filters
- `GET /api/sessions/[sessionId]/thread` — Threaded conversation
- `POST /api/import/batch` — Historical import

### Existing VS Code Extension

**Architecture Pattern:**

```
Extension Host
├── AuthService (singleton)
├── SettingsService (singleton)
├── ImportService
├── CrashDetector
└── AnalyticsPanel (webview)
    └── React App
        ├── Dashboard.tsx
        ├── ScoreCard.tsx
        ├── DimensionList.tsx
        └── ImportPanel.tsx
```

**Webview Message Protocol:**

```typescript
// Extension → Webview
type ExtensionMessage =
  | { type: 'init'; data: { user, settings } }
  | { type: 'analytics:data'; data: AnalyticsData }
  | { type: 'import:progress'; data: ImportProgress };

// Webview → Extension
type WebviewMessage =
  | { type: 'refresh' }
  | { type: 'import:start'; sessionIds: string[] }
  | { type: 'settings:update'; settings: Settings };
```

**Current Tabs:**
1. Analytics — Score cards, dimension breakdown
2. Last Prompt — Most recent prompt details
3. Sessions — Session list and import
4. Import — Import panel

---

## Phase 3 Schema Extensions

### Sessions Table Extensions

**New Columns for `sessions`:**

```sql
-- Add Phase 3 columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  primary_stage VARCHAR(50);
-- 'architecture', 'specification', 'development', 'debugging', 'enhancement'

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  has_debugging_loop BOOLEAN DEFAULT FALSE;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  user_message_count INTEGER DEFAULT 0;
-- Prompts from user (not tool results)

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  conversation_score DECIMAL(5,2);
-- Aggregate of prompt scores (excluding selection/confirmation)

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  stage_breakdown JSONB;
-- {"architecture": 3, "development": 15, "debugging": 7}

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_sessions_stage
  ON sessions(primary_stage)
  WHERE primary_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_debugging_loop
  ON sessions(has_debugging_loop)
  WHERE has_debugging_loop = TRUE;
```

**Updated Aggregation Trigger:**

```sql
CREATE OR REPLACE FUNCTION update_session_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sessions SET
    total_prompts = total_prompts + 1,
    user_message_count = CASE
      WHEN NEW.prompt_type IS NOT NULL
       AND NEW.prompt_type != 'tool_result'
      THEN user_message_count + 1
      ELSE user_message_count
    END,
    ended_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.session_uuid;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Prompts Table Extensions

**New Columns for `prompts`:**

```sql
-- Prompt type classification
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS
  prompt_type VARCHAR(50);
-- 'initiating', 'continuation', 'selection', 'correction',
-- 'confirmation', 'clarification', 'tool_result'

ALTER TABLE prompts ADD COLUMN IF NOT EXISTS
  message_uuid VARCHAR(100);
-- Claude Code's message UUID for threading lookup

ALTER TABLE prompts ADD COLUMN IF NOT EXISTS
  parent_message_uuid VARCHAR(100);
-- Claude Code's parent UUID (supplements parent_prompt_id)

ALTER TABLE prompts ADD COLUMN IF NOT EXISTS
  is_in_debugging_loop BOOLEAN DEFAULT FALSE;
-- Flag for prompts detected as part of a loop

ALTER TABLE prompts ADD COLUMN IF NOT EXISTS
  detected_stage VARCHAR(50);
-- Stage detected for this specific prompt

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompts_type
  ON prompts(prompt_type)
  WHERE prompt_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompts_message_uuid
  ON prompts(message_uuid)
  WHERE message_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompts_parent_message
  ON prompts(parent_message_uuid)
  WHERE parent_message_uuid IS NOT NULL;
```

### Prompt Responses Extensions

**New Columns for `prompt_responses`:**

```sql
-- Thinking summary (compressed)
ALTER TABLE prompt_responses ADD COLUMN IF NOT EXISTS
  thinking_summary TEXT;
-- First N characters of extended thinking (configurable)

ALTER TABLE prompt_responses ADD COLUMN IF NOT EXISTS
  thinking_word_count INTEGER;
-- Original thinking word count before compression

ALTER TABLE prompt_responses ADD COLUMN IF NOT EXISTS
  stop_reason VARCHAR(50);
-- 'end_turn', 'max_tokens', 'tool_use', etc.

ALTER TABLE prompt_responses ADD COLUMN IF NOT EXISTS
  cache_stats JSONB;
-- {"creation": 9364, "read": 39481, "tier": "standard"}
```

### Project Mappings Table (New)

**This is the only new table required:**

```sql
CREATE TABLE project_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Claude Code project identification
  claude_project_path TEXT NOT NULL,
  normalized_path TEXT NOT NULL,
  -- Normalized for matching: lowercase, path separators standardized

  -- Matching metadata
  match_confidence DECIMAL(3,2),
  -- 0.00-1.00 confidence score
  match_method VARCHAR(50),
  -- 'exact_path', 'suffix_match', 'name_similarity', 'user_selected'
  user_confirmed BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  UNIQUE(team_id, claude_project_path)
);

-- Indexes
CREATE INDEX idx_project_mappings_team
  ON project_mappings(team_id);

CREATE INDEX idx_project_mappings_project
  ON project_mappings(project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX idx_project_mappings_normalized
  ON project_mappings(team_id, normalized_path);

-- RLS
ALTER TABLE project_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view mappings"
  ON project_mappings FOR SELECT USING (
    team_id IN (SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Team admins can manage mappings"
  ON project_mappings FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = project_mappings.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );
```

### Migration Strategy

**Migration 1: Sessions Extensions (Phase 3)**

```sql
-- 20251225100000_sessions_phase3_extensions.sql

-- Add new columns (all nullable or with defaults)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS primary_stage VARCHAR(50),
  ADD COLUMN IF NOT EXISTS has_debugging_loop BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_message_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversation_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS stage_breakdown JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_stage ON sessions(primary_stage)
  WHERE primary_stage IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_debugging_loop ON sessions(has_debugging_loop)
  WHERE has_debugging_loop = TRUE;

-- Backfill user_message_count from existing data
UPDATE sessions s SET user_message_count = (
  SELECT COUNT(*) FROM prompts p
  WHERE p.session_uuid = s.id
  AND p.prompt_type IS NULL  -- Legacy prompts assumed to be user messages
);
```

**Migration 2: Prompts Extensions**

```sql
-- 20251225110000_prompts_phase3_extensions.sql

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS prompt_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS message_uuid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS parent_message_uuid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_in_debugging_loop BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS detected_stage VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_prompts_type ON prompts(prompt_type)
  WHERE prompt_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prompts_message_uuid ON prompts(message_uuid)
  WHERE message_uuid IS NOT NULL;
```

**Migration 3: Prompt Responses Extensions**

```sql
-- 20251225120000_responses_phase3_extensions.sql

ALTER TABLE prompt_responses
  ADD COLUMN IF NOT EXISTS thinking_summary TEXT,
  ADD COLUMN IF NOT EXISTS thinking_word_count INTEGER,
  ADD COLUMN IF NOT EXISTS stop_reason VARCHAR(50),
  ADD COLUMN IF NOT EXISTS cache_stats JSONB;
```

**Migration 4: Project Mappings Table**

```sql
-- 20251225130000_create_project_mappings.sql
-- (Full CREATE TABLE as shown above)
```

---

## Context-Aware Analysis Engine

### Prompt Classification System

**Classification Categories:**

| Type | Description | Scoring Weight | Detection Heuristics |
|------|-------------|----------------|---------------------|
| `initiating` | Starts new task/topic | 100% | First in session, or topic change detected |
| `continuation` | Provides requested info | 70% | Follows LLM question, provides data |
| `selection` | Chooses from options | 0% (skip) | Short, matches option pattern |
| `correction` | Redirects LLM | 80% | Contains negation, "instead", "actually" |
| `confirmation` | Approves to proceed | 0% (skip) | "yes", "proceed", "go ahead" |
| `clarification` | Asks for explanation | 60% | Question format, "explain", "why" |

**Classification Service:**

```typescript
// lib/analysis/promptClassifier.ts

interface ClassificationResult {
  promptType: PromptType;
  confidence: number;
  scoringWeight: number;
  reasoning?: string;
}

export async function classifyPrompt(
  prompt: string,
  conversationContext: ConversationContext
): Promise<ClassificationResult> {
  // 1. Try heuristic classification first (fast, cheap)
  const heuristicResult = classifyByHeuristics(prompt, conversationContext);
  if (heuristicResult.confidence > 0.9) {
    return heuristicResult;
  }

  // 2. Fall back to LLM classification
  return classifyByLLM(prompt, conversationContext);
}

function classifyByHeuristics(
  prompt: string,
  context: ConversationContext
): ClassificationResult {
  const normalized = prompt.toLowerCase().trim();

  // Selection patterns
  if (isSelectionPattern(normalized, context.lastResponseOptions)) {
    return { promptType: 'selection', confidence: 0.95, scoringWeight: 0 };
  }

  // Confirmation patterns
  if (CONFIRMATION_PATTERNS.some(p => normalized.match(p))) {
    return { promptType: 'confirmation', confidence: 0.9, scoringWeight: 0 };
  }

  // Correction patterns
  if (CORRECTION_INDICATORS.some(i => normalized.includes(i))) {
    return { promptType: 'correction', confidence: 0.8, scoringWeight: 0.8 };
  }

  // First prompt in session
  if (context.messageIndex === 0) {
    return { promptType: 'initiating', confidence: 0.95, scoringWeight: 1.0 };
  }

  // Default to continuation
  return { promptType: 'continuation', confidence: 0.6, scoringWeight: 0.7 };
}

const CONFIRMATION_PATTERNS = [
  /^(yes|y|ok|okay|sure|proceed|go ahead|do it|sounds good)\.?$/i,
  /^(please|plz)?\s*(continue|go|start)\.?$/i
];

const CORRECTION_INDICATORS = [
  "no,", "not that", "instead", "actually", "wrong", "that's not"
];
```

### Conversation Context Retrieval

**Context Building for Analysis:**

```typescript
// lib/analysis/conversationContext.ts

interface ConversationContext {
  sessionId: string;
  messageIndex: number;
  messages: ConversationMessage[];
  lastResponse?: ResponseSummary;
  lastResponseOptions?: string[];
  tokenBudget: number;
  totalTokens: number;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  promptType?: PromptType;
  truncated: boolean;
  tokenCount: number;
}

export async function buildConversationContext(
  promptId: string,
  options: ContextOptions = {}
): Promise<ConversationContext> {
  const {
    maxMessages = 50,
    tokenBudget = 10000,
    includeResponses = true
  } = options;

  // 1. Get the prompt's session
  const prompt = await getPromptWithSession(promptId);
  const sessionId = prompt.session_uuid;

  // 2. Get preceding messages in session
  const precedingPrompts = await getPrecedingPrompts(sessionId, prompt.sequence_number);

  // 3. Build context with token budget
  const messages: ConversationMessage[] = [];
  let totalTokens = 0;

  for (const p of precedingPrompts.slice(-maxMessages)) {
    const userMessage = buildUserMessage(p);
    totalTokens += userMessage.tokenCount;

    if (totalTokens > tokenBudget) {
      userMessage.truncated = true;
      messages.push(userMessage);
      break;
    }

    messages.push(userMessage);

    if (includeResponses && p.response) {
      const assistantMessage = buildAssistantMessage(p.response);
      totalTokens += assistantMessage.tokenCount;
      messages.push(assistantMessage);
    }
  }

  return {
    sessionId,
    messageIndex: prompt.sequence_number - 1,
    messages,
    lastResponse: precedingPrompts.at(-1)?.response
      ? summarizeResponse(precedingPrompts.at(-1).response)
      : undefined,
    lastResponseOptions: extractOptionsFromResponse(precedingPrompts.at(-1)?.response),
    tokenBudget,
    totalTokens
  };
}
```

### Debugging Loop Detection

**Detection Algorithm:**

```typescript
// lib/analysis/debuggingLoopDetector.ts

interface LoopDetectionResult {
  isInLoop: boolean;
  loopCount: number;
  similarPromptIds: string[];
  escapeRecommendation?: string;
}

const LOOP_THRESHOLD = 3;  // 3+ similar attempts = loop
const SIMILARITY_THRESHOLD = 0.8;

export async function detectDebuggingLoop(
  promptId: string,
  sessionId: string
): Promise<LoopDetectionResult> {
  // 1. Get recent prompts in session
  const recentPrompts = await getRecentPrompts(sessionId, 20);

  // 2. Get the current prompt
  const currentPrompt = recentPrompts.find(p => p.id === promptId);
  if (!currentPrompt) {
    return { isInLoop: false, loopCount: 0, similarPromptIds: [] };
  }

  // 3. Find similar prompts
  const similarPrompts = await findSimilarPrompts(
    currentPrompt.content,
    recentPrompts.filter(p => p.id !== promptId)
  );

  // 4. Check for loop pattern
  if (similarPrompts.length >= LOOP_THRESHOLD - 1) {
    // Also check for error→fix→error pattern
    const hasErrorPattern = await detectErrorFixErrorPattern(
      sessionId,
      similarPrompts.map(p => p.id).concat(promptId)
    );

    if (hasErrorPattern || similarPrompts.length >= LOOP_THRESHOLD) {
      return {
        isInLoop: true,
        loopCount: similarPrompts.length + 1,
        similarPromptIds: similarPrompts.map(p => p.id),
        escapeRecommendation: generateEscapeRecommendation(currentPrompt)
      };
    }
  }

  return { isInLoop: false, loopCount: 0, similarPromptIds: [] };
}

async function findSimilarPrompts(
  content: string,
  candidates: Prompt[]
): Promise<Prompt[]> {
  const similar: Prompt[] = [];

  for (const candidate of candidates) {
    const similarity = await computeSimilarity(content, candidate.content);
    if (similarity > SIMILARITY_THRESHOLD) {
      similar.push(candidate);
    }
  }

  return similar;
}

// Heuristic patterns for debugging loops
const DEBUGGING_INDICATORS = [
  /still (not|doesn't|won't|can't)/i,
  /same (error|issue|problem)/i,
  /again/i,
  /not (working|fixed)/i,
  /keeps? (happening|failing)/i
];

function generateEscapeRecommendation(prompt: Prompt): string {
  // Based on research from AI doom loops
  return `You appear to be in a debugging loop (${prompt.loopCount} similar attempts). Consider:
• Provide more architectural context about what you're building
• Start with a fresh conversation and clearer requirements
• Break the problem into smaller, isolated steps
• Describe the expected behavior vs. actual behavior`;
}
```

**Real-Time Alert (VS Code Extension):**

```typescript
// packages/vscode-extension/src/services/loopAlertService.ts

export class LoopAlertService {
  private dismissedSessions = new Set<string>();

  async checkAndAlert(sessionId: string, promptId: string): Promise<void> {
    if (this.dismissedSessions.has(sessionId)) {
      return;
    }

    const result = await this.api.detectLoop(sessionId, promptId);

    if (result.isInLoop) {
      const action = await vscode.window.showWarningMessage(
        `Debugging Loop Detected (${result.loopCount} similar attempts)`,
        'View Recommendations',
        "Don't Show Again"
      );

      if (action === 'View Recommendations') {
        this.showRecommendations(result.escapeRecommendation);
      } else if (action === "Don't Show Again") {
        this.dismissedSessions.add(sessionId);
      }
    }
  }
}
```

### Project Stage Detection

**Stage Classification:**

```typescript
// lib/analysis/stageDetector.ts

type ProjectStage =
  | 'architecture'
  | 'specification'
  | 'development'
  | 'debugging'
  | 'enhancement';

interface StageDetectionResult {
  stage: ProjectStage;
  confidence: number;
  indicators: string[];
}

const STAGE_INDICATORS: Record<ProjectStage, string[]> = {
  architecture: [
    'design', 'structure', 'pattern', 'approach', 'architecture',
    'database schema', 'api design', 'system', 'component'
  ],
  specification: [
    'requirements', 'should', 'feature', 'user story', 'acceptance',
    'criteria', 'business logic', 'workflow', 'use case'
  ],
  development: [
    'implement', 'create', 'add', 'build', 'write', 'generate',
    'function', 'class', 'component', 'endpoint', 'code'
  ],
  debugging: [
    'error', 'fix', 'bug', 'not working', 'issue', 'failing',
    'broken', 'crash', 'exception', 'undefined', 'null'
  ],
  enhancement: [
    'improve', 'refactor', 'optimize', 'better', 'clean up',
    'performance', 'simplify', 'modernize', 'upgrade'
  ]
};

export function detectStage(promptContent: string): StageDetectionResult {
  const normalized = promptContent.toLowerCase();
  const scores: Record<ProjectStage, number> = {
    architecture: 0,
    specification: 0,
    development: 0,
    debugging: 0,
    enhancement: 0
  };
  const foundIndicators: Record<ProjectStage, string[]> = {
    architecture: [],
    specification: [],
    development: [],
    debugging: [],
    enhancement: []
  };

  for (const [stage, indicators] of Object.entries(STAGE_INDICATORS)) {
    for (const indicator of indicators) {
      if (normalized.includes(indicator)) {
        scores[stage as ProjectStage]++;
        foundIndicators[stage as ProjectStage].push(indicator);
      }
    }
  }

  // Find highest scoring stage
  const maxScore = Math.max(...Object.values(scores));
  const detectedStage = Object.entries(scores)
    .find(([_, score]) => score === maxScore)?.[0] as ProjectStage;

  return {
    stage: detectedStage || 'development',
    confidence: maxScore > 0 ? Math.min(0.3 + maxScore * 0.15, 0.95) : 0.3,
    indicators: foundIndicators[detectedStage || 'development']
  };
}

// Aggregate session stage from individual prompts
export async function aggregateSessionStage(
  sessionId: string
): Promise<{ primaryStage: ProjectStage; breakdown: Record<ProjectStage, number> }> {
  const prompts = await getSessionPrompts(sessionId);
  const breakdown: Record<ProjectStage, number> = {
    architecture: 0,
    specification: 0,
    development: 0,
    debugging: 0,
    enhancement: 0
  };

  for (const prompt of prompts) {
    const stage = prompt.detected_stage || detectStage(prompt.content).stage;
    breakdown[stage]++;
  }

  const primaryStage = Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a)[0][0] as ProjectStage;

  return { primaryStage, breakdown };
}
```

---

## Enhanced Capture Pipeline

### Two-Hook Capture Architecture

**Claude Code provides native hooks for capture:**

| Hook | Fires When | Input Data | Purpose |
|------|------------|------------|---------|
| **Stop** | Claude finishes responding | `{transcript_path}` | Capture response |
| **UserPromptSubmit** | User submits prompt | `{session_id, prompt}` | Capture prompt |
| **SessionStart** | Session begins | `{session_id, source}` | Track session lifecycle |

**Key Insight:** The `Stop` hook fires when Claude completes a response, providing the transcript file path. This is a native Claude Code feature - no file watching or polling needed.

### Response Capture via Stop Hook

**Stop Hook Script (contextor-response.sh):**

```bash
#!/bin/bash
# Contextor Response Capture - Captures LLM responses via Stop hook

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

USER_CONFIG="${PROJECT_ROOT}/.contextor/.user"
SHARED_CONFIG="${PROJECT_ROOT}/.contextor/config.json"

# Exit silently if not configured
if [[ ! -f "${USER_CONFIG}" ]] || [[ ! -f "${SHARED_CONFIG}" ]]; then
  exit 0
fi

# Read hook input from stdin
HOOK_INPUT=$(cat)
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty')

if [[ -z "$TRANSCRIPT_PATH" ]] || [[ ! -f "$TRANSCRIPT_PATH" ]]; then
  exit 0
fi

# Read config
API_KEY=$(jq -r '.api_key // empty' "${USER_CONFIG}")
API_ENDPOINT=$(jq -r '.api_endpoint // empty' "${SHARED_CONFIG}")

# Extract session ID from transcript path (filename without .jsonl)
SESSION_ID=$(basename "$TRANSCRIPT_PATH" .jsonl)

# Find last assistant message in transcript
LAST_ASSISTANT=$(grep '"type":"assistant"' "$TRANSCRIPT_PATH" | tail -1)

if [[ -z "$LAST_ASSISTANT" ]]; then
  exit 0
fi

# Extract response data
RESPONSE_TEXT=$(echo "$LAST_ASSISTANT" | jq -r '
  [.message.content[]? | select(.type == "text") | .text] | join("\n")
')
THINKING_TEXT=$(echo "$LAST_ASSISTANT" | jq -r '
  [.message.content[]? | select(.type == "thinking") | .thinking] | join("\n")
')
TOOLS_USED=$(echo "$LAST_ASSISTANT" | jq -c '
  [.message.content[]? | select(.type == "tool_use") | {name, id}]
')
MODEL=$(echo "$LAST_ASSISTANT" | jq -r '.message.model // empty')
USAGE=$(echo "$LAST_ASSISTANT" | jq -c '.message.usage // {}')
STOP_REASON=$(echo "$LAST_ASSISTANT" | jq -r '.message.stop_reason // empty')
MESSAGE_UUID=$(echo "$LAST_ASSISTANT" | jq -r '.uuid // empty')

# Send to API in background
{
  curl -s --max-time 10 -X POST "${API_ENDPOINT}/responses/capture" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d "$(jq -n \
      --arg session_id "$SESSION_ID" \
      --arg message_uuid "$MESSAGE_UUID" \
      --arg response_text "$RESPONSE_TEXT" \
      --arg thinking_text "$THINKING_TEXT" \
      --argjson tools_used "$TOOLS_USED" \
      --arg model "$MODEL" \
      --argjson usage "$USAGE" \
      --arg stop_reason "$STOP_REASON" \
      '{
        session_id: $session_id,
        message_uuid: $message_uuid,
        response_text: $response_text,
        thinking_summary: ($thinking_text | .[0:500]),
        thinking_word_count: ($thinking_text | split(" ") | length),
        tools_used: $tools_used,
        model: $model,
        usage: $usage,
        stop_reason: $stop_reason,
        timestamp: (now | todate)
      }')"
} &

exit 0
```

### Prompt Capture via UserPromptSubmit Hook

**Existing hook (contextor-capture.sh) remains largely the same**, but now:
- Response data is NOT included (already captured by Stop hook)
- Analysis is triggered, which queries DB for conversation context

```bash
# Key change: No response data sent with prompt
# Backend triggers analysis which queries DB for full context
curl -s --max-time 10 -X POST "${API_ENDPOINT}/prompts/capture" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "$(jq -n \
    --arg session_id "$SESSION_ID" \
    --arg prompt "$PROMPT" \
    '{
      session_id: $session_id,
      prompt: $prompt,
      timestamp: (now | todate)
    }')"
```
```

### Thinking Summary Compression

**Compression Function:**

```typescript
// lib/analysis/thinkingCompressor.ts

interface ThinkingSummary {
  summary: string;
  originalWordCount: number;
  truncated: boolean;
}

export function compressThinking(
  thinkingContent: string,
  maxLength: number = 500
): ThinkingSummary {
  const originalWordCount = thinkingContent.split(/\s+/).length;

  if (thinkingContent.length <= maxLength) {
    return {
      summary: thinkingContent,
      originalWordCount,
      truncated: false
    };
  }

  // Try to break at sentence boundary
  const truncated = thinkingContent.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf('.');

  const summary = lastSentence > maxLength * 0.7
    ? truncated.substring(0, lastSentence + 1)
    : truncated.substring(0, truncated.lastIndexOf(' ')) + '...';

  return {
    summary,
    originalWordCount,
    truncated: true
  };
}
```

### Capture Flow Architecture

**Two-Hook Capture Sequence:**

The key insight is that responses are captured BEFORE the next prompt arrives. This means when analyzing a prompt, all previous conversation context is already in the database.

```
TURN N: Claude Responds
┌─────────────────────────────────────────────────────────────────────┐
│  Claude finishes │     Stop hook      │     Backend API            │
│  responding      │────►fires with ────►│     /responses/capture    │
│                  │     transcript_path │                            │
└─────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │  Store Response:    │
                                         │  - Text (encrypted) │
                                         │  - Thinking summary │
                                         │  - Tools used       │
                                         │  - Token usage      │
                                         │  - Model, stop_reason│
                                         └─────────────────────┘
                                                    │
                    (User reads response, thinks, types)
                                                    │
                                                    ▼
TURN N+1: User Submits Prompt
┌─────────────────────────────────────────────────────────────────────┐
│  User submits    │  UserPromptSubmit  │     Backend API            │
│  prompt          │────►hook fires ────►│     /prompts/capture      │
│                  │     with prompt     │                            │
└─────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │  Store Prompt       │
                                         │  Link to session    │
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │  Trigger Analysis   │
                                         │  (async)            │
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │  Query DB for full  │
                                         │  conversation context│
                                         │  (all previous msgs) │
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │  Analyze prompt     │
                                         │  IN CONTEXT         │
                                         └─────────────────────┘
```

**Response Capture Endpoint:**

```typescript
// app/api/responses/capture/route.ts (NEW)

interface ResponseCaptureRequest {
  session_id: string;
  message_uuid: string;
  response_text: string;
  thinking_summary?: string;
  thinking_word_count?: number;
  tools_used: Array<{ name: string; id: string }>;
  model: string;
  usage: TokenUsage;
  stop_reason: string;
  timestamp: string;
}

export async function POST(request: Request) {
  const body = await request.json();

  // 1. Upsert session (creates if new)
  const session = await upsertSession(body.session_id);

  // 2. Store response with encryption
  const response = await storeResponse({
    sessionUuid: session.id,
    messageUuid: body.message_uuid,
    responseText: body.response_text,  // Will be encrypted
    thinkingSummary: body.thinking_summary,
    thinkingWordCount: body.thinking_word_count,
    toolsUsed: body.tools_used,
    model: body.model,
    usage: body.usage,
    stopReason: body.stop_reason,
  });

  // 3. Update session aggregates
  await updateSessionStats(session.id);

  return NextResponse.json({ success: true, responseId: response.id });
}
```

**Prompt Capture Endpoint (Updated):**

```typescript
// app/api/prompts/capture/route.ts (simplified)

interface PromptCaptureRequest {
  session_id: string;
  prompt: string;
  timestamp: string;
  // Note: NO response data - it's already in DB from Stop hook
}

export async function POST(request: Request) {
  const body = await request.json();

  // 1. Get or create session
  const session = await upsertSession(body.session_id);

  // 2. Create prompt record
  const prompt = await createPrompt({
    sessionUuid: session.id,
    content: body.prompt,
    createdAt: body.timestamp,
  });

  // 3. Queue analysis (async) - will query DB for context
  await queueAnalysis(prompt.id, {
    classifyPrompt: true,
    detectStage: true,
    detectLoop: true,
    scoreWithContext: true,  // Analysis queries DB for all previous messages
  });

  return NextResponse.json({ success: true, promptId: prompt.id });
}
```

---

## API Extensions

**New Endpoints for Phase 3:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/responses/capture` | POST | **Capture response via Stop hook** |
| `/api/sessions/[id]/context` | GET | Get conversation context for analysis |
| `/api/sessions/[id]/stage` | GET | Get session stage classification |
| `/api/sessions/[id]/loops` | GET | Get debugging loop instances |
| `/api/analysis/classify` | POST | Classify a prompt |
| `/api/analysis/detect-loop` | POST | Detect debugging loop |
| `/api/project-mappings` | GET/POST | Manage project path mappings |
| `/api/project-mappings/match` | POST | Auto-match a Claude path |

**Extended Existing Endpoints:**

```typescript
// GET /api/sessions (extended response)
interface SessionsResponse {
  sessions: Array<{
    // Existing fields...

    // New Phase 3 fields
    primaryStage?: ProjectStage;
    hasDebuggingLoop: boolean;
    userMessageCount: number;
    conversationScore?: number;
    stageBreakdown?: Record<ProjectStage, number>;
  }>;
}

// GET /api/sessions/[id]/thread (extended response)
interface ThreadResponse {
  messages: Array<{
    // Existing fields...

    // New Phase 3 fields
    promptType?: PromptType;
    isInDebuggingLoop: boolean;
    detectedStage?: ProjectStage;
    thinkingSummary?: string;
    thinkingWordCount?: number;
  }>;

  // Conversation-level data
  primaryStage?: ProjectStage;
  hasDebuggingLoop: boolean;
  conversationScore?: number;
}
```

**Project Mapping Endpoints:**

```typescript
// POST /api/project-mappings/match
interface MatchRequest {
  claudeProjectPath: string;
  teamId: string;
}

interface MatchResponse {
  matched: boolean;
  projectId?: string;
  projectName?: string;
  confidence: number;
  method: 'exact_path' | 'suffix_match' | 'name_similarity';
  needsConfirmation: boolean;
  suggestions?: Array<{
    projectId: string;
    projectName: string;
    confidence: number;
  }>;
}

// POST /api/project-mappings
interface CreateMappingRequest {
  teamId: string;
  claudeProjectPath: string;
  projectId: string;
  userConfirmed: boolean;
}
```

---

## VS Code Extension Enhancements

**New Tab: Conversations**

```typescript
// packages/vscode-extension/webviews/analytics/src/components/ConversationsTab.tsx

interface ConversationsTabProps {
  sessions: Session[];
  selectedSession: Session | null;
  onSelectSession: (session: Session) => void;
}

export function ConversationsTab({ sessions, selectedSession, onSelectSession }: ConversationsTabProps) {
  return (
    <div className="conversations-tab">
      <div className="session-list">
        {sessions.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            selected={selectedSession?.id === session.id}
            onClick={() => onSelectSession(session)}
          />
        ))}
      </div>

      {selectedSession && (
        <div className="conversation-view">
          <ConversationHeader session={selectedSession} />
          <MessageThread sessionId={selectedSession.id} />
        </div>
      )}
    </div>
  );
}

function ConversationHeader({ session }: { session: Session }) {
  return (
    <div className="conversation-header">
      <div className="meta">
        <span className="project">{session.projectName || 'Unlinked'}</span>
        <span className="date">{formatDate(session.startedAt)}</span>
        <span className="duration">{formatDuration(session.duration)}</span>
      </div>

      <div className="badges">
        {session.primaryStage && (
          <Badge variant="stage">{session.primaryStage}</Badge>
        )}
        {session.hasDebuggingLoop && (
          <Badge variant="warning">Debugging Loop</Badge>
        )}
        {session.conversationScore && (
          <Badge variant="score">{session.conversationScore}/100</Badge>
        )}
      </div>
    </div>
  );
}
```

**Enhanced Message Protocol:**

```typescript
// packages/vscode-extension/src/types/messages.ts

// New message types
type ExtensionMessage =
  | { type: 'sessions:list'; data: Session[] }
  | { type: 'session:thread'; data: ThreadedMessage[] }
  | { type: 'loop:detected'; data: LoopDetectionResult }
  | { type: 'stage:updated'; data: { sessionId: string; stage: ProjectStage } };

type WebviewMessage =
  | { type: 'session:select'; sessionId: string }
  | { type: 'loop:dismiss'; sessionId: string }
  | { type: 'mapping:confirm'; mappingId: string; projectId: string };
```

**Real-time Debugging Loop Alert:**

```typescript
// packages/vscode-extension/src/extension.ts

export function activate(context: vscode.ExtensionContext) {
  // ... existing activation code ...

  // Subscribe to real-time loop detection
  const loopSubscription = supabase
    .channel('loop-alerts')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'prompts',
      filter: `is_in_debugging_loop=eq.true`
    }, (payload) => {
      const prompt = payload.new as Prompt;
      if (prompt.user_id === currentUser.id) {
        showLoopAlert(prompt);
      }
    })
    .subscribe();
}
```

---

## Data Flow Diagrams

### Two-Hook Capture Flow

The key insight: **Response is captured BEFORE the next prompt arrives.** This is the natural order of a conversation - Claude responds first, then user types their prompt in response.

```
CONVERSATION TURN N
===================

┌──────────────┐          ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│    User      │          │  Claude Code │          │   Stop       │          │   Backend    │
│              │          │              │          │   Hook       │          │              │
└──────┬───────┘          └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │                         │
       │                         │ [Claude responds...]    │                         │
       │◄────────────────────────┤                         │                         │
       │                         │                         │                         │
       │                         │ Response Complete       │                         │
       │                         ├────────────────────────►│                         │
       │                         │ {transcript_path}       │                         │
       │                         │                         │                         │
       │                         │                         │ POST /api/responses/capture
       │                         │                         ├────────────────────────►│
       │                         │                         │ {response, tools, etc.} │
       │                         │                         │                         │
       │                         │                         │                  ┌──────┴──────┐
       │                         │                         │                  │ Store:      │
       │                         │                         │                  │ • Response  │
       │                         │                         │                  │ • Thinking  │
       │                         │                         │                  │ • Tools     │
       │                         │                         │                  └─────────────┘

[User reads response, thinks, types...]

CONVERSATION TURN N+1
=====================

┌──────────────┐          ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│    User      │          │  Claude Code │          │UserPromptSubmit│        │   Backend    │
│              │          │              │          │   Hook       │          │              │
└──────┬───────┘          └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │                         │
       │ prompt                  │                         │                         │
       ├────────────────────────►│                         │                         │
       │                         │                         │                         │
       │                         │ UserPromptSubmit        │                         │
       │                         ├────────────────────────►│                         │
       │                         │ {session_id, prompt}    │                         │
       │                         │                         │                         │
       │                         │                         │ POST /api/prompts/capture
       │                         │                         ├────────────────────────►│
       │                         │                         │                         │
       │                         │                         │                  ┌──────┴──────┐
       │                         │                         │                  │ Store Prompt│
       │                         │                         │                  │ Link to     │
       │                         │                         │                  │ Session     │
       │                         │                         │                  └──────┬──────┘
       │                         │                         │                         │
       │                         │                         │                  ┌──────┴──────┐
       │                         │                         │                  │ Query DB    │
       │                         │                         │                  │ for context │
       │                         │                         │                  │ (prev msgs) │
       │                         │                         │                  └──────┬──────┘
       │                         │                         │                         │
       │                         │                         │                  ┌──────┴──────┐
       │                         │                         │                  │ Analyze     │
       │                         │                         │                  │ IN CONTEXT  │
       │                         │                         │                  └─────────────┘
```

**Key Points:**
- Stop hook fires when Claude finishes → Response stored immediately
- UserPromptSubmit fires when user types → Prompt stored, analysis triggered
- Analysis queries DB for full conversation context (all previous messages)
- No file watching or polling needed - native Claude Code hooks handle detection

### Analysis Pipeline Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Prompt     │────►│   Classify   │────►│   Detect     │────►│   Detect     │
│   Created    │     │   Type       │     │   Stage      │     │   Loop       │
└──────────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                                       │
                     ┌──────────────┐     ┌──────────────┐            │
                     │   Update     │◄────│   Score      │◄───────────┘
                     │   Session    │     │   w/Context  │
                     │   Aggregates │     │              │
                     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Alert if   │
                     │   Loop       │
                     │   Detected   │
                     └──────────────┘
```

---

## Performance Considerations

### Database Indexes

All new columns used in WHERE/ORDER BY/GROUP BY have indexes (see schema section).

### Query Optimization

**Conversation List Query:**

```sql
-- Efficient query for session list with new fields
SELECT
  s.*,
  p.name as project_name
FROM sessions s
LEFT JOIN projects p ON s.project_id = p.id
WHERE s.team_id = $1
  AND ($2::varchar IS NULL OR s.primary_stage = $2)
  AND ($3::boolean IS NULL OR s.has_debugging_loop = $3)
ORDER BY s.started_at DESC
LIMIT 50 OFFSET $4;
```

**Thread Query with Context:**

```sql
-- Efficient query for conversation thread
SELECT
  p.*,
  pr.thinking_summary,
  pr.stop_reason,
  array_agg(te.tool_name ORDER BY te.execution_order) as tools
FROM prompts p
LEFT JOIN prompt_responses pr ON pr.prompt_id = p.id
LEFT JOIN tool_executions te ON te.response_id = pr.id
WHERE p.session_uuid = $1
GROUP BY p.id, pr.id
ORDER BY p.sequence_number;
```

### Caching Strategy

- Session metadata cached in VS Code extension (5 minute TTL)
- Conversation context cached per analysis session
- Project mappings cached per team (invalidate on change)

---

## Security Considerations

### Response Encryption

All response text continues to use AES-256 encryption via existing `prompt_responses.response_text_encrypted` column.

### Thinking Summary Security

Thinking summaries may contain sensitive reasoning. They:
- Are stored in plain text (compressed, not encrypted)
- Follow same RLS policies as `prompt_responses`
- Can be disabled per-team via admin setting

### Project Mapping RLS

Project mappings table has team-scoped RLS:
- All team members can view mappings
- Only team admins can create/modify mappings

---

## Implementation Roadmap

### Phase 3a: Schema & Foundation (Epic 23)

1. Apply schema migrations (4 migrations)
2. Backfill user_message_count on existing sessions
3. Test all queries with new fields
4. Update RLS policies

### Phase 3b: Enhanced Capture (Epic 24)

1. Add response watcher to VS Code extension
2. Update capture endpoint with new fields
3. Implement thinking compression
4. Test end-to-end capture flow

### Phase 3c: Analysis Engine (Epic 26)

1. Implement prompt classifier
2. Implement stage detector
3. Implement debugging loop detector
4. Add context-aware scoring
5. Integrate with real-time alerts

### Phase 3d: UI (Epic 25)

1. Add Conversations tab to VS Code extension
2. Build conversation thread view
3. Add message metadata expansion
4. Implement stage and loop badges

### Phase 3e: Project Mapping (Epic 27)

1. Create project_mappings table
2. Implement auto-match algorithm
3. Build mapping UI in VS Code extension
4. Enhance import flow with mapping

### Phase 3f: Team Analytics (Epic 28)

1. Add team conversation visibility
2. Build aggregate metrics dashboard
3. Implement comparison views
4. Add mentorship insights

---

## Appendix A: Full Schema Summary

**Tables Modified:**
- `sessions` — +5 columns
- `prompts` — +5 columns
- `prompt_responses` — +4 columns

**Tables Created:**
- `project_mappings` — 1 new table

**Total New Columns:** 14
**New Tables:** 1
**Breaking Changes:** 0

---

## Appendix B: Environment Variables

No new environment variables required. All features use existing configuration.

---

## Appendix C: Dependencies

**Backend:**
- No new npm packages required

**VS Code Extension:**
- `chokidar` for file watching (already installed)
- No new dependencies required

---

*Document generated by Winston (Architect Agent)*
*Based on PRD Phase 3 and existing implementation analysis*
