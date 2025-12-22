#!/usr/bin/env python3
"""
Contextor Logo Concept Generator
Using Google Gemini Nano Banana Pro (gemini-3-pro-image-preview)
"""

import os
import sys
import base64
from datetime import datetime
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Installing google-genai...")
    os.system("pip install google-genai -q")
    from google import genai
    from google.genai import types

# Configuration
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY not set")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-2.0-flash-exp"  # Using available model with image generation

STAGING_DIR = Path(__file__).parent
TIMESTAMP = datetime.now().strftime("%Y%m%d-%H%M%S")

# Style anchor for consistency across all concepts
STYLE_ANCHOR = """
STYLE REQUIREMENTS:
- Geometric and minimal design
- Tech-forward, modern aesthetic
- Clean lines, precise shapes
- Monochrome palette: use pure white (#FFFFFF) on dark gray background (#1A1A1A)
- Professional and sophisticated
- Suitable for SaaS/developer tools brand
- Logo icon should be centered with equal padding on all sides
- No text in the icon - symbol only
- Flat design, no gradients or shadows
- High contrast for visibility at small sizes
"""

# Logo concepts
CONCEPTS = [
    {
        "name": "context-layers",
        "prompt": f"""
Create a minimalist logo icon for "Contextor" - a context coaching platform for AI developers.

CONCEPT: "Context Layers"
Design stacked geometric shapes (hexagons or rounded squares) suggesting layered context and knowledge.
The shapes should overlap or nest within each other, creating depth through positioning.
3-4 layers stacked vertically or concentrically.
Think of it as layers of understanding building upon each other.

{STYLE_ANCHOR}

OUTPUT: Single clean icon on solid dark gray (#1A1A1A) background, white shapes only.
"""
    },
    {
        "name": "coaching-pulse",
        "prompt": f"""
Create a minimalist logo icon for "Contextor" - a context coaching platform for AI developers.

CONCEPT: "Coaching Pulse"
Design an abstract letter "C" combined with a subtle wave or pulse line.
The wave represents the "vibe" in vibe-coding and dynamic AI coaching.
The C should be geometric and modern, with the pulse integrated elegantly.
Think of a heartbeat monitor merged with typography.

{STYLE_ANCHOR}

OUTPUT: Single clean icon on solid dark gray (#1A1A1A) background, white shapes only.
"""
    },
    {
        "name": "neural-guide",
        "prompt": f"""
Create a minimalist logo icon for "Contextor" - a context coaching platform for AI developers.

CONCEPT: "Neural Guide"
Design interconnected nodes/dots forming a subtle network or constellation pattern.
The nodes should suggest AI/neural connections while also implying guidance/direction.
5-7 connected dots with clean geometric lines between them.
Abstract enough to not be literal, but evocative of AI coaching.

{STYLE_ANCHOR}

OUTPUT: Single clean icon on solid dark gray (#1A1A1A) background, white shapes only.
"""
    },
    {
        "name": "focus-frame",
        "prompt": f"""
Create a minimalist logo icon for "Contextor" - a context coaching platform for AI developers.

CONCEPT: "Focus Frame"
Design geometric brackets or frame elements around a central focal point.
The frame represents "context" as focused attention - framing what matters.
Could be corner brackets, a viewfinder shape, or targeting crosshairs.
A subtle dot or element at the center to represent the focused content.

{STYLE_ANCHOR}

OUTPUT: Single clean icon on solid dark gray (#1A1A1A) background, white shapes only.
"""
    }
]

def generate_concept(concept, index):
    """Generate a single logo concept"""
    name = concept["name"]
    prompt = concept["prompt"]

    print(f"\n{'='*50}")
    print(f"Generating Concept {index+1}: {name}")
    print(f"{'='*50}")

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE']
            )
        )

        # Extract and save image
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                image_data = part.inline_data.data
                filename = f"logo-{name}-{TIMESTAMP}.png"
                filepath = STAGING_DIR / filename

                with open(filepath, "wb") as f:
                    f.write(image_data)

                print(f"✓ Saved: {filepath}")
                return str(filepath)
            elif part.text:
                print(f"Model response: {part.text[:200]}...")

        print("WARNING: No image in response")
        return None

    except Exception as e:
        print(f"ERROR: {e}")
        return None

def main():
    print("\n" + "="*60)
    print("CONTEXTOR LOGO GENERATION")
    print("Model: gemini-2.0-flash-exp (Nano Banana)")
    print("="*60)

    generated = []

    for i, concept in enumerate(CONCEPTS):
        filepath = generate_concept(concept, i)
        if filepath:
            generated.append(filepath)

    print("\n" + "="*60)
    print(f"COMPLETE: {len(generated)}/{len(CONCEPTS)} concepts generated")
    print("="*60)

    for path in generated:
        print(f"  - {path}")

    return generated

if __name__ == "__main__":
    main()
