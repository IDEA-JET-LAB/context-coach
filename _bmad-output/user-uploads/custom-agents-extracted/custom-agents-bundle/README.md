# BMAD Custom Agents Bundle

This bundle contains 3 custom BMAD agents ready to import into any BMAD-enabled project.

## Included Agents

### 1. Pixel - AI Image Artist & Visual Asset Generator
**Icon:** 🎨
**Activation:** `/bmad:custom:agents:pixel`

Expert AI image artist using Google Gemini for generating brand-consistent imagery. Features include:
- Web design assets (heroes, backgrounds, icons)
- Marketing visuals (social media, ads)
- Brand style profile detection
- Batch image generation scripts
- Staging workflow for reviewing generated images

**Sidecar Contents:**
- `instructions.md` - Agent behavioral directives
- `imagesorcery-protocol.md` - Image generation protocol
- `project-style-profile.yaml.template` - Visual style configuration
- `knowledge/` - Reference materials
- `staging/` - Temporary image review folder
- Python scripts for batch generation

---

### 2. Marketing Strategist (Maven) - Digital Marketing & AI Content Expert
**Icon:** 📊
**Activation:** `/bmad:custom:agents:marketing-strategist`

Expert marketing strategist for SaaS and startups. Features 20+ menu triggers:
- Strategy & planning (brand audits, positioning)
- Content creation (calendars, scripts, posts, carousels)
- Advertising (copy, campaigns, audience targeting)
- AI content workflows (image prompts, video guides)
- SaaS-specific tactics (PLG, growth hacking)
- Performance analysis & optimization

**Sidecar Contents:**
- `instructions.md` - Agent behavioral directives
- `memories.md` - Brand context & session history
- `knowledge/` - Extensive marketing knowledge base:
  - Platform guides (LinkedIn, Meta, TikTok, X, YouTube)
  - Content & copywriting frameworks
  - SaaS marketing playbooks
  - Video script templates
- `outputs/` - Generated content folder

---

### 3. SEO Specialist (Sophie) - SEO, AEO & GEO Expert
**Icon:** 🔍
**Activation:** `/bmad:custom:agents:seo-specialist`

Expert search optimization covering traditional SEO plus modern AI search engines. Features 25+ prompts:
- **SEO**: Full audits, technical audits, schema generation, keyword research
- **AEO**: Answer Engine Optimization for featured snippets
- **GEO**: Generative Engine Optimization for ChatGPT/Claude visibility
- **Unified**: Complete SEO + AEO + GEO audit in one

---

## Installation

### Option 1: Automatic Installation (Recommended)

Run the import script in your target project:

```bash
# From your target project root (must have .bmad folder)
./path/to/custom-agents-bundle/import.sh
```

### Option 2: Manual Installation

1. **Copy agent files to your project:**

```bash
# Copy to .bmad/custom/agents/ in your target project
cp -r agents/pixel /path/to/target/.bmad/custom/agents/
cp -r agents/marketing-strategist /path/to/target/.bmad/custom/agents/
cp -r agents/seo-specialist /path/to/target/.bmad/custom/agents/
```

2. **Register agents in manifest** (`.bmad/_cfg/agent-manifest.csv`):

Add these lines to your agent manifest:

```csv
"pixel","Pixel","AI Image Artist & Visual Asset Generator using Google Gemini","🎨","AI Image Artist + Visual Asset Generator","Expert AI image artist...","Creative yet precise...","Quality over speed...","custom",".bmad/custom/agents/pixel/pixel.agent.yaml"
"marketing-strategist","Marketing Strategist","Digital Marketing & AI Content Expert for SaaS and Startups","📊","Marketing Strategist + Content Expert","Expert marketing strategist...","Approachable and strategic...","Data-driven with creative flair...","custom",".bmad/custom/agents/marketing-strategist/marketing-strategist.agent.yaml"
"seo-specialist","SEO Specialist","SEO, AEO & GEO Expert","🔍","SEO + AEO + GEO Expert","Expert search optimization...","Clear and analytical...","Thorough and methodical...","custom",".bmad/custom/agents/seo-specialist/seo-specialist.agent.yaml"
```

3. **Configure output paths** (optional):

Edit the agent YAML files to update `output_folder` paths for your project structure.

---

## Post-Installation

### Reset Memories (Recommended)

The agents include memories from their source project. Reset them for a fresh start:

```bash
# Clear Pixel memories
echo "# Pixel Memories\n\nNo memories recorded yet." > .bmad/custom/agents/pixel/pixel-sidecar/memories.md

# Clear Marketing Strategist memories
echo "# Marketing Strategist Memories\n\nNo memories recorded yet." > .bmad/custom/agents/marketing-strategist/marketing-strategist-sidecar/memories.md
```

### Configure Pixel for Your Project

1. Copy the style profile template:
```bash
cp pixel-sidecar/project-style-profile.yaml.template pixel-sidecar/project-style-profile.yaml
```

2. Edit `project-configs/default.yaml` to set your output paths.

### Verify Installation

Test each agent activation:
```
/bmad:custom:agents:pixel
/bmad:custom:agents:marketing-strategist
/bmad:custom:agents:seo-specialist
```

---

## Requirements

- BMAD Core 6.0+ installed in target project
- For Pixel agent: Google Gemini API access (for image generation)
- For Marketing Strategist: Firecrawl MCP recommended (for research)

---

## Bundle Info

- **Created:** 2025-12-21
- **Source Project:** IdeaJetLab
- **BMAD Version:** 6.0.0-alpha.16
