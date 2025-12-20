# Contextor - Initial Vision Brainstorming

**Date:** December 18-19, 2025
**Participants:** Edgars, BMad Master
**Status:** Discovery Phase

---

## Session Overview

This document captures the key brainstorming discussions from the initial Contextor development sessions, compiled from prompt journal entries.

---

## Core Vision

**Contextor** is a prompt journaling system for AI-assisted development teams that enables:
- Team learning from each other's prompting techniques
- Reflection on prompting patterns
- Improvement of prompting skills through analysis

---

## Key Discussion Topics

### 1. Storage Architecture Evolution

**Initial State (MVP):**
- Local JSONL file storage in `.bmad/contextor/journal/`
- Daily journal files with schema v1.1
- Hybrid capture: Claude Code hooks + BMAD agent native

**Scaling Discussion:**
> "Now let's imagine that the prompt database grows to thousands of records per user per month. What would be a larger scale storage solution?"

**Options Considered:**
| Option | Pros | Cons |
|--------|------|------|
| JSONL (current) | Simple, portable, git-friendly | Not queryable at scale |
| SQLite | Local, queryable, single file | Sync complexity |
| Supabase | Cloud-native, team sharing, real-time | Requires connection |

**Decision Direction:**
- SQLite is not overkill for local storage
- **Supabase preferred for cloud/team use case**
- Stage 1: Consider cloud-first approach

---

### 2. Frontend Options

**Discussion:**
> "What would be the easiest way to locally view the logs? What's preferred if I would want it to be an installable app versus web app?"

**Options to Explore:**
- Local web app (universal: Mac/Windows)
- Electron-based installable app
- Simple CLI viewer
- Web dashboard (cloud approach)

---

### 3. Cloud-First Architecture (Preferred Direction)

**Key Insight:**
> "The true power is when teams work and all this can be analyzed in the cloud."

**Proposed Architecture:**
```
Developer Machine          →    Cloud (Supabase)
┌──────────────────┐            ┌─────────────────────┐
│ Claude Code Hook │  ───────►  │ Supabase Database   │
│ (captures prompt)│   HTTP     │ - prompts table     │
└──────────────────┘            │ - users table       │
                                │ - projects table    │
                                └─────────────────────┘
                                         │
                                         ▼
                                ┌─────────────────────┐
                                │ Web Dashboard       │
                                │ - Stats & Charts    │
                                │ - Prompt History    │
                                │ - Team Analytics    │
                                └─────────────────────┘
```

**Key Requirements:**
1. Very easy installation - "run script one time and it starts working"
2. Sets up hooks automatically
3. If user uses BMAD, updates BMAD configuration
4. Stage 1: Focus on Claude Code users only

---

### 4. Analytics Vision (Future Stages)

**Stage 1 - Basic Analytics:**
- Query and access all prompts online
- Basic stats: prompts per day, charts
- Average prompt length
- Timeline visualization

**Stage 2 - Semantic Analysis:**
> "We will want to run an agent over them and feed them into LLM and do analysis of prompt context."

- How exactly the developer is prompting
- What is missing in prompts
- How prompts could be improved
- AI-powered coaching feedback

---

## Installation Experience Goals

**Target User Experience:**
1. Developer runs single install script in project folder
2. Script detects environment (Claude Code, BMAD, etc.)
3. Automatically configures hooks
4. Prompts start flowing to cloud immediately
5. Developer can view dashboard with stats

---

## Open Questions

1. **Authentication:** How do we identify users/teams in Supabase?
2. **Project Association:** How do we link prompts to specific projects?
3. **Privacy:** What data consent/controls are needed?
4. **Pricing Model:** Free tier limits? Team pricing?
5. **Data Retention:** How long to keep prompts?

---

## Next Steps

- [ ] Create Product Brief with formal requirements
- [ ] Research Supabase integration patterns
- [ ] Design database schema for cloud storage
- [ ] Create PRD for cloud-first MVP
- [ ] Define epics and stories for implementation

---

*Document compiled from Contextor prompt journal entries*
