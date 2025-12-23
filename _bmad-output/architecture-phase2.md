---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - '_bmad-output/prd.md'
  - '_bmad-output/architecture.md'
  - '_bmad-output/research/enhanced-prompt-analysis-brainstorm.md'
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2025-12-22'
project_name: 'contextor-phase2'
user_name: 'Edgars'
date: '2025-12-22'
---

# Phase 2 Architecture Decision Document

## Table of Contents

- [Overview](#overview) (Line 79)
- [Phase 2 Scope](#phase-2-scope) (Line 94)
  - [Epic Overview](#epic-overview) (Line 96)
  - [Epic Dependencies](#epic-dependencies) (Line 108)
- [Core Architectural Decisions](#core-architectural-decisions) (Line 139)
  - [Decision Summary](#decision-summary) (Line 141)
  - [Data Flow Architecture](#data-flow-architecture) (Line 152)
- [Privacy & Data Protection Architecture](#privacy--data-protection-architecture) (Line 201)
  - [5-Layer Privacy Model](#5-layer-privacy-model) (Line 203)
  - [Privacy Settings Schema](#privacy-settings-schema) (Line 357)
- [Transcript Mining Architecture](#transcript-mining-architecture) (Line 380)
  - [JSONL Format Specification](#jsonl-format-specification) (Line 382)
  - [Message Types](#message-types-8-total) (Line 394)
  - [User Message Schema](#user-message-schema) (Line 407)
  - [Assistant Message Schema](#assistant-message-schema) (Line 427)
  - [Parsing Implementation](#parsing-implementation) (Line 455)
  - [Prompt-Response Pairing](#prompt-response-pairing) (Line 524)
- [Session & Conversation Tracking](#session--conversation-tracking) (Line 604)
  - [Session Data Model](#session-data-model) (Line 606)
  - [Conversation Threading](#conversation-threading) (Line 641)
- [Historical Import System](#historical-import-system) (Line 675)
  - [Discovery Phase](#discovery-phase) (Line 677)
  - [Import Flow](#import-flow) (Line 746)
  - [Batch Processing](#batch-processing) (Line 773)
- [VS Code Extension Architecture](#vs-code-extension-architecture) (Line 813)
  - [Extension Structure](#extension-structure) (Line 815)
  - [Hybrid Local/Cloud Approach](#hybrid-localcloud-approach) (Line 848)
- [Crash Recovery System](#crash-recovery-system) (Line 892)
  - [Detection Algorithm](#detection-algorithm) (Line 894)
  - [Recovery Prompt Generation](#recovery-prompt-generation) (Line 957)
- [Pre-Submission Coaching](#pre-submission-coaching) (Line 988)
  - [Hook Blocking Flow](#hook-blocking-flow) (Line 990)
  - [Fast Heuristics Engine](#fast-heuristics-engine) (Line 1059)
- [Database Schema Extensions](#database-schema-extensions) (Line 1124)
- [API Extensions](#api-extensions) (Line 1246)
- [Implementation Patterns](#implementation-patterns) (Line 1288)
  - [Consistent Error Handling](#consistent-error-handling) (Line 1290)
  - [Privacy-First Data Access](#privacy-first-data-access) (Line 1319)
  - [Extension Communication Pattern](#extension-communication-pattern) (Line 1354)
- [Architecture Validation](#architecture-validation) (Line 1373)
  - [Coherence Check](#coherence-check-) (Line 1375)
  - [Requirements Coverage](#requirements-coverage-) (Line 1384)
  - [Implementation Readiness](#implementation-readiness-) (Line 1396)
- [Epic 21: Enhanced Analysis Framework](#epic-21-enhanced-analysis-framework) (Line 1408)
  - [Analysis Dimensions](#analysis-dimensions) (Line 1414)
  - [Classification Architecture](#classification-architecture) (Line 1423)
  - [Aggregation Pipeline](#aggregation-pipeline) (Line 1444)
- [Epic 22: Configurable Analysis Engine](#epic-22-configurable-analysis-engine) (Line 1464)
  - [Configuration Components](#configuration-components) (Line 1468)
  - [Version Control System](#version-control-system) (Line 1478)
  - [A/B Testing Framework](#ab-testing-framework) (Line 1497)
- [Security Architecture](#security-architecture) (Line 1531)
  - [Data Protection Layers](#data-protection-layers) (Line 1537)
  - [Multi-Tenant Isolation](#multi-tenant-isolation) (Line 1549)
  - [Audit Logging](#audit-logging) (Line 1571)
- [Architecture Completion Summary](#architecture-completion-summary) (Line 1592)

---

## Overview

This document extends the Phase 1 Architecture (`architecture.md`) with decisions for Phase 2: Enhanced Analysis Platform. Phase 1 established the foundation (auth, teams, projects, basic capture, analysis). Phase 2 adds:

- **Response Context Capture** - Full prompt+response pairs via transcript mining
- **Session Tracking** - Conversation grouping and multi-terminal awareness
- **Historical Import** - Day-one value from existing transcript history
- **VS Code Extension** - Distribution channel for analytics and coaching
- **Smart Crash Recovery** - AI-powered session resumption
- **Pre-Submission Coaching** - Real-time prompt improvement suggestions

**Guiding Principle:** Privacy-first design. All new data capture features are built on a robust privacy foundation.

---

## Phase 2 Scope

### Epic Overview

| Epic | Priority | Description |
|------|----------|-------------|
| **14.5: Privacy & Data Protection** | P0 | Foundation for trust - must be first |
| **15: Response Context Capture** | P0 | Transcript mining for prompt+response pairs |
| **16: Session Tracking** | P0 | Conversation grouping via session_id |
| **17: Historical Import** | P1 | Import 30 days of existing transcripts |
| **18: Crash Recovery** | P2 | Detect interrupted sessions, generate recovery |
| **19: VS Code Extension** | P1 | Analytics dashboard and coaching UI |
| **20: Pre-Submission Coaching** | P3 | Hook blocking with improvement suggestions |

### Epic Dependencies

```
                    ┌─────────────────────┐
                    │ Epic 14.5: Privacy  │
                    │ (MUST BE FIRST)     │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
    │ Epic 15:        │ │ Epic 16:    │ │ Epic 19:        │
    │ Response Context│ │ Sessions    │ │ VS Code Ext     │
    └────────┬────────┘ └──────┬──────┘ └────────┬────────┘
             │                 │                  │
             └────────┬────────┴──────────┬───────┘
                      ▼                   ▼
            ┌─────────────────┐  ┌─────────────────┐
            │ Epic 17:        │  │ Epic 18:        │
            │ Historical      │  │ Crash Recovery  │
            └─────────────────┘  └────────┬────────┘
                                          │
                                          ▼
                                ┌─────────────────┐
                                │ Epic 20:        │
                                │ Pre-Submission  │
                                └─────────────────┘
```

---

## Core Architectural Decisions

### Decision Summary

| Category | Decision | Rationale |
|----------|----------|-----------|
| **Data Source** | Transcript mining (not PostToolUse) | Full context, complete history |
| **Privacy Model** | 5-layer protection | Trust foundation |
| **Extension Type** | Hybrid local/cloud | Fast UX + AI analysis |
| **Coaching Trigger** | Hook blocking (exit 2) | Native Claude Code integration |
| **Storage Level** | User-selectable | Privacy choice |
| **Encryption** | Column-level via pgcrypto | Supabase native |

### Data Flow Architecture

**Phase 2 Enhanced Capture Flow:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER DEVELOPMENT                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CLAUDE CODE                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ UserPrompt    │  │ Stop          │  │ SessionStart/End      │   │
│  │ Submit Hook   │  │ Hook          │  │ Hooks                 │   │
│  └───────┬───────┘  └───────┬───────┘  └───────────┬───────────┘   │
└──────────┼──────────────────┼──────────────────────┼───────────────┘
           │                  │                      │
           ▼                  ▼                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     CONTEXTOR CAPTURE LAYER                          │
│                                                                      │
│  ┌──────────────────┐     ┌──────────────────┐                      │
│  │ Prompt Capture   │     │ Transcript       │                      │
│  │ (Immediate)      │     │ Mining           │                      │
│  └────────┬─────────┘     └────────┬─────────┘                      │
│           │                        │                                 │
│           ▼                        ▼                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    PRIVACY LAYER                              │   │
│  │  ┌─────────┐  ┌─────────────┐  ┌───────────────┐             │   │
│  │  │ Secret  │  │ File Path   │  │ User Custom   │             │   │
│  │  │ Redact  │  │ Anonymize   │  │ Patterns      │             │   │
│  │  └─────────┘  └─────────────┘  └───────────────┘             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        CONTEXTOR CLOUD                               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐   │
│  │ API Gateway    │  │ Storage        │  │ Analysis Engine      │   │
│  │ (Rate Limited) │  │ (Encrypted)    │  │ (Prompt + Response)  │   │
│  └────────────────┘  └────────────────┘  └──────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Privacy & Data Protection Architecture

### 5-Layer Privacy Model

#### Layer 1: Local Redaction (Before Upload)

All data redacted on user's machine BEFORE leaving local environment.

**File:** `lib/capture/redact-response.ts` (new)

```typescript
export function redactResponse(response: string, settings: PrivacySettings): RedactionResult {
  let result = response;
  const patterns: string[] = [];

  // Layer 1a: Existing secret patterns
  const secretResult = redactSecrets(result);
  result = secretResult.redactedText;
  patterns.push(...secretResult.redactedPatterns);

  // Layer 1b: Database connection strings
  result = result.replace(
    /(postgres|mysql|mongodb|redis):\/\/[^\s"']+/gi,
    '[REDACTED DB URL]'
  );

  // Layer 1c: File paths (if enabled)
  if (settings.redactFilePaths) {
    result = result.replace(
      /\/(?:Users|home|var|etc)\/[^\s"']+/g,
      '[REDACTED PATH]'
    );
  }

  // Layer 1d: Email addresses (if enabled)
  if (settings.redactEmails) {
    result = result.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      '[REDACTED EMAIL]'
    );
  }

  // Layer 1e: Custom user patterns
  for (const pattern of settings.customPatterns) {
    try {
      result = result.replace(new RegExp(pattern, 'g'), '[REDACTED CUSTOM]');
    } catch (e) {
      // Invalid regex, skip
    }
  }

  return { redactedText: result, redactedPatterns: patterns };
}
```

#### Layer 2: User Transparency

**First-run consent dialog:**

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Contextor Data Collection                                   │
│                                                                 │
│  To provide prompt analysis, we collect:                        │
│                                                                 │
│  ✓ Your prompts to Claude                                       │
│  ✓ Claude's responses (for context)                             │
│  ✓ Tool usage (which tools were called)                         │
│  ✓ Session timing (duration, frequency)                         │
│                                                                 │
│  We automatically redact:                                       │
│  • API keys, tokens, passwords                                  │
│  • SSH private keys                                             │
│  • Database credentials                                         │
│                                                                 │
│  [View Privacy Policy]  [Configure]  [I Understand]             │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:** `components/privacy/consent-dialog.tsx`

#### Layer 3: User Control

| Control | Implementation |
|---------|----------------|
| Opt-out projects | Exclude list in `.contextor/config.json` |
| Delete my data | One-click in dashboard settings |
| Export my data | Download all data as JSON |
| Pause capture | Temporarily disable without uninstall |
| Retention period | Choose: 30, 90, 365 days, or forever |

**Database table:** `privacy_preferences`

```sql
CREATE TABLE privacy_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  capture_level TEXT DEFAULT 'standard' CHECK (capture_level IN ('full', 'standard', 'minimal', 'local')),
  redact_file_paths BOOLEAN DEFAULT TRUE,
  redact_emails BOOLEAN DEFAULT TRUE,
  custom_patterns TEXT[] DEFAULT '{}',
  excluded_projects TEXT[] DEFAULT '{}',
  retention_days INTEGER DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Layer 4: Encryption at Rest

**Supabase pgcrypto implementation:**

```sql
-- Enable pgcrypto extension (already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key in Vault
SELECT vault.create_secret('contextor_encryption_key', 'your-secure-key-here');

-- Function to encrypt text
CREATE OR REPLACE FUNCTION encrypt_sensitive(plaintext TEXT)
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(
    plaintext,
    current_setting('app.encryption_key')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt text
CREATE OR REPLACE FUNCTION decrypt_sensitive(ciphertext BYTEA)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    ciphertext,
    current_setting('app.encryption_key')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Columns to encrypt:**
- `prompts.text`
- `prompt_responses.response_text`
- `tool_executions.tool_input`

#### Layer 5: Data Minimization

| Store | Discard |
|-------|---------|
| Prompt text (redacted) | Full tool input JSON |
| Response summary | Large file contents |
| Tool names called | Exact file paths (anonymize) |
| Analysis results | Raw tool output |
| Session metadata | Intermediate processing |

### Privacy Settings Schema

```typescript
interface PrivacySettings {
  captureLevel: 'full' | 'standard' | 'minimal' | 'local';
  redactFilePaths: boolean;
  redactEmails: boolean;
  customPatterns: string[];  // User-defined regex
  excludedProjects: string[];
  retentionDays: number;
}

// Privacy level descriptions
const PRIVACY_LEVELS = {
  full: 'Prompts + responses + analysis (for teams wanting full history)',
  standard: 'Prompts + analysis only (recommended)',
  minimal: 'Analysis results only (no raw text stored)',
  local: 'Everything stays on machine (no cloud sync)'
};
```

---

## Transcript Mining Architecture

### JSONL Format Specification

**File Location:**
```
~/.claude/projects/-{path-with-dashes}/[session-uuid].jsonl

Example:
~/.claude/projects/-Users-edgars-My-projects-DEV-context-coach/abc123.jsonl
```

**Path transformation:** `/Users/edgars/My-projects` → `-Users-edgars-My-projects`

### Message Types (8 Total)

| Type | Description | Frequency |
|------|-------------|-----------|
| `user` | User prompts & tool results | High |
| `assistant` | Claude's responses | High |
| `file-history-snapshot` | File state checkpoints | Medium |
| `summary` | Conversation summary | Once/file |
| `queue-operation` | Background task tracking | Low |
| `tool_use` | Tool invocation (nested) | High |
| `tool_result` | Tool output (nested) | High |
| `thinking` | Extended thinking (nested) | Medium |

### User Message Schema

```json
{
  "parentUuid": "uuid | null",
  "sessionId": "uuid",
  "type": "user",
  "uuid": "uuid",
  "timestamp": "2025-12-22T10:30:00.000Z",
  "cwd": "/Users/edgars/project",
  "gitBranch": "main",
  "version": "2.0.75",
  "slug": "conversation-name",
  "message": {
    "role": "user",
    "content": "string" | [{ "type": "tool_result", ... }]
  }
}
```

### Assistant Message Schema

```json
{
  "parentUuid": "uuid",
  "sessionId": "uuid",
  "type": "assistant",
  "uuid": "uuid",
  "timestamp": "2025-12-22T10:30:05.000Z",
  "requestId": "req_011...",
  "message": {
    "model": "claude-opus-4-5-20251101",
    "id": "msg_01...",
    "role": "assistant",
    "content": [
      { "type": "text", "text": "..." },
      { "type": "tool_use", "id": "toolu_01...", "name": "Edit", "input": {...} },
      { "type": "thinking", "thinking": "...", "signature": "..." }
    ],
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_read_input_tokens": 890
    }
  }
}
```

### Parsing Implementation

**File:** `lib/transcript/parser.ts`

```typescript
import * as readline from 'readline';
import * as fs from 'fs';

export interface TranscriptMessage {
  type: 'user' | 'assistant' | 'file-history-snapshot' | 'summary' | 'queue-operation';
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  message?: {
    role: string;
    content: string | ContentBlock[];
    model?: string;
    usage?: TokenUsage;
  };
  cwd?: string;
  gitBranch?: string;
  version?: string;
  slug?: string;
}

export async function parseTranscript(filePath: string): Promise<TranscriptMessage[]> {
  const messages: TranscriptMessage[] = [];

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const parsed = JSON.parse(line);
        messages.push(parsed);
      } catch (e) {
        // Skip malformed lines
        console.warn(`Skipping malformed line in ${filePath}`);
      }
    }
  }

  return messages;
}

export async function* streamParseTranscript(filePath: string): AsyncGenerator<TranscriptMessage> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        yield JSON.parse(line);
      } catch (e) {
        // Skip malformed lines
      }
    }
  }
}
```

### Prompt-Response Pairing

**File:** `lib/transcript/pairing.ts`

```typescript
export interface PromptResponsePair {
  prompt: {
    text: string;
    timestamp: string;
    uuid: string;
    sessionId: string;
    cwd?: string;
    gitBranch?: string;
  };
  response: {
    text: string;
    model: string;
    tokens: TokenUsage;
    timestamp: string;
    hasThinking: boolean;
    toolsUsed: string[];
  };
}

export function extractConversationPairs(messages: TranscriptMessage[]): PromptResponsePair[] {
  const pairs: PromptResponsePair[] = [];
  let currentPrompt: PromptResponsePair['prompt'] | null = null;

  for (const msg of messages) {
    // User message with string content (actual prompt, not tool result)
    if (msg.type === 'user' && typeof msg.message?.content === 'string') {
      currentPrompt = {
        text: msg.message.content,
        timestamp: msg.timestamp,
        uuid: msg.uuid,
        sessionId: msg.sessionId,
        cwd: msg.cwd,
        gitBranch: msg.gitBranch
      };
    }
    // Assistant message following a prompt
    else if (msg.type === 'assistant' && currentPrompt && Array.isArray(msg.message?.content)) {
      const content = msg.message.content;

      // Extract text response
      const responseText = content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('\n');

      // Extract tool names
      const toolsUsed = content
        .filter((c): c is { type: 'tool_use'; name: string } => c.type === 'tool_use')
        .map(c => c.name);

      // Check for thinking blocks
      const hasThinking = content.some(c => c.type === 'thinking');

      pairs.push({
        prompt: currentPrompt,
        response: {
          text: responseText,
          model: msg.message.model || 'unknown',
          tokens: msg.message.usage || { input_tokens: 0, output_tokens: 0 },
          timestamp: msg.timestamp,
          hasThinking,
          toolsUsed
        }
      });

      currentPrompt = null;
    }
  }

  return pairs;
}
```

---

## Session & Conversation Tracking

### Session Data Model

**File:** `lib/db/schema/sessions.ts`

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL UNIQUE,  -- Claude Code's session_id
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  end_reason TEXT,  -- 'clear', 'logout', 'crash', 'timeout'
  git_branch TEXT,
  claude_code_version TEXT,
  slug TEXT,  -- Human-readable conversation name
  cwd TEXT,
  total_prompts INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link prompts to sessions
ALTER TABLE prompts ADD COLUMN session_uuid UUID REFERENCES sessions(id) ON DELETE SET NULL;
ALTER TABLE prompts ADD COLUMN sequence_number INTEGER;
ALTER TABLE prompts ADD COLUMN parent_prompt_id UUID REFERENCES prompts(id);

-- Indexes
CREATE INDEX idx_sessions_user ON sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_team ON sessions(team_id, started_at DESC);
CREATE INDEX idx_prompts_session ON prompts(session_uuid, sequence_number);
```

### Conversation Threading

```typescript
export function buildConversationTree(messages: TranscriptMessage[]) {
  const byUuid = new Map<string, TranscriptMessage & { children: TranscriptMessage[] }>();

  // First pass: index all messages
  for (const msg of messages) {
    byUuid.set(msg.uuid, { ...msg, children: [] });
  }

  // Second pass: build tree
  const roots: Array<TranscriptMessage & { children: TranscriptMessage[] }> = [];

  for (const msg of byUuid.values()) {
    if (msg.parentUuid === null) {
      roots.push(msg);
    } else {
      const parent = byUuid.get(msg.parentUuid);
      if (parent) {
        parent.children.push(msg);
      } else {
        // Orphaned message, treat as root
        roots.push(msg);
      }
    }
  }

  return roots;
}
```

---

## Historical Import System

### Discovery Phase

**File:** `lib/import/discover.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface DiscoveredProject {
  path: string;
  normalizedPath: string;  // The -Users-edgars-... format
  sessionCount: number;
  totalPrompts: number;
  oldestSession: Date;
  newestSession: Date;
}

export async function discoverProjects(): Promise<DiscoveredProject[]> {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const projects: DiscoveredProject[] = [];

  try {
    const entries = await fs.readdir(claudeDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(claudeDir, entry.name);
        const sessions = await fs.readdir(projectPath);
        const jsonlFiles = sessions.filter(f => f.endsWith('.jsonl'));

        if (jsonlFiles.length > 0) {
          // Denormalize path for display
          const displayPath = entry.name.replace(/^-/, '/').replace(/-/g, '/');

          // Count prompts and find date range
          let totalPrompts = 0;
          let oldest = new Date();
          let newest = new Date(0);

          for (const session of jsonlFiles) {
            const stat = await fs.stat(path.join(projectPath, session));
            if (stat.mtime < oldest) oldest = stat.mtime;
            if (stat.mtime > newest) newest = stat.mtime;

            // Quick prompt count (count user message lines)
            const content = await fs.readFile(path.join(projectPath, session), 'utf-8');
            totalPrompts += (content.match(/"type":"user"/g) || []).length;
          }

          projects.push({
            path: displayPath,
            normalizedPath: entry.name,
            sessionCount: jsonlFiles.length,
            totalPrompts,
            oldestSession: oldest,
            newestSession: newest
          });
        }
      }
    }
  } catch (e) {
    // Claude directory might not exist
  }

  return projects;
}
```

### Import Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  🎉 Welcome to Contextor!                                       │
│                                                                 │
│  We detected 847 prompts from the last 30 days across           │
│  12 projects.                                                   │
│                                                                 │
│  Would you like to import and analyze your prompt history?      │
│  This provides immediate insights into your prompting patterns. │
│                                                                 │
│  [Import All]  [Select Projects]  [Skip for Now]                │
└─────────────────────────────────────────────────────────────────┘
```

**State machine:**

```typescript
type ImportState =
  | { phase: 'discovery'; projects?: DiscoveredProject[] }
  | { phase: 'selection'; selected: string[] }
  | { phase: 'importing'; progress: number; total: number }
  | { phase: 'complete'; imported: number; failed: number }
  | { phase: 'skipped' };
```

### Batch Processing

**File:** `lib/import/batch.ts`

```typescript
const BATCH_SIZE = 50;

export async function importProject(
  projectPath: string,
  onProgress: (count: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  const sessions = await listSessions(projectPath);
  let success = 0;
  let failed = 0;
  let processed = 0;

  for (const session of sessions) {
    try {
      const pairs = await extractPairsFromSession(session);

      // Process in batches
      for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
        const batch = pairs.slice(i, i + BATCH_SIZE);
        await uploadBatch(batch);
        success += batch.length;
      }
    } catch (e) {
      failed += 1;
    }

    processed += 1;
    onProgress(processed, sessions.length);
  }

  return { success, failed };
}
```

---

## VS Code Extension Architecture

### Extension Structure

```
packages/vscode-extension/
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts              # Main entry point
│   ├── commands/
│   │   ├── importHistory.ts      # Historical import command
│   │   ├── recoverSession.ts     # Crash recovery command
│   │   └── improveprompt.ts      # Pre-submission coaching
│   ├── providers/
│   │   ├── analyticsPanel.ts     # Webview for analytics
│   │   ├── sessionBrowser.ts     # Session tree view
│   │   └── suggestionPanel.ts    # Coaching suggestions
│   ├── services/
│   │   ├── api.ts                # Contextor API client
│   │   ├── transcripts.ts        # Local transcript reader
│   │   ├── crashDetector.ts      # Interrupted session detection
│   │   └── heuristics.ts         # Fast local analysis
│   ├── watchers/
│   │   ├── suggestionWatcher.ts  # Watch for suggestion file
│   │   └── transcriptWatcher.ts  # Watch for new transcripts
│   └── types/
│       └── index.ts
├── webviews/
│   ├── analytics/                # React app for analytics
│   └── coaching/                 # React app for coaching UI
└── test/
    └── suite/
```

### Hybrid Local/Cloud Approach

**Local Operations (Fast):**
- Crash detection (file watching)
- Transcript reading
- Fast heuristics for coaching
- Session browser

**Cloud Operations (AI-Powered):**
- Full analysis (prompt scoring)
- Pattern detection
- Team analytics
- Trend visualization

```typescript
// services/api.ts
export class ContextorAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string) {
    this.baseUrl = 'https://api.contextor.co';
    this.apiKey = apiKey;
  }

  async getAnalytics(teamId: string, timeRange: string): Promise<Analytics> {
    return this.fetch(`/analytics/${teamId}?range=${timeRange}`);
  }

  async submitForAnalysis(prompt: string, response: string): Promise<Analysis> {
    return this.fetch('/analyze', {
      method: 'POST',
      body: JSON.stringify({ prompt, response })
    });
  }

  async getRecoveryContext(sessionId: string): Promise<RecoveryContext> {
    return this.fetch(`/recovery/${sessionId}`);
  }
}
```

---

## Crash Recovery System

### Detection Algorithm

**File:** `services/crashDetector.ts`

```typescript
export interface InterruptedSession {
  sessionPath: string;
  sessionId: string;
  lastActivity: Date;
  lastPrompt: string;
  lastToolUsed: string | null;
  messageCount: number;
}

export async function detectInterruptedSessions(): Promise<InterruptedSession[]> {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const interrupted: InterruptedSession[] = [];
  const now = Date.now();
  const STALE_THRESHOLD = 15 * 60 * 1000; // 15 minutes

  for (const project of await fs.readdir(claudeDir)) {
    const projectPath = path.join(claudeDir, project);
    const sessions = await fs.readdir(projectPath);

    for (const sessionFile of sessions.filter(f => f.endsWith('.jsonl'))) {
      const sessionPath = path.join(projectPath, sessionFile);
      const stat = await fs.stat(sessionPath);
      const lastModified = stat.mtime.getTime();

      // Session is stale if modified recently but not ended properly
      if (now - lastModified > STALE_THRESHOLD && now - lastModified < 24 * 60 * 60 * 1000) {
        const messages = await parseTranscript(sessionPath);
        const hasEnd = messages.some(m =>
          m.type === 'summary' ||
          (m.message?.content && typeof m.message.content === 'string' &&
           m.message.content.includes('session ended'))
        );

        if (!hasEnd && messages.length > 0) {
          const lastUserMsg = [...messages].reverse().find(m =>
            m.type === 'user' && typeof m.message?.content === 'string'
          );
          const lastAssistantMsg = [...messages].reverse().find(m =>
            m.type === 'assistant'
          );

          interrupted.push({
            sessionPath,
            sessionId: sessionFile.replace('.jsonl', ''),
            lastActivity: stat.mtime,
            lastPrompt: lastUserMsg?.message?.content as string || '',
            lastToolUsed: extractLastTool(lastAssistantMsg),
            messageCount: messages.length
          });
        }
      }
    }
  }

  return interrupted;
}
```

### Recovery Prompt Generation

```typescript
export async function generateRecoveryPrompt(session: InterruptedSession): Promise<string> {
  // Use AI to summarize context
  const messages = await parseTranscript(session.sessionPath);
  const recentMessages = messages.slice(-20); // Last 20 messages

  const summary = await callContextorAI({
    task: 'summarize_session',
    messages: recentMessages.map(m => ({
      type: m.type,
      content: m.type === 'user'
        ? (typeof m.message?.content === 'string' ? m.message.content : '[tool result]')
        : extractAssistantText(m)
    }))
  });

  return `Continue from where we left off. Here's the context:

- We were working on: ${summary.task}
- Last action: ${summary.lastAction}
- Pending: ${summary.pending}
- My last request was: "${session.lastPrompt.slice(0, 100)}..."

Please continue.`;
}
```

---

## Pre-Submission Coaching

### Hook Blocking Flow

```
User types prompt → Presses Enter
              │
              ▼
┌─────────────────────────────────┐
│ UserPromptSubmit hook fires     │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ Hook calls local heuristics     │
│ (contextor-coach.sh)            │
└─────────────┬───────────────────┘
              │
    ┌─────────┴─────────┐
    │ Improvement       │
    │ suggested?        │
    └────────┬──────────┘
             │
   ┌─────────┼──────────┐
   ▼                    ▼
┌──────────┐      ┌───────────────┐
│ No       │      │ Yes           │
│ Exit 0   │      │ Write to file │
│ (proceed)│      │ Exit 2 (block)│
└──────────┘      │ stderr msg    │
                  └───────┬───────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ VS Code extension     │
              │ watches suggestion    │
              │ file, shows UI        │
              └───────────┬───────────┘
                          │
                ┌─────────┼─────────┐
                ▼                   ▼
          ┌───────────┐      ┌───────────┐
          │ Accept    │      │ Skip      │
          │ Copy to   │      │ Resubmit  │
          │ clipboard │      │ original  │
          └───────────┘      └───────────┘
```

**Hook script:** `.claude/hooks/contextor-coach.sh`

```bash
#!/bin/bash

# Extract prompt from stdin (JSON format)
PROMPT=$(cat | jq -r '.prompt // ""')

# Quick local analysis (< 100ms)
SUGGESTION=$(contextor-heuristics "$PROMPT")

if [ -n "$SUGGESTION" ]; then
  # Write suggestion for extension
  echo "$SUGGESTION" > ~/.contextor/suggestion.json

  # Block with message
  echo "💡 Contextor has a suggestion. See VS Code panel." >&2
  exit 2
fi

exit 0
```

### Fast Heuristics Engine

**File:** `lib/heuristics/fast-check.ts`

```typescript
export interface HeuristicResult {
  shouldSuggest: boolean;
  issues: HeuristicIssue[];
  suggestion?: string;
}

export interface HeuristicIssue {
  type: 'too_vague' | 'no_context' | 'missing_goal' | 'ambiguous' | 'too_long';
  severity: 'warning' | 'improvement';
  message: string;
}

const HEURISTICS: Array<(prompt: string) => HeuristicIssue | null> = [
  // Too short / vague
  (p) => p.length < 20 ? {
    type: 'too_vague',
    severity: 'warning',
    message: 'Prompt is very short. Consider adding more context.'
  } : null,

  // No question or action
  (p) => !p.match(/[?]|please|help|show|create|fix|add|update|remove/i) ? {
    type: 'missing_goal',
    severity: 'improvement',
    message: 'Prompt doesn\'t have a clear ask. What do you want Claude to do?'
  } : null,

  // All caps (shouting)
  (p) => p === p.toUpperCase() && p.length > 10 ? {
    type: 'ambiguous',
    severity: 'warning',
    message: 'All caps can be hard to parse. Consider normal case.'
  } : null,

  // Very long without structure
  (p) => p.length > 500 && !p.includes('\n') && !p.includes('-') && !p.includes('1.') ? {
    type: 'too_long',
    severity: 'improvement',
    message: 'Long prompt without structure. Consider using bullet points or numbered steps.'
  } : null,
];

export function runHeuristics(prompt: string): HeuristicResult {
  const issues: HeuristicIssue[] = [];

  for (const check of HEURISTICS) {
    const issue = check(prompt);
    if (issue) issues.push(issue);
  }

  return {
    shouldSuggest: issues.some(i => i.severity === 'warning'),
    issues,
    suggestion: issues.length > 0 ? generateSuggestion(prompt, issues) : undefined
  };
}
```

---

## Database Schema Extensions

**Migration:** `20251222300000_phase2_schema.sql`

```sql
-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  end_reason TEXT CHECK (end_reason IN ('clear', 'logout', 'crash', 'timeout', 'unknown')),
  git_branch TEXT,
  claude_code_version TEXT,
  slug TEXT,
  cwd TEXT,
  total_prompts INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt extensions
ALTER TABLE prompts ADD COLUMN session_uuid UUID REFERENCES sessions(id) ON DELETE SET NULL;
ALTER TABLE prompts ADD COLUMN sequence_number INTEGER;
ALTER TABLE prompts ADD COLUMN parent_prompt_id UUID REFERENCES prompts(id);
ALTER TABLE prompts ADD COLUMN model TEXT;
ALTER TABLE prompts ADD COLUMN input_tokens INTEGER;
ALTER TABLE prompts ADD COLUMN output_tokens INTEGER;
ALTER TABLE prompts ADD COLUMN has_thinking BOOLEAN DEFAULT FALSE;

-- Responses table
CREATE TABLE prompt_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  response_text_encrypted BYTEA,  -- Encrypted at rest
  tool_count INTEGER DEFAULT 0,
  tools_used TEXT[] DEFAULT '{}',
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  has_thinking BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Privacy preferences
CREATE TABLE privacy_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  capture_level TEXT DEFAULT 'standard' CHECK (capture_level IN ('full', 'standard', 'minimal', 'local')),
  redact_file_paths BOOLEAN DEFAULT TRUE,
  redact_emails BOOLEAN DEFAULT TRUE,
  custom_patterns TEXT[] DEFAULT '{}',
  excluded_projects TEXT[] DEFAULT '{}',
  retention_days INTEGER DEFAULT 90,
  consent_given_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Import tracking
CREATE TABLE historical_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_path TEXT NOT NULL,
  session_count INTEGER,
  prompt_count INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coaching improvements tracking
CREATE TABLE prompt_improvements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  suggested_text TEXT NOT NULL,
  issues JSONB NOT NULL,  -- Array of HeuristicIssue
  accepted BOOLEAN,
  final_text TEXT,  -- What user actually submitted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_improvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_team_access ON sessions
  FOR ALL USING (team_id = (current_setting('app.current_team_id')::uuid));

CREATE POLICY responses_via_prompts ON prompt_responses
  FOR ALL USING (EXISTS (
    SELECT 1 FROM prompts p WHERE p.id = prompt_id AND p.team_id = (current_setting('app.current_team_id')::uuid)
  ));

CREATE POLICY privacy_own ON privacy_preferences
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY imports_own ON historical_imports
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY improvements_own ON prompt_improvements
  FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_sessions_user_time ON sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_team_time ON sessions(team_id, started_at DESC);
CREATE INDEX idx_prompts_session ON prompts(session_uuid, sequence_number);
CREATE INDEX idx_responses_prompt ON prompt_responses(prompt_id);
CREATE INDEX idx_improvements_user ON prompt_improvements(user_id, created_at DESC);
```

---

## API Extensions

**New Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/prompts/batch` | POST | Batch upload prompt+response pairs |
| `/api/sessions` | GET | List sessions for team |
| `/api/sessions/[id]` | GET | Session details with prompts |
| `/api/import/discover` | POST | Receive discovery results from CLI |
| `/api/import/batch` | POST | Batch import historical data |
| `/api/recovery/[sessionId]` | GET | Get recovery context for session |
| `/api/privacy/preferences` | GET/PUT | Manage privacy settings |
| `/api/privacy/export` | GET | Export all user data |
| `/api/privacy/delete` | DELETE | Delete all user data |
| `/api/coaching/heuristics` | POST | Cloud heuristics check |
| `/api/coaching/improve` | POST | AI-powered improvement suggestion |

**Batch Upload Schema:**

```typescript
// POST /api/prompts/batch
interface BatchUploadRequest {
  pairs: Array<{
    prompt: {
      text: string;
      timestamp: string;
      session_id?: string;
    };
    response: {
      text: string;
      model: string;
      tokens: { input: number; output: number };
    };
  }>;
  source: 'live' | 'historical';
  project_id: string;
}
```

---

## Implementation Patterns

### Consistent Error Handling

```typescript
// All Phase 2 API routes follow this pattern
export async function POST(request: Request) {
  try {
    // Validate privacy settings first
    const privacy = await getPrivacyPreferences(userId);
    if (!privacy.consent_given_at) {
      return Response.json(
        { error: { code: 'CONSENT_REQUIRED', message: 'Privacy consent required' } },
        { status: 403 }
      );
    }

    // Proceed with operation
    const result = await processRequest(request, privacy);
    return Response.json({ data: result });

  } catch (error) {
    console.error('[API] endpoint: error', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An error occurred' } },
      { status: 500 }
    );
  }
}
```

### Privacy-First Data Access

```typescript
// Always check privacy level before returning data
export async function getPromptsWithResponses(
  teamId: string,
  userId: string
): Promise<PromptWithResponse[]> {
  const privacy = await getPrivacyPreferences(userId);

  const prompts = await db
    .from('prompts')
    .select(`
      *,
      prompt_responses (*)
    `)
    .eq('team_id', teamId);

  // Apply privacy level transformations
  return prompts.map(p => transformForPrivacy(p, privacy));
}

function transformForPrivacy(prompt: Prompt, privacy: PrivacyPreferences): PromptWithResponse {
  switch (privacy.capture_level) {
    case 'minimal':
      return { ...prompt, text: '[REDACTED]', response: null };
    case 'standard':
      return { ...prompt, response: null };
    case 'full':
    default:
      return prompt;
  }
}
```

### Extension Communication Pattern

```typescript
// VS Code extension watches for suggestion file
const watcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(os.homedir(), '.contextor/suggestion.json')
);

watcher.onDidChange(async (uri) => {
  const content = await vscode.workspace.fs.readFile(uri);
  const suggestion = JSON.parse(content.toString());

  // Show suggestion panel
  await vscode.commands.executeCommand('contextor.showSuggestion', suggestion);
});
```

---

## Architecture Validation

### Coherence Check ✅

| Decision | Compatible With |
|----------|-----------------|
| Transcript mining | Phase 1 hook system, existing capture |
| Privacy layers | Supabase RLS, existing redaction |
| VS Code extension | Claude Code extension, terminal workflow |
| Session tracking | Existing prompts table, team structure |

### Requirements Coverage ✅

| Epic | Stories | Architecture Support |
|------|---------|---------------------|
| 14.5 Privacy | 6 | 5-layer model, encryption, preferences |
| 15 Response | 4 | Transcript parser, pairing logic |
| 16 Sessions | 4 | Session table, threading, UI |
| 17 Import | 4 | Discovery, batch processing |
| 18 Recovery | 4 | Detection, AI summarization |
| 19 Extension | 4 | Structure, hybrid approach |
| 20 Coaching | 4 | Hook blocking, heuristics |

### Implementation Readiness ✅

- [x] All data models defined with SQL
- [x] API endpoints specified
- [x] File structures documented
- [x] Privacy model complete
- [x] Extension architecture defined
- [x] Parsing code provided
- [x] Integration patterns documented

---

## Epic 21: Enhanced Analysis Framework

> **Detailed Architecture:** See [`_bmad-output/architecture-epic21.md`](./architecture-epic21.md) for complete implementation details.

Epic 21 transforms Contextor's analysis from basic 3-dimension scoring to a comprehensive 25+ dimension framework based on research findings from 2,498 real Claude Code transcripts.

### Analysis Dimensions

| Category | Dimensions | Purpose |
|----------|-----------|---------|
| **Per-Prompt** | Work Style, Sentiment, Complexity, Timing | Classify each prompt instantly |
| **Per-Session** | Session Health, Context Usage, Flow Quality | Track session degradation |
| **Per-User** | Technical Profile, Collaboration Style, Tool Mastery | Build user personas |
| **Per-Team** | Style Distribution, Best Practices, Common Struggles | Team intelligence |

### Classification Architecture

**Regex-Based Classifiers (<5ms latency):**

```typescript
// Fast classification without LLM calls
export const WORK_STYLE_PATTERNS = {
  architecture: /\b(how should|what approach|design|architect|structure)\b/i,
  debugging: /\b(not working|error|fix|broken|fail|bug)\b/i,
  implementation: /\b(write|create|implement|add|build)\b/i,
  testing: /\b(test|spec|expect|assert|mock)\b/i,
};

export function classifyWorkStyle(promptText: string): WorkStyleCategory {
  for (const [category, pattern] of Object.entries(WORK_STYLE_PATTERNS)) {
    if (pattern.test(promptText)) return category as WorkStyleCategory;
  }
  return 'other';
}
```

### Aggregation Pipeline

**Daily/Weekly Cron Jobs via Supabase Edge Functions:**

```
Daily Aggregation (00:00 UTC)
├── Collect all prompts from previous day
├── Compute dimension averages per user
├── Compute dimension averages per team
├── Store in user_daily_analytics / team_daily_analytics
└── Trigger weekly rollup on Sundays
```

**Key Tables:**
- `user_daily_analytics` - Per-user daily dimension scores
- `team_daily_analytics` - Aggregated team metrics
- `prompt_classifications` - Cached classification results

---

## Epic 22: Configurable Analysis Engine

Epic 22 transforms hardcoded analysis logic into a database-driven, admin-configurable system with A/B testing capabilities.

### Configuration Components

| Component | Purpose | Scope |
|-----------|---------|-------|
| **Analysis Prompts** | LLM templates with `{{variables}}` | Global |
| **Classification Rules** | Regex patterns for categorization | Global |
| **Feedback Templates** | Score-based message templates | Global |
| **Scoring Weights** | Dimension importance (sum to 100%) | Global + Team Override |
| **Thresholds** | Warning/critical levels | Global + Team Override |

### Version Control System

```
┌─────────────────────────────────────────────────────┐
│                  CONFIG VERSIONS                     │
│                                                      │
│  v1 (archived)  →  v2 (active)  →  v3 (draft)      │
│       ↓               ↓               ↓             │
│  [Snapshot]       [Snapshot]      [Editable]        │
│                                                      │
│  Features:                                           │
│  • Complete config snapshots                         │
│  • One active version at a time                     │
│  • Draft preview against sample prompts             │
│  • One-click rollback to any version                │
│  • Full audit trail of all changes                  │
└─────────────────────────────────────────────────────┘
```

### A/B Testing Framework

**Experiment Lifecycle:**
```
DRAFT → ACTIVE → RUNNING → ANALYZING → COMPLETED
                    ↓
                 PAUSED
```

**Traffic Splitting:**
- Deterministic hash-based assignment (user_id + experiment_id)
- Sticky assignment (same user always gets same variant)
- Configurable split percentage (default 50/50)

**Statistical Significance:**
- Two-sample t-test for mean score comparison
- Minimum sample size: 100 per variant
- Configurable significance threshold (default p < 0.05)
- Effect size calculation (Cohen's d)

**Auto-Promotion:**
- Automatic winner detection when criteria met
- Optional manual approval gate
- Configurable minimum run duration

**Key Admin API Endpoints:**
- `POST /api/admin/analysis/prompts` - Manage LLM templates
- `POST /api/admin/analysis/rules` - Manage classification rules
- `GET/PUT /api/admin/analysis/weights` - Manage scoring weights
- `POST /api/admin/experiments` - Create A/B experiments
- `GET /api/admin/experiments/:id/results` - View experiment metrics

---

## Security Architecture

> **Detailed Architecture:** See [`_bmad-output/security-architecture-phase2.md`](./security-architecture-phase2.md) for complete implementation (1800+ lines).

Phase 2 introduces sensitive data capture (full transcripts, responses, sessions) requiring comprehensive security measures. Users upload complete Claude Code transcripts containing source code, file paths, and potentially secrets.

### Data Protection Layers

**Extended 5-Layer Privacy Model:**

| Layer | Phase 1 | Phase 2 Extension |
|-------|---------|-------------------|
| **1. Local Redaction** | Secret patterns | +DB queries, file paths, code snippets |
| **2. Transparency** | Basic consent | Granular per-data-type consent |
| **3. User Control** | Delete all | Selective deletion, audit access, retention |
| **4. Encryption** | Column-level | Key rotation, optional per-team keys |
| **5. Minimization** | Basic redaction | Response summarization, path hashing |

### Multi-Tenant Isolation

```
┌─────────────────────────────────────────────┐
│              TENANT BOUNDARY                 │
│  ┌───────────────────────────────────────┐  │
│  │              TEAM A                    │  │
│  │  Projects │ Members │ Analytics       │  │
│  │  Sessions │ Prompts │ Responses       │  │
│  └───────────────────────────────────────┘  │
│  ┌───────────────────────────────────────┐  │
│  │              TEAM B                    │  │
│  │       (Completely Isolated)            │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Isolation Mechanisms:**
- RLS policies on all tables
- `verifyTeamAccess()` application-level guards
- Cross-team analytics anonymization (min sample: 10)

### Audit Logging

**Comprehensive Audit Events:**
- All configuration changes (prompts, rules, weights)
- All admin operations (user management, experiments)
- All sensitive data access (exports, bulk operations)
- Authentication events (login, 2FA, session revocation)

**Retention:** 2 years with monthly partitioning

**Key Security Features:**
- Rate limiting on all sensitive endpoints
- Prompt injection prevention for LLM templates
- ReDoS protection for regex patterns
- Configuration signing with HMAC
- GDPR-compliant deletion workflow
- Anomaly detection and automatic lockout
- Breach notification workflow (72-hour GDPR compliance)

---

## Architecture Completion Summary

**Phase 2 Architecture Status:** ✅ READY FOR IMPLEMENTATION

**Documents:**
- Main: `_bmad-output/architecture-phase2.md` (this file)
- Epic 21: `_bmad-output/architecture-epic21.md` (2800+ lines)
- Security: `_bmad-output/security-architecture-phase2.md` (3400+ lines)

**Last Updated:** 2025-12-23

**Key Deliverables:**
- 5-layer privacy architecture
- Transcript mining specification with validated JSONL schema
- Session tracking data model
- Historical import system design
- VS Code extension architecture
- Crash recovery algorithm
- Pre-submission coaching flow
- **Enhanced 25+ dimension analysis framework (Epic 21)**
- **Configurable analysis engine with A/B testing (Epic 22)**
- **Comprehensive security architecture**
- Complete database schema for all new tables
- Full API specification for admin configuration

**Implementation Order:**

| Phase | Epics | Parallel Work |
|-------|-------|---------------|
| **1** | Epic 14.5: Privacy Foundation | - |
| **2** | Epic 15: Response Context | Epic 16: Sessions |
| **3** | Epic 17: Historical Import | Epic 19: VS Code Extension |
| **4** | Epic 18: Crash Recovery | - |
| **5** | Epic 20: Pre-Submission Coaching | - |
| **6** | Epic 21: Enhanced Analysis | Epic 22: Config Engine |

**Data Source:** Cloud Supabase only (local development deprecated)

**Next Steps:**
1. Create sprint stories for Epic 21 and Epic 22
2. Implement security foundation enhancements
3. Add Epic 21 analysis dimensions to Edge Function
4. Build admin UI for Epic 22 configuration
