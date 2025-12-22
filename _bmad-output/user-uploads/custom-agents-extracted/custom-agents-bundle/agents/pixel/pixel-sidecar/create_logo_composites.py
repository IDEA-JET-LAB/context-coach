#!/usr/bin/env python3
"""
Pixel - Logo Composite Generator
Creates square and landscape logo images for Google Ads
"""

import os
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime

# Paths
STAGING_DIR = os.path.dirname(os.path.abspath(__file__)) + "/staging"
LOGO_PATH = "/Users/edgars/My-projects/2025-projects/DEV/idea-jet-lab/ideajetlab/public/assets/logo.png"

# Brand colors
BG_COLOR = (12, 10, 8)  # #0C0A08
ACCENT_COLOR = (255, 107, 53)  # #FF6B35

TIMESTAMP = datetime.now().strftime("%Y%m%d-%H%M%S")

def create_square_logo():
    """Create 1200x1200 square logo on dark background"""
    print("\n🎨 Creating Square Logo (1200x1200)...")

    # Create dark background
    canvas = Image.new("RGBA", (1200, 1200), BG_COLOR + (255,))

    # Load logo
    logo = Image.open(LOGO_PATH).convert("RGBA")

    # Scale logo to fit nicely (about 60% of canvas)
    max_size = 720
    logo.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    # Center the logo
    x = (1200 - logo.width) // 2
    y = (1200 - logo.height) // 2

    # Paste with transparency
    canvas.paste(logo, (x, y), logo)

    # Save
    filepath = f"{STAGING_DIR}/viberescue-logo-square-{TIMESTAMP}.png"
    canvas.save(filepath, "PNG")
    print(f"   ✅ Saved: {filepath}")
    return filepath

def create_landscape_logo():
    """Create 1200x300 landscape logo with text"""
    print("\n🎨 Creating Landscape Logo (1200x300)...")

    # Create dark background
    canvas = Image.new("RGBA", (1200, 300), BG_COLOR + (255,))

    # Load logo
    logo = Image.open(LOGO_PATH).convert("RGBA")

    # Scale logo to fit height (with padding)
    max_height = 220
    ratio = max_height / logo.height
    new_width = int(logo.width * ratio)
    logo = logo.resize((new_width, max_height), Image.Resampling.LANCZOS)

    # Position logo on left with padding
    logo_x = 60
    logo_y = (300 - logo.height) // 2
    canvas.paste(logo, (logo_x, logo_y), logo)

    # Add text "IDEA JET LAB" to the right of logo
    draw = ImageDraw.Draw(canvas)

    # Try to load a nice font, fallback to default
    text = "IDEA JET LAB"
    font_size = 64

    try:
        # Try system fonts
        font_paths = [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/Library/Fonts/Arial Bold.ttf",
        ]
        font = None
        for fp in font_paths:
            if os.path.exists(fp):
                font = ImageFont.truetype(fp, font_size)
                break
        if not font:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()

    # Calculate text position (to the right of logo, vertically centered)
    text_x = logo_x + logo.width + 40

    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_height = bbox[3] - bbox[1]
    text_y = (300 - text_height) // 2

    # Draw text in white
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)

    # Save
    filepath = f"{STAGING_DIR}/viberescue-logo-landscape-{TIMESTAMP}.png"
    canvas.save(filepath, "PNG")
    print(f"   ✅ Saved: {filepath}")
    return filepath

def main():
    print("=" * 60)
    print("PIXEL - Logo Composite Generation")
    print("=" * 60)

    os.makedirs(STAGING_DIR, exist_ok=True)

    result1 = create_square_logo()
    result2 = create_landscape_logo()

    print("\n" + "=" * 60)
    print("LOGO COMPOSITES COMPLETE")
    print("=" * 60)

    if result1:
        print(f"\n📸 Square Logo: {result1}")
    if result2:
        print(f"📸 Landscape Logo: {result2}")

if __name__ == "__main__":
    main()
