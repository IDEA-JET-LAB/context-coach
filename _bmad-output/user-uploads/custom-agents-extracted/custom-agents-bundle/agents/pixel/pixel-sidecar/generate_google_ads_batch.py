#!/usr/bin/env python3
"""
Pixel - Google Ads Campaign BATCH Image Generator
VibeRescue Campaign for IdeaJetLab
Generates all 10 illustrated images
"""

import os
import base64
from datetime import datetime
from google import genai
from google.genai import types

# Initialize client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# Staging directory
STAGING_DIR = os.path.dirname(os.path.abspath(__file__)) + "/staging"
os.makedirs(STAGING_DIR, exist_ok=True)

# Timestamp for this batch
TIMESTAMP = datetime.now().strftime("%Y%m%d-%H%M%S")

def generate_image(prompt: str, filename: str):
    """Generate an image using Gemini Nano Banana Pro"""

    print(f"\n🎨 Generating: {filename}")

    try:
        response = client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            )
        )

        # Extract image from response
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                image_data = part.inline_data.data
                filepath = f"{STAGING_DIR}/{filename}"

                if isinstance(image_data, str):
                    with open(filepath, "wb") as f:
                        f.write(base64.b64decode(image_data))
                else:
                    with open(filepath, "wb") as f:
                        f.write(image_data)

                print(f"   ✅ Saved: {filepath}")
                return filepath

        print("   ❌ No image in response")
        return None

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return None


# ============================================================
# PROMPTS
# ============================================================

LANDSCAPE_PROMPTS = [
    {
        "name": "landscape-rescue",
        "prompt": """Create a wide landscape digital advertisement image (approximately 1.91:1 aspect ratio).

Dark charcoal background (#0C0A08). A glowing orange (#FF6B35) lifebuoy floating above a small laptop showing error screens. Soft warm ambient glow around the lifebuoy. 3D render style, modern tech startup aesthetic. Clean minimal composition with negative space on right side for text overlay. No text in the image.

STYLE: Warm orange #FF6B35 accent, dark #0C0A08 background, 3D render, volumetric lighting, professional tech aesthetic."""
    },
    {
        "name": "landscape-progress",
        "prompt": """Create a wide landscape digital advertisement image (approximately 1.91:1 aspect ratio).

Dark background (#0C0A08). Sleek horizontal 3D progress bar showing 80% filled with glowing orange (#FF6B35), the remaining 20% subtly highlighted in dark gray. Floating geometric shapes in background. Modern tech aesthetic, soft volumetric lighting. Clean composition with space for text overlay. No text in the image.

STYLE: Warm orange #FF6B35 accent, dark #0C0A08 background, 3D render, volumetric lighting, professional tech aesthetic."""
    },
    {
        "name": "landscape-code-transform",
        "prompt": """Create a wide landscape digital advertisement image (approximately 1.91:1 aspect ratio).

Split composition on dark charcoal background (#0C0A08). Left side: chaotic tangled code with red error highlights. Right side: clean organized code with green checkmarks and orange (#FF6B35) accents. Glowing orange dividing line in center showing transformation. Modern 3D tech aesthetic. No text in the image.

STYLE: Warm orange #FF6B35 accent, dark #0C0A08 background, 3D render, volumetric lighting, professional tech aesthetic."""
    },
    {
        "name": "landscape-developer-hands",
        "prompt": """Create a wide landscape digital advertisement image (approximately 1.91:1 aspect ratio).

Dark background (#0C0A08). Close-up of professional hands on modern keyboard, holographic code projections floating above transforming from red errors to green success indicators. Orange (#FF6B35) accent lighting throughout. Cinematic modern tech aesthetic. No face visible. No text in the image.

STYLE: Warm orange #FF6B35 accent, dark #0C0A08 background, 3D render, volumetric lighting, professional cinematic tech aesthetic."""
    },
]

SQUARE_PROMPTS = [
    {
        "name": "square-lifebuoy",
        "prompt": """Create a square digital advertisement image (1:1 aspect ratio).

Minimalist dark charcoal background (#0C0A08). Single glowing orange (#FF6B35) lifebuoy with clean modern design, perfectly centered. Soft orange ambient glow radiating outward. 3D render style, tech startup aesthetic. Plenty of negative space around the lifebuoy. No text.

STYLE: Warm orange #FF6B35 accent, dark #0C0A08 background, 3D render, centered composition, minimal."""
    },
    {
        "name": "square-rocket",
        "prompt": """Create a square digital advertisement image (1:1 aspect ratio).

Dark background (#0C0A08). Orange (#FF6B35) 3D rocket launching upward with warm glowing trail. Below it, subtle tangled code being left behind, symbolizing escaping problems. Modern 3D render, soft volumetric lighting. Centered composition. No text.

STYLE: Warm orange #FF6B35 accent, dark #0C0A08 background, 3D render, centered composition, dynamic upward motion."""
    },
    {
        "name": "square-checkmark",
        "prompt": """Create a square digital advertisement image (1:1 aspect ratio).

Dark charcoal background (#0C0A08). Large glowing orange (#FF6B35) checkmark with subtle circuit board patterns inside it. Soft ambient glow around the checkmark. Modern tech aesthetic, 3D render. Clean centered composition. No text.

STYLE: Warm orange #FF6B35 accent, dark #0C0A08 background, 3D render, centered, tech circuit patterns."""
    },
    {
        "name": "square-abstract",
        "prompt": """Create a square digital advertisement image (1:1 aspect ratio).

Dark background (#0C0A08). Abstract 3D geometric shapes in orange (#FF6B35) and dark gray, floating and interconnected with glowing edges. Suggests technology and innovation. Modern tech startup aesthetic. Minimal, clean centered composition. No text.

STYLE: Warm orange #FF6B35 accent, dark #0C0A08 background, 3D abstract geometric, interconnected shapes, glowing edges."""
    },
]

PORTRAIT_PROMPTS = [
    {
        "name": "portrait-rescue",
        "prompt": """Create a tall portrait digital advertisement image (4:5 aspect ratio, vertical).

Dark charcoal background (#0C0A08). Orange (#FF6B35) lifebuoy at top of composition, trailing down to a small laptop at bottom. Glowing orange connection line between them. Vertical composition, 3D render style. Modern tech aesthetic. No text.

STYLE: Warm orange #FF6B35 accent, dark #0C0A08 background, 3D render, vertical flow from top to bottom."""
    },
    {
        "name": "portrait-progress",
        "prompt": """Create a tall portrait digital advertisement image (4:5 aspect ratio, vertical).

Dark background (#0C0A08). Vertical progress bar showing 80% filled with glowing orange (#FF6B35), ascending from bottom to near top. Floating geometric shapes in background. Modern tech aesthetic. Clean vertical composition. No text.

STYLE: Warm orange #FF6B35 accent, dark #0C0A08 background, 3D render, vertical ascending composition."""
    },
]


def main():
    print("=" * 70)
    print("PIXEL - VibeRescue Google Ads BATCH Generation")
    print(f"Timestamp: {TIMESTAMP}")
    print("=" * 70)

    results = []

    # Generate Landscape images (4)
    print("\n" + "=" * 70)
    print("LANDSCAPE IMAGES (4)")
    print("=" * 70)
    for item in LANDSCAPE_PROMPTS:
        filename = f"viberescue-{item['name']}-{TIMESTAMP}.png"
        result = generate_image(item["prompt"], filename)
        results.append({"name": item["name"], "path": result, "type": "landscape"})

    # Generate Square images (4)
    print("\n" + "=" * 70)
    print("SQUARE IMAGES (4)")
    print("=" * 70)
    for item in SQUARE_PROMPTS:
        filename = f"viberescue-{item['name']}-{TIMESTAMP}.png"
        result = generate_image(item["prompt"], filename)
        results.append({"name": item["name"], "path": result, "type": "square"})

    # Generate Portrait images (2)
    print("\n" + "=" * 70)
    print("PORTRAIT IMAGES (2)")
    print("=" * 70)
    for item in PORTRAIT_PROMPTS:
        filename = f"viberescue-{item['name']}-{TIMESTAMP}.png"
        result = generate_image(item["prompt"], filename)
        results.append({"name": item["name"], "path": result, "type": "portrait"})

    # Summary
    print("\n" + "=" * 70)
    print("BATCH GENERATION COMPLETE")
    print("=" * 70)

    success = sum(1 for r in results if r["path"])
    failed = sum(1 for r in results if not r["path"])

    print(f"\n✅ Success: {success}")
    print(f"❌ Failed: {failed}")

    print("\n📸 Generated files:")
    for r in results:
        status = "✅" if r["path"] else "❌"
        print(f"   {status} [{r['type']:9}] {r['name']}")

    print(f"\n📂 Staging folder: {STAGING_DIR}")
    print(f"🔖 Batch timestamp: {TIMESTAMP}")


if __name__ == "__main__":
    main()
