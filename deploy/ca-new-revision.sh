#!/bin/sh
# Create a new revision of the Container App (same image, forces new instance)
#
# Usage:
#   ./deploy/ca-new-revision.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "${SCRIPT_DIR}/common.sh"

new_revision() {
  _app="$1"

  echo "Creating new revision for ${_app}"
  az containerapp update \
    -n "${_app}" \
    -g "${RESOURCE_GROUP}" \
    --revision-suffix "$(date +%Y%m%d%H%M%S)"

  echo "New revision created for ${_app}"
}

new_revision "${BRAIN_APP}"
# new_revision "${EARS_APP}"
