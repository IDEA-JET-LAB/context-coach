# Marketing Strategist Agent - Installation Guide

**Last Updated:** 2025-12-12
**Version:** 1.0.0
**Type:** Expert Agent

---

## Table of Contents

- [Overview](#overview) (Line ~25)
- [Requirements](#requirements) (Line ~45)
- [Installation](#installation) (Line ~60)
- [Activation](#activation) (Line ~100)
- [Configuration](#configuration) (Line ~130)
- [Usage](#usage) (Line ~170)
- [Troubleshooting](#troubleshooting) (Line ~230)

---

## Overview

The **Marketing Strategist** (codename: Maven) is a BMAD Expert Agent specializing in digital marketing, social media strategy, and AI-generated content creation for SaaS companies and startups.

### Key Features

- **22 menu commands** for marketing tasks
- **Persistent memory** for brand context continuity
- **Platform expertise** across TikTok, YouTube, Meta, LinkedIn, X
- **AI content guidance** for image and video generation
- **SaaS specialization** with growth and PLG tactics

### Agent Type

This is an **Expert Agent** with:
- Sidecar folder for persistent memory and knowledge
- Self-contained YAML definition
- Standalone operation (not tied to a module)

---

## Requirements

- **BMAD Core:** v6.0.0-alpha.8 or later
- **IDE:** Claude Code (recommended) or compatible
- **Project Structure:** Standard BMAD folder structure (`.bmad/`)

### File Dependencies

The agent requires these files to function:

```
.bmad/custom/src/agents/marketing-strategist/
├── marketing-strategist.agent.yaml     # Main agent definition
├── info-and-installation-guide.md      # This file
└── marketing-strategist-sidecar/
    ├── instructions.md                  # Behavioral directives
    ├── memories.md                      # Persistent context
    └── knowledge/                       # Knowledge base files
```

---

## Installation

### Automatic Installation

If you received this agent as a package:

1. Extract to your project's `.bmad/custom/src/agents/` directory
2. Copy the slash command to `.claude/commands/bmad/custom/agents/`
3. Copy the customization file to `.bmad/_cfg/agents/`

### Manual Installation

The agent should already be installed if you're reading this. Verify with:

```bash
# Check agent file exists
ls -la .bmad/custom/src/agents/marketing-strategist/

# Check slash command exists
ls -la .claude/commands/bmad/custom/agents/marketing-strategist.md

# Check customization file exists
ls -la .bmad/_cfg/agents/custom-marketing-strategist.customize.yaml
```

### Directory Structure Verification

```
.bmad/
├── custom/
│   └── src/
│       └── agents/
│           └── marketing-strategist/
│               ├── marketing-strategist.agent.yaml
│               ├── info-and-installation-guide.md
│               └── marketing-strategist-sidecar/
│                   ├── instructions.md
│                   ├── memories.md
│                   └── knowledge/
│                       ├── frameworks/
│                       ├── platforms/
│                       ├── templates/
│                       ├── saas/
│                       └── ai-content/
├── _cfg/
│   └── agents/
│       └── custom-marketing-strategist.customize.yaml
```

---

## Activation

### Via Slash Command (Recommended)

In Claude Code, type:

```
/bmad:custom:agents:marketing-strategist
```

This will:
1. Load the agent YAML
2. Load sidecar files (memories.md, instructions.md)
3. Display Maven's greeting and menu

### Via Direct Invocation

You can also ask Claude to activate the agent:

```
Please activate the Marketing Strategist agent from .bmad/custom/src/agents/marketing-strategist/
```

### Expected Startup Behavior

When activated, Maven will:
1. Load and acknowledge brand context from memories.md
2. Note if this is a new session (no prior context)
3. Display the categorized menu of commands
4. Wait for your input

---

## Configuration

### Customization File

Edit `.bmad/_cfg/agents/custom-marketing-strategist.customize.yaml` to adjust:

```yaml
# Communication style preference
customization:
  communication_style: "direct"  # Options: direct, friendly, formal

# Default platform focus
  default_platform: null  # Options: tiktok, youtube, meta, linkedin, x

# Industry specialization
  industry_focus: "saas"  # Options: saas, ecommerce, b2b, b2c, agency

# Output format preference
  content_output_format: "markdown"  # Options: markdown, notion, google-docs
```

### Output Location

By default, generated marketing content goes to:

```
{project-root}/docs/marketing/
```

To change this, modify the `output_folder` in the customization file.

### Memory Persistence

Brand context is stored in:

```
.bmad/custom/src/agents/marketing-strategist/marketing-strategist-sidecar/memories.md
```

This file is updated at session end with any new brand information learned.

---

## Usage

### Available Commands

#### Strategy & Planning
| Command | Description |
|---------|-------------|
| `*strategy` | Create comprehensive marketing strategy |
| `*launch` | Design product/feature launch campaign |
| `*audit` | Audit existing marketing presence |

#### Content Creation
| Command | Description |
|---------|-------------|
| `*content-plan` | Create content calendar |
| `*video-script` | Generate video scripts |
| `*post` | Write social media posts |
| `*carousel` | Design carousel content |
| `*repurpose` | Transform content across platforms |

#### Advertising
| Command | Description |
|---------|-------------|
| `*ad-copy` | Write ad copy |
| `*campaign` | Design ad campaigns |
| `*audience` | Define target audiences |

#### AI Content
| Command | Description |
|---------|-------------|
| `*ai-image` | AI image generation prompts |
| `*ai-video` | AI video generation guide |
| `*ai-workflow` | AI content workflow design |

#### SaaS & Startup
| Command | Description |
|---------|-------------|
| `*saas-growth` | SaaS growth marketing plan |
| `*plg` | Product-led growth tactics |
| `*founder-brand` | Founder personal branding |

#### Analysis & Utility
| Command | Description |
|---------|-------------|
| `*analyze` | Analyze performance data |
| `*optimize` | Optimize campaigns |
| `*brand` | Set/update brand context |
| `*trends` | Get current platform trends |
| `*tools` | Tool recommendations |
| `*menu` | Show all commands |
| `*dismiss` | Exit agent |

### Example Session

```
You: /bmad:custom:agents:marketing-strategist

Maven: [Greeting and menu display]

You: *brand

Maven: [Brand context capture process]

You: *content-plan

Maven: [Content calendar creation workflow]

You: *dismiss

Maven: [Saves context and exits]
```

---

## Troubleshooting

### Agent Won't Activate

**Check:** Slash command file exists
```bash
cat .claude/commands/bmad/custom/agents/marketing-strategist.md
```

**Check:** Agent YAML is valid
```bash
cat .bmad/custom/src/agents/marketing-strategist/marketing-strategist.agent.yaml
```

### Memory Not Persisting

**Check:** memories.md is writable
```bash
ls -la .bmad/custom/src/agents/marketing-strategist/marketing-strategist-sidecar/memories.md
```

**Solution:** Ensure you use `*dismiss` to exit (triggers memory save).

### Knowledge Files Not Loading

**Check:** Knowledge directory structure
```bash
ls -la .bmad/custom/src/agents/marketing-strategist/marketing-strategist-sidecar/knowledge/
```

**Note:** Knowledge files are loaded on-demand when referenced by commands.

### Commands Not Recognized

**Check:** You're using the correct format: `*command` (with asterisk)

**Check:** Agent is fully activated before issuing commands.

---

## Extending the Agent

### Adding Knowledge Files

Add new knowledge to the sidecar:

```
marketing-strategist-sidecar/knowledge/
├── platforms/tiktok-guide.md    # Platform-specific guides
├── frameworks/new-framework.md  # New content frameworks
├── templates/new-template.md    # New templates
```

### Customizing Prompts

Edit the prompts section in `marketing-strategist.agent.yaml` to modify command behavior.

### Adding Commands

Add new menu items and corresponding prompts to the agent YAML.

---

## Support

- **Specification:** `docs/SPEC-bmad-marketing-strategist-agent.md`
- **BMAD Documentation:** `.bmad/docs/`
- **Issue Reporting:** Contact project maintainer

---

*Marketing Strategist Agent v1.0.0 - Built with BMAD v6*
