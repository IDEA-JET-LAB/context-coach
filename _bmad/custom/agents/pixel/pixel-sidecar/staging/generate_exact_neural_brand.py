#!/usr/bin/env python3
"""
Contextor Brand - EXACT Neural Network Symbol
Using the specific design from wild3 board
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

# EXACT symbol description - very precise
EXACT_SYMBOL = """
THE EXACT SYMBOL TO RECREATE:
This is a neural network / brain neuron structure forming the letter C.

PRECISE VISUAL DESCRIPTION:
- The C is formed by BRANCHING DENDRITE-LIKE structures (like a neuron tree)
- Main "trunk" curves to form the C shape, with branches extending outward
- Color: Deep PURPLE at the core/trunk, transitioning to BLUE at the outer branches
- The branches subdivide multiple times (like tree branches or neural dendrites)
- Branches get progressively THINNER as they extend outward
- At branch points and tips: GLOWING WHITE/BRIGHT NODES (like synapses firing)
- The nodes have a soft LUMINOUS GLOW around them
- Overall feel: Organic biological structure with tech/digital glow aesthetic
- The branching is DENSE but readable - clearly forms a C shape
- Background should be DARK (#0A0A0A or similar)

CRITICAL: Must look like the SAME symbol, not a new interpretation.
The branching pattern, the purple-to-blue gradient, the glowing nodes - all must match.
"""

# Brand applications with exact symbol
BRAND_BOARDS = [
    {
        "name": "exact-neural-solo",
        "title": "Exact Symbol - Solo Variations",
        "prompt": f"""
Create a board showing the SAME neural network C symbol in 6 different presentations.

{EXACT_SYMBOL}

LAYOUT: 2 rows × 3 columns on dark background (#0A0A0A)

THE 6 PRESENTATIONS (same symbol, different contexts):
1. FULL COLOR - The symbol exactly as described, purple-blue gradient with glowing nodes
2. MONOCHROME BLUE - Same symbol but all in shades of blue/cyan only
3. MONOCHROME PURPLE - Same symbol but all in shades of purple/violet only
4. WHITE ON BLACK - Pure white version of the symbol on black background (no color)
5. BLACK ON WHITE - Pure black/dark gray version on white background (inverted)
6. SUBTLE GLOW - Same symbol with softer, more subtle node glow (elegant version)

CRITICAL: All 6 must be the SAME SYMBOL SHAPE - same branching pattern, same C form.
Only the color treatment changes.

OUTPUT: Single image with 6 versions in grid layout.
"""
    },
    {
        "name": "exact-neural-appicons",
        "title": "Exact Symbol - App Icons",
        "prompt": f"""
Create app icon versions using the EXACT neural network C symbol.

{EXACT_SYMBOL}

LAYOUT: 2 rows × 3 columns on dark background (#1A1A1A)

6 APP ICON VERSIONS (iOS/Android rounded square format):
1. DARK APP ICON - Symbol on dark purple-to-black gradient background, rounded corners
2. DARK SOLID - Symbol on solid dark background (#1A1A1A), rounded corners
3. LIGHT APP ICON - Symbol (darker version) on white/light gray background
4. GRADIENT BACKGROUND - Symbol on blue-to-purple gradient background
5. MINIMAL DARK - Symbol slightly simplified/cleaner for small sizes, dark bg
6. BADGE GLOW - Symbol with enhanced glow effect, like a notification badge

ALL must use the SAME neural C symbol shape.
Proper app icon proportions with padding from edges.
Must be recognizable at small sizes.

OUTPUT: Single image with 6 app icons in grid layout.
"""
    },
    {
        "name": "exact-neural-horizontal",
        "title": "Exact Symbol - Horizontal Lockups",
        "prompt": f"""
Create horizontal logo lockups using the EXACT neural network C symbol.

{EXACT_SYMBOL}

LAYOUT: 3 rows × 2 columns on dark background (#0A0A0A)

6 HORIZONTAL LOCKUPS (symbol LEFT, text RIGHT):
1. CLEAN SANS - Neural symbol + "Contextor" in clean modern sans-serif (white text)
2. WITH TAGLINE - Neural symbol + "Contextor" + "Your Context Tutor" below (smaller)
3. BOLD TEXT - Neural symbol + "Contextor" in bold/heavy weight
4. LIGHT TEXT - Neural symbol + "Contextor" in light/thin weight
5. LOWERCASE - Neural symbol + "contextor" all lowercase
6. COMPACT - Tighter spacing between symbol and text, efficient layout

ALL use the EXACT same neural C symbol.
Text is white/light on dark background.
Symbol and text vertically centered.
Professional spacing and alignment.

OUTPUT: Single image with 6 horizontal lockups in grid layout.
"""
    },
    {
        "name": "exact-neural-vertical",
        "title": "Exact Symbol - Vertical Lockups",
        "prompt": f"""
Create vertical/stacked logo lockups using the EXACT neural network C symbol.

{EXACT_SYMBOL}

LAYOUT: 2 rows × 3 columns on dark background (#0A0A0A)

6 VERTICAL LOCKUPS (symbol TOP, text BELOW):
1. CENTERED - Neural symbol centered above "Contextor" text
2. WITH TAGLINE - Neural symbol, then "Contextor", then "Your Context Tutor"
3. ICON LARGE - Larger symbol, smaller text below
4. BALANCED - Symbol and text similar visual weight
5. SPACIOUS - More breathing room between elements
6. COMPACT STACK - Tighter vertical spacing, efficient

ALL use the EXACT same neural C symbol.
Everything centered on vertical axis.
White/light text on dark background.

OUTPUT: Single image with 6 vertical lockups in grid layout.
"""
    },
    {
        "name": "exact-neural-branduse",
        "title": "Exact Symbol - Brand In Use",
        "prompt": f"""
Show the EXACT neural network C symbol in real-world brand applications.

{EXACT_SYMBOL}

Create a brand presentation board showing the symbol in context:

SHOW THESE APPLICATIONS:
- Website header/navigation with horizontal logo
- Mobile phone screen with app icon on home screen
- Business card corner showing the symbol
- Social media avatar (circular crop of symbol)
- Email signature with small horizontal logo
- Favicon (tiny square, simplified if needed)
- Dark mode and light mode side by side
- T-shirt or merchandise mockup with symbol

LAYOUT: Creative presentation layout on dark background
Show the SAME symbol consistently across all touchpoints.
Premium, professional brand presentation style.
The neural C symbol should be instantly recognizable in every application.

OUTPUT: Single comprehensive brand-in-use presentation image.
"""
    },
    {
        "name": "exact-neural-colors",
        "title": "Exact Symbol - Color Variations",
        "prompt": f"""
Show the EXACT neural network C symbol in different color schemes.

{EXACT_SYMBOL}

LAYOUT: 2 rows × 3 columns on dark background (#0A0A0A)

6 COLOR VARIATIONS (same symbol shape, different colors):
1. ORIGINAL - Purple-to-blue gradient with white glowing nodes (the original)
2. TEAL/CYAN - Teal to cyan gradient, same structure
3. SUNSET - Orange to pink/magenta gradient, warm version
4. EMERALD - Green to teal gradient, nature-tech feel
5. GOLD/AMBER - Golden to orange, premium warm feel
6. MONOCHROME - Pure white with subtle gray depth, no color

ALL must be the EXACT SAME symbol structure and branching pattern.
Only the color palette changes.
Glowing nodes should match the color scheme.

OUTPUT: Single image with 6 color variations in grid layout.
"""
    }
]

def generate_board(board, index):
    """Generate a brand board"""
    name = board["name"]
    title = board["title"]
    prompt = board["prompt"]

    print(f"\n{'='*60}")
    print(f"🎯 Exact Symbol Board {index+1}/6: {title}")
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
    print("\n" + "🎯"*30)
    print("CONTEXTOR - EXACT NEURAL SYMBOL BRAND SYSTEM")
    print(f"Model: {MODEL}")
    print("Using the EXACT symbol design - consistent across all applications")
    print("🎯"*30)

    generated = []

    for i, board in enumerate(BRAND_BOARDS):
        filepath = generate_board(board, i)
        if filepath:
            generated.append(filepath)

    print("\n" + "="*60)
    print(f"🎯 EXACT SYMBOL BOARDS COMPLETE: {len(generated)}/6")
    print("="*60)

    for path in generated:
        print(f"  ✓ {Path(path).name}")

    return generated

if __name__ == "__main__":
    main()
