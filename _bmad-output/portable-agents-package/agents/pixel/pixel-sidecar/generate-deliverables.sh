#!/bin/bash
# Pixel - Deliverables Icons Batch Generation Script
# Generates 6 cohesive 3D isometric illustrations for IdeaJetLab

STAGING_DIR="$(dirname "$0")/staging"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Style anchor for consistency
STYLE_PREFIX="3D isometric illustration with tech-forward futuristic aesthetic. Dark charcoal background (#1A1A1A). Warm orange (#ff6b35) accent glows and highlights. Glass and transparent UI elements. Professional, innovative, dimensional. High quality, detailed."

# Image configurations
declare -a IMAGES=(
    "deliverable-01-app|A modern smartphone and laptop displaying floating app screens with data visualizations. Connected by glowing orange lines. Glass panels showing UI mockups. Tech dashboard aesthetic."
    "deliverable-02-auth|A glowing shield with secure lock and biometric fingerprint scan. Key symbols. Orange security pulse waves. Digital identity verification elements."
    "deliverable-03-payment|A stylized credit card with flowing transaction lines. Stripe-like wave pattern. Money flow visualization. Subscription symbols. Orange glow on payment processing."
    "deliverable-04-dashboard|Floating admin control panels with charts, graphs, and data tables. User management icons. Content grid views. Glowing orange accent elements."
    "deliverable-05-database|Stacked database cylinders with glowing data flow connections. API endpoint symbols. Type-safe code snippets floating. Supabase-inspired green and orange accents."
    "deliverable-06-hosting|Server rack with global network nodes. CDN edge connections spanning a globe. Cloud deployment symbols. Orange glowing network paths."
)

echo "🎨 Pixel - Generating Deliverables Icons"
echo "========================================"
echo "Staging directory: $STAGING_DIR"
echo ""

mkdir -p "$STAGING_DIR"

for item in "${IMAGES[@]}"; do
    IFS='|' read -r filename prompt <<< "$item"

    full_prompt="$STYLE_PREFIX $prompt"
    output_file="$STAGING_DIR/${TIMESTAMP}-${filename}.png"

    echo "🖼️  Generating: $filename"
    echo "   Prompt: ${prompt:0:80}..."

    # Call Imagen 4 API
    response=$(curl -s -X POST \
        "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict" \
        -H "x-goog-api-key: $GEMINI_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"instances\": [{\"prompt\": $(echo "$full_prompt" | jq -Rs .)}],
            \"parameters\": {
                \"sampleCount\": 1,
                \"aspectRatio\": \"4:3\"
            }
        }")

    # Extract and decode the image
    image_data=$(echo "$response" | jq -r '.predictions[0].bytesBase64Encoded // empty')

    if [ -n "$image_data" ]; then
        echo "$image_data" | base64 -d > "$output_file"
        echo "   ✅ Saved: $output_file"
    else
        error=$(echo "$response" | jq -r '.error.message // "Unknown error"')
        echo "   ❌ Failed: $error"
        echo "$response" > "$STAGING_DIR/${TIMESTAMP}-${filename}-error.json"
    fi

    echo ""
    sleep 1  # Rate limiting
done

echo "========================================"
echo "🎨 Generation complete!"
echo "Check staging folder: $STAGING_DIR"
