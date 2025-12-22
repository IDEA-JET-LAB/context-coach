#!/usr/bin/env python3
"""
Generate 4 cohesive process icons for VibeRescue "How it works" section.
Style: 3D isometric, glass effects, dark background, orange accents
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

# Strict style system for cohesive icon family
STYLE_SYSTEM = """Create a SQUARE 1:1 aspect ratio icon. This is critical - the image MUST be square.

You are creating ONE icon from a cohesive icon family set. ALL icons MUST follow these EXACT specifications:

FORMAT: Square image, 1:1 aspect ratio (width equals height)

BACKGROUND:
- Solid dark background color: #1A1A1A (dark charcoal gray)
- NO gradients, NO patterns, completely flat uniform dark background

COLOR PALETTE (use ONLY these colors):
- Primary accent: #FF6B35 (warm orange) - main icon glow and highlights
- Secondary glow: #FF8C42 (lighter orange) - subtle glow effects  
- Icon body: #2A2A2A to #3A3A3A (dark gray) with glass/transparent effects

STYLE:
- 3D isometric perspective with glass/transparent elements
- Soft orange glow around main icon element
- Centered composition with icon taking 60-70% of frame
- NO text, NO labels, NO characters, NO QR codes
- Professional, tech-forward aesthetic
- Consistent visual weight and detail level

CRITICAL: Output must be SQUARE (1:1 ratio). Not wide, not tall - SQUARE.
"""

# Icon definitions
ICONS = [
    {
        "name": f"viberescue-process-consultation-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Free Consultation - Video call / Meeting
- 3D isometric video conference screen or monitor
- Glass/transparent screen with subtle reflections
- 1-2 floating chat bubble indicators around it
- Soft orange glow emanating from screen
- Could have small connection dots suggesting network
- Clean, modern, professional feel
- SQUARE FORMAT 1:1"""
    },
    {
        "name": f"viberescue-process-assessment-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Expert Assessment - Code analysis / Diagnostics
- 3D isometric magnifying glass examining code blocks
- Or diagnostic scanner with scanning effect
- Glass lens with orange glow reflection
- Small data visualization elements (simple bars or dots)
- Suggests deep analysis and expertise
- Match the visual weight of other icons in set
- SQUARE FORMAT 1:1"""
    },
    {
        "name": f"viberescue-process-path-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Clear Path Forward - Roadmap / Direction
- 3D isometric pathway, road, or route visualization
- Directional arrow showing forward progress
- Could be stepping stones or milestone markers
- Orange glow highlighting the path
- Suggests clarity and forward movement
- Match the visual weight of other icons in set
- SQUARE FORMAT 1:1"""
    },
    {
        "name": f"viberescue-process-choice-{timestamp}",
        "prompt": f"""{STYLE_SYSTEM}

ICON: Your Choice - Options / Decision making
- 3D isometric toggle switches or control panel
- Or branching paths showing multiple options
- Could be selection checkmarks or radio buttons in 3D
- Orange glow on selected/active elements
- Suggests user control and multiple possibilities
- Match the visual weight of other icons in set
- SQUARE FORMAT 1:1"""
    }
]

def generate_image(model, image_config, index):
    name = image_config["name"]
    prompt = image_config["prompt"]
    
    print(f"\n[{index+1}/4] Generating: {name}")
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
    print("🎨 PIXEL - VibeRescue Process Icons Generation")
    print("=" * 60)
    print(f"Model: {MODEL} (Nano Banana Pro)")
    print(f"Style: 3D Isometric, Glass Effects, Orange Accents")
    print(f"Output: {STAGING_DIR}")
    print("=" * 60)
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name=MODEL)
    
    results = []
    for i, img_config in enumerate(ICONS):
        result = generate_image(model, img_config, i)
        results.append((img_config["name"], result))
    
    print("\n" + "=" * 60)
    successful = sum(1 for r in results if r[1])
    print(f"✨ Generated: {successful}/4 icons")
    print("=" * 60)
    
    if successful > 0:
        print("\n📁 Staged Files:")
        for name, path in results:
            if path:
                print(f"   {path}")
    
    return [r[1] for r in results if r[1]]

if __name__ == "__main__":
    main()
