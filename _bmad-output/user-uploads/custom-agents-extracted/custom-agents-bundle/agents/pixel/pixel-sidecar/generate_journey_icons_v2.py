#!/usr/bin/env python3
"""
Generate 6 journey icons for VibeRescue "You did something most people never do" section.
Style: Matching mobile deliverables - dark gray body, orange accents, clean edges
Workflow: Generate → Remove background → Auto-crop
"""

import os
import sys
import warnings
from pathlib import Path
from datetime import datetime

warnings.filterwarnings("ignore")

try:
    import google.generativeai as genai
    from PIL import Image
    from rembg import remove
    import io
except ImportError as e:
    print(f"ERROR: Missing dependency - {e}")
    sys.exit(1)

MODEL = "gemini-3-pro-image-preview"
STAGING_DIR = Path(__file__).parent / "staging"
STAGING_DIR.mkdir(exist_ok=True)

timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

# Style matching existing mobile deliverables icons
# Key: NO glows/halos around icon, clean hard edges for background removal
STYLE_SYSTEM = """Create a SQUARE 1:1 icon matching this EXACT style:

BACKGROUND:
- Solid flat dark gray: #1A1A1A
- Completely uniform, NO gradients, NO glow, NO vignette
- The background must be perfectly flat for clean removal

ICON STYLE (matching IdeaJetLab mobile icons):
- Main shape: Dark charcoal gray (#2D2D2D to #3A3A3A) with subtle 3D depth
- Accent elements: Solid warm orange (#FF6B35) fills
- Rounded corners on rectangular shapes (radius ~12-15%)
- Semi-3D feel with subtle shading ON the icon itself
- Clean, sharp edges - NO glow, NO halo, NO blur around the icon
- Simple, iconic, instantly recognizable

CRITICAL - CLEAN EDGES:
- The icon must have HARD, CLEAN edges against the background
- NO orange glow emanating outward from the icon
- NO soft shadows spreading onto the background
- NO gradient transition between icon and background
- The edge between icon and background must be crisp and defined

COMPOSITION:
- Icon centered with padding (icon fills ~60% of frame)
- NO text, NO labels, NO watermarks
- Square format 1:1
"""

ICONS = [
    {
        "name": f"journey-idea-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Lightbulb (The Idea)
- Classic lightbulb shape
- Bulb body: Dark gray (#2D2D2D) with subtle glass-like sheen
- Filament inside: Orange (#FF6B35) glowing element
- Screw base: Darker gray with subtle ridges
- The orange glow stays INSIDE the bulb, does NOT extend outside
- Clean hard edges on the outer bulb silhouette"""
    },
    {
        "name": f"journey-build-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Crossed Tools (The Build)
- Wrench and hammer crossed in X pattern
- Tool bodies: Dark gray (#2D2D2D) metallic look
- Tool heads/accents: Orange (#FF6B35) solid color
- Simple geometric shapes, not overly detailed
- Clean hard silhouette edges, no outer effects"""
    },
    {
        "name": f"journey-launch-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Rocket (The Launch)
- Sleek rocket pointing upward diagonally
- Rocket body: Dark gray (#2D2D2D) with subtle metallic sheen
- Fins and window accent: Orange (#FF6B35)
- Small flame at bottom: Orange, contained, not spreading out
- Clean rocket silhouette, no glow extending beyond the shape"""
    },
    {
        "name": f"journey-users-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Two People (Users Signed Up)
- Two user bust silhouettes (head + shoulders)
- Front figure: Orange (#FF6B35) solid fill
- Back figure: Dark gray (#2D2D2D) slightly behind
- Simple rounded head shapes, curved shoulders
- Clean edges, figures have defined boundaries"""
    },
    {
        "name": f"journey-sales-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Money Bag (First Sales)
- Classic money bag shape with tied top
- Bag body: Dark gray (#2D2D2D) rounded shape
- Dollar sign on front: Orange (#FF6B35) bold
- Simple, iconic shape
- Clean edges, no glow around the bag"""
    },
    {
        "name": f"journey-magic-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Sparkle Stars (The Magic)
- 3-4 four-pointed stars clustered together
- Stars: Orange (#FF6B35) solid fill
- Varying sizes for visual interest
- Clean geometric star shapes
- Stars have sharp defined edges, no blur or glow spreading out"""
    }
]


def remove_background_and_crop(input_path, output_path):
    """Remove background using rembg and auto-crop to content bounds."""
    try:
        # Read image
        with open(input_path, 'rb') as f:
            input_data = f.read()

        # Remove background
        output_data = remove(input_data)

        # Open as PIL image
        img = Image.open(io.BytesIO(output_data))

        # Auto-crop to content bounds (remove transparent padding)
        bbox = img.getbbox()
        if bbox:
            # Add small padding (5% of size)
            padding = int(max(bbox[2] - bbox[0], bbox[3] - bbox[1]) * 0.05)
            new_bbox = (
                max(0, bbox[0] - padding),
                max(0, bbox[1] - padding),
                min(img.width, bbox[2] + padding),
                min(img.height, bbox[3] + padding)
            )
            img = img.crop(new_bbox)

        # Save as PNG with transparency
        img.save(output_path, "PNG")
        return img.size

    except Exception as e:
        print(f"   ✗ Background removal error: {e}")
        return None


def generate_icon(model, icon_config, index, total):
    name = icon_config["name"]
    prompt = icon_config["prompt"]
    icon_type = name.split('-')[1]  # idea, build, launch, etc.

    print(f"\n[{index+1}/{total}] Generating: {icon_type}")
    print("-" * 50)

    try:
        response = model.generate_content(prompt)

        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    image_data = part.inline_data.data

                    # Save raw generated image
                    raw_path = STAGING_DIR / f"{name}-raw.png"
                    with open(raw_path, "wb") as f:
                        f.write(image_data)

                    img = Image.open(raw_path)
                    print(f"   ✓ Generated: {img.size[0]}x{img.size[1]}")

                    # Remove background and crop
                    print(f"   → Removing background...")
                    final_path = STAGING_DIR / f"{name}.png"
                    final_size = remove_background_and_crop(raw_path, final_path)

                    if final_size:
                        file_size = os.path.getsize(final_path) / 1024
                        print(f"   ✓ Final: {final_size[0]}x{final_size[1]} ({file_size:.0f} KB)")

                        # Clean up raw file
                        os.remove(raw_path)
                        return str(final_path)
                    else:
                        return str(raw_path)  # Return raw if bg removal failed

        print(f"   ✗ No image in response")
        return None

    except Exception as e:
        print(f"   ✗ Error: {e}")
        return None


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)

    print("=" * 60)
    print("🎨 PIXEL - Journey Icons v2")
    print("=" * 60)
    print(f"Model: {MODEL} (Nano Banana Pro)")
    print(f"Style: Mobile deliverables style, clean edges")
    print(f"Workflow: Generate → Remove BG → Auto-crop")
    print(f"Output: {STAGING_DIR}")
    print("=" * 60)

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name=MODEL)

    results = []
    for i, icon_config in enumerate(ICONS):
        result = generate_icon(model, icon_config, i, len(ICONS))
        results.append((icon_config["name"], result))

    print("\n" + "=" * 60)
    successful = sum(1 for r in results if r[1])
    print(f"✨ Generated: {successful}/{len(ICONS)} icons with transparent backgrounds")
    print("=" * 60)

    if successful > 0:
        print("\n📁 Final Files (transparent PNGs):")
        for name, path in results:
            if path:
                print(f"   {path}")

    return [r[1] for r in results if r[1]]


if __name__ == "__main__":
    main()
