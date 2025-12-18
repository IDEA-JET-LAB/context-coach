# Context Coach MVP Specification

**Version:** 0.2.0
**Date:** 2025-12-18
**Status:** Ready for Testing

---

## Overview

Context Coach is a prompt journaling system for teams using AI-assisted development. It captures prompts to enable learning, reflection, and improvement of prompting skills.

**MVP Focus:** Prompt capture and storage only.

---

## Functional Requirements

### FR-1: Prompt Capture (BMAD Native)

**Description:** When a BMAD agent is activated, the user's prompt is logged.

**Trigger:** Agent activation step in any BMAD agent.

**Captured Data:**
- User prompt text
- Timestamp
- Project path
- Agent engaged (if any)
- Session identifier

**Behavior:**
1. User activates BMAD agent (e.g., `/bmad:bmm:agents:dev`)
2. Agent reads Context Coach config
3. If enabled, agent appends entry to journal
4. Agent proceeds with normal operation

### FR-2: Prompt Capture (Claude Code Hook)

**Description:** Claude Code hook captures prompts automatically.

**Trigger:** `user-prompt-submit-hook` in Claude Code.

**Captured Data:**
- User prompt text
- Timestamp
- Project path
- Working directory
- Git branch (if available)
- Source: "claude-code-hook"

**Behavior:**
1. User submits any prompt in Claude Code
2. Hook script executes
3. Script appends entry to journal
4. Claude Code proceeds normally

### FR-3: Journal Storage

**Description:** Prompts stored in append-friendly format.

**Location:** `{project-root}/.bmad/context-coach/journal/`

**Format:** JSONL (JSON Lines) - one JSON object per line

**File Naming:** `{YYYY-MM-DD}.jsonl` (daily rotation)

**Example:**
```
.bmad/context-coach/journal/
├── 2025-12-18.jsonl
├── 2025-12-19.jsonl
└── index.json
```

### FR-4: Configuration

**Description:** User can enable/disable and configure Context Coach.

**Location:** `.bmad/core/config.yaml` or `.bmad/context-coach/config.yaml`

**Options:**
```yaml
context_coach:
  enabled: true
  capture_responses: false  # MVP: prompts only
  journal_path: '{project-root}/.bmad/context-coach/journal'
  user_id: 'edgars'  # For team identification
```

---

## Data Schema

### Journal Entry (v1.1)

```json
{
  "id": "cc-a7b3c9d2e4f5",
  "version": "1.1",
  "timestamp": "2025-12-18T14:32:15.123Z",
  "user_id": "edgars",
  "source": "bmad-agent | claude-code-hook",
  "project": {
    "path": "/Users/edgars/projects/my-app",
    "name": "my-app",
    "git_branch": "main"
  },
  "prompt": {
    "text": "Help me refactor src/auth.ts and look at this screenshot",
    "char_count": 56,
    "word_count": 10,
    "has_images": true,
    "referenced_files": ["src/auth.ts"]
  },
  "context": {
    "agent_id": ".bmad/bmm/agents/dev.md",
    "agent_name": "dev",
    "session_id": "optional-session-id"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Deterministic ID: `cc-` + MD5 hash (enables deduplication) |
| version | string | Yes | Schema version (currently "1.1") |
| timestamp | string | Yes | ISO 8601 timestamp |
| user_id | string | Yes | Identifier for team member |
| source | string | Yes | `"bmad-agent"` or `"claude-code-hook"` |
| project.path | string | Yes | Absolute project path |
| project.name | string | Yes | Project folder name |
| project.git_branch | string | No | Current git branch |
| prompt.text | string | Yes | The actual prompt |
| prompt.char_count | number | Yes | Character count |
| prompt.word_count | number | Yes | Word count |
| prompt.has_images | boolean | Yes | Whether prompt references images |
| prompt.referenced_files | array | Yes | File paths mentioned in prompt |
| context.agent_id | string | No | BMAD agent file path (null for hook) |
| context.agent_name | string | No | BMAD agent name (null for hook) |
| context.session_id | string | No | Session identifier |

### Deduplication Strategy

Both capture methods generate the same deterministic ID for the same prompt:

```
ID = "cc-" + MD5(YYYYMMDDHHMM + ":" + prompt[0:200])[:12]
```

**Priority:** BMAD agent entries overwrite hook entries (same ID) because they contain richer metadata (agent_id, agent_name).

---

## Technical Design

### Component 1: BMAD Journal Writer

**Type:** Instruction set embedded in agent activation

**Implementation:** Markdown instructions that any LLM can follow

**File:** `.bmad/modules/context-coach/journal-writer.md`

**Mechanism:**
```markdown
## Context Coach Journal Writer

When activated, perform these steps BEFORE proceeding with user request:

1. Check if `.bmad/context-coach/config.yaml` exists and `enabled: true`
2. If enabled:
   - Generate UUID for entry
   - Get current timestamp
   - Read user_id from config
   - Get project path and git branch
   - Construct journal entry JSON
   - Append to `.bmad/context-coach/journal/{YYYY-MM-DD}.jsonl`
3. Proceed with normal agent operation
```

### Component 2: Claude Code Hook Script

**Type:** Shell script

**File:** `.claude/hooks/context-coach-capture.sh`

**Hook Config:** `~/.claude/hooks.json`

```json
{
  "hooks": {
    "user-prompt-submit": [
      {
        "command": ".claude/hooks/context-coach-capture.sh"
      }
    ]
  }
}
```

**Script Logic:**
```bash
#!/bin/bash
# Receives prompt via stdin or environment
# Constructs JSON entry
# Appends to journal file
```

### Component 3: Configuration

**File:** `.bmad/context-coach/config.yaml`

```yaml
# Context Coach Configuration
enabled: true
user_id: "${USER}"  # Uses system username by default
journal_path: ".bmad/context-coach/journal"
```

---

## Installation

### Step 1: Copy Module Files

```bash
# From BMAD module repository
cp -r context-coach/ {project}/.bmad/modules/context-coach/
```

### Step 2: Create Config

```bash
# Create config file
cat > {project}/.bmad/context-coach/config.yaml << 'EOF'
enabled: true
user_id: "your-name"
journal_path: ".bmad/context-coach/journal"
EOF
```

### Step 3: Create Journal Directory

```bash
mkdir -p {project}/.bmad/context-coach/journal
```

### Step 4 (Optional): Install Claude Code Hook

```bash
# Copy hook script
cp context-coach-capture.sh {project}/.claude/hooks/

# Add to Claude Code hooks config
# (manual step - edit ~/.claude/hooks.json)
```

---

## File Structure

```
.bmad/
├── modules/
│   └── context-coach/
│       ├── module.yaml           # Module metadata
│       ├── journal-writer.md     # BMAD capture instructions
│       └── README.md             # Usage documentation
├── context-coach/
│   ├── config.yaml               # User configuration
│   └── journal/
│       ├── 2025-12-18.jsonl      # Daily journal files
│       └── index.json            # Optional: journal index
└── core/
    └── config.yaml               # Can reference context-coach

.claude/
└── hooks/
    └── context-coach-capture.sh  # Claude Code hook script
```

---

## Out of Scope (Future Phases)

- Response capture
- Prompt analysis and scoring
- Team analytics dashboard
- Improvement suggestions
- Image/attachment handling
- Real-time feedback
- Cross-project aggregation

---

## Success Criteria

1. **Capture Works:** Prompts are logged when using BMAD agents
2. **Hook Works:** Claude Code hook captures non-BMAD prompts
3. **Readable Output:** Journal files contain valid JSON
4. **No Disruption:** Normal workflow unaffected
5. **Easy Install:** Team member can install in < 5 minutes

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| AI forgets to log (BMAD) | Clear activation instructions, testing |
| Large journal files | Daily rotation, future archival |
| Performance impact | Async write, minimal processing |
| Privacy concerns | Local storage only, user controls |

---

*Specification created for Context Coach MVP*
