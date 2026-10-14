#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Ensure Git Bash and Bun tools are available in PATH
if [ -d "/c/Program Files/Git/bin" ]; then
  export PATH="/c/Program Files/Git/bin:/c/Program Files/Git/usr/bin:$PATH"
fi
if [ -d "/c/Users/MATEUS/.bun/bin" ]; then
  export PATH="/c/Users/MATEUS/.bun/bin:$PATH"
fi
if [ -d "$HOME/.bun/bin" ]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Pin Playwright browser cache strictly to repository-local toolchain
export PLAYWRIGHT_BROWSERS_PATH="$ROOT_DIR/.qa/tools/playwright-browsers"

echo "[phase6] step 1: check static pwa build integrity"
node scripts/qa/check-pwa-build.mjs

echo "[phase6] step 2: service worker & precache integrity tests"
node --test apps/web/tests/sw-integrity.test.cjs apps/web/tests/sw-registration-integrity.test.cjs apps/web/tests/sw-build-injection.test.cjs scripts/tests/sw-precache-integrity.test.mjs scripts/tests/pwa-build-integrity.test.cjs

echo "[phase6] step 3: legacy offline inventory & safety tests"
node --test apps/web/tests/legacy-offline-inventory.test.cjs apps/web/tests/legacy-offline-safety.test.cjs

echo "[phase6] step 4: runtime update consent & browser capabilities tests"
bun run --cwd apps/web test src/test/swUpdateConsent.test.ts src/platform/adapters/BrowserLocationProvider.test.ts

echo "[phase6] step 5: playwright upgrade & legacy preservation fixtures (chromium & webkit)"
bash scripts/qa/run-pwa-fixture.sh

echo "[phase6] PASS: all phase 6 pwa local gates passed"
