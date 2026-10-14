#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Ensure Git Bash, Node, and Bun tools are available in PATH
if [ -d "/c/Program Files/Git/bin" ]; then
  export PATH="/c/Program Files/Git/bin:/c/Program Files/Git/usr/bin:$PATH"
fi
if [ -d "/c/Program Files/nodejs" ]; then
  export PATH="/c/Program Files/nodejs:$PATH"
fi
if [ -d "/c/Users/MATEUS/.bun/bin" ]; then
  export PATH="/c/Users/MATEUS/.bun/bin:$PATH"
fi
if [ -d "$HOME/.bun/bin" ]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Pin Playwright browser cache strictly to repository-local toolchain
export PLAYWRIGHT_BROWSERS_PATH="$ROOT_DIR/.qa/tools/playwright-browsers"

# Strict local dummy environment for offline validation (zero external network)
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-http://127.0.0.1:54321}"
export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-phase7-local-offline-key}"

echo "[phase7] step 1: toolchain & doctor preflight"
for tool in bash git node bun; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[ERRO] Ferramenta essencial ausente no PATH: $tool" >&2
    exit 2
  fi
done

if [ ! -d "$PLAYWRIGHT_BROWSERS_PATH" ]; then
  echo "[ERRO] Cache local de navegadores ausente em $PLAYWRIGHT_BROWSERS_PATH" >&2
  echo "       Execute 'task setup' para provisionar os navegadores locais." >&2
  exit 2
fi

echo "[phase7] step 2: legacy offline inventory & safety tests"
node --test apps/web/tests/legacy-offline-inventory.test.cjs apps/web/tests/legacy-offline-safety.test.cjs

echo "[phase7] step 3: offline core scoped database & atomic queue tests"
node --test apps/web/tests/indexeddb-local-adapter.test.cjs \
            apps/web/tests/indexeddb-local-safety.test.cjs \
            apps/web/tests/local-command-policy.test.cjs \
            apps/web/tests/local-sync-round.test.cjs \
            apps/web/tests/atomic-command-queue.test.cjs \
            apps/web/tests/atomic-queue-transition-snapshot.test.cjs

echo "[phase7] step 4: legacy migration engine & local queue chaos tests"
node --test apps/web/tests/legacy-migration-engine.test.cjs apps/web/tests/local-queue-chaos.test.cjs

echo "[phase7] step 5: playwright real browser atomic queue & chaos tests (chromium & webkit)"
(
  cd "$ROOT_DIR/apps/web"
  bunx playwright test --config=playwright.pwa.config.ts queue-atomic.spec.ts queue-chaos.spec.ts
)

echo "[phase7] step 6: local snapshot rehearsal & reconciliation test"
node --test scripts/tests/local-snapshot-rehearsal.test.mjs

echo "[phase7] PASS: all phase 7 offline local gates passed"
