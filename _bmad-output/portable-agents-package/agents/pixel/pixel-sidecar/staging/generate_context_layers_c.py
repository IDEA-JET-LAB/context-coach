#!/usr/bin/env python3
"""
Context Layers + C Variations
Refinement of Concept 1 with letter C integration
"""

import os
import sys
from datetime import datetime
from pathlib import Path

from google import genai
from google.genai import types

# CRITICAL: Use GEMINI_API_KEY explicitly to avoid conflicts
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY not set")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-3-pro-image-preview"

STAGING_DIR = Path(__file__).parent
TIMESTAMP = datetime.now().strftime("%Y%m%d-%H%M%S")

# Base style for all variations
STYLE_BASE = """
STYLE REQUIREMENTS:
- Geometric and minimal design
- Tech-forward, modern aesthetic
- Clean lines, precise shapes
- Monochrome: pure white (#FFFFFF) on dark gray background (#1A1A1A)
- Professional and sophisticated
- Logo icon centered with equal padding
- Flat design, no gradients or shadows
- High contrast for visibility at small sizes
"""

# Variations of Context Layers + C
VARIATIONS = [
    {
        "name": "context-layers-c-v1",
        "prompt": f"""
Create a minimalist logo icon for "Contextor" - a context coaching platform.

CONCEPT: "Context Layers with C"
- 2-3 concentric rounded square or hexagon layers (NOT 4 - remove the smallest)
- The layers are rotated 90 degrees counterclockwise (so they appear as diamonds/rotated squares)
- A prominent letter "C" in the CENTER of the layers
- The "C" should be bold, geometric, and sized to fill about 40-50% of the inner layer
- The C is the focal point, layers frame it

COMPOSITION:
- Rotated 90° counterclockwise (layers appear as diamonds)
- 2-3 layers only (outer, middle, optional inner frame)
- Bold geometric "C" at center
- C should be clearly readable and not cramped

{STYLE_BASE}

OUTPUT: Single clean icon on solid dark gray (#1A1A1A) background, white shapes only.
"""
    },
    {
        "name": "context-layers-c-v2",
        "prompt": f"""
Create a minimalist logo icon for "Contextor" - a context coaching platform.

CONCEPT: "Context Layers with C" - Variation 2
- 2 concentric rounded square layers only (simplified)
- Layers rotated 45 degrees (appearing as diamonds)
- A bold, modern letter "C" prominently in the center
- The C should be large and commanding - about 50% of total icon size
- Layers serve as a frame/border around the C
- The C has slightly rounded terminals (modern geometric style)

COMPOSITION:
- Diamond orientation (45° rotation)
- Just 2 clean layers framing the C
- C is the hero element, large and bold
- Open, breathing space around the C

{STYLE_BASE}

OUTPUT: Single clean icon on solid dark gray (#1A1A1A) background, white shapes only.
"""
    },
    {
        "name": "context-layers-c-v3",
        "prompt": f"""
Create a minimalist logo icon for "Contextor" - a context coaching platform.

CONCEPT: "Context Layers with C" - Variation 3
- Concentric hexagon layers (2 hexagons)
- Rotated so one point faces up (like a stop sign orientation)
- A bold geometric "C" in the center
- The C is formed with clean, thick strokes
- The C opening faces right
- Hexagons provide tech/modern feel

COMPOSITION:
- 2 hexagonal layers, rotated with point up
- Large, prominent C at center
- C is bold and fills the inner hexagon well
- Clean negative space between C and inner hexagon edge

{STYLE_BASE}

OUTPUT: Single clean icon on solid dark gray (#1A1A1A) background, white shapes only.
"""
    },
    {
        "name": "context-layers-c-v4",
        "prompt": f"""
Create a minimalist logo icon for "Contextor" - a context coaching platform.

CONCEPT: "Context Layers with C" - Variation 4 (Abstract C)
- 2-3 concentric rounded rectangles or squircles
- Rotated 90 degrees counterclockwise
- The letter "C" is integrated INTO the layer design
- The innermost layer IS the C shape (not a separate element)
- The C forms naturally from the layer arrangement
- Layers get progressively smaller, innermost is C-shaped

COMPOSITION:
- Rotated layers creating depth
- C emerges organically from the design
- Abstract but recognizable as C
- Very modern and clever

{STYLE_BASE}

OUTPUT: Single clean icon on solid dark gray (#1A1A1A) background, white shapes only.
"""
    }
]

def generate_variation(variation, index):
    """Generate a single variation"""
    name = variation["name"]
    prompt = variation["prompt"]

    print(f"\n{'='*50}")
    print(f"Generating Variation {index+1}: {name}")
    print(f"{'='*50}")

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

                print(f"✓ Saved: {filepath}")
                return str(filepath)
            elif part.text:
                print(f"Model note: {part.text[:100]}...")

        print("WARNING: No image in response")
        return None

    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        return None

def main():
    print("\n" + "="*60)
    print("CONTEXT LAYERS + C VARIATIONS")
    print(f"Model: {MODEL} (Nano Banana Pro)")
    print("="*60)

    generated = []

    for i, variation in enumerate(VARIATIONS):
        filepath = generate_variation(variation, i)
        if filepath:
            generated.append(filepath)

    print("\n" + "="*60)
    print(f"COMPLETE: {len(generated)}/{len(VARIATIONS)} variations generated")
    print("="*60)

    for path in generated:
        print(f"  - {path}")

    return generated

if __name__ == "__main__":
    main()
