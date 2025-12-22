# Vibe Contextor - Prototype Extension

A quick validation prototype to test prompt interception on Lovable.dev.

## What It Does

1. **Detects** the prompt input field on Lovable
2. **Intercepts** when you click Submit or press Enter
3. **Shows** your prompt in an editable sidebar
4. **Sends** the (optionally edited) prompt when you click "Send to Lovable"

## Installation

### Step 1: Add an Icon (Required)

Chrome requires an icon. Create a simple 128x128 PNG image and save it as:
```
icons/icon128.png
```

**Quick option:** Use any 128x128 image, or create one at:
- https://www.favicon.io/favicon-generator/ (type "VC", download, use the largest size)
- Or just screenshot this purple square and crop to 128x128:

```
 ┌────────────────┐
 │                │
 │      VC        │
 │                │
 └────────────────┘
```

### Step 2: Load in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select this `extension-prototype` folder
6. You should see "Vibe Contextor (Prototype)" appear

### Step 3: Test on Lovable

1. Go to https://lovable.dev/
2. Open any project (or create one)
3. Look for the purple **"VC"** button in the bottom-right corner
4. Type a prompt in Lovable's input
5. Either:
   - Click the VC button to open sidebar with current prompt
   - Click Submit / press Enter - the sidebar should intercept

## Debugging

Open Chrome DevTools (F12) and check the Console tab for messages starting with `[Vibe Contextor]`.

The sidebar also has a "Debug Info" section that shows:
- Whether the prompt input was detected
- Whether the submit button was found
- Current prompt length

## Troubleshooting

### "Extension won't load"
- Make sure you have an `icons/icon128.png` file
- Check for syntax errors in manifest.json

### "Prompt not detected"
- Lovable may have updated their UI
- Check the console for detection attempts
- You may need to update the selectors in `content.js`

### "Submit not intercepting"
- Some buttons might not match our selectors
- Try using the VC toggle button instead of Submit

### "Prompt not sending after edit"
- React controlled inputs can be tricky
- Check console for errors
- The value might need a different event dispatch

## Files

```
extension-prototype/
├── manifest.json    # Chrome extension configuration
├── content.js       # Main script - detection & interception
├── sidebar.css      # Sidebar styling
├── icons/
│   └── icon128.png  # YOU NEED TO ADD THIS
└── README.md        # This file
```

## Success = Validation

If this works, we've validated:
- ✓ We can detect Lovable's prompt input
- ✓ We can intercept submissions
- ✓ We can show a sidebar UI
- ✓ We can relay prompts back

Next step would be full MVP with suggestions, scoring, etc.

---

*Prototype built by Winston (Architect) for Context Coach validation*
