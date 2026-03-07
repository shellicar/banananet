#!/bin/sh
# Restart the active Container App revision to force a new instance
#
# Usage:
#   ./deploy/ca-restart.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "${SCRIPT_DIR}/common.sh"

restart_app() {
  _app="$1"

  _revision=$(az containerapp revision list \
    -n "${_app}" \
    -g "${RESOURCE_GROUP}" \
    --query "[?properties.active].name | [0]" \
    -o tsv)

  if [ -z "$_revision" ]; then
    echo "No active revision found for ${_app}" >&2
    return 1
  fi

  echo "Restarting ${_app} revision: ${_revision}"
  az containerapp revision restart \
    -n "${_app}" \
    -g "${RESOURCE_GROUP}" \
    --revision "${_revision}"

  echo "Restart triggered: ${_revision}"
}

restart_app "${BRAIN_APP}"
restart_app "${EARS_APP}"
