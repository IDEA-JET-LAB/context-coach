#!/usr/bin/env node

/**
 * Script to generate PNG icon from SVG for VS Code Marketplace
 *
 * Requirements:
 *   npm install sharp
 *
 * Usage:
 *   node scripts/generate-icon.js
 *
 * Or using npx:
 *   npx sharp-cli -i images/contextor-icon.svg -o images/icon.png resize 128 128
 */

const fs = require('fs');
const path = require('path');

// Try to use sharp if available
async function generateWithSharp() {
  try {
    const sharp = require('sharp');

    const inputPath = path.join(__dirname, '..', 'images', 'contextor-icon.svg');
    const outputPath = path.join(__dirname, '..', 'images', 'icon.png');

    // Read SVG and convert to PNG
    await sharp(inputPath)
      .resize(128, 128)
      .png()
      .toFile(outputPath);

    console.log('Successfully generated icon.png (128x128)');
    return true;
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      return false;
    }
    throw error;
  }
}

// Fallback: Create a simple colored square as placeholder
function generatePlaceholder() {
  const outputPath = path.join(__dirname, '..', 'images', 'icon.png');

  // Minimal 128x128 PNG with solid color (dark purple #1a1a2e)
  // This is a valid PNG but should be replaced with a proper icon
  console.log(`
================================================================================
PNG ICON REQUIRED

The VS Code Marketplace requires a PNG icon (128x128 pixels).

To generate the icon, install sharp and run this script:

  cd packages/vscode-extension
  npm install sharp --save-dev
  node scripts/generate-icon.js

Or use an online SVG to PNG converter:
  1. Open images/contextor-icon.svg in a browser
  2. Use a tool like https://svgtopng.com/ to convert to 128x128 PNG
  3. Save as images/icon.png

Or use ImageMagick (if installed):
  convert -background none -resize 128x128 images/contextor-icon.svg images/icon.png

Or use Inkscape (if installed):
  inkscape -w 128 -h 128 images/contextor-icon.svg -o images/icon.png
================================================================================
  `);

  return false;
}

async function main() {
  const success = await generateWithSharp();
  if (!success) {
    generatePlaceholder();
    process.exit(1);
  }
}

main().catch(console.error);
