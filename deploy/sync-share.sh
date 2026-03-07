#!/bin/sh
# Sync an Azure Files share between storage accounts using azcopy.
#
# Usage:
#   ./deploy/sync-share.sh <share-name> [--from <account>] [--to <account>] [-d|--destructive]
#
# Shares: home, sandbox, audit
#
# Dry run by default. Pass -d or --destructive to actually sync.
#
# Requires: azcopy, az CLI (logged in)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "${SCRIPT_DIR}/common.sh"

FROM_ACCOUNT="${VOLUME_STORAGE}"
TO_ACCOUNT="${BRAIN_STORAGE}"
SHARE_NAME=""
DESTRUCTIVE=0

while [ $# -gt 0 ]; do
  case "$1" in
    -d|--destructive)
      DESTRUCTIVE=1
      shift
      ;;
    --from)
      FROM_ACCOUNT="$2"
      shift 2
      ;;
    --to)
      TO_ACCOUNT="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./deploy/sync-share.sh <share-name> [--from <account>] [--to <account>] [-d]"
      echo ""
      echo "Sync an Azure Files share between storage accounts."
      echo "Dry run by default — pass -d to actually sync."
      echo ""
      echo "Shares: home, sandbox, audit"
      echo ""
      echo "Options:"
      echo "  --from <account>    Source storage account (default: ${VOLUME_STORAGE})"
      echo "  --to <account>      Destination storage account (default: ${BRAIN_STORAGE})"
      echo "  -d, --destructive   Actually sync (default is dry run)"
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      SHARE_NAME="$1"
      shift
      ;;
  esac
done

if [ -z "${SHARE_NAME}" ]; then
  echo "❌ Share name required. Usage: ./deploy/sync-share.sh <share-name> [-d]" >&2
  echo "   Shares: home, sandbox, audit" >&2
  exit 1
fi

if ! command -v azcopy >/dev/null 2>&1; then
  echo "❌ azcopy not found. Install it: https://learn.microsoft.com/azure/storage/common/storage-use-azcopy-v10" >&2
  exit 1
fi

echo "🔑 Generating SAS tokens..."
EXPIRY=$(date -u -d '+1 hour' '+%Y-%m-%dT%H:%MZ')

SRC_SAS=$(az storage account generate-sas \
  --account-name "${FROM_ACCOUNT}" \
  --services f \
  --resource-types sco \
  --permissions rl \
  --expiry "${EXPIRY}" \
  --output tsv)

DST_SAS=$(az storage account generate-sas \
  --account-name "${TO_ACCOUNT}" \
  --services f \
  --resource-types sco \
  --permissions rwlc \
  --expiry "${EXPIRY}" \
  --output tsv)

SRC_URL="https://${FROM_ACCOUNT}.file.core.windows.net/${SHARE_NAME}?${SRC_SAS}"
DST_URL="https://${TO_ACCOUNT}.file.core.windows.net/${SHARE_NAME}?${DST_SAS}"

DISPLAY_SRC="https://${FROM_ACCOUNT}.file.core.windows.net/${SHARE_NAME}"
DISPLAY_DST="https://${TO_ACCOUNT}.file.core.windows.net/${SHARE_NAME}"

if [ "${DESTRUCTIVE}" = 1 ]; then
  echo "📤 Syncing share '${SHARE_NAME}'..."
  echo "   From: ${DISPLAY_SRC}"
  echo "   To:   ${DISPLAY_DST}"
  azcopy sync "${SRC_URL}" "${DST_URL}" --recursive
  echo "✅ Sync complete"
else
  echo "🔍 Dry run — showing what would be synced:"
  echo "   From: ${DISPLAY_SRC}"
  echo "   To:   ${DISPLAY_DST}"
  azcopy sync "${SRC_URL}" "${DST_URL}" --recursive --dry-run
  echo ""
  echo "Run with -d to actually sync."
fi
