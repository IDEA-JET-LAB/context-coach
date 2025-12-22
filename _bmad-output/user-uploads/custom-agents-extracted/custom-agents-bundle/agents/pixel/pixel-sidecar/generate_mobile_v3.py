#!/usr/bin/env python3
"""
Pixel - Mobile Icon Generator v3
Regenerate 5 icons (excluding payment) with explicit 1:1 aspect ratio
"""

import os
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

try:
    import google.generativeai as genai
except ImportError:
    print("ERROR: google-generativeai not installed")
    sys.exit(1)

MODEL = "gemini-3-pro-image-preview"
STAGING_DIR = Path(__file__).parent / "staging"
STAGING_DIR.mkdir(exist_ok=True)

# Strict style with EXPLICIT square format requirement
STYLE_SYSTEM = """Create a SQUARE 1:1 aspect ratio icon. This is critical - the image MUST be square.

You are creating ONE icon from a cohesive icon family set. ALL icons MUST follow these EXACT specifications:

FORMAT: Square image, 1:1 aspect ratio (width equals height)

BACKGROUND:
- Solid dark background color: #1A1A1A (dark charcoal gray)
- NO gradients, NO patterns, completely flat uniform dark background

COLOR PALETTE (use ONLY these colors):
- Primary accent: #FF6B35 (warm orange) - main icon glow and highlights
- Secondary glow: #FF8C42 (lighter orange) - subtle glow effects
- Icon body: #2A2A2A to #3A3A3A (dark gray) - icon shapes

STYLE:
- Clean flat design with subtle gradient on icon surfaces
- Soft orange glow around main icon element
- Centered composition with icon taking 60-70% of frame
- NO text, NO labels, NO characters, NO QR codes
- Simple geometric shapes, maximum 3-4 elements

CRITICAL: Output must be SQUARE (1:1 ratio). Not wide, not tall - SQUARE.
"""

# Only regenerate the 5 that were wide
IMAGES = [
    {
        "name": "deliverable-app-mobile-v3",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Smartphone/mobile device
- Simple rounded rectangle phone shape in dark gray
- Glowing orange screen area
- 2 small floating app windows nearby
- Soft orange bloom around device
- SQUARE FORMAT 1:1"""
    },
    {
        "name": "deliverable-auth-mobile-v3",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Security shield with lock
- Shield shape in dark gray with orange glowing outline
- Simple padlock symbol in center with orange glow
- Soft orange bloom from shield
- SQUARE FORMAT 1:1"""
    },
    {
        "name": "deliverable-dashboard-mobile-v3",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Dashboard analytics
- Simple panel shape in dark gray
- 2-3 bar chart bars with orange glow
- Soft orange bloom around panel
- MUST use ORANGE accent color
- SQUARE FORMAT 1:1"""
    },
    {
        "name": "deliverable-database-mobile-v3",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Database storage
- Classic stacked cylinder database shape in dark gray
- 2-3 stacked discs
- Orange glowing lines between layers
- Soft orange bloom around database
- SQUARE FORMAT 1:1"""
    },
    {
        "name": "deliverable-hosting-mobile-v3",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Server/cloud hosting
- Server rack or cloud shape in dark gray
- 3-4 orange glowing dots for nodes
- Simple connection lines
- Soft orange bloom
- SQUARE FORMAT 1:1"""
    }
]

def generate_image(model, image_config, index):
    name = image_config["name"]
    prompt = image_config["prompt"]

    print(f"\n[{index+1}/5] Generating: {name}")
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
                    ratio = img.size[0] / img.size[1]
                    print(f"✓ Saved: {img.size[0]}x{img.size[1]} (ratio: {ratio:.2f})")

                    if abs(ratio - 1.0) > 0.1:
                        print(f"  ⚠ WARNING: Not square! Will need cropping")

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
    print("Pixel - Mobile Icon Generator v3")
    print("Regenerating 5 icons with explicit square format")
    print(f"Model: {MODEL}")
    print("=" * 60)

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name=MODEL)

    results = []
    for i, img_config in enumerate(IMAGES):
        result = generate_image(model, img_config, i)
        results.append((img_config["name"], result))

    print("\n" + "=" * 60)
    successful = sum(1 for r in results if r[1])
    print(f"Generated: {successful}/5")

if __name__ == "__main__":
    main()
