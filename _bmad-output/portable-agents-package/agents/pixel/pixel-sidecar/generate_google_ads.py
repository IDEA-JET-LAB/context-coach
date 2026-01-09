#!/usr/bin/env python3
"""
Pixel - Google Ads Campaign Image Generator
VibeRescue Campaign for IdeaJetLab
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

def generate_image(prompt: str, filename: str):
    """Generate an image using Gemini with image generation"""

    print(f"\n🎨 Generating: {filename}")
    print(f"   Prompt: {prompt[:100]}...")

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

                # Decode base64 if needed, or save raw bytes
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
        import traceback
        traceback.print_exc()
        return None

def main():
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    # Sample 1: Landscape Rescue Concept (1200x628, ~1.91:1)
    landscape_prompt = """Create a digital advertisement image in landscape format (wide, approximately 1.91:1 aspect ratio).

Dark charcoal background (#0C0A08). A glowing orange (#FF6B35) lifebuoy floating above a small laptop showing error screens. Soft warm ambient glow around the lifebuoy. 3D render style, modern tech startup aesthetic. Clean minimal composition with negative space on right side for text overlay. No text in the image itself.

STYLE:
- Primary accent color: Warm orange #FF6B35
- Background: Dark charcoal #0C0A08
- 3D render with soft volumetric lighting
- Modern tech startup aesthetic
- Professional yet innovative feel
- High contrast between subject and background
"""

    # Sample 2: Square Lifebuoy Icon (1200x1200, 1:1)
    square_prompt = """Create a digital advertisement image in square format (1:1 aspect ratio).

Minimalist dark charcoal background (#0C0A08). Single glowing orange (#FF6B35) lifebuoy with clean modern design, perfectly centered. Soft orange ambient glow radiating outward. 3D render style, tech startup aesthetic. Plenty of negative space around the lifebuoy. No text.

STYLE:
- Primary accent color: Warm orange #FF6B35
- Background: Dark charcoal #0C0A08
- 3D render with soft volumetric lighting
- Modern minimalist tech aesthetic
- Centered composition with balanced negative space
- Lifebuoy should occupy about 50-60% of canvas
"""

    print("=" * 60)
    print("PIXEL - VibeRescue Google Ads Sample Generation")
    print("=" * 60)

    # Generate Sample 1
    result1 = generate_image(
        landscape_prompt,
        f"viberescue-ads-landscape-rescue-{timestamp}.png"
    )

    # Generate Sample 2
    result2 = generate_image(
        square_prompt,
        f"viberescue-ads-square-lifebuoy-{timestamp}.png"
    )

    print("\n" + "=" * 60)
    print("GENERATION COMPLETE")
    print("=" * 60)

    if result1:
        print(f"\n📸 Sample 1 (Landscape): {result1}")
    if result2:
        print(f"📸 Sample 2 (Square): {result2}")

    print(f"\n📂 Staging folder: {STAGING_DIR}")

if __name__ == "__main__":
    main()
