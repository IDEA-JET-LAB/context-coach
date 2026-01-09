# Custom Agents Installation Guide

## Prerequisites

The target project **must have BMAD Core installed** before adding these agents.

If BMAD is not installed, run:
```bash
npx @anthropic-ai/bmad-core init
```

## Installation Steps

### Option 1: Copy Entire Folder (Recommended)

1. Copy the `agents/` folder to your target project:
   ```bash
   cp -R agents/ /path/to/target-project/_bmad/custom/agents/
   ```

2. The agents will automatically be discovered by BMAD and appear in:
   - Claude Code slash commands as `/bmad:custom:agents:<agent-name>`
   - BMad Master menu under "List Available Tasks"

### Option 2: Copy Individual Agents

To install only specific agents, copy the entire agent folder:

```bash
# Example: Install only marketing-strategist
cp -R agents/marketing-strategist /path/to/target-project/_bmad/custom/agents/

# Example: Install only pixel
cp -R agents/pixel /path/to/target-project/_bmad/custom/agents/
```

## Included Agents

### 1. marketing-strategist
Full-featured marketing agent with:
- Platform guides (LinkedIn, X/Twitter, YouTube, TikTok, Meta)
- Content frameworks and copywriting formulas
- SaaS marketing and PLG playbook
- Video script templates
- AI image generation guide

### 2. pixel
Image and design agent with:
- ImageSorcery protocol for AI image generation
- Project style profiles
- Asset staging and catalog management

### 3. seo-specialist
SEO optimization agent for content and technical SEO.

## Agent Structure

Each agent follows this structure:
```
agent-name/
├── agent-name.agent.yaml    # Main agent definition
├── info-and-installation-guide.md  # Optional: Additional docs
└── agent-name-sidecar/      # Optional: Knowledge & memories
    ├── instructions.md      # Detailed agent instructions
    ├── memories.md          # Agent's persistent memories
    └── knowledge/           # Domain-specific knowledge files
```

## Verification

After installation, verify agents are recognized:

1. In Claude Code, type `/bmad:custom:agents:` and see if agents appear
2. Or activate BMad Master and use `[LT] List Tasks` to see all available agents

## Troubleshooting

**Agents not appearing?**
- Ensure BMAD Core is installed (`_bmad/core/` exists)
- Check that agent YAML files are valid
- Restart Claude Code session

**Sidecar not loading?**
- The sidecar folder name must match: `{agent-name}-sidecar`
- All paths in agent YAML must be relative to agent location
