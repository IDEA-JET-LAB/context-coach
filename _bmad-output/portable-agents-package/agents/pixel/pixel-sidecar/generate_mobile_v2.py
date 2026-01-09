#!/usr/bin/env python3
"""
Pixel - Mobile Icon Generator v2
Cohesive icon family with strict style consistency
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

# STRICT unified style for cohesive icon family
STYLE_SYSTEM = """You are creating ONE icon from a cohesive icon family set. ALL icons in this set MUST follow these EXACT specifications:

BACKGROUND:
- Solid dark background color: #1A1A1A (dark charcoal gray)
- NO gradients, NO patterns, NO variations
- Completely flat, uniform dark background filling entire image

COLOR PALETTE (use ONLY these colors):
- Primary accent: #FF6B35 (warm orange) - used for main icon glow and highlights
- Secondary glow: #FF8C42 (lighter orange) - subtle glow effects only
- Icon body: #2A2A2A to #3A3A3A (dark gray) - the icon shapes themselves
- Highlight edges: rgba(255,107,53,0.3) - subtle orange rim lighting

STYLE SPECIFICATIONS:
- Clean flat design with subtle gradient on icon surfaces
- Soft orange glow/bloom effect around main icon element
- Rounded corners on all shapes (pill/capsule style)
- Centered composition with icon taking 60-70% of frame
- Consistent stroke weight if any outlines used
- NO text, NO labels, NO characters, NO QR codes
- NO white colors anywhere - darkest is #1A1A1A, lightest is the orange accent

ICON CONSTRUCTION:
- Simple geometric shapes (circles, rounded rectangles, pills)
- Maximum 3-4 distinct elements per icon
- Clear silhouette recognizable at 64px
- Consistent visual weight across all icons

LIGHTING:
- Soft ambient orange glow emanating from icon center
- Subtle rim/edge lighting in orange
- No harsh shadows, no dramatic lighting

This creates a UNIFIED FAMILY LOOK. Every icon must feel like it belongs with the others.
"""

IMAGES = [
    {
        "name": "deliverable-app-mobile-v2",
        "prompt": f"""{STYLE_SYSTEM}

CREATE THIS SPECIFIC ICON:
Subject: Smartphone/mobile device icon
- Simple rounded rectangle phone shape in dark gray (#2A2A2A)
- Glowing orange (#FF6B35) screen area
- 2 small floating app window rectangles nearby (also with orange glow)
- Soft orange bloom around the device
- Dark solid background #1A1A1A"""
    },
    {
        "name": "deliverable-auth-mobile-v2",
        "prompt": f"""{STYLE_SYSTEM}

CREATE THIS SPECIFIC ICON:
Subject: Security shield with lock icon
- Shield shape in dark gray (#2A2A2A) with orange (#FF6B35) glowing outline
- Simple keyhole or padlock symbol in center (orange glow)
- Soft orange bloom emanating from shield
- Dark solid background #1A1A1A
- Keep it minimal - just shield + lock concept"""
    },
    {
        "name": "deliverable-payment-mobile-v2",
        "prompt": f"""{STYLE_SYSTEM}

CREATE THIS SPECIFIC ICON:
Subject: Credit card / payment icon
- Rounded rectangle card shape in dark gray (#2A2A2A)
- Orange (#FF6B35) glowing stripe or chip element
- Slight 3D tilt/angle for depth
- Soft orange bloom around card
- Dark solid background #1A1A1A
- NO white, just dark grays and orange accents"""
    },
    {
        "name": "deliverable-dashboard-mobile-v2",
        "prompt": f"""{STYLE_SYSTEM}

CREATE THIS SPECIFIC ICON:
Subject: Dashboard / analytics icon
- Simple panel shape in dark gray (#2A2A2A)
- 2-3 bar chart bars with orange (#FF6B35) glow
- Or circular gauge with orange indicator
- Soft orange bloom around the panel
- Dark solid background #1A1A1A
- MUST use orange as primary accent color, NOT blue or other colors"""
    },
    {
        "name": "deliverable-database-mobile-v2",
        "prompt": f"""{STYLE_SYSTEM}

CREATE THIS SPECIFIC ICON:
Subject: Database / storage icon
- Classic stacked cylinder database shape in dark gray (#2A2A2A)
- 2-3 stacked discs/cylinders
- Orange (#FF6B35) glowing lines between layers
- Soft orange bloom around database
- Dark solid background #1A1A1A
- Keep simple - no small scattered elements"""
    },
    {
        "name": "deliverable-hosting-mobile-v2",
        "prompt": f"""{STYLE_SYSTEM}

CREATE THIS SPECIFIC ICON:
Subject: Server / cloud hosting icon
- Server rack or cloud shape in dark gray (#2A2A2A)
- 3-4 small orange (#FF6B35) glowing dots representing nodes/connections
- Simple connection lines between dots
- Soft orange bloom around main element
- Dark solid background #1A1A1A"""
    }
]

def generate_image(model, image_config, index):
    name = image_config["name"]
    prompt = image_config["prompt"]

    print(f"\n[{index+1}/6] Generating: {name}")
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

                    print(f"✓ Saved: {output_path}")
                    return str(output_path)

        print(f"✗ No image in response for {name}")
        return None

    except Exception as e:
        print(f"✗ Error generating {name}: {e}")
        return None

def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)

    print("=" * 60)
    print("Pixel - Mobile Icon Generator v2")
    print("Style: Cohesive icon family with strict consistency")
    print(f"Model: {MODEL} (Nano Banana Pro)")
    print(f"Output: {STAGING_DIR}")
    print("=" * 60)

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name=MODEL)

    results = []
    for i, img_config in enumerate(IMAGES):
        result = generate_image(model, img_config, i)
        results.append((img_config["name"], result))

    print("\n" + "=" * 60)
    print("GENERATION COMPLETE")
    print("=" * 60)

    successful = [r for r in results if r[1]]
    failed = [r for r in results if not r[1]]

    print(f"\n✓ Successful: {len(successful)}/6")
    for name, path in successful:
        print(f"  - {name}")

    if failed:
        print(f"\n✗ Failed: {len(failed)}/6")
        for name, _ in failed:
            print(f"  - {name}")

if __name__ == "__main__":
    main()
