#!/bin/sh
# Create an ACR purge task to clean up old image tags
#
# Usage:
#   ./deploy/acr-purge-setup.sh
#
# Creates a daily scheduled task that:
#   - Deletes tags older than 7 days
#   - Keeps the 5 most recent tags
#   - Purges untagged manifests

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "${SCRIPT_DIR}/common.sh"

IMAGE_NAME="banananet-brain"

echo "🗑️  Creating ACR purge task for ${IMAGE_NAME}..."
az acr task create \
  --name "purge-${IMAGE_NAME}" \
  --registry "${ACR_NAME}" \
  --cmd "acr purge --filter '${IMAGE_NAME}:.*' --ago 7d --keep 5 --untagged" \
  --schedule "0 0 * * *" \
  --context /dev/null

echo "✅ Purge task created: purge-${IMAGE_NAME}"
echo "   Schedule: daily at midnight UTC"
echo "   Keeps: 5 most recent tags"
echo "   Deletes: tags older than 7 days + untagged manifests"
