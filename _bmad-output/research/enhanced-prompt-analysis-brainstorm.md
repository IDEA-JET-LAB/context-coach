# Enhanced Prompt Analysis - Architectural Brainstorm

**Date:** 2025-12-22
**Participants:** Edgars, Winston (Architect Agent)
**Status:** Active Discussion

---

## Problem Statement

Current Contextor prompt analysis evaluates prompts **in isolation**. Without knowing:
- What Claude responded with
- Whether the response was helpful
- What tools were used
- The conversation context

...we're essentially grading questions without knowing the answers. This limits our ability to provide meaningful prompt improvement feedback.

---

## Current Architecture

```
User Prompt → UserPromptSubmit hook → Capture API → Database → Async Analysis
                                                                    ↓
                                              (Only prompt text analyzed)
```

**What we capture today:**
- Prompt text
- Timestamp
- User/Project/Team IDs
- Word/character counts

**What we DON'T capture:**
- Claude's response
- Tool executions
- Session context
- Conversation threading

---

## Discovery: Claude Code Has 10 Hooks

| Hook Event | Data Available | Potential Value |
|------------|----------------|-----------------|
| **SessionStart** | session_id, source, transcript_path | Session tracking, duration |
| **UserPromptSubmit** | prompt, session_id | ✅ Currently used |
| **PreToolUse** | tool_name, tool_input | Audit, understand intent |
| **PostToolUse** | tool_name, tool_input, **tool_response** | 🔥 Response capture |
| **Stop** | session_id | Signal "turn complete" |
| **SessionEnd** | session_id, reason | Duration, cleanup |
| PermissionRequest | message | Low value for analysis |
| Notification | message | Low value for analysis |
| SubagentStop | - | Subagent tracking |
| PreCompact | - | Context management |

---

## Proposed Enhancements

### Enhancement 1: Response Context via PostToolUse

Capture what Claude actually **did** in response to prompts:
- Which tools were called
- What were the tool outputs
- Success/failure status

### Enhancement 2: Full Transcript Mining

Every hook receives `transcript_path` pointing to session JSONL. Could parse this to extract:
- Claude's full text response (reasoning, explanations)
- Complete conversation context

### Enhancement 3: Session/Conversation Tracking

Use `session_id` to group prompts into conversations. Track:
- Which terminal/session each prompt came from
- Conversation flow and follow-ups
- Session duration

### Enhancement 4: Pre-Submission Coaching (New Feature)

Intercept prompts BEFORE Claude processes them:
- Analyze prompt quality in real-time
- Suggest improvements
- Let user accept/modify/skip
- Track improvement acceptance rates

---

## Open Questions (Under Discussion)

### Q1: Transcript Mining Complexity

**Initial concern:** Parsing JSONL, timing, file I/O overhead.

**Reality check needed:**
- Script runs locally, has filesystem access
- jq can parse JSONL easily
- Session files are local, not remote

**Actual challenges to explore:**
- Identifying correct response entry (ordering)
- File size for long sessions
- Format stability of JSONL structure

### Q2: Multi-Terminal / Parallel Agent Tracking

**Question:** Developers run multiple Claude Code instances. Can we track which terminal a prompt came from?

**Key insight:** Every hook provides `session_id` - this IS the correlation key.

**Proposed approach:**
- Each terminal = unique session_id
- Group all prompts by session_id = conversation
- Track parallel sessions as separate conversations

### Q3: Comprehensive Hook Data Capture

**Philosophy:** Capture everything, analyze later ("data lake" approach)

**Hooks to add:**
- SessionStart → track session begins
- SessionEnd → track session ends (calculate duration)
- PreToolUse → understand intent before execution
- PostToolUse → capture tool responses

**Future value:**
- Session duration analytics
- Tool usage patterns
- Success/failure rates
- Productivity metrics

---

## Data Model Evolution (Draft)

### Current Schema
```sql
prompts (id, text, analysis_status, ...)
prompt_analyses (prompt_id, scores, suggestions, ...)
```

### Proposed Schema Additions
```sql
-- Session tracking
sessions (
  id UUID,
  session_id TEXT,          -- Claude Code's session_id
  user_id UUID,
  team_id UUID,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  end_reason TEXT,          -- 'clear', 'logout', etc.
  metadata JSONB
)

-- Link prompts to sessions
prompts (
  ...existing...,
  session_id UUID REFERENCES sessions,  -- NEW
  sequence_number INTEGER,              -- Order within session
)

-- Tool execution log
tool_executions (
  id UUID,
  session_id UUID REFERENCES sessions,
  prompt_id UUID REFERENCES prompts,    -- Which prompt triggered this
  tool_name TEXT,
  tool_input JSONB,
  tool_response TEXT,
  executed_at TIMESTAMPTZ
)

-- Response capture (from transcript mining)
prompt_responses (
  id UUID,
  prompt_id UUID REFERENCES prompts,
  response_text TEXT,                   -- Claude's text response
  tool_count INTEGER,
  created_at TIMESTAMPTZ
)

-- Pre-submission improvements (future feature)
prompt_improvements (
  id UUID,
  original_text TEXT,
  suggested_text TEXT,
  accepted BOOLEAN,
  user_final_text TEXT,
  created_at TIMESTAMPTZ
)
```

---

## Architecture Options

### Option A: Incremental Enhancement
1. Add PostToolUse capture first (lowest risk)
2. Add session tracking
3. Add transcript mining
4. Add pre-submission coaching

### Option B: Comprehensive Capture
1. Add ALL hooks at once
2. Store everything
3. Build analytics later

### Option C: Response-First
1. Focus on transcript mining for response capture
2. Skip intermediate tool logging
3. Direct to prompt+response pairs

---

## Decision: Transcript Mining Approach

**Decided:** Go with full transcript mining for maximum context.

**Rationale:**
- Provides complete prompt + response pairs
- Post-processing latency (5-10s) is acceptable for analysis
- No need to limit to "last 50 lines" — read full context
- Local file access makes this straightforward

---

## NEW FEATURE: Historical Transcript Import (Day-One Value)

### Discovery (Verified)

Claude Code maintains local transcript files for **30 days by default**:

```
~/.claude/
├── projects/
│   └── -home-user-project-name/
│       ├── [session-uuid].jsonl    # Full conversation history
│       └── [session-uuid].jsonl
```

**Retention details:**
- Default: 30 days local retention
- Configurable via `cleanupPeriodDays` in `~/.claude/settings.json`
- Setting to `99999` keeps transcripts indefinitely

### Feature Concept: "Import History"

**On first Contextor install or first session:**

```
┌─────────────────────────────────────────────────────────────┐
│  🎉 Welcome to Contextor!                                   │
│                                                             │
│  We detected 847 prompts from the last 30 days across       │
│  12 projects.                                               │
│                                                             │
│  Would you like to import and analyze your prompt history?  │
│  This provides immediate insights into your prompting       │
│  patterns without waiting for new data.                     │
│                                                             │
│  [Import All]  [Select Projects]  [Skip for Now]            │
└─────────────────────────────────────────────────────────────┘
```

### Value Proposition

| Benefit | Description |
|---------|-------------|
| **Immediate insights** | Day-one value, no cold start problem |
| **Rich context** | Full prompt + response pairs already available |
| **Pattern detection** | Enough data to identify habits and areas to improve |
| **Onboarding hook** | Compelling reason to complete setup |

### Technical Approach

1. **Discovery phase:**
   - Scan `~/.claude/projects/` for all session JSONL files
   - Count prompts per project
   - Show summary to user

2. **Import phase (with consent):**
   - Parse JSONL files
   - Extract prompt + response pairs
   - Apply secret redaction
   - Send to Contextor API for storage + analysis

3. **Privacy controls:**
   - User chooses which projects to import
   - Option to exclude specific sessions
   - Clear data ownership messaging

### File Location Pattern

```
~/.claude/projects/-{path-with-dashes}/[session-id].jsonl

Example:
~/.claude/projects/-home-edgars-my-projects-dev-context-coach/abc123.jsonl
```

Path transformation: `/home/edgars/my-projects` → `-home-edgars-my-projects`

### JSONL Structure (Per Line)

```json
{"type": "user", "message": "...", "timestamp": "...", "sessionId": "..."}
{"type": "assistant", "message": "...", "timestamp": "..."}
{"type": "tool_use", "name": "Edit", "input": {...}, "timestamp": "..."}
{"type": "tool_result", "output": "...", "timestamp": "..."}
```

---

## Next Steps (To Be Decided)

- [x] ~~Clarify transcript mining complexity~~ → Confirmed feasible
- [x] ~~Decide on session tracking approach~~ → Use session_id from hooks
- [ ] Define MVP scope for enhanced capture
- [ ] Technical spike on actual JSONL format (read real files)
- [ ] Design historical import UX
- [ ] Design pre-submission coaching UX (future phase)

---

## NEW FEATURE: Smart Crash Recovery

### The Problem (Validated)

Claude Code **does have** session resumption (`--continue`, `--resume`), but:

| Gap | Impact |
|-----|--------|
| **Not automatic** | User must know to use `--continue` flag |
| **No crash detection** | No prompt to resume after unexpected crash |
| **Context feels stale** | After long interruption, user forgets where they were |
| **No summary** | User must re-read transcript to understand state |

**User experience today:**
```
Terminal crashes → User restarts → Starts new session →
Manually types "continue what we were doing" →
Claude has context but user doesn't → Inefficient restart
```

### Contextor's Opportunity

We have access to the transcript. We can provide **smart recovery**:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ Interrupted Session Detected                            │
│                                                             │
│  Your last session crashed 15 minutes ago while working on: │
│                                                             │
│  📁 Project: context-coach                                  │
│  🔧 Task: Implementing user authentication                  │
│  📝 Last action: Editing auth/callback/route.ts             │
│  💬 Last prompt: "Now add the error handling for..."        │
│                                                             │
│  [Resume with Context]  [View Transcript]  [Start Fresh]    │
└─────────────────────────────────────────────────────────────┘
```

### Technical Approach

1. **Detect interrupted sessions:**
   - Monitor `~/.claude/projects/` for recent sessions
   - Check if session ended abnormally (no `SessionEnd` event)
   - Compare last activity time vs current time

2. **Generate recovery context:**
   - Parse last N messages from transcript
   - Use AI to summarize: "You were working on X, last action was Y"
   - Identify incomplete tasks or pending actions

3. **Recovery prompt generation:**
   ```
   "Continue from where we left off. Here's the context:
   - We were implementing OAuth callback handling
   - Last edit was to auth/callback/route.ts line 45
   - You had suggested adding try/catch for the code exchange
   - I asked you to proceed with that change

   Please continue."
   ```

4. **Integration options:**
   - VS Code extension shows notification
   - CLI hook on `SessionStart` checks for interrupted sessions
   - Web dashboard shows "incomplete sessions" list

### What Claude Code Already Does vs. What We Add

| Feature | Claude Code | Contextor Adds |
|---------|-------------|----------------|
| Session storage | ✅ Full transcript | ✅ Same data |
| Manual resume | ✅ `--continue` flag | - |
| Crash detection | ❌ None | ✅ Automatic |
| Context summary | ❌ User reads transcript | ✅ AI-generated summary |
| Recovery prompt | ❌ User writes manually | ✅ Auto-generated |
| Visual notification | ❌ CLI only | ✅ VS Code extension |

---

## UI Strategy: VS Code Extension

### Why VS Code Extension?

| Factor | Reasoning |
|--------|-----------|
| **Distribution** | Marketplace discovery, easy install |
| **User base** | Most Claude Code users are in VS Code |
| **Integration** | Native to development workflow |
| **Low friction** | No separate app to launch |
| **Existing pattern** | Claude Code already has VS Code extension |

### Proposed Extension Features

**Phase 1: Analytics Dashboard**
- Prompt history view (synced from cloud)
- Analysis scores and trends
- Improvement suggestions

**Phase 2: Crash Recovery**
- Detect interrupted sessions
- Show recovery notification
- Generate recovery prompts
- One-click resume

**Phase 3: Real-time Coaching**
- Pre-submission prompt analysis
- Inline suggestions
- "Improve this prompt" quick action

### Architecture Options

**Option A: Extension talks directly to local files**
```
VS Code Extension → Read ~/.claude/projects/ → Display locally
                  → Sync to Contextor cloud for analysis
```

**Option B: Extension talks to Contextor cloud**
```
Claude Code Hooks → Capture to Contextor Cloud
VS Code Extension → Fetch from Contextor API → Display
```

**Option C: Hybrid**
```
Local: Crash detection, immediate features
Cloud: Analytics, historical analysis, AI suggestions
```

**Recommendation:** Option C (Hybrid) — fast local UX with cloud-powered intelligence.

### Existing Claude Code Extension

Claude Code already has a VS Code extension with:
- Inline diffs
- Conversation tabs
- File @-mentions
- Auto-accept option

**Our extension would be complementary, not competitive:**
- Claude Code extension = conversation interface
- Contextor extension = analytics, coaching, recovery

Could potentially integrate as a panel within their extension (if they offer API).

---

## VALIDATED: Technical Feasibility Questions

### Q: Do VS Code Extension users get the same hooks/transcripts?

**Answer: YES** ✅

- VS Code extension and CLI share the same infrastructure
- Hooks (UserPromptSubmit, PostToolUse, etc.) fire identically
- Transcript JSONL files created in same location: `~/.claude/projects/`
- Settings and conversation history are shared between CLI and extension

**Implication:** Our hook-based capture works for ALL Claude Code users regardless of interface.

### Q: Is offline recovery a valid benefit?

**Answer: NO** — Claude Code requires internet connection.

- All processing happens on Anthropic's servers
- No offline mode exists
- "Offline" indicator bugs exist but it still needs connectivity

**Revised architecture rationale:** Hybrid approach is still valuable, but for:
- **Local:** Speed (no round-trip), privacy (sensitive data stays local)
- **Cloud:** AI analysis, cross-device sync, team features

### Q: Can we track context window consumption / compaction?

**Answer:** Limited capabilities exist (OpenTelemetry metrics, PreCompact hook), but:
- No real-time context % visibility
- Minimal data from compaction events

**Decision:** Low priority. Deprioritized for initial roadmap. Could revisit later as productivity analytics feature.

---

## Pre-Submission Analysis: UI Options Evaluation

### Option A: Terminal Injection

**Concept:** VS Code extension intercepts terminal input, shows suggestions in terminal.

**Technical Assessment:**

| Aspect | Feasibility |
|--------|-------------|
| VS Code Terminal API | Can send text TO terminal, limited read |
| Intercept before Enter | ❌ No pre-keystroke hook in VS Code |
| Wrap terminal input | Possible via custom shell profile, fragile |
| Show inline suggestions | Would appear as text output, not interactive |

**Verdict:** Technically difficult and fragile. Terminal is designed for output, not interactive UI.

### Option B: VS Code Extension Panel

**Concept:** Separate panel (sidebar or below chat) shows analysis and suggestions.

**Technical Assessment:**

| Aspect | Feasibility |
|--------|-------------|
| Custom webview panel | ✅ Full control, rich UI |
| Position flexibility | ✅ Can dock anywhere |
| React to terminal input | Partial — can watch files, not keystrokes |
| User workflow | User must look at panel, context switch |

**Verdict:** Technically straightforward, but creates split attention.

### Option C: Hook-Based with Extension UI (Recommended)

**Concept:** Use UserPromptSubmit hook to trigger analysis, extension shows results.

**Flow:**
```
User types prompt in terminal → Presses Enter
                ↓
UserPromptSubmit hook fires
                ↓
Hook calls local analysis service (fast heuristics)
                ↓
If improvement suggested:
  - Hook writes to ~/.contextor/suggestion.json
  - Hook blocks with exit code 2
  - stderr shows: "💡 Contextor has a suggestion. See VS Code panel."
                ↓
VS Code extension watches suggestion file
  - Shows rich UI with original/suggested prompt
  - [Accept] copies improved prompt to clipboard
  - [Skip] user resubmits original
                ↓
User pastes improved prompt or resubmits
```

**Why this works:**
- Hook provides the interception point (before Claude processes)
- Extension provides rich UI (not limited to terminal text)
- File/socket bridges the two processes
- User stays in terminal for actual prompting

**Trade-off:** Requires user to paste improved prompt (not auto-replace). But this is intentional — user should consciously accept changes.

### Option D: Full Extension Input (Future)

**Concept:** User types prompts in VS Code extension UI, not terminal.

**When this makes sense:**
- If Claude Code extension adds API for third-party integration
- If we build a wrapper/alternative to Claude Code VS Code extension
- For users who prefer GUI over CLI anyway

**Not viable today:** Claude Code extension doesn't expose APIs for prompt injection.

---

## Revised Feature Summary

| Feature | Feasibility | Recommended Approach |
|---------|-------------|---------------------|
| **Transcript mining** | ✅ High | Read JSONL on Stop hook |
| **Session tracking** | ✅ High | session_id from hooks |
| **Historical import** | ✅ High | Scan ~/.claude/projects/ |
| **Crash recovery** | ✅ High | Detect incomplete sessions |
| **Pre-submission coaching** | ✅ Medium | Hook + Extension UI hybrid |
| **VS Code extension** | ✅ High | Complementary to Claude Code ext |

---

## Feature Roadmap: Phase 2 - Enhanced Analysis

### Recommended PRD Approach

These features represent a **significant product evolution** — not minor enhancements. Options:

| Approach | Pros | Cons |
|----------|------|------|
| Extend existing PRD | Single source of truth, clear lineage | PRD becomes very long |
| Create "Phase 2" addendum | Clean separation, focused scope | Two documents to maintain |
| Separate feature specs | Detailed per feature | Loses holistic view |

**Recommendation: Extend PRD with Phase 2 Section**

Add a "Phase 2: Enhanced Analysis Platform" section to the existing PRD that:
1. References Phase 1 as foundation (current capture + basic analysis)
2. Defines Phase 2 vision and objectives
3. Contains new epics for each major capability
4. Links back to this brainstorm document for technical details

### Proposed Epic Structure

```
PHASE 2: Enhanced Analysis Platform
├── Epic 15: Response Context Capture
│   ├── Story: Transcript mining implementation
│   ├── Story: Stop hook integration
│   ├── Story: Prompt-response pairing logic
│   └── Story: Enhanced analysis with response context
│
├── Epic 16: Session & Conversation Tracking
│   ├── Story: Session model and database schema
│   ├── Story: Hook updates for session_id capture
│   ├── Story: Conversation grouping in UI
│   └── Story: Multi-terminal session visualization
│
├── Epic 17: Historical Import
│   ├── Story: Transcript discovery and scanning
│   ├── Story: Import consent and project selection UI
│   ├── Story: Batch processing and analysis
│   └── Story: Onboarding integration
│
├── Epic 18: Smart Crash Recovery
│   ├── Story: Interrupted session detection
│   ├── Story: AI-powered context summarization
│   ├── Story: Recovery prompt generation
│   └── Story: VS Code notification integration
│
├── Epic 19: VS Code Extension (Foundation)
│   ├── Story: Extension scaffolding and architecture
│   ├── Story: Analytics dashboard panel
│   ├── Story: Session browser and history view
│   └── Story: Contextor cloud API integration
│
├── Epic 20: Pre-Submission Coaching
│   ├── Story: Fast local analysis heuristics
│   ├── Story: Hook blocking and suggestion flow
│   ├── Story: Extension suggestion UI
│   └── Story: Improvement tracking and metrics
```

### Priority Order (Recommended)

| Priority | Epic | Rationale |
|----------|------|-----------|
| **P0** | Epic 15: Response Context | Foundation for all enhanced analysis |
| **P0** | Epic 16: Session Tracking | Required for conversation grouping |
| **P1** | Epic 17: Historical Import | Day-one value, solves cold start |
| **P1** | Epic 19: VS Code Extension | Distribution channel for all features |
| **P2** | Epic 18: Crash Recovery | Valuable but depends on extension |
| **P3** | Epic 20: Pre-Submission Coaching | Most complex, highest risk |

### Dependencies

```
                    ┌─────────────────┐
                    │ Epic 15:        │
                    │ Response Context│
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ Epic 16:    │  │ Epic 17:    │  │ Epic 19:    │
    │ Sessions    │  │ Historical  │  │ VS Code Ext │
    └─────────────┘  └──────┬──────┘  └──────┬──────┘
                            │                │
                            └───────┬────────┘
                                    ▼
                          ┌─────────────────┐
                          │ Epic 18:        │
                          │ Crash Recovery  │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ Epic 20:        │
                          │ Pre-Submission  │
                          └─────────────────┘
```

### Success Metrics (Phase 2)

| Metric | Target | How Measured |
|--------|--------|--------------|
| Analysis accuracy improvement | +40% | A/B test with response context |
| User onboarding completion | +25% | Historical import acceptance rate |
| Crash recovery adoption | 60%+ | Users who accept recovery prompts |
| Extension installs | 1000+ | VS Code marketplace |
| Pre-submission improvement rate | 30%+ | Accepted suggestions / offered |

---

## Privacy Architecture (Critical)

### Data Sensitivity Assessment

Phase 2 significantly expands data collection. We must design privacy-first.

| Data Type | Sensitivity | Risk |
|-----------|-------------|------|
| User prompts | High | May contain business logic, internal info |
| Claude responses | High | May include generated code with secrets |
| Tool inputs (Edit, Write) | Critical | Exact file contents, code changes |
| Tool outputs | Medium | Command results, file contents |
| File paths | Medium | Reveals project structure |
| Session metadata | Low | Timing, duration, counts |

### Current State: Redaction Module

We have `lib/capture/redact-secrets.ts` that detects:
- API keys (OpenAI, Stripe, AWS, Google, GitHub, GitLab, Slack, Azure)
- JWTs and bearer tokens
- SSH private keys
- URL passwords
- Environment variables with sensitive names

**Gap:** This runs only on prompts. Phase 2 needs it on responses too.

### Privacy Architecture for Phase 2

#### Layer 1: Local Redaction (Before Upload)

All data redacted on user's machine BEFORE leaving:

```
Transcript JSONL → Local Redaction Script → Redacted Data → Upload to Cloud
                         ↓
              - Secret patterns (existing)
              - File path anonymization (optional)
              - Custom user-defined patterns
```

**New patterns to add:**
- Database connection strings (`postgres://...`, `mongodb://...`)
- Private IP addresses (optional - some users want this)
- Email addresses (optional)
- Custom regex patterns (user-configurable)

**Implementation:** Enhance CLI/hook with comprehensive redaction before ANY network call.

#### Layer 2: User Transparency

**Before any data capture, show users exactly what will be collected:**

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Contextor Data Collection                               │
│                                                             │
│  To provide prompt analysis, we collect:                    │
│                                                             │
│  ✓ Your prompts to Claude                                   │
│  ✓ Claude's responses (for context)                         │
│  ✓ Tool usage (which tools were called)                     │
│  ✓ Session timing (duration, frequency)                     │
│                                                             │
│  We automatically redact:                                   │
│  • API keys, tokens, passwords                              │
│  • SSH private keys                                         │
│  • Database credentials                                     │
│                                                             │
│  You can also exclude:                                      │
│  ☐ Specific projects                                        │
│  ☐ File paths                                               │
│  ☐ Email addresses                                          │
│                                                             │
│  [View Privacy Policy]  [Configure]  [I Understand]         │
└─────────────────────────────────────────────────────────────┘
```

**Key principle:** No surprises. User knows exactly what's captured.

#### Layer 3: User Control

| Control | Implementation |
|---------|----------------|
| **Opt-out specific projects** | Exclude list in `.contextor/config.json` |
| **Delete my data** | One-click delete in dashboard |
| **Export my data** | Download all data in JSON format |
| **Pause capture** | Temporarily disable without uninstalling |
| **Retention period** | Choose: 30 days, 90 days, 1 year, forever |

#### Layer 4: Encryption at Rest

**Database encryption for sensitive columns:**

```sql
-- Encrypt prompt text and response text
ALTER TABLE prompts
  ALTER COLUMN text TYPE bytea
  USING pgp_sym_encrypt(text, 'encryption_key');

ALTER TABLE prompt_responses
  ALTER COLUMN response_text TYPE bytea
  USING pgp_sym_encrypt(response_text, 'encryption_key');
```

**Supabase options:**
- Column-level encryption with `pgcrypto`
- Vault for key management
- Row-level security (already in place)

**Key management considerations:**
- Key per user vs shared key
- Key rotation policy
- Recovery if key lost

**Recommendation:** Start with Supabase Vault + column encryption for `text` and `response_text` fields.

#### Layer 5: Data Minimization

Store only what's needed for analysis:

| What to Store | What to Discard |
|---------------|-----------------|
| Prompt text (redacted) | Full tool input JSON |
| Response summary | Large file contents from Read tool |
| Tool names called | Exact file paths (anonymize) |
| Analysis results | Raw tool output |
| Session metadata | Intermediate processing data |

**Option: Analysis-Only Mode**

For privacy-conscious users:
1. Upload prompt + response
2. Run analysis
3. Store ONLY the analysis results
4. Delete raw prompt/response immediately

User sees scores and suggestions but raw data never persists.

### Privacy Levels (User Choice)

| Level | What's Stored | Who It's For |
|-------|---------------|--------------|
| **Full** | Prompts + responses + analysis | Teams wanting full history |
| **Standard** | Prompts + analysis (no responses) | Individual developers |
| **Minimal** | Analysis results only | Privacy-conscious users |
| **Local Only** | Everything stays on machine | Air-gapped environments |

### Compliance Considerations

| Requirement | How We Address |
|-------------|----------------|
| **GDPR Right to Erasure** | Delete my data feature |
| **GDPR Data Portability** | Export in standard JSON |
| **Data Minimization** | Privacy levels, retention limits |
| **Consent** | Explicit opt-in, clear explanation |
| **Security** | Encryption at rest, TLS in transit |

### Privacy Epic (Add to Phase 2)

```
Epic 14.5: Privacy & Data Protection (P0 - Before other Phase 2 work)
├── Story: Enhanced redaction for responses and tool outputs
├── Story: User transparency UI (what we collect)
├── Story: Privacy controls (opt-out, delete, export)
├── Story: Column encryption for sensitive data
├── Story: Privacy levels implementation
└── Story: Retention policy and auto-deletion
```

**This should be P0** — before any response capture, we must have privacy infrastructure in place.

### Technical Implementation Notes

**1. Local redaction enhancement:**
```typescript
// New file: lib/capture/redact-response.ts
export function redactResponse(response: string): RedactionResult {
  // Apply all secret patterns
  let result = redactSecrets(response);

  // Additional response-specific patterns
  result = redactFilePaths(result.redactedText);
  result = redactDatabaseUrls(result.redactedText);

  return result;
}
```

**2. Encryption helper:**
```typescript
// Using Supabase Vault
import { createClient } from '@supabase/supabase-js';

async function encryptForStorage(text: string, userId: string): Promise<string> {
  const { data } = await supabase.rpc('encrypt_user_data', {
    plaintext: text,
    user_key_id: userId
  });
  return data;
}
```

**3. Privacy settings schema:**
```typescript
interface PrivacySettings {
  captureLevel: 'full' | 'standard' | 'minimal' | 'local';
  redactFilePaths: boolean;
  redactEmails: boolean;
  customPatterns: string[];  // User-defined regex
  excludedProjects: string[];
  retentionDays: number;
}
```

---

## Revised Priority Order (With Privacy)

| Priority | Epic | Rationale |
|----------|------|-----------|
| **P0** | Epic 14.5: Privacy & Data Protection | MUST be first - foundation for trust |
| **P0** | Epic 15: Response Context | Foundation for enhanced analysis |
| **P0** | Epic 16: Session Tracking | Required for conversation grouping |
| **P1** | Epic 17: Historical Import | Day-one value, depends on privacy |
| **P1** | Epic 19: VS Code Extension | Distribution channel |
| **P2** | Epic 18: Crash Recovery | Depends on extension |
| **P3** | Epic 20: Pre-Submission Coaching | Most complex |

---

## Next Steps

1. **Review and approve roadmap** with product stakeholder
2. **Extend PRD** with Phase 2 section and epic definitions
3. **Technical spike** on transcript JSONL format (validate assumptions)
4. **Begin Epic 14.5** (Privacy) as true foundation

---

## Technical Spike: JSONL Format Validation

**Date:** 2025-12-22
**Status:** ✅ Complete

### Executive Summary

Analyzed real Claude Code transcript files from `~/.claude/projects/`. All PRD assumptions validated, plus discovered additional valuable fields.

### File Location & Structure

```
~/.claude/projects/
└── -Users-edgars-My-projects-2025-projects-DEV-context-coach/
    ├── 371ee508-6d30-41bd-bb8a-60553920b81e.jsonl  (7KB)
    ├── 08210051-db26-426c-97d1-962517c62a66.jsonl  (21KB)
    └── 017b1ce3-0634-4b6c-a8a3-c98f535d9094.jsonl  (623KB)
```

- **Format:** JSONL (one JSON object per line)
- **Naming:** UUID v4 filenames
- **Size range:** 100B to 5MB+ (correlates with session length)

### Message Types Discovered (8 Total)

| Type | Description | Frequency |
|------|-------------|-----------|
| `user` | User prompts & tool results | High |
| `assistant` | Claude's responses | High |
| `file-history-snapshot` | File state checkpoints | Medium |
| `summary` | Conversation summary | Once per file |
| `queue-operation` | Background task tracking | Low |
| `tool_use` | Tool invocation (nested in assistant) | High |
| `tool_result` | Tool output (nested in user) | High |
| `thinking` | Extended thinking (nested in assistant) | Medium |

### Actual JSONL Schema

#### User Message
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

#### Assistant Message
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
      "cache_read_input_tokens": 890,
      "cache_creation_input_tokens": 123
    }
  }
}
```

#### Tool Result (nested in user content)
```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01...",
  "content": "Result output as string",
  "is_error": false
}
```

### PRD Assumption Validation

| Assumption | Status | Evidence |
|------------|--------|----------|
| `session_id` available | ✅ Confirmed | Every message has `sessionId` (UUID) |
| Timestamps on messages | ✅ Confirmed | ISO-8601 with milliseconds |
| Tool calls captured | ✅ Confirmed | `tool_use` in assistant, `tool_result` in user |
| User prompts preserved | ✅ Confirmed | `message.content` (string or array) |
| Message threading | ✅ Confirmed | `parentUuid` links to parent (null = root) |
| Response text available | ✅ Confirmed | Assistant `content` array with `type: "text"` |

### Bonus Discoveries (Enhance PRD)

| Field | Location | Value for Contextor |
|-------|----------|---------------------|
| **`thinking`** | Assistant content blocks | Extended reasoning — quality signal |
| **`usage`** | Assistant message | Token counts — cost analytics |
| **`model`** | Assistant message | Which Claude model used |
| **`gitBranch`** | All messages | Track prompts by git context |
| **`slug`** | All messages | Human-readable conversation ID |
| **`cwd`** | All messages | Working directory context |
| **`version`** | All messages | Claude Code version |

### Parsing Code Snippets

**Stream JSONL parsing:**
```typescript
import * as readline from 'readline';
import * as fs from 'fs';

async function parseTranscript(filePath: string) {
  const messages = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      messages.push(JSON.parse(line));
    }
  }
  return messages;
}
```

**Extract prompt-response pairs:**
```typescript
function extractConversationPairs(messages: any[]) {
  const pairs = [];
  let currentPrompt = null;

  for (const msg of messages) {
    if (msg.type === 'user' && typeof msg.message?.content === 'string') {
      currentPrompt = {
        text: msg.message.content,
        timestamp: msg.timestamp,
        uuid: msg.uuid,
        sessionId: msg.sessionId
      };
    } else if (msg.type === 'assistant' && currentPrompt) {
      const responseText = msg.message.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');

      pairs.push({
        prompt: currentPrompt,
        response: {
          text: responseText,
          model: msg.message.model,
          tokens: msg.message.usage,
          timestamp: msg.timestamp
        }
      });
      currentPrompt = null;
    }
  }
  return pairs;
}
```

**Build conversation tree:**
```typescript
function buildConversationTree(messages: any[]) {
  const byUuid = new Map(messages.map(m => [m.uuid, { ...m, children: [] }]));
  const roots = [];

  for (const msg of byUuid.values()) {
    if (msg.parentUuid === null) {
      roots.push(msg);
    } else {
      const parent = byUuid.get(msg.parentUuid);
      if (parent) parent.children.push(msg);
    }
  }
  return roots;
}
```

### Data Sensitivity Notes

**Found in transcripts (requires redaction):**
- Full file contents (from Read tool)
- File system paths
- Code with potential secrets
- Git branch names

**Redaction recommendations:**
1. Apply existing `redact-secrets.ts` to all text content
2. Consider optional file path anonymization
3. Truncate or exclude large file contents
4. Respect user privacy level settings

### Performance Observations

| File Size | Messages | Parse Time (est.) |
|-----------|----------|-------------------|
| 7KB | ~50 | <100ms |
| 100KB | ~500 | <500ms |
| 600KB | ~3000 | <2s |
| 5MB | ~25000 | <10s |

**Recommendation:** Stream parsing for files >100KB to avoid memory issues.

### Schema Changes for PRD

Based on findings, consider adding to `sessions` table:

```sql
ALTER TABLE sessions ADD COLUMN git_branch TEXT;
ALTER TABLE sessions ADD COLUMN claude_code_version TEXT;
ALTER TABLE sessions ADD COLUMN slug TEXT;
```

And to `prompts` table:

```sql
ALTER TABLE prompts ADD COLUMN model TEXT;
ALTER TABLE prompts ADD COLUMN input_tokens INTEGER;
ALTER TABLE prompts ADD COLUMN output_tokens INTEGER;
ALTER TABLE prompts ADD COLUMN has_thinking BOOLEAN DEFAULT FALSE;
```

### Conclusion

**Technical spike successful.** The JSONL format is well-structured, contains all needed fields, and provides additional valuable metadata. Implementation can proceed with confidence.

---

## Discussion Log

### 2025-12-22 - Initial Brainstorm

**Edgars' core insight:** Prompts without response context are insufficient for quality analysis. Need to capture what Claude responded with.

**Key questions raised:**
1. How hard is transcript mining really?
2. Can we track multi-terminal parallel sessions?
3. Should we capture all hook data speculatively?

**Winston's analysis:** PostToolUse provides immediate value. Transcript mining is feasible. Session_id enables conversation grouping.

*(Discussion continues...)*
