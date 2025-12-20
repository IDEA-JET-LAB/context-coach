# Contextor Project

**Prompt Journaling for AI-Assisted Development Teams**

---

## Overview

Contextor is a system for capturing and analyzing prompts during AI-assisted development sessions. It enables teams to:

- Learn from each other's prompting techniques
- Identify patterns in effective prompts
- Improve prompt engineering skills
- Track AI usage across projects

---

## Project Status

**Current Phase:** MVP Development
**Version:** 0.1.0

### Completed
- [x] Approach evaluation and decision
- [x] MVP specification
- [x] BMAD module structure
- [x] Claude Code hook implementation
- [x] Install script

### In Progress
- [ ] Real-world testing
- [ ] Team deployment

### Future Phases
- [ ] Prompt analysis agent
- [ ] Team analytics dashboard
- [ ] Quality scoring rubric
- [ ] Visualization frontend

---

## Project Structure

```
contextor/
├── _bmad/                             # BMAD platform installation
├── _bmad-output/                      # BMAD workflow artifacts
│   ├── research/
│   │   └── approach-evaluation.md     # Decision process documentation
│   └── specs/
│       └── mvp-specification.md       # Technical specification
├── src/                               # Development source
│   ├── install.sh                     # Installation script
│   ├── module/
│   │   ├── module.yaml                # BMAD module metadata
│   │   ├── config.template.yaml       # Configuration template
│   │   ├── journal-writer.md          # BMAD agent instructions
│   │   └── README.md                  # User documentation
│   └── hooks/
│       ├── contextor-capture.sh   # Claude Code hook script
│       └── hooks-config-example.json  # Hook configuration example
├── dist/                              # Distributable package (for sharing)
├── .bmad/                             # Contextor installed (for testing)
│   └── contextor/
└── README.md                          # This file
```

---

## Quick Start

### Installation

```bash
# From this project's src folder
cd src

# Run installer (from target project)
./install.sh /path/to/your/project your-name
```

### Manual Installation

1. Copy module files to `.bmad/modules/contextor/`
2. Create config at `.bmad/contextor/config.yaml`
3. Create journal directory `.bmad/contextor/journal/`
4. (Optional) Install Claude Code hook

See `src/module/README.md` for detailed instructions.

---

## How It Works

### Two Capture Methods

1. **BMAD Native** (Universal)
   - Works with any AI CLI tool
   - Instructions embedded in agent activation
   - Captures prompts when using BMAD agents

2. **Claude Code Hook** (Enhanced)
   - Automatic capture via Claude Code hooks
   - Captures ALL prompts, not just BMAD sessions
   - Only available for Claude Code users

### Data Storage

Prompts stored in JSONL format:
```
.bmad/contextor/journal/
├── 2025-12-18.jsonl
├── 2025-12-19.jsonl
└── ...
```

---

## Key Documents

| Document | Description |
|----------|-------------|
| [Approach Evaluation](_bmad-output/research/approach-evaluation.md) | How we decided on this architecture |
| [MVP Specification](_bmad-output/specs/mvp-specification.md) | Technical details and data schema |
| [User Documentation](src/module/README.md) | End-user guide |

---

## Architecture Decision

After evaluating multiple approaches:
- Tool-specific hooks (fragmented)
- MCP server (complex, unreliable triggering)
- Proxy/middleware (overkill)
- BMAD native (universal but BMAD-only)

**Selected:** BMAD Native + Claude Code Hooks hybrid

This provides universal coverage through BMAD while enhancing capture for Claude Code users.

See [Approach Evaluation](_bmad-output/research/approach-evaluation.md) for full analysis.

---

## Team Usage

For team deployment:

1. Each team member installs Contextor in their projects
2. Set unique `user_id` in config
3. Optionally share journals via git or shared storage
4. Review prompts in team sessions for learning

---

## Privacy Considerations

- All data stored locally by default
- Project-scoped (each project has own journal)
- User controls enable/disable
- No external services or cloud storage

---

## Contributing

This is an internal IdeaJetLab project. For suggestions:
1. Create an issue in the main repository
2. Tag with `contextor` label

---

*Contextor - Learn from every prompt*
