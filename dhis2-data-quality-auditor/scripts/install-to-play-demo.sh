#!/usr/bin/env bash
set -euo pipefail

# Installs the built app onto a chosen play.dhis2.org demo instance via
# DHIS2's standard, documented App Management API (POST /api/apps) -- the
# same install mechanism used for any manual DHIS2 app install, nothing
# app-hub-specific or undocumented.
#
# Wrapped as a script because play.dhis2.org instances are periodically
# reset/rebuilt by DHIS2, which wipes any installed app. Re-run this before
# sharing a demo link -- don't assume a previously-shared link is still live.
#
# Required environment variables:
#   PLAY_URL       Base URL of the play instance, e.g. https://play.dhis2.org/40.0.0
#   PLAY_USERNAME  Username for that instance's published demo admin account
#   PLAY_PASSWORD  Password for that account
#
# Demo credentials for play.dhis2.org are published by DHIS2 itself and can
# change over time -- look them up at https://play.dhis2.org before running
# this rather than assuming any specific value here.

: "${PLAY_URL:?Set PLAY_URL to the play.dhis2.org instance base URL, e.g. https://play.dhis2.org/40.0.0}"
: "${PLAY_USERNAME:?Set PLAY_USERNAME to that instance's demo admin username}"
: "${PLAY_PASSWORD:?Set PLAY_PASSWORD to that instance's demo admin password}"

cd "$(dirname "$0")/.."

ZIP_PATH="$(ls -t build/bundle/*.zip 2>/dev/null | head -1 || true)"
if [ -z "$ZIP_PATH" ]; then
  echo "No built app zip found under build/bundle/. Run 'yarn build' first." >&2
  exit 1
fi

BASE_URL="${PLAY_URL%/}"

echo "Installing ${ZIP_PATH} to ${BASE_URL} ..."
HTTP_STATUS=$(curl -sS -o /tmp/dqa-install-response.json -w '%{http_code}' \
  -u "${PLAY_USERNAME}:${PLAY_PASSWORD}" \
  -F "file=@${ZIP_PATH}" \
  "${BASE_URL}/api/apps")

cat /tmp/dqa-install-response.json
echo

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  echo "Install request succeeded (HTTP ${HTTP_STATUS})."
else
  echo "Install request failed (HTTP ${HTTP_STATUS})." >&2
  exit 1
fi

echo
echo "Next steps to get the shareable demo link:"
echo "1. Open ${BASE_URL}/dhis-web-app-management/index.html#/apps"
echo "2. Confirm 'Data Quality Auditor' is listed and note its launch URL"
echo "   (exact mount path varies by DHIS2 core version)."
echo "3. Open that URL in a private/incognito window to confirm it loads with"
echo "   no local session before sharing it."
