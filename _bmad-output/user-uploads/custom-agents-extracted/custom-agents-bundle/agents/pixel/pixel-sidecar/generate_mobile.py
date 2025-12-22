#!/usr/bin/env python3
"""
Pixel - Mobile Image Generator
Simpler, more iconic designs optimized for mobile viewing
Uses Google Gemini Nano Banana Pro (gemini-3-pro-image-preview)
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

# Mobile-optimized style - simpler, more iconic
STYLE_PREFIX = """Create a minimal, iconic illustration optimized for mobile viewing.
Style: Clean, simple, modern flat design with subtle 3D depth.
Colors: Warm orange (#ff6b35) accent on dark background (#1A1A1A).
The design should be recognizable and clear even at small sizes (under 200px).

CRITICAL REQUIREMENTS:
- NO text, letters, words, or characters
- NO QR codes or barcodes
- NO complex details that get lost at small sizes
- Simple, bold shapes with clear silhouettes
- Minimal elements - focus on ONE central icon/concept
- Square 1:1 aspect ratio
- Clean edges, no busy backgrounds
"""

IMAGES = [
    {
        "name": "deliverable-app-mobile",
        "prompt": f"""{STYLE_PREFIX}

Subject: A simple smartphone icon with a glowing orange screen.
Show 2-3 floating minimal app window shapes around it.
Keep it clean and iconic - think app store icon style.
Central focus on the phone with subtle orange glow effect."""
    },
    {
        "name": "deliverable-auth-mobile",
        "prompt": f"""{STYLE_PREFIX}

Subject: A simple shield icon with a keyhole or lock symbol in the center.
Glowing orange outline on the shield.
Minimal security badge design - clean and recognizable.
No complex patterns, just the essential shield + lock concept."""
    },
    {
        "name": "deliverable-payment-mobile",
        "prompt": f"""{STYLE_PREFIX}

Subject: A simple credit card icon at a slight angle.
Glowing orange edge highlight.
Maybe a small checkmark or currency symbol floating nearby.
Clean, minimal payment concept - like a payment app icon."""
    },
    {
        "name": "deliverable-dashboard-mobile",
        "prompt": f"""{STYLE_PREFIX}

Subject: A simple control panel or gauge icon.
Show 2-3 minimal bar chart elements or circular gauges.
Orange accent highlights on the data elements.
Dashboard concept reduced to its simplest visual form."""
    },
    {
        "name": "deliverable-database-mobile",
        "prompt": f"""{STYLE_PREFIX}

Subject: Simple stacked cylinder database icon.
2-3 cylindrical layers with orange glow between them.
Maybe subtle connection dots suggesting data flow.
Classic database symbol but with modern minimal styling."""
    },
    {
        "name": "deliverable-hosting-mobile",
        "prompt": f"""{STYLE_PREFIX}

Subject: A simple server or cloud icon with connection nodes.
Small globe or network dots suggesting global reach.
Orange glowing connection lines between 3-4 points.
Minimal cloud/server hosting concept."""
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
    print("Pixel - Mobile Image Generator")
    print(f"Model: {MODEL} (Nano Banana Pro)")
    print("Style: Minimal icons for mobile")
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
