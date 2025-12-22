#!/bin/bash
# BMAD Custom Agents Import Script
# Imports Pixel, Marketing Strategist, and SEO Specialist agents

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-.}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       BMAD Custom Agents Bundle Installer                  ║"
echo "║       Pixel | Marketing Strategist | SEO Specialist        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if target has BMAD
if [ ! -d "$TARGET_DIR/.bmad" ]; then
    echo -e "${RED}Error: No .bmad folder found in $TARGET_DIR${NC}"
    echo "Please run this script from a BMAD-enabled project root,"
    echo "or provide the path as an argument: ./import.sh /path/to/project"
    exit 1
fi

echo -e "${GREEN}✓ Found BMAD installation in $TARGET_DIR${NC}"
echo ""

# Create custom agents directory if needed
CUSTOM_DIR="$TARGET_DIR/.bmad/custom/agents"
mkdir -p "$CUSTOM_DIR"

# Function to install an agent
install_agent() {
    local agent_name=$1
    local agent_display=$2
    local agent_icon=$3

    echo -n "Installing $agent_icon $agent_display... "

    if [ -d "$CUSTOM_DIR/$agent_name" ]; then
        echo -e "${YELLOW}exists (skipping)${NC}"
        return
    fi

    cp -r "$SCRIPT_DIR/agents/$agent_name" "$CUSTOM_DIR/"
    echo -e "${GREEN}done${NC}"
}

# Install agents
install_agent "pixel" "Pixel" "🎨"
install_agent "marketing-strategist" "Marketing Strategist" "📊"
install_agent "seo-specialist" "SEO Specialist" "🔍"

echo ""

# Check for agent manifest
MANIFEST="$TARGET_DIR/.bmad/_cfg/agent-manifest.csv"
if [ -f "$MANIFEST" ]; then
    echo -e "${YELLOW}Note: You may need to register agents in:${NC}"
    echo "  $MANIFEST"
    echo ""
    echo "Add these entries if not present:"
    echo '  "pixel","Pixel","AI Image Artist","🎨",...'
    echo '  "marketing-strategist","Marketing Strategist","Digital Marketing Expert","📊",...'
    echo '  "seo-specialist","SEO Specialist","SEO, AEO & GEO Expert","🔍",...'
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo "Activate agents with:"
echo "  /bmad:custom:agents:pixel"
echo "  /bmad:custom:agents:marketing-strategist"
echo "  /bmad:custom:agents:seo-specialist"
echo ""
echo "See README.md for configuration options."
echo "═══════════════════════════════════════════════════════════"
