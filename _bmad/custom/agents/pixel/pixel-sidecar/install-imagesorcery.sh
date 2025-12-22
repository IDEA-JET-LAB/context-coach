#!/bin/bash
# =============================================================================
# ImageSorcery MCP Installation Script
# =============================================================================
# This script installs the ImageSorcery MCP server for local image manipulation
# capabilities (crop, resize, rotate, background removal, object detection, etc.)
#
# Usage: ./install-imagesorcery.sh
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VENV_DIR="$HOME/.venvs/imagesorcery-mcp"
PYTHON_MIN_VERSION="3.10"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          ImageSorcery MCP Installation Script                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# -----------------------------------------------------------------------------
# Check Python version
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[1/5]${NC} Checking Python version..."

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}ERROR: Python 3 is not installed.${NC}"
    echo "Please install Python 3.10 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "       Found Python $PYTHON_VERSION"

# Compare versions (simple check)
if [[ "$(printf '%s\n' "$PYTHON_MIN_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$PYTHON_MIN_VERSION" ]]; then
    echo -e "${RED}ERROR: Python $PYTHON_MIN_VERSION or higher is required.${NC}"
    exit 1
fi
echo -e "${GREEN}       ✓ Python version OK${NC}"

# -----------------------------------------------------------------------------
# Create virtual environment directory
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[2/5]${NC} Creating virtual environment at $VENV_DIR..."

mkdir -p "$(dirname "$VENV_DIR")"

if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}       Virtual environment already exists.${NC}"
    read -p "       Recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$VENV_DIR"
        python3 -m venv "$VENV_DIR"
        echo -e "${GREEN}       ✓ Virtual environment recreated${NC}"
    else
        echo "       Using existing environment"
    fi
else
    python3 -m venv "$VENV_DIR"
    echo -e "${GREEN}       ✓ Virtual environment created${NC}"
fi

# -----------------------------------------------------------------------------
# Activate venv and install package
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[3/5]${NC} Installing imagesorcery-mcp package..."

source "$VENV_DIR/bin/activate"

pip install --upgrade pip > /dev/null 2>&1
pip install imagesorcery-mcp

echo -e "${GREEN}       ✓ Package installed${NC}"

# -----------------------------------------------------------------------------
# Run post-install (downloads models ~2GB)
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[4/5]${NC} Running post-installation (downloading models)..."
echo -e "${YELLOW}       This may take several minutes (~2GB of models)${NC}"
echo ""

imagesorcery-mcp --post-install

echo ""
echo -e "${GREEN}       ✓ Models downloaded${NC}"

# -----------------------------------------------------------------------------
# Verify installation
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[5/5]${NC} Verifying installation..."

if [ -f "$VENV_DIR/bin/imagesorcery-mcp" ]; then
    echo -e "${GREEN}       ✓ imagesorcery-mcp executable found${NC}"
else
    echo -e "${RED}       ✗ imagesorcery-mcp executable NOT found${NC}"
    exit 1
fi

# Test that it can start (quick check)
timeout 5 "$VENV_DIR/bin/imagesorcery-mcp" --help > /dev/null 2>&1 || true
echo -e "${GREEN}       ✓ Installation verified${NC}"

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Installation Complete!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Virtual environment: ${BLUE}$VENV_DIR${NC}"
echo -e "Executable:          ${BLUE}$VENV_DIR/bin/imagesorcery-mcp${NC}"
echo ""
echo -e "${YELLOW}MCP Configuration (already added to .mcp.json):${NC}"
echo ""
echo '  "imagesorcery-mcp": {'
echo '    "command": "$HOME/.venvs/imagesorcery-mcp/bin/imagesorcery-mcp",'
echo '    "timeout": 120'
echo '  }'
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Restart Claude Code to load the new MCP server"
echo "  2. The ImageSorcery tools will be available in your session"
echo "  3. Use Pixel agent commands like *smart-crop, *remove-bg, etc."
echo ""
echo -e "${GREEN}Ready to use ImageSorcery with Pixel! 🎨${NC}"
