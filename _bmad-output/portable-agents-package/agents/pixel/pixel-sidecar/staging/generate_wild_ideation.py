#!/usr/bin/env python3
"""
Contextor Logo - WILD IDEATION
No constraints. Pure creative exploration.
5 boards × 6 variations = 30 fresh concepts
"""

import os
import sys
from datetime import datetime
from pathlib import Path

from google import genai
from google.genai import types

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY not set")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)
MODEL = "gemini-3-pro-image-preview"

STAGING_DIR = Path(__file__).parent
TIMESTAMP = datetime.now().strftime("%Y%m%d-%H%M%S")

# Brand reminder (but we're going wild)
BRAND = """
BRAND: "Contextor" - AI coaching platform
But go WILD with interpretation. Be creative. Be unexpected.
"""

# 5 WILD EXPLORATION BOARDS
WILD_BOARDS = [
    {
        "name": "wild1-abstract-expressive",
        "title": "Abstract & Expressive",
        "prompt": f"""
Create a logo exploration board with 6 ABSTRACT and EXPRESSIVE logo concepts for "Contextor".

{BRAND}

LAYOUT: 2 rows × 3 columns on dark background (#0A0A0A)

GO WILD WITH THESE 6 DIRECTIONS:
1. BRUSH STROKE C - An expressive, artistic brush stroke forming a C, with paint splatter energy
2. CONSTELLATION - Stars and lines forming a C pattern, cosmic and dreamy, deep blues and purples
3. SOUND WAVE C - Audio waveform that shapes into a C, music visualization aesthetic
4. LIQUID METAL - Chrome/mercury liquid forming C shape, hyper-realistic metallic sheen
5. SMOKE/VAPOR - Ethereal smoke wisps forming the letter C, mysterious and elegant
6. GEOMETRIC EXPLOSION - C made of scattered geometric fragments coming together

STYLE: Each should feel like ART, not just a logo. Premium, gallery-worthy, conversation-starting.
Bold colors where appropriate. Dark background to make them pop.

OUTPUT: Single image, 6 variations in neat grid.
"""
    },
    {
        "name": "wild2-negative-space-optical",
        "title": "Negative Space & Optical Illusions",
        "prompt": f"""
Create a logo exploration board with 6 CLEVER NEGATIVE SPACE and OPTICAL ILLUSION logos for "Contextor".

{BRAND}

LAYOUT: 2 rows × 3 columns on dark background (#1A1A1A)

CLEVER CONCEPTS:
1. HIDDEN C - Two shapes that create a C in the negative space between them (like FedEx arrow)
2. IMPOSSIBLE C - Escher-style impossible geometry forming C, mind-bending
3. FACE/VASE ILLUSION - Design where you see either a C or something else depending on focus
4. 3D CUBE ILLUSION - Flat design that appears 3D, C visible from one "angle"
5. FIGURE-GROUND - Pattern where C emerges from repeating background elements
6. AMBIGRAM - C that reads as C from multiple orientations/rotations

STYLE: Minimal colors (white, black, one accent). The cleverness IS the design.
These should make people look twice and smile when they "get it".

OUTPUT: Single image, 6 variations in grid layout.
"""
    },
    {
        "name": "wild3-nature-tech-fusion",
        "title": "Nature Meets Tech",
        "prompt": f"""
Create a logo exploration board with 6 NATURE-MEETS-TECHNOLOGY fusion logos for "Contextor".

{BRAND}

LAYOUT: 2 rows × 3 columns on dark background (#0D0D0D)

ORGANIC-TECH FUSION:
1. TREE RINGS C - Concentric wood grain rings forming C, organic warmth meets precision
2. DNA HELIX - Double helix that curves into C shape, biotech aesthetic, blues and greens
3. NEURAL NETWORK - Brain neurons connecting to form C, synapses glowing
4. FINGERPRINT C - Fingerprint pattern where lines form the letter C, identity + security
5. LEAF VEINS - Botanical leaf with veins forming C pattern, green gradient on dark
6. CRYSTAL GROWTH - Geometric crystals/minerals growing into C formation, gem colors

STYLE: Blend organic textures with clean tech precision.
Rich colors inspired by nature. Sophisticated, not childish.

OUTPUT: Single image, 6 variations in grid layout.
"""
    },
    {
        "name": "wild4-retro-unexpected",
        "title": "Retro & Unexpected",
        "prompt": f"""
Create a logo exploration board with 6 RETRO and UNEXPECTED style logos for "Contextor".

{BRAND}

LAYOUT: 2 rows × 3 columns on dark background (#1A1A1A)

UNEXPECTED STYLES:
1. 80s SYNTHWAVE - Neon grid, sunset gradient, chrome C, retro-futuristic
2. BAUHAUS - Primary colors, geometric shapes, 1920s design movement aesthetic
3. ART DECO - Gold and black, elegant geometric patterns, 1930s glamour
4. PIXEL ART - 8-bit retro game style C, nostalgic gaming aesthetic
5. JAPANESE MINIMAL - Zen circle (ensō) with C, wabi-sabi imperfection, red accent
6. BRUTALIST - Raw, bold, chunky typography, concrete texture feel, anti-pretty

STYLE: Each should transport to a different era or aesthetic movement.
Unexpected for a tech company. Memorable because it's different.

OUTPUT: Single image, 6 variations in grid layout.
"""
    },
    {
        "name": "wild5-futuristic-experimental",
        "title": "Futuristic & Experimental",
        "prompt": f"""
Create a logo exploration board with 6 FUTURISTIC and EXPERIMENTAL logos for "Contextor".

{BRAND}

LAYOUT: 2 rows × 3 columns on dark background (#050505)

FUTURE-FORWARD EXPERIMENTS:
1. HOLOGRAPHIC - Iridescent holographic C, rainbow light refraction, futuristic material
2. GLITCH ART - Digital glitch effect on C, RGB split, data corruption aesthetic
3. AI GENERATED FEEL - Abstract shapes that suggest machine creativity, morphing forms
4. PORTAL/WORMHOLE - C as a portal opening, space-time distortion, cosmic
5. BIOLUMINESCENT - Deep sea creature glow, C made of glowing organic particles
6. QUANTUM - Particles in superposition forming C, physics-inspired, ethereal dots

STYLE: Push boundaries. These should feel like they're from 2030.
Experimental, avant-garde, conversation starters.
Dark backgrounds, glowing elements, otherworldly.

OUTPUT: Single image, 6 variations in grid layout.
"""
    }
]

def generate_wild_board(board, index):
    """Generate a wild exploration board"""
    name = board["name"]
    title = board["title"]
    prompt = board["prompt"]

    print(f"\n{'='*60}")
    print(f"🎨 Wild Board {index+1}/5: {title}")
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
                print(f"💭 {part.text[:100]}...")

        print("⚠ No image generated")
        return None

    except Exception as e:
        print(f"✗ ERROR: {e}")
        return None

def main():
    print("\n" + "🔥"*35)
    print("CONTEXTOR - WILD CREATIVE IDEATION")
    print(f"Model: {MODEL}")
    print("No rules. Pure instinct. Let's go.")
    print("🔥"*35)

    generated = []

    for i, board in enumerate(WILD_BOARDS):
        filepath = generate_wild_board(board, i)
        if filepath:
            generated.append(filepath)

    print("\n" + "="*60)
    print(f"🎨 WILD SESSION COMPLETE: {len(generated)}/5 boards")
    print("="*60)

    for path in generated:
        print(f"  ✓ {Path(path).name}")

    return generated

if __name__ == "__main__":
    main()
