# ImageSorcery MCP Integration Protocol

## Overview

This protocol defines how Pixel integrates with **ImageSorcery MCP** for post-generation image manipulation. ImageSorcery provides local, privacy-focused image processing capabilities including cropping, background removal, object detection, resizing, rotation, and more.

**Key Principle:** ImageSorcery tools are "dumb executors" - they do exactly what you tell them. Pixel must provide the intelligence: detecting objects first, calculating coordinates, then executing operations.

---

## Available Tools Reference

### Core Manipulation Tools

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `crop` | Crop image to coordinates | `x1, y1, x2, y2` |
| `resize` | Resize to dimensions | `width, height` or `scale` |
| `rotate` | Rotate by degrees | `angle` (any degree value) |
| `fill` | Fill areas with color/transparency | `areas[], color, opacity, invert_areas` |
| `blur` | Blur areas of image | `areas[], blur_strength, invert_areas` |
| `overlay` | Composite images | `base_image_path, overlay_image_path, x, y` |

### Detection Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `find` | Text-prompt object detection | "find the cat", "find the logo" - use for specific subjects |
| `detect` | General object detection | List ALL objects in image - use for inventory/analysis |

### Utility Tools

| Tool | Purpose |
|------|---------|
| `get_metainfo` | Get image dimensions, format, metadata |
| `ocr` | Extract text from images |
| `draw_texts` | Add text overlays |
| `draw_rectangles` | Draw rectangles (annotations, highlights) |
| `draw_circles` | Draw circles |
| `draw_lines` | Draw lines |
| `draw_arrows` | Draw arrows (for guides, annotations) |
| `change_color` | Convert to grayscale/sepia |

---

## The Intelligence Workflow

### Pattern: Detect → Calculate → Execute

Most smart operations follow this three-step pattern:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   1. DETECT     │ ──▶ │  2. CALCULATE   │ ──▶ │   3. EXECUTE    │
│                 │     │                 │     │                 │
│ find/detect to  │     │ Use bbox to     │     │ Call crop/fill/ │
│ get bbox coords │     │ compute final   │     │ blur with final │
│                 │     │ coordinates     │     │ coordinates     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**When to use this pattern:**
- Smart cropping (isolate subject)
- Background removal (need to know where subject IS)
- Background blur (blur everything EXCEPT subject)
- Subject-centered resizing

**When NOT needed (direct execution):**
- Simple crop with known coordinates
- Resize entire image
- Rotate entire image
- Add overlay at known position

---

## Detection Tools Deep Dive

### `find` - Text-Prompt Detection

Use when you know WHAT you're looking for.

**Tool Call:**
```json
{
  "name": "find",
  "arguments": {
    "input_path": "/path/to/image.png",
    "description": "rocket icon",
    "confidence": 0.3,
    "return_all_matches": false,
    "return_geometry": true,
    "geometry_format": "mask"
  }
}
```

**Response:**
```json
{
  "image_path": "/path/to/image.png",
  "query": "rocket icon",
  "found_objects": [
    {
      "description": "rocket icon",
      "match": "rocket",
      "confidence": 0.92,
      "bbox": [150, 80, 350, 320],
      "mask_path": "/path/to/image_mask_0.png"
    }
  ],
  "found": true
}
```

**Bbox format:** `[x1, y1, x2, y2]` where:
- `x1, y1` = top-left corner
- `x2, y2` = bottom-right corner

### `detect` - General Object Detection

Use when you want to see ALL objects in an image.

**Tool Call:**
```json
{
  "name": "detect",
  "arguments": {
    "input_path": "/path/to/image.png",
    "confidence": 0.5,
    "return_geometry": true
  }
}
```

**Response:**
```json
{
  "image_path": "/path/to/image.png",
  "detections": [
    {"class": "person", "confidence": 0.95, "bbox": [10, 20, 200, 400]},
    {"class": "dog", "confidence": 0.88, "bbox": [250, 150, 380, 350]},
    {"class": "car", "confidence": 0.76, "bbox": [400, 200, 600, 350]}
  ]
}
```

---

## Coordinate Calculations

### Getting Image Dimensions

Before calculating, always know the image size:

```json
{
  "name": "get_metainfo",
  "arguments": {
    "input_path": "/path/to/image.png"
  }
}
```

Returns:
```json
{
  "dimensions": {"width": 512, "height": 512},
  "format": "PNG"
}
```

### Calculating Centered Crop for Aspect Ratio

**Given:**
- Object bbox: `[obj_x1, obj_y1, obj_x2, obj_y2]`
- Image dimensions: `img_width, img_height`
- Target aspect ratio: `target_w:target_h` (e.g., 4:3)
- Padding percentage: `padding` (e.g., 0.1 for 10%)

**Calculate:**

```
1. Object center:
   center_x = (obj_x1 + obj_x2) / 2
   center_y = (obj_y1 + obj_y2) / 2

2. Object dimensions with padding:
   obj_width = (obj_x2 - obj_x1) * (1 + padding)
   obj_height = (obj_y2 - obj_y1) * (1 + padding)

3. Determine crop size based on aspect ratio:
   target_ratio = target_w / target_h

   If obj_width / obj_height > target_ratio:
     # Object is wider than target ratio - fit to width
     crop_width = obj_width
     crop_height = crop_width / target_ratio
   Else:
     # Object is taller than target ratio - fit to height
     crop_height = obj_height
     crop_width = crop_height * target_ratio

4. Calculate crop coordinates (centered on object):
   crop_x1 = center_x - (crop_width / 2)
   crop_y1 = center_y - (crop_height / 2)
   crop_x2 = center_x + (crop_width / 2)
   crop_y2 = center_y + (crop_height / 2)

5. Clamp to image bounds:
   crop_x1 = max(0, crop_x1)
   crop_y1 = max(0, crop_y1)
   crop_x2 = min(img_width, crop_x2)
   crop_y2 = min(img_height, crop_y2)

6. Adjust if clamping broke aspect ratio:
   # Shift the crop area if one side hit a boundary
   # Or resize crop to fit within bounds while maintaining ratio
```

### Example Calculation

**Scenario:** Crop rocket icon from 512x512 image to 4:3 aspect ratio

```
Input:
  - Image: 512 x 512
  - Object bbox: [150, 80, 350, 320]
  - Target ratio: 4:3 (1.333)
  - Padding: 15%

Step 1: Object center
  center_x = (150 + 350) / 2 = 250
  center_y = (80 + 320) / 2 = 200

Step 2: Object dimensions with padding
  obj_width = (350 - 150) * 1.15 = 230
  obj_height = (320 - 80) * 1.15 = 276

Step 3: Aspect ratio adjustment
  current_ratio = 230 / 276 = 0.83
  target_ratio = 4 / 3 = 1.33

  Object is taller than target, so fit to height:
  crop_height = 276
  crop_width = 276 * 1.33 = 367

Step 4: Centered crop coordinates
  crop_x1 = 250 - (367 / 2) = 66.5 → 66
  crop_y1 = 200 - (276 / 2) = 62
  crop_x2 = 250 + (367 / 2) = 433.5 → 434
  crop_y2 = 200 + (276 / 2) = 338

Step 5: Clamp to bounds
  crop_x1 = max(0, 66) = 66 ✓
  crop_y1 = max(0, 62) = 62 ✓
  crop_x2 = min(512, 434) = 434 ✓
  crop_y2 = min(512, 338) = 338 ✓

Final crop: [66, 62, 434, 338]
Result size: 368 x 276 (ratio: 1.33 = 4:3) ✓
```

---

## Workflow Protocols

### Protocol: Smart Crop (`*smart-crop`)

**Trigger:** User wants to crop to isolate subject with optional aspect ratio

**Steps:**

1. **Get image info**
   ```json
   {"name": "get_metainfo", "arguments": {"input_path": "<image>"}}
   ```

2. **Detect subject**
   ```json
   {
     "name": "find",
     "arguments": {
       "input_path": "<image>",
       "description": "<subject description>",
       "confidence": 0.3
     }
   }
   ```

3. **Handle detection result**
   - If `found: false` → Inform user, ask for manual coordinates or different description
   - If `found: true` → Extract bbox from first (highest confidence) result

4. **Calculate crop area**
   - Apply padding (default 15%)
   - If aspect ratio specified, adjust using formulas above
   - Clamp to image bounds

5. **Execute crop**
   ```json
   {
     "name": "crop",
     "arguments": {
       "input_path": "<image>",
       "x1": <calculated>, "y1": <calculated>,
       "x2": <calculated>, "y2": <calculated>,
       "output_path": "<output>"
     }
   }
   ```

6. **Preview result** (auto-open with system viewer)

---

### Protocol: Background Removal (`*remove-bg`)

**Trigger:** User wants transparent background around subject

**Steps:**

1. **Detect subject with mask**
   ```json
   {
     "name": "find",
     "arguments": {
       "input_path": "<image>",
       "description": "<subject>",
       "return_geometry": true,
       "geometry_format": "mask"
     }
   }
   ```

2. **Use mask for precise removal**
   ```json
   {
     "name": "fill",
     "arguments": {
       "input_path": "<image>",
       "areas": [{"mask_path": "<returned mask path>", "color": null}],
       "invert_areas": true,
       "output_path": "<output.png>"
     }
   }
   ```

   **Note:** `color: null` = transparent, `invert_areas: true` = affect everything OUTSIDE the mask

3. **Alternative: Bbox-based removal** (less precise)
   ```json
   {
     "name": "fill",
     "arguments": {
       "input_path": "<image>",
       "areas": [{"x1": <bbox_x1>, "y1": <bbox_y1>, "x2": <bbox_x2>, "y2": <bbox_y2>, "color": null}],
       "invert_areas": true,
       "output_path": "<output.png>"
     }
   }
   ```

4. **Important:** Output MUST be PNG format for transparency support

---

### Protocol: Background Blur (`*blur-bg`)

**Trigger:** User wants subject in focus with blurred background

**Steps:**

1. **Detect subject**
   ```json
   {
     "name": "find",
     "arguments": {
       "input_path": "<image>",
       "description": "<subject>",
       "return_geometry": true,
       "geometry_format": "mask"
     }
   }
   ```

2. **Apply inverted blur**
   ```json
   {
     "name": "blur",
     "arguments": {
       "input_path": "<image>",
       "areas": [{"mask_path": "<mask>", "blur_strength": 25}],
       "invert_areas": true,
       "output_path": "<output>"
     }
   }
   ```

   **Note:** `blur_strength` must be odd number (21, 25, 31, etc.)

---

### Protocol: Resize (`*resize`)

**Trigger:** User wants to resize image

**Direct execution - no detection needed:**

```json
{
  "name": "resize",
  "arguments": {
    "input_path": "<image>",
    "width": 800,
    "height": 600,
    "output_path": "<output>"
  }
}
```

**Preserve aspect ratio:** Provide only width OR height, and the other will be calculated automatically.

---

### Protocol: Rotate (`*rotate`)

**Trigger:** User wants to rotate image

**Direct execution:**

```json
{
  "name": "rotate",
  "arguments": {
    "input_path": "<image>",
    "angle": 45,
    "output_path": "<output>"
  }
}
```

**Note:** Uses `imutils.rotate_bound` which expands canvas to fit rotated image without cropping.

---

### Protocol: Detect Objects (`*detect-objects`)

**Trigger:** User wants to see what objects are in the image

**Direct execution:**

```json
{
  "name": "detect",
  "arguments": {
    "input_path": "<image>",
    "confidence": 0.5,
    "return_geometry": false
  }
}
```

**Report to user:**
- List each detected object with confidence score
- Optionally draw bounding boxes using `draw_rectangles` for visualization

---

### Protocol: Add Overlay/Watermark (`*add-overlay`)

**Trigger:** User wants to composite images

**Direct execution:**

```json
{
  "name": "overlay",
  "arguments": {
    "base_image_path": "<background>",
    "overlay_image_path": "<logo or watermark>",
    "x": 10,
    "y": 10,
    "output_path": "<output>"
  }
}
```

**Common positions:**
- Top-left: `x=10, y=10`
- Top-right: `x=base_width - overlay_width - 10, y=10`
- Bottom-right: `x=base_width - overlay_width - 10, y=base_height - overlay_height - 10`
- Centered: `x=(base_width - overlay_width) / 2, y=(base_height - overlay_height) / 2`

---

## Error Handling

### Detection Failures

**If `find` returns `found: false`:**

1. Try lower confidence threshold (0.2 or 0.1)
2. Try different description (more generic or more specific)
3. Try `detect` to see what IS detected
4. Ask user for manual coordinates
5. Fall back to center-crop if appropriate

**Response template:**
```
I couldn't detect "<description>" in the image (confidence threshold: 0.3).

Options:
1. Try a different description - what should I look for?
2. I can show you what objects ARE detected in the image
3. You can provide manual coordinates [x1, y1, x2, y2]
4. I can do a center-crop at the requested aspect ratio
```

### Coordinate Overflow

**If calculated crop exceeds image bounds:**

1. Shift crop area to fit (maintain size, change position)
2. If still doesn't fit, shrink crop while maintaining aspect ratio
3. Warn user if significant content may be lost

### File Format Issues

**Transparency requires PNG:**
- If user requests transparency on JPEG → convert to PNG first or warn
- Always output PNG when transparency is involved

---

## Command Summary

| Command | Detection Required | Primary Tool(s) | Notes |
|---------|-------------------|-----------------|-------|
| `*smart-crop` | Yes | find → crop | Calculates centered crop |
| `*crop-to-ratio <ratio>` | Yes | find → crop | Enforces aspect ratio |
| `*remove-bg` | Yes | find → fill (invert) | Outputs PNG |
| `*blur-bg` | Yes | find → blur (invert) | Strength must be odd |
| `*resize <w> <h>` | No | resize | Direct execution |
| `*rotate <degrees>` | No | rotate | Expands canvas |
| `*detect-objects` | N/A | detect | Returns object list |
| `*add-overlay` | No | overlay | Needs position |
| `*blur-area <coords>` | No | blur | Direct with coordinates |
| `*annotate` | No | draw_* tools | Rectangles, arrows, text |

---

## Integration Checklist

Before using ImageSorcery:

- [ ] MCP server is configured in `.claude/settings.json`
- [ ] Virtual environment is active with `imagesorcery-mcp` installed
- [ ] YOLO models downloaded (`imagesorcery-mcp --post-install`)
- [ ] Staging folder exists for output images

**MCP Configuration:**
```json
{
  "mcpServers": {
    "imagesorcery-mcp": {
      "command": "/path/to/venv/bin/imagesorcery-mcp",
      "timeout": 100
    }
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12 | Initial protocol draft |
