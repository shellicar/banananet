#!/bin/sh
# Build and push brain + ears images to Azure Container Registry
#
# Usage:
#   ./deploy/acr-push.sh [--build-only] [--no-deploy]
#
# Options:
#   --build-only  Build and tag without pushing to ACR
#   --no-deploy   Push to ACR but don't update Container Apps

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "${SCRIPT_DIR}/acr-push-image.sh"

BUILD_ONLY=0
NO_DEPLOY=0

for arg in "$@"; do
  case "$arg" in
    --build-only) BUILD_ONLY=1 ;;
    --no-deploy) NO_DEPLOY=1 ;;
  esac
done

# Compile
echo "📦 Building packages..."
pnpm build

# Build
build_image banananet-brain apps/brain/Dockerfile
build_image banananet-ears apps/ears/Dockerfile

if [ "$BUILD_ONLY" = 1 ]; then
  echo ""
  echo "✅ All images built (--build-only, skipping push)"
  exit 0
fi

# Push
acr_login
push_image "${IMAGE_REF_banananet_brain}"
push_image "${IMAGE_REF_banananet_ears}"

echo ""
echo "✅ All images pushed"

if [ "$NO_DEPLOY" = 1 ]; then
  exit 0
fi

# Deploy
deploy_image "${BRAIN_APP}" "${IMAGE_REF_banananet_brain}"
deploy_image "${EARS_APP}" "${IMAGE_REF_banananet_ears}"

echo ""
echo "✅ Deploy complete"
