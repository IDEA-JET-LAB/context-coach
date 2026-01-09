#!/usr/bin/env python3
"""
Contextor Brand Development - Neural Network Logo
Full brand system exploration
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

# Neural Network brand foundation
BRAND_DNA = """
BRAND: Contextor
TAGLINE: "Your Context Tutor"
LOGO CONCEPT: Neural Network - Brain neurons/synapses connecting to form the letter C
PERSONALITY: Intelligent, Connected, Guiding, Modern, Premium
COLORS:
- Primary: Glowing blues, teals, cyans (neural/tech feel)
- Accent: Warm highlights (synaptic energy)
- Neutral: Deep dark backgrounds, clean whites
"""

# Brand development boards
BRAND_BOARDS = [
    {
        "name": "neural-icon-variations",
        "title": "Neural Network Icon Variations",
        "prompt": f"""
Create an exploration board showing 6 VARIATIONS of the Neural Network C logo.

{BRAND_DNA}

LAYOUT: 2 rows × 3 columns on dark background (#0A0A0A)

6 ICON VARIATIONS:
1. GLOWING NODES - Bright glowing dots/nodes connected by thin lines forming C, blue-cyan glow
2. MINIMAL NODES - Simplified version with fewer nodes, cleaner, more abstract
3. DENSE NETWORK - More nodes and connections, complex but readable C shape
4. GRADIENT CONNECTIONS - Lines have gradient from blue to purple, nodes are white
5. BLACK & WHITE - Pure white nodes and lines on black, no color, stark contrast
6. WARM NEURAL - Orange/gold glowing nodes instead of blue, warmer feel

STYLE FOR ALL:
- The C shape must be clearly recognizable
- Nodes are dots/circles of varying sizes
- Connections are thin elegant lines
- Neural/synaptic aesthetic
- Premium, sophisticated
- Each icon should work at small sizes

OUTPUT: Single image with 6 icon variations in grid layout.
"""
    },
    {
        "name": "neural-app-icons",
        "title": "App Icon Versions",
        "prompt": f"""
Create an exploration board showing 6 APP ICON versions of the Neural Network C logo.

{BRAND_DNA}

LAYOUT: 2 rows × 3 columns on dark background (#1A1A1A)

6 APP ICON VERSIONS (all with rounded corners like iOS/Android app icons):
1. DARK GRADIENT BG - Neural C on dark blue to purple gradient background, rounded square
2. LIGHT VERSION - Neural C (dark/black) on white/light gray background, for light mode
3. SOLID COLOR BG - Neural C on solid deep blue (#1E3A5F) background
4. GRADIENT NEURAL - The neural network itself has gradient, dark background
5. MINIMAL APP - Super simplified neural C, just 5-7 key nodes, clean
6. BADGE STYLE - Neural C with subtle outer glow, like a notification badge feel

STYLE FOR ALL:
- iOS/Android app icon proportions (rounded square, ~1024x1024 style)
- Must be recognizable at small sizes (think phone home screen)
- Premium app store quality
- The C should be the clear focal point
- Proper padding within the icon bounds

OUTPUT: Single image with 6 app icon variations in grid layout.
"""
    },
    {
        "name": "neural-horizontal-lockups",
        "title": "Horizontal Wordmark Lockups",
        "prompt": f"""
Create an exploration board showing 6 HORIZONTAL WORDMARK lockups for Contextor.

{BRAND_DNA}

LAYOUT: 3 rows × 2 columns on dark background (#0A0A0A)

6 HORIZONTAL LOCKUPS (icon LEFT, text RIGHT):
1. MODERN SANS - Neural C icon + "Contextor" in clean geometric sans-serif (like Inter or Geist)
2. BOLD WEIGHT - Neural C icon + "Contextor" in heavy/bold weight, strong presence
3. LIGHT WEIGHT - Neural C icon + "Contextor" in light/thin weight, elegant
4. WITH TAGLINE - Neural C + "Contextor" + "Your Context Tutor" smaller below
5. TECH FONT - Neural C + "Contextor" in slightly techy/futuristic font
6. LOWERCASE - Neural C + "contextor" all lowercase, modern startup feel

STYLE FOR ALL:
- Icon and text vertically centered/aligned
- Proper spacing between icon and text
- Text should complement, not overpower the icon
- White/light text on dark background
- Professional, premium quality
- Would work on website header, business cards

OUTPUT: Single image with 6 horizontal lockups in grid layout.
"""
    },
    {
        "name": "neural-vertical-lockups",
        "title": "Vertical Wordmark Lockups",
        "prompt": f"""
Create an exploration board showing 6 VERTICAL/STACKED wordmark lockups for Contextor.

{BRAND_DNA}

LAYOUT: 2 rows × 3 columns on dark background (#0A0A0A)

6 VERTICAL LOCKUPS (icon TOP, text BELOW):
1. CENTERED STACK - Neural C icon centered above "Contextor" text, clean alignment
2. WITH TAGLINE - Neural C above "Contextor" above "Your Context Tutor" (smaller)
3. COMPACT - Tighter spacing, icon and text close together, efficient
4. SPACIOUS - More breathing room between icon and text, premium feel
5. ICON DOMINANT - Larger icon, smaller text below, icon is the star
6. BALANCED - Icon and text similar visual weight, harmonious

STYLE FOR ALL:
- Everything centered on vertical axis
- Proper hierarchy (icon → brand name → tagline)
- White/light elements on dark background
- Would work for app splash screen, social media avatar, favicon
- Premium, polished quality

OUTPUT: Single image with 6 vertical lockups in grid layout.
"""
    },
    {
        "name": "neural-brand-system",
        "title": "Brand System Overview",
        "prompt": f"""
Create a BRAND SYSTEM OVERVIEW board showing how the Contextor Neural Network brand works across applications.

{BRAND_DNA}

LAYOUT: Creative layout showing brand in context on dark background (#0A0A0A)

SHOW THE BRAND IN USE:
- Website header mockup with horizontal logo
- Mobile app icon on a phone home screen suggestion
- Business card corner or edge
- Social media profile avatar (circular crop)
- Email signature style
- Favicon (tiny square version)
- Loading/splash screen concept
- Maybe a subtle pattern made from the neural network nodes

STYLE:
- Show the brand system cohesively
- Demonstrate versatility across touchpoints
- Premium, modern SaaS brand feel
- Color variations (dark mode primary, light mode secondary)
- The neural network C should be recognizable in all contexts
- Professional presentation, like a brand guidelines preview

OUTPUT: Single comprehensive brand system overview image.
"""
    }
]

def generate_brand_board(board, index):
    """Generate a brand development board"""
    name = board["name"]
    title = board["title"]
    prompt = board["prompt"]

    print(f"\n{'='*60}")
    print(f"🧠 Brand Board {index+1}/5: {title}")
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
    print("\n" + "🧠"*30)
    print("CONTEXTOR NEURAL NETWORK - BRAND DEVELOPMENT")
    print(f"Model: {MODEL}")
    print("Building your complete brand system...")
    print("🧠"*30)

    generated = []

    for i, board in enumerate(BRAND_BOARDS):
        filepath = generate_brand_board(board, i)
        if filepath:
            generated.append(filepath)

    print("\n" + "="*60)
    print(f"🧠 BRAND DEVELOPMENT COMPLETE: {len(generated)}/5 boards")
    print("="*60)

    for path in generated:
        print(f"  ✓ {Path(path).name}")

    return generated

if __name__ == "__main__":
    main()
