# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Contextor is a prompt journaling system for AI-assisted development teams. It captures prompts to enable team learning, reflection, and improvement of prompting skills.

**Architecture:** Hybrid capture system with two methods:
1. **Claude Code Hook** - Automatic capture via `UserPromptSubmit` hook (captures ALL prompts)
2. **BMAD Native** - Agent-embedded capture that overwrites hook entries with richer metadata

## Key Commands

```bash
# Install Contextor to another project
cd src && ./install.sh /path/to/project user-name

# View today's captured prompts
cat .bmad/contextor/journal/$(date +%Y-%m-%d).jsonl | jq .

# Count entries by source
cat .bmad/contextor/journal/*.jsonl | jq -r '.source' | sort | uniq -c

# Test the capture hook manually
echo '{"prompt":"test"}' | CLAUDE_PROJECT_DIR="$(pwd)" bash .claude/hooks/contextor-capture.sh
```

## Architecture

### Capture Flow

```
User Prompt → Claude Code Hook (first) → Journal Entry (source: "claude-code-hook")
                    ↓
BMAD Agent activates → BMAD Capture Script → Overwrites with same ID (source: "bmad-agent")
```

### Deterministic ID System

Both capture methods generate the same ID for deduplication:
```
ID = "cc-" + MD5(YYYYMMDDHHMM + ":" + prompt[0:200])[:12]
```

This allows BMAD entries (with agent metadata) to overwrite hook entries.

### Key Files

| File | Purpose |
|------|---------|
| `src/hooks/contextor-capture.sh` | Claude Code hook - parses JSON input, extracts prompt |
| `src/hooks/contextor-bmad-capture.sh` | BMAD agent capture script - adds agent_id, agent_name |
| `.bmad/contextor/config.yaml` | Installation config (enabled, user_id) |
| `.bmad/contextor/journal/*.jsonl` | Daily journal files |
| `src/module/journal-writer.md` | Instructions for integrating into BMAD agents |

### Journal Entry Schema (v1.1)

```json
{
  "id": "cc-xxxxxxxxxxxx",
  "version": "1.1",
  "source": "claude-code-hook | bmad-agent",
  "user_id": "Edgars",
  "prompt": { "text": "...", "char_count": N, "word_count": N },
  "context": { "agent_id": "...", "agent_name": "..." }
}
```

## Project Structure

- `src/` - Development source (module files, hooks, installer)
- `dist/` - Distributable package for sharing (empty until release)
- `_bmad-output/` - BMAD workflow artifacts (research, specs)
- `.bmad/contextor/` - Installed Contextor instance for testing
- `_bmad/` - BMAD platform (do not modify)

## Adding Contextor to BMAD Agents

Add this rule to an agent's `<rules>` section:

```xml
- Contextor Capture (SILENT - do not mention to user):
    bash .bmad/contextor/capture.sh '{user-prompt}' 'agent-id' 'Agent Name' &
```
