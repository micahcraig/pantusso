#!/usr/bin/env bash
# E2E tests require Node 22 because better-sqlite3 is compiled for that version.
# This wrapper activates nvm's Node 22 before handing off to Playwright.
set -euo pipefail

# In CI, Node is already set up by actions/setup-node — skip nvm entirely.
# Locally, we need nvm to activate the same Node version better-sqlite3 was
# compiled against (v22), because the system node may be a different version.
if [ -z "${CI:-}" ]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # npm sets npm_config_prefix which conflicts with nvm — unset before sourcing
    unset npm_config_prefix
    # shellcheck source=/dev/null
    \. "$NVM_DIR/nvm.sh"
    nvm use 22 --silent
  fi
fi

exec npx playwright test "$@"
