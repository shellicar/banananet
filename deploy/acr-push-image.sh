#!/bin/sh
# Reusable functions for building, pushing, and deploying container images.
# Source this file, then call the functions.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "${SCRIPT_DIR}/common.sh"

acr_login() {
  echo "🔐 Logging in to ACR..."
  az acr login --name "${ACR_NAME}" < /dev/null
}

# Build and tag a Docker image.
# Usage: build_image <image-name> <dockerfile>
# Sets: IMAGE_REF_<suffix> variable with the full ACR image reference
build_image() {
  _name="$1"
  _dockerfile="$2"

  echo ""
  echo "══════════════════════════════════════════"
  echo "  Building ${_name}"
  echo "══════════════════════════════════════════"

  docker build -t "${_name}:build" -f "${_dockerfile}" .

  _tag=$(docker inspect "${_name}:build" --format '{{.Id}}' | cut -c8-15)
  _ref="${ACR}/${_name}:${_tag}"

  echo "🏷️  Tagging as ${_ref}"
  docker tag "${_name}:build" "${_ref}"

  eval "IMAGE_REF_$(echo "${_name}" | tr '-' '_')=${_ref}"
}

# Push an image to ACR and tag as latest.
# Usage: push_image <acr-image-ref>
push_image() {
  _ref="$1"
  _name=$(echo "${_ref}" | sed "s|${ACR}/||" | cut -d: -f1)
  _tag=$(echo "${_ref}" | rev | cut -d: -f1 | rev)

  echo "📤 Pushing ${_ref}..."
  docker push "${_ref}"

  _latest_digest=$(az acr manifest show-metadata \
    --registry "${ACR_NAME}" \
    --name "${_name}:latest" \
    --query "digest" \
    --output tsv 2>/dev/null || echo "")
  _new_digest=$(az acr manifest show-metadata \
    --registry "${ACR_NAME}" \
    --name "${_name}:${_tag}" \
    --query "digest" \
    --output tsv)

  if [ "${_latest_digest}" = "${_new_digest}" ]; then
    echo "🏷️  latest already points to ${_tag}, skipping import"
  else
    echo "🏷️  Tagging latest → ${_tag} (server-side)..."
    az acr import \
      --name "${ACR_NAME}" \
      --source "${_ref}" \
      --image "${_name}:latest" \
      --force
  fi
}

# Update a Container App to use a new image.
# Usage: deploy_image <container-app-name> <acr-image-ref>
deploy_image() {
  _app="$1"
  _ref="$2"
  _tag=$(echo "${_ref}" | rev | cut -d: -f1 | rev)
  _build_time=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  _current_image=$(az containerapp show \
    -n "${_app}" \
    -g "${RESOURCE_GROUP}" \
    --query "properties.template.containers[0].image" \
    --output tsv 2>/dev/null || echo "")

  if [ "${_current_image}" = "${_ref}" ]; then
    echo "🚀 ${_app} already running ${_ref}, skipping deploy"
  else
    echo "🚀 Updating ${_app}..."
    az containerapp update \
      -n "${_app}" \
      -g "${RESOURCE_GROUP}" \
      --image "${_ref}" \
      --set-env-vars \
        "BANANABOT_BUILD_HASH=${_tag}" \
        "BANANABOT_BUILD_TIME=${_build_time}" \
      --query "{image: properties.template.containers[0].image, readyRevision: properties.latestReadyRevisionName, latestRevision: properties.latestRevisionName}" \
      --output json
  fi
}
