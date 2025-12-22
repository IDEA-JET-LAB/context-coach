# AI Image Generation Guide

> Reference guide for Maven's AI image generation recommendations.

---

## Overview

AI image generation tools like Midjourney, DALL-E, and Stable Diffusion can create marketing visuals at scale. This guide covers prompt engineering, best practices, and workflows for marketing use cases.

---

## Tool Comparison

| Tool | Best For | Style | Cost | Learning Curve |
|------|----------|-------|------|----------------|
| **Midjourney** | Artistic, stylized imagery | Beautiful, aesthetic | $10-60/mo | Medium |
| **DALL-E 3** | Realistic, text rendering | Clean, accurate | Pay per image | Easy |
| **Stable Diffusion** | Customization, fine-tuning | Variable | Free (self-host) | Hard |
| **Adobe Firefly** | Brand-safe, commercial use | Adobe style | Adobe sub | Easy |
| **Leonardo.ai** | Marketing graphics | Versatile | Freemium | Medium |

### Recommendation by Use Case

| Use Case | Recommended Tool |
|----------|------------------|
| Social media graphics | Midjourney, Leonardo |
| Product mockups | DALL-E 3, Stable Diffusion |
| Ad creatives | Midjourney, Adobe Firefly |
| Blog post images | DALL-E 3, Midjourney |
| Text-heavy graphics | DALL-E 3 (best text rendering) |
| Brand-consistent imagery | Stable Diffusion (fine-tuned) |

---

## Prompt Engineering Fundamentals

### The Prompt Formula

```
[Subject] + [Style] + [Composition] + [Lighting] + [Quality Modifiers]
```

**Example:**
```
A modern SaaS dashboard interface on a laptop screen,
minimalist flat design style,
centered composition with negative space,
soft natural lighting from the left,
4K, highly detailed, professional photography
```

### Prompt Components

#### 1. Subject (What)
- Be specific: "A smiling woman using a laptop" > "A person working"
- Include context: "in a modern office" > (no context)
- Add details: "wearing business casual, mid-30s, confident expression"

#### 2. Style (How it looks)
- Photography: "professional photography, DSLR, 85mm lens"
- Illustration: "flat illustration, vector art, minimalist"
- 3D: "3D render, octane render, cinema 4D"
- Artistic: "oil painting style, watercolor, impressionist"

#### 3. Composition
- "centered composition"
- "rule of thirds"
- "close-up shot"
- "wide angle"
- "birds eye view"
- "negative space on the right for text"

#### 4. Lighting
- "soft natural lighting"
- "studio lighting"
- "golden hour"
- "dramatic side lighting"
- "bright and airy"

#### 5. Quality Modifiers
- "4K, highly detailed"
- "professional photography"
- "award-winning"
- "trending on Behance"
- "hyperrealistic"

---

## Marketing-Specific Prompts

### Social Media Graphics

**Hero Image with Text Space:**
```
Modern abstract gradient background in [brand colors],
flowing organic shapes,
minimalist design,
large negative space on the left for text overlay,
4K resolution, vibrant colors
```

**Product Feature Highlight:**
```
Clean 3D render of a floating smartphone screen
showing [app interface description],
soft gradient background in [color],
subtle shadow beneath,
marketing mockup style,
highly polished, professional
```

### Ad Creatives

**Lifestyle Ad Image:**
```
[Target demographic] using [product type] in [setting],
candid moment, genuine smile,
bright natural lighting,
shallow depth of field,
professional advertising photography,
aspirational lifestyle
```

**Product-Focused Ad:**
```
[Product] on a clean [surface color] background,
studio product photography,
soft box lighting,
slight reflection beneath,
e-commerce style,
high resolution, sharp details
```

### Blog & Content

**Blog Header - Conceptual:**
```
Abstract visualization of [concept],
modern digital art style,
[brand colors] color palette,
clean and professional,
wide aspect ratio for blog header,
trending on Dribbble
```

**Blog Header - Realistic:**
```
[Scene description] relevant to [blog topic],
editorial photography style,
natural lighting,
horizontal composition,
professional stock photo quality
```

### Testimonial & Social Proof

**Customer Success Imagery:**
```
Diverse group of professionals celebrating success,
modern office environment,
genuine expressions of achievement,
warm natural lighting,
corporate but not stock-photo-fake,
candid moment captured
```

---

## Negative Prompts

Negative prompts tell the AI what to avoid. Essential for quality:

### Universal Negative Prompts
```
blurry, low quality, distorted, deformed, ugly,
bad anatomy, extra limbs, mutated,
watermark, signature, text overlay,
cropped, out of frame
```

### For People
```
distorted faces, extra fingers, mutated hands,
uncanny valley, plastic skin,
asymmetrical eyes, weird teeth
```

### For Products
```
warped perspective, inconsistent lighting,
unrealistic shadows, floating objects,
low resolution textures
```

### For Marketing
```
cluttered, busy background, distracting elements,
unprofessional, amateur looking,
generic stock photo feel
```

---

## Tool-Specific Syntax

### Midjourney

**Basic Structure:**
```
/imagine prompt: [your prompt] --ar 16:9 --v 6
```

**Key Parameters:**
| Parameter | Description | Example |
|-----------|-------------|---------|
| `--ar` | Aspect ratio | `--ar 16:9`, `--ar 1:1`, `--ar 9:16` |
| `--v` | Version | `--v 6` (latest) |
| `--stylize` | Artistic interpretation | `--stylize 100` (low) to `--stylize 1000` (high) |
| `--chaos` | Variation | `--chaos 0` (consistent) to `--chaos 100` (wild) |
| `--no` | Negative prompt | `--no text, watermark` |
| `--style raw` | Less stylized | For realistic images |

**Example:**
```
/imagine prompt: modern SaaS dashboard UI on laptop,
minimalist design, clean interface,
soft natural lighting, professional photography
--ar 16:9 --v 6 --stylize 250
```

### DALL-E 3

**Best Practices:**
- Natural language works well
- Be very specific about what you want
- Include size: "wide image" or "square image"
- Text rendering: Specify exact text in quotes

**Example:**
```
Create a wide professional marketing image showing
a diverse team of professionals collaborating around
a large digital screen displaying analytics charts.
Modern office setting with large windows,
bright natural light. Corporate but warm atmosphere.
```

### Stable Diffusion

**Basic Structure:**
```
Prompt: [positive prompt]
Negative Prompt: [negative prompt]
Steps: 30-50
CFG Scale: 7-12
Sampler: DPM++ 2M Karras
```

**Example:**
```
Prompt: professional product photography of a sleek
smartphone on white marble surface, soft studio lighting,
reflection, minimalist, commercial photography, 8K

Negative: blurry, low quality, amateur, cluttered background,
harsh shadows, overexposed
```

---

## Aspect Ratios by Use Case

| Platform/Use | Aspect Ratio | Midjourney |
|--------------|--------------|------------|
| Instagram Feed | 1:1 or 4:5 | `--ar 1:1` or `--ar 4:5` |
| Instagram Stories | 9:16 | `--ar 9:16` |
| Facebook Post | 1.91:1 | `--ar 191:100` |
| LinkedIn Post | 1.91:1 | `--ar 191:100` |
| Twitter/X Post | 16:9 | `--ar 16:9` |
| Blog Header | 16:9 or 2:1 | `--ar 16:9` or `--ar 2:1` |
| YouTube Thumbnail | 16:9 | `--ar 16:9` |
| Pinterest | 2:3 | `--ar 2:3` |
| Ad Banner | Various | Match ad specs |

---

## Workflow: From Brief to Final Image

### Step 1: Define Requirements
- What is the image for? (Ad, social, blog)
- What size/aspect ratio?
- What style matches the brand?
- What message should it convey?
- What text will be overlaid?

### Step 2: Draft Initial Prompt
Use the formula: Subject + Style + Composition + Lighting + Quality

### Step 3: Generate Variations
- Create 4-8 variations
- Use different style approaches
- Vary composition for options

### Step 4: Refine
- Select best candidates
- Use "vary" or "upscale" features
- Adjust prompt for improvements

### Step 5: Post-Process
- Crop/resize as needed
- Adjust colors for brand consistency
- Add text overlays if needed
- Final quality check

---

## Commercial Use Considerations

### Licensing by Tool

| Tool | Commercial Use | Notes |
|------|----------------|-------|
| Midjourney | Yes (paid plans) | Own generated images |
| DALL-E 3 | Yes | Check current terms |
| Stable Diffusion | Yes | Depends on model used |
| Adobe Firefly | Yes | Designed for commercial use |

### Best Practices

1. **Keep records** - Save prompts and generation metadata
2. **Avoid likeness** - Don't generate recognizable people
3. **Check trademarks** - Don't include branded items
4. **Disclose when required** - Some contexts require AI disclosure
5. **Use for ideation** - Consider AI as starting point, not final

### When to Avoid AI Images

- When authenticity matters (team photos, customer photos)
- Testimonials (use real customer photos)
- Before/after claims (must be real)
- Regulated industries (check compliance)

---

## Quality Checklist

Before using an AI-generated image:

- [ ] Resolution sufficient for intended use?
- [ ] No obvious AI artifacts (hands, text, faces)?
- [ ] Consistent with brand guidelines?
- [ ] Appropriate for target audience?
- [ ] Legal/compliance considerations addressed?
- [ ] Post-processing completed?
- [ ] Matches overall campaign aesthetic?

---

*Maven uses this guide when creating AI image prompts for marketing use cases.*
