#!/bin/sh
# Fetch the Azure Functions master key from blob storage and write it to .env
#
# Usage:
#   ./deploy/sync-env.sh
#
# Requires: az CLI (logged in), jq

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "${SCRIPT_DIR}/common.sh"

CONTAINER_NAME="azure-webjobs-secrets"
APP_NAME="${BRAIN_APP}"
STORAGE_ACCOUNT="${BRAIN_STORAGE}"
BLOB_PATH="${APP_NAME}/host.json"
ENV_FILE="../.env"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required but not installed" >&2
  exit 1
fi

echo "Fetching master key from ${STORAGE_ACCOUNT}/${CONTAINER_NAME}/${BLOB_PATH}..."

TMPFILE=$(mktemp)
trap 'rm -f "${TMPFILE}"' EXIT

az storage blob download \
  --account-name "${STORAGE_ACCOUNT}" \
  --container-name "${CONTAINER_NAME}" \
  --name "${BLOB_PATH}" \
  --auth-mode key \
  --file "${TMPFILE}" \
  --output none

MASTER_KEY=$(jq -r '.masterKey.value' "${TMPFILE}")

if [ -z "${MASTER_KEY}" ] || [ "${MASTER_KEY}" = "null" ]; then
  echo "Failed to extract master key from host.json" >&2
  exit 1
fi

if [ -f "${ENV_FILE}" ]; then
  # Remove existing BRAIN_KEY line if present
  EXISTING=$(grep -v '^BRAIN_KEY=' "${ENV_FILE}" || true)
  printf '%s\n' "${EXISTING}" > "${ENV_FILE}"
fi

printf 'BRAIN_KEY=%s\n' "${MASTER_KEY}" >> "${ENV_FILE}"

echo "Written BRAIN_KEY to ${ENV_FILE}"
