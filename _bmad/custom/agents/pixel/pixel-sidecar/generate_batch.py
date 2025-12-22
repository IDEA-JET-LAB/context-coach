#!/usr/bin/env python3
"""
Pixel - Batch Image Generator
Uses Google Gemini Nano Banana Pro (gemini-3-pro-image-preview)
"""

import os
import sys
import warnings
from datetime import datetime
from pathlib import Path

# Suppress warnings
warnings.filterwarnings("ignore")

try:
    import google.generativeai as genai
except ImportError:
    print("ERROR: google-generativeai not installed. Run: pip install google-generativeai")
    sys.exit(1)

# Configuration
MODEL = "gemini-3-pro-image-preview"  # Nano Banana Pro - best quality
STAGING_DIR = Path(__file__).parent / "staging"
STAGING_DIR.mkdir(exist_ok=True)

# Style prefix for all generations - IdeaJetLab brand
STYLE_PREFIX = """Create a 3D isometric illustration with a tech-forward, futuristic aesthetic.
Use warm orange (#ff6b35) as the PRIMARY accent color against a dark background (#0c0a08 or #1A1A1A).
Include glass/transparent UI elements and dimensional copper/orange glows.
Style should be professional yet innovative.

CRITICAL REQUIREMENTS:
- NO text, letters, words, or characters anywhere in the image
- NO QR codes or barcodes
- NO readable labels or signs
- Pure visual/iconic representation only
- 4:3 aspect ratio
- High quality, detailed rendering
"""

# Image definitions
IMAGES = [
    {
        "name": "deliverable-app-v2",
        "prompt": f"""{STYLE_PREFIX}

Subject: A modern smartphone and laptop displaying floating app interface screens.
The devices should have glowing orange data connection lines between them.
Show multiple floating UI cards/windows around the devices suggesting a full application.
Include subtle particle effects and orange accent lighting.
The scene should convey "production-ready software" and "cross-platform app"."""
    },
    {
        "name": "deliverable-auth-v2",
        "prompt": f"""{STYLE_PREFIX}

Subject: A glowing 3D shield icon with a secure lock mechanism at its center.
Include biometric fingerprint scanning visualization with orange scan lines.
Add security pulse waves emanating from the shield.
Show floating key icons and checkmark symbols around the main shield.
The scene should convey "secure authentication" and "identity protection"."""
    },
    {
        "name": "deliverable-payment-v2",
        "prompt": f"""{STYLE_PREFIX}

Subject: A sleek 3D credit card with glowing orange edge lighting.
Show flowing transaction lines and payment processing visualization.
Include floating currency symbols and secure payment icons.
Add subtle circuit patterns on the card surface.
The scene should convey "payment processing" and "secure transactions"."""
    },
    {
        "name": "deliverable-dashboard-v2",
        "prompt": f"""{STYLE_PREFIX}

Subject: Multiple floating holographic control panels with charts and graphs.
Show bar charts, line graphs, and pie charts with orange accent colors.
Include data visualization elements and metric displays.
Add glowing connection lines between the panels.
The scene should convey "admin control" and "data management"."""
    },
    {
        "name": "deliverable-database-v2",
        "prompt": f"""{STYLE_PREFIX}

Subject: Stacked cylindrical database icons with glowing orange data streams.
Show API connection nodes and data flow visualization.
Include server rack elements with pulsing status indicators.
Add floating data packet representations moving between storage units.
The scene should convey "database architecture" and "backend infrastructure"."""
    },
    {
        "name": "deliverable-hosting-v2",
        "prompt": f"""{STYLE_PREFIX}

Subject: A central server rack with global CDN node connections.
Show a stylized globe with distribution points connected by orange light beams.
Include cloud infrastructure elements and network topology visualization.
Add uptime/performance indicator elements with glowing status lights.
The scene should convey "global hosting" and "CDN infrastructure"."""
    }
]

def generate_image(model, image_config, index):
    """Generate a single image using Gemini"""
    name = image_config["name"]
    prompt = image_config["prompt"]

    print(f"\n[{index+1}/6] Generating: {name}")
    print("-" * 50)

    try:
        response = model.generate_content(prompt)

        # Check for image parts
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    # Save image
                    image_data = part.inline_data.data
                    output_path = STAGING_DIR / f"{name}.png"

                    with open(output_path, "wb") as f:
                        f.write(image_data)

                    print(f"✓ Saved: {output_path}")
                    return str(output_path)

        # Check if there was text response instead
        if response.text:
            print(f"  Response was text only: {response.text[:200]}...")

        print(f"✗ No image in response for {name}")
        return None

    except Exception as e:
        print(f"✗ Error generating {name}: {e}")
        return None

def main():
    # Check for API key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY environment variable not set")
        print("\nTo set it:")
        print("  export GEMINI_API_KEY='your-api-key'")
        print("\nOr for Claude Code:")
        print("  claude config set secrets.GEMINI_API_KEY 'your-api-key'")
        sys.exit(1)

    print("=" * 60)
    print("Pixel - Batch Image Generator")
    print(f"Model: {MODEL} (Nano Banana Pro)")
    print(f"Output: {STAGING_DIR}")
    print("=" * 60)

    # Configure API
    genai.configure(api_key=api_key)

    # Initialize model
    model = genai.GenerativeModel(model_name=MODEL)

    # Generate all images
    results = []
    for i, img_config in enumerate(IMAGES):
        result = generate_image(model, img_config, i)
        results.append((img_config["name"], result))

    # Summary
    print("\n" + "=" * 60)
    print("GENERATION COMPLETE")
    print("=" * 60)

    successful = [r for r in results if r[1]]
    failed = [r for r in results if not r[1]]

    print(f"\n✓ Successful: {len(successful)}/6")
    for name, path in successful:
        print(f"  - {name}: {path}")

    if failed:
        print(f"\n✗ Failed: {len(failed)}/6")
        for name, _ in failed:
            print(f"  - {name}")

    print(f"\nStaged images location: {STAGING_DIR}")

if __name__ == "__main__":
    main()
