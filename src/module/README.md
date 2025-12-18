# Context Coach

**Prompt Journaling for AI-Assisted Development Teams**

Context Coach captures your prompts during development sessions, enabling team learning and prompt quality improvement.

---

## Quick Start

### 1. Install the Module

Copy the module to your project:

```bash
# From your project root
mkdir -p .bmad/modules/context-coach
mkdir -p .bmad/context-coach/journal

# Copy module files
cp -r path/to/context-coach/module/* .bmad/modules/context-coach/
```

### 2. Configure

Create your config file:

```bash
cp .bmad/modules/context-coach/config.template.yaml .bmad/context-coach/config.yaml
```

Edit `.bmad/context-coach/config.yaml`:

```yaml
enabled: true
user_id: "your-name"  # Change this!
journal_path: ".bmad/context-coach/journal"
```

### 3. Use Normally

That's it! When you use BMAD agents, your prompts will be automatically logged.

---

## How It Works

### BMAD Agent Capture

When you activate any BMAD agent, the agent checks for Context Coach and logs your prompt before proceeding.

**What's captured:**
- Your prompt text
- Timestamp
- Project information
- Which agent was engaged

**What's NOT captured:**
- AI responses (MVP - future feature)
- Passwords/secrets (if configured)
- System prompts

### Claude Code Hook (Optional)

For enhanced capture with Claude Code, install the hook script to capture ALL prompts, not just BMAD sessions.

See: [Claude Code Hook Setup](#claude-code-hook-setup)

---

## Journal Format

Prompts are stored in daily JSONL files:

```
.bmad/context-coach/journal/
├── 2025-12-18.jsonl
├── 2025-12-19.jsonl
└── ...
```

Each line is a JSON object:

```json
{
  "id": "20251218-143215-a7x9",
  "version": "1.0",
  "timestamp": "2025-12-18T14:32:15.123Z",
  "user_id": "edgars",
  "source": "bmad-agent",
  "project": {
    "path": "/Users/edgars/projects/my-app",
    "name": "my-app",
    "git_branch": "main"
  },
  "prompt": {
    "text": "Help me refactor the authentication module",
    "char_count": 43,
    "word_count": 7
  },
  "context": {
    "agent_id": ".bmad/bmm/agents/dev.md",
    "agent_name": "dev"
  }
}
```

---

## Viewing Your Prompts

### Quick View

```bash
# Today's prompts
cat .bmad/context-coach/journal/$(date +%Y-%m-%d).jsonl | jq .

# Count today's prompts
wc -l .bmad/context-coach/journal/$(date +%Y-%m-%d).jsonl

# Search for specific text
grep "refactor" .bmad/context-coach/journal/*.jsonl | jq .
```

### Pretty Print

```bash
# View all prompts nicely formatted
cat .bmad/context-coach/journal/*.jsonl | jq -s '.'
```

---

## Configuration Options

```yaml
# .bmad/context-coach/config.yaml

# Master switch
enabled: true

# Your team identifier
user_id: "your-name"

# Storage location
journal_path: ".bmad/context-coach/journal"

# Exclude sensitive patterns (optional)
exclude_patterns:
  - "password"
  - "secret"
  - "api_key"
```

---

## Claude Code Hook Setup

For Claude Code users, add automatic capture of ALL prompts:

### 1. Create Hook Script

Save this as `.claude/hooks/context-coach-capture.sh`:

```bash
#!/bin/bash
# Context Coach - Claude Code Hook
# Captures prompts automatically

# ... (see implementation/hooks/context-coach-capture.sh)
```

### 2. Make Executable

```bash
chmod +x .claude/hooks/context-coach-capture.sh
```

### 3. Configure Claude Code

Add to your Claude Code hooks configuration:

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

---

## Privacy & Security

- **Local Only**: All data stays on your machine
- **Project Scoped**: Each project has its own journal
- **You Control**: Enable/disable anytime
- **Exclude Sensitive**: Configure patterns to skip

### Git Ignore

Add to your `.gitignore` if you don't want to share journals:

```
.bmad/context-coach/journal/
```

Or commit them for team visibility - your choice!

---

## Team Usage

For team learning:

1. Each team member sets their `user_id`
2. Optionally commit journals to shared repo
3. Review prompts in team meetings
4. Learn from each other's approaches

---

## Troubleshooting

### Prompts Not Being Logged

1. Check config exists: `cat .bmad/context-coach/config.yaml`
2. Verify enabled: `grep enabled .bmad/context-coach/config.yaml`
3. Check journal directory exists: `ls .bmad/context-coach/journal/`

### Large Journal Files

Daily rotation keeps files manageable. For archival:

```bash
# Compress old journals
gzip .bmad/context-coach/journal/2025-12-*.jsonl
```

---

## Roadmap

- [x] MVP: Prompt capture and storage
- [ ] Response capture
- [ ] Prompt analysis agent
- [ ] Team analytics dashboard
- [ ] Quality scoring
- [ ] Improvement suggestions

---

## Support

Questions or issues? Open an issue in the repository.

---

*Context Coach - Learn from every prompt*
