#!/usr/bin/env python3
"""
Generate 6 cohesive journey icons for VibeRescue "You did something most people never do" section.
Style: Minimal line art, light design, transparent background workflow
Model: gemini-3-pro-image-preview (Nano Banana Pro)
"""

import os
import sys
import warnings
from pathlib import Path
from datetime import datetime

warnings.filterwarnings("ignore")

try:
    import google.generativeai as genai
except ImportError:
    print("ERROR: google-generativeai not installed")
    sys.exit(1)

MODEL = "gemini-3-pro-image-preview"
STAGING_DIR = Path(__file__).parent / "staging"
STAGING_DIR.mkdir(exist_ok=True)

# Timestamp for filenames
timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

# Minimal line art style system
STYLE_SYSTEM = """Create a SQUARE 1:1 aspect ratio icon. This is critical - the image MUST be square.

You are creating ONE icon from a cohesive minimal icon family. ALL icons MUST follow these EXACT specifications:

FORMAT: Square image, 1:1 aspect ratio (width equals height)

BACKGROUND:
- Solid dark background: #1A1A1A (dark charcoal gray)
- Completely flat, NO gradients, NO patterns
- This background will be removed later for transparency

STYLE - MINIMAL LINE ART:
- Simple thin white line art (stroke width ~2-3px feel)
- Clean geometric shapes, not detailed or realistic
- Modern, elegant, minimalist design
- Warm orange accent (#FF6B35) for glow or highlight elements
- Very little detail - simplicity is key
- Icon should feel "light" and airy, not heavy or complex

COLOR PALETTE:
- Primary lines: White (#FFFFFF) thin strokes
- Accent glow: #FF6B35 (warm orange) - subtle, not overwhelming
- Background: #1A1A1A (dark gray)

COMPOSITION:
- Icon perfectly centered in frame
- Equal padding on all sides
- Icon takes ~50-60% of frame (leave breathing room)
- NO text, NO labels, NO watermarks

CRITICAL: Output MUST be SQUARE (1:1 ratio).
"""

# Icon definitions
ICONS = [
    {
        "name": f"journey-idea-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: The Idea - Lightbulb
- Simple thin white outline of a classic lightbulb shape
- 2-3 subtle curved lines inside for filament
- Small geometric screw base
- Soft orange (#FF6B35) glow emanating around the bulb
- Very minimal, elegant, not realistic
- SQUARE FORMAT 1:1"""
    },
    {
        "name": f"journey-build-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: The Build - Crossed Tools
- Thin white outline of a wrench and hammer crossed in X pattern
- Clean geometric tool shapes
- 45-degree crossing angle
- Subtle orange (#FF6B35) accent on tool heads
- Minimal detail, just recognizable silhouettes
- SQUARE FORMAT 1:1"""
    },
    {
        "name": f"journey-launch-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: The Launch - Rocket
- Simple thin white outline of a sleek rocket
- Pointing upward at slight angle
- Minimal fins, tiny circular window
- Orange (#FF6B35) flame trail at bottom
- Very simplified, icon-style, not detailed
- SQUARE FORMAT 1:1"""
    },
    {
        "name": f"journey-users-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Users Signed Up - Two People
- Two simplified human bust silhouettes (head + shoulders)
- Simple circular heads, curved shoulder lines
- One figure slightly overlapping/behind the other
- Thin white outlines, very geometric
- Subtle orange (#FF6B35) accent highlight
- SQUARE FORMAT 1:1"""
    },
    {
        "name": f"journey-sales-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: First Sales - Money Bag
- Classic money bag shape with tied top
- Dollar sign ($) in center, rendered in orange (#FF6B35)
- Thin white outline for bag body
- Clean smooth curves, no excessive detail
- Simple and iconic, instantly recognizable
- SQUARE FORMAT 1:1"""
    },
    {
        "name": f"journey-magic-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: The Magic - Sparkles/Stars
- 3-4 four-pointed stars in varying sizes
- Scattered in a pleasing cluster arrangement
- Stars rendered in bright orange (#FF6B35)
- Clean geometric sharp-pointed star shapes
- Could have tiny white highlight sparkle dots
- SQUARE FORMAT 1:1"""
    }
]

def generate_image(model, image_config, index, total):
    name = image_config["name"]
    prompt = image_config["prompt"]

    print(f"\n[{index+1}/{total}] Generating: {name.split('-')[1]}")
    print("-" * 50)

    try:
        response = model.generate_content(prompt)

        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    image_data = part.inline_data.data
                    output_path = STAGING_DIR / f"{name}.png"

                    with open(output_path, "wb") as f:
                        f.write(image_data)

                    # Check dimensions
                    from PIL import Image
                    img = Image.open(output_path)
                    file_size = os.path.getsize(output_path) / 1024
                    ratio = img.size[0] / img.size[1]
                    print(f"✓ Saved: {img.size[0]}x{img.size[1]} ({file_size:.0f} KB)")

                    if abs(ratio - 1.0) > 0.1:
                        print(f"  ⚠ WARNING: Not square! Ratio: {ratio:.2f}")

                    return str(output_path)

        print(f"✗ No image in response")
        return None

    except Exception as e:
        print(f"✗ Error: {e}")
        return None

def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)

    print("=" * 60)
    print("🎨 PIXEL - Journey Icons Generation")
    print("=" * 60)
    print(f"Model: {MODEL} (Nano Banana Pro)")
    print(f"Style: Minimal Line Art, Light Design")
    print(f"Icons: Idea, Build, Launch, Users, Sales, Magic")
    print(f"Output: {STAGING_DIR}")
    print("=" * 60)

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name=MODEL)

    results = []
    for i, img_config in enumerate(ICONS):
        result = generate_image(model, img_config, i, len(ICONS))
        results.append((img_config["name"], result))

    print("\n" + "=" * 60)
    successful = sum(1 for r in results if r[1])
    print(f"✨ Generated: {successful}/{len(ICONS)} icons")
    print("=" * 60)

    if successful > 0:
        print("\n📁 Staged Files:")
        for name, path in results:
            if path:
                print(f"   {path}")

        print("\n🔧 Next Steps:")
        print("   1. Preview generated icons")
        print("   2. Remove backgrounds for transparency")
        print("   3. Accept and deploy to project")

    return [r[1] for r in results if r[1]]

if __name__ == "__main__":
    main()
