# Context Coach: Approach Evaluation

**Date:** 2025-12-18
**Participants:** Edgars, BMad Master
**Status:** Exploration Complete → MVP Selected

---

## Problem Statement

### The Challenge
- Junior developers struggle with AI orchestration and the BMAD method
- Prompting skills vary across the team
- No visibility into how team members construct prompts
- No systematic way to learn from good (or bad) prompts
- Need for reflection and improvement feedback loop

### Goals
1. Capture prompts across team development sessions
2. Store with meaningful metadata for later analysis
3. Enable team learning and prompt quality improvement
4. Make it easy to install and use

---

## Approaches Evaluated

### 1. Claude Code Hooks (Tool-Specific)

**Concept:** Use Claude Code's native `user-prompt-submit-hook` to capture prompts automatically.

**Pros:**
- Native to Claude Code - automatic triggering
- Non-intrusive - works in background
- Captures ALL prompts, not just BMAD sessions
- High reliability - hook always fires

**Cons:**
- Only works with Claude Code
- Team uses multiple tools (Gemini CLI, Aider, etc.)
- Would need separate implementation per tool
- High maintenance burden for multi-tool support

**Verdict:** Good for Claude Code enhancement, not universal solution.

---

### 2. BMAD Native Approach

**Concept:** Build prompt logging into BMAD agent activation - the AI logs itself.

**Pros:**
- Universal - works with ANY LLM/CLI tool
- Low infrastructure - just file writes
- Integrated into existing team workflow
- Self-maintaining - AI does the logging
- Portable across tools

**Cons:**
- Only captures BMAD agent interactions
- Relies on team discipline (always use BMAD)
- Raw prompts without agent activation not captured

**Verdict:** Best universal approach for teams using BMAD consistently.

---

### 3. MCP Server Approach

**Concept:** Create MCP server providing logging tools; AI calls them per instructions.

**Pros:**
- Protocol-level solution
- Rich functionality (tools, resources, analytics)
- Decoupled from BMAD
- Centralized sophisticated backend

**Cons:**
- Requires MCP support (not all tools have it)
- AI must be instructed to call tools (not automatic)
- Infrastructure overhead (running server)
- Gemini CLI MCP support unknown
- Instruction dependency per project (CLAUDE.md, etc.)

**MCP Support Reality:**
| Tool | MCP Support |
|------|-------------|
| Claude Code | Yes |
| Cursor | Yes |
| Continue | Yes |
| Gemini CLI | Unknown |
| Aider | No |
| GitHub Copilot CLI | No |

**Verdict:** Powerful but fragmented support and relies on AI compliance.

---

### 4. Proxy/Middleware Approach

**Concept:** External system captures all AI traffic between CLI and LLM API.

**Pros:**
- Truly universal - captures everything
- No AI compliance needed
- Complete data capture

**Cons:**
- Significant complexity
- Requires routing all API traffic
- Security/privacy considerations
- Infrastructure heavy

**Verdict:** Overkill for team learning use case.

---

### 5. Hybrid: BMAD Native + Claude Code Hooks

**Concept:** BMAD provides universal capture; Claude Code hooks enhance when available.

**Pros:**
- Universal base coverage via BMAD
- Enhanced capture for Claude Code users
- Best of both approaches
- Graceful degradation

**Cons:**
- Two systems to maintain
- Potential duplicate logging to handle

**Verdict:** SELECTED APPROACH - pragmatic balance of coverage and simplicity.

---

## Decision Matrix

| Approach | Universal | Automatic | Simple | Reliable | Score |
|----------|-----------|-----------|--------|----------|-------|
| Tool Hooks Only | 1 | 5 | 4 | 5 | 15 |
| BMAD Native | 5 | 3 | 5 | 3 | 16 |
| MCP Server | 2 | 2 | 2 | 2 | 8 |
| Proxy/Middleware | 5 | 5 | 1 | 4 | 15 |
| **BMAD + Hooks** | **4** | **4** | **4** | **4** | **16** |

---

## Selected Approach: BMAD Native + Claude Code Hooks

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CONTEXT COACH                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: BMAD Native (Universal)                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Agent activation includes logging directive              │ │
│  │ • Works with any LLM (Claude, Gemini, GPT, etc.)          │ │
│  │ • Simple file append operation                             │ │
│  │ • Captures: prompt, agent, project, timestamp              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Layer 2: Claude Code Hooks (Enhanced)                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • Automatic capture via user-prompt-submit-hook            │ │
│  │ • Catches non-BMAD prompts too                            │ │
│  │ • Richer metadata (session, terminal, etc.)               │ │
│  │ • Only for Claude Code users                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Storage: Unified Journal                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ • .bmad/context-coach/journal/                             │ │
│  │ • JSONL format (append-friendly)                           │ │
│  │ • Daily rotation                                           │ │
│  │ • Consistent schema regardless of capture source           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### MVP Scope
- **In Scope:** Prompt capture and storage only
- **Out of Scope (Phase 2):** Analysis, visualization, team reports

### Installation Target
- Installable as BMAD module
- Simple setup for team members
- Works immediately after install

---

## Next Steps

1. Design MVP specification
2. Define journal entry schema
3. Create BMAD module structure
4. Implement Claude Code hook
5. Test with single user
6. Deploy to team

---

*Document created during Context Coach exploration session*
