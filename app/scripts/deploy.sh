#!/bin/bash
#
# PRODUCTION DEPLOYMENT SCRIPT
# ============================
# This script ensures correct build args are used every time.
# NEVER manually type the Supabase API key - it's case-sensitive!
#
# Usage: ./scripts/deploy.sh [version]
# Example: ./scripts/deploy.sh v1.2.2
#

set -e

# Version tag (required)
VERSION=${1:-}
if [ -z "$VERSION" ]; then
  echo "Error: Version tag required"
  echo "Usage: ./scripts/deploy.sh v1.2.2"
  exit 1
fi

# Production configuration - SINGLE SOURCE OF TRUTH
# These values are copied from Supabase dashboard - DO NOT MODIFY
SUPABASE_URL="https://ddskanjiobrjphscskog.supabase.co"
SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkc2thbmppb2JyanBoc2Nza29nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMTMzNTIsImV4cCI6MjA4MTg4OTM1Mn0.lB5CtFZunXFR6QbE2OvKRaMWVhZ-zOEb1GmAVqdtKTA"
APP_URL="https://contextor.co"
GA_MEASUREMENT_ID="G-PPFJMVVMGD"
GCP_PROJECT="ideajetlab-website"
IMAGE_NAME="gcr.io/${GCP_PROJECT}/contextor"

echo "=== Contextor Production Deployment ==="
echo "Version: ${VERSION}"
echo "Image: ${IMAGE_NAME}:${VERSION}"
echo ""

# Step 1: Set GCP project
echo "Setting GCP project..."
gcloud config set project ${GCP_PROJECT}

# Step 2: Build for AMD64 (required for Cloud Run)
echo ""
echo "Building Docker image (this takes ~2 minutes)..."
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL} \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY} \
  --build-arg NEXT_PUBLIC_APP_URL=${APP_URL} \
  --build-arg NEXT_PUBLIC_GA_MEASUREMENT_ID=${GA_MEASUREMENT_ID} \
  -t ${IMAGE_NAME}:${VERSION} \
  .

# Step 3: Push to GCR
echo ""
echo "Pushing to Google Container Registry..."
docker push ${IMAGE_NAME}:${VERSION}

# Step 4: Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy contextor-web \
  --image ${IMAGE_NAME}:${VERSION} \
  --region us-central1

# Step 5: Verify
echo ""
echo "Verifying deployment..."
sleep 5
HEALTH=$(curl -s https://contextor.co/api/health)
echo "Health check: ${HEALTH}"

echo ""
echo "=== Deployment complete ==="
echo "Version ${VERSION} is now live at https://contextor.co"
