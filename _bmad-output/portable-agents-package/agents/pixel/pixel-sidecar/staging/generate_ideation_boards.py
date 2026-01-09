#!/usr/bin/env python3
"""
Contextor Logo Ideation Boards
Deep exploration of Context Layers + C concept
5 boards × 4-6 variations each
"""

import os
import sys
from datetime import datetime
from pathlib import Path

from google import genai
from google.genai import types

# CRITICAL: Use GEMINI_API_KEY explicitly
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY not set")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-3-pro-image-preview"

STAGING_DIR = Path(__file__).parent
TIMESTAMP = datetime.now().strftime("%Y%m%d-%H%M%S")

# Base context for all boards
BRAND_CONTEXT = """
BRAND: "Contextor" - AI context coaching platform for developers
KEYWORDS: Coaching, AI, vibe-coding, context, learning, guidance
CORE CONCEPT: Layered shapes with integrated letter "C"
The "C" should feel NATIVE to the shape - not just placed on top, but designed as part of the geometry.
"""

# 5 Exploration Boards
BOARDS = [
    {
        "name": "board1-shape-exploration",
        "title": "Shape Exploration",
        "prompt": f"""
Create a logo exploration board showing 6 variations of the "Context Layers + C" concept.

{BRAND_CONTEXT}

LAYOUT: 2 rows × 3 columns of logo variations, evenly spaced on dark background (#1A1A1A)
Each logo should be the same size, cleanly separated with visible spacing between them.

THE 6 VARIATIONS (left to right, top to bottom):
1. HEXAGON layers with C - 2-3 concentric hexagons, C integrated into inner shape
2. PENTAGON layers with C - 2-3 concentric pentagons, C follows angular aesthetic
3. CIRCLE layers with C - 2-3 concentric circles, C with rounded terminals
4. ROUNDED SQUARE layers with C - 2-3 squircles, C with matching corner radius
5. OCTAGON layers with C - 2-3 octagons, C geometric and angular
6. DIAMOND/RHOMBUS layers with C - 2-3 rotated squares, C bold and centered

STYLE FOR ALL:
- White shapes on dark gray (#1A1A1A) background
- The C must feel INTEGRATED with the shape geometry, not just placed
- C should be bold and prominent (40-50% of inner area)
- Clean, minimal, tech-forward
- Flat design, no shadows
- Each logo self-contained with padding

OUTPUT: Single image with all 6 variations in a neat grid layout.
"""
    },
    {
        "name": "board2-isometric-3d",
        "title": "Isometric 3D Exploration",
        "prompt": f"""
Create a logo exploration board showing 6 ISOMETRIC 3D variations of the "Context Layers + C" concept.

{BRAND_CONTEXT}

LAYOUT: 2 rows × 3 columns of logo variations on dark background (#1A1A1A)

THE 6 ISOMETRIC 3D VARIATIONS:
1. STACKED PLATFORMS - Hexagonal platforms stacked in 3D, C on top platform, viewed from isometric angle
2. FLOATING LAYERS - 3 floating hexagonal planes at different heights, C emerges from arrangement
3. EXTRUDED C - The C letter itself is 3D extruded, sitting within hexagonal frame
4. CUBE WITH C - Isometric cube/box with C visible on front face, layered edges
5. PRISM LAYERS - Triangular prism layers stacked, C integrated on front
6. CYLINDER STACK - Circular discs stacked isometrically, C carved into top

STYLE FOR ALL:
- Isometric 3D perspective (30° angle typical)
- White/light gray with subtle depth shading (minimal, not heavy shadows)
- The 3D should feel modern and tech, not cartoonish
- C remains prominent and readable
- Clean edges, geometric precision
- Dark background (#1A1A1A)

OUTPUT: Single image with all 6 isometric variations in grid layout.
"""
    },
    {
        "name": "board3-gradient-modern",
        "title": "Modern Gradient Exploration",
        "prompt": f"""
Create a logo exploration board showing 6 GRADIENT variations of the "Context Layers + C" concept.

{BRAND_CONTEXT}

LAYOUT: 2 rows × 3 columns of logo variations on dark background (#0D0D0D)

THE 6 GRADIENT VARIATIONS:
1. SUNSET GRADIENT - Warm orange to pink gradient on layers, white C
2. OCEAN GRADIENT - Teal to blue gradient, layers have gradient fill, C is white
3. AURORA GRADIENT - Green to purple to blue gradient across layers
4. EMBER GRADIENT - Deep red to orange, like glowing coals, sophisticated
5. FROST GRADIENT - Light blue to white, cool and clean, icy feel
6. NEON GRADIENT - Electric pink to cyan, vibrant and modern

STYLE FOR ALL:
- Gradients should be smooth and modern (2024/2025 design trends)
- Gradients apply to the LAYERS, C can be white or contrasting
- Dark background (#0D0D0D) to make colors pop
- Hexagon or rounded square shapes for layers
- C integrated into design, bold and readable
- Gradients should feel premium, not cheap
- Clean edges, no glow effects

OUTPUT: Single image with all 6 gradient variations in grid layout.
"""
    },
    {
        "name": "board4-c-integration",
        "title": "C-Integration Styles",
        "prompt": f"""
Create a logo exploration board showing 6 different ways to INTEGRATE the letter C with the layered shapes.

{BRAND_CONTEXT}

LAYOUT: 2 rows × 3 columns of logo variations on dark background (#1A1A1A)

THE 6 C-INTEGRATION APPROACHES:
1. C AS CUTOUT - The C is cut OUT of the inner layer (negative space), layers are solid white
2. C FORMS FROM LAYERS - The layers themselves arrange to suggest/form the C shape
3. C WITH MATCHING ANGLES - C letterform designed with same angles as hexagon (60° cuts)
4. C AS OPENING - The innermost layer has a C-shaped opening/gap
5. C BREAKS THE FRAME - The C extends slightly beyond the inner layer, breaking containment
6. LAYERED C - The C itself has layers/depth, matching the surrounding frame layers

STYLE FOR ALL:
- White on dark gray (#1A1A1A)
- Hexagonal layers as the base shape
- The C should feel DESIGNED for this context, not a font
- Geometric, minimal, sophisticated
- Each approach should be distinctly different
- C must remain recognizable as the letter C

OUTPUT: Single image with all 6 C-integration variations in grid layout.
"""
    },
    {
        "name": "board5-hybrid-premium",
        "title": "Premium Hybrid Concepts",
        "prompt": f"""
Create a logo exploration board showing 6 PREMIUM HYBRID variations combining the best ideas.

{BRAND_CONTEXT}

LAYOUT: 2 rows × 3 columns of logo variations on dark background (#0D0D0D)

THE 6 PREMIUM HYBRID CONCEPTS:
1. ISOMETRIC GRADIENT - 3D isometric hexagon layers with subtle blue-to-purple gradient, white C
2. GLASS MORPHISM - Frosted glass effect layers, subtle blur, C appears to float
3. MINIMAL LUXE - Ultra-minimal, just 2 thin hexagon outlines + bold C, lots of whitespace
4. TECH CIRCUIT - Layers have subtle circuit-line patterns, C is solid and bold
5. DYNAMIC MOTION - Layers appear slightly offset suggesting motion/energy, C anchors center
6. NEON OUTLINE - Dark layers with glowing neon edge outline (cyan or orange), C glows subtly

STYLE FOR ALL:
- Premium, sophisticated, could work for a high-end SaaS
- Modern 2024/2025 design aesthetics
- Dark background to feel premium
- C is always prominent and readable
- Balance between creative and professional
- Each should feel like a finished, polished concept

OUTPUT: Single image with all 6 premium hybrid variations in grid layout.
"""
    }
]

def generate_board(board, index):
    """Generate a single exploration board"""
    name = board["name"]
    title = board["title"]
    prompt = board["prompt"]

    print(f"\n{'='*60}")
    print(f"Board {index+1}/5: {title}")
    print(f"{'='*60}")

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE']
            )
        )

        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                image_data = part.inline_data.data
                filename = f"{name}-{TIMESTAMP}.png"
                filepath = STAGING_DIR / filename

                with open(filepath, "wb") as f:
                    f.write(image_data)

                print(f"✓ Saved: {filename}")
                return str(filepath)
            elif part.text:
                print(f"Model note: {part.text[:150]}...")

        print("⚠ No image in response")
        return None

    except Exception as e:
        print(f"✗ ERROR: {type(e).__name__}: {e}")
        return None

def main():
    print("\n" + "="*70)
    print("CONTEXTOR LOGO IDEATION - 5 EXPLORATION BOARDS")
    print(f"Model: {MODEL} (Nano Banana Pro)")
    print("Each board: 6 variations in grid layout")
    print("="*70)

    generated = []

    for i, board in enumerate(BOARDS):
        filepath = generate_board(board, i)
        if filepath:
            generated.append(filepath)

    print("\n" + "="*70)
    print(f"COMPLETE: {len(generated)}/5 boards generated")
    print("="*70)

    for path in generated:
        print(f"  ✓ {Path(path).name}")

    return generated

if __name__ == "__main__":
    main()
