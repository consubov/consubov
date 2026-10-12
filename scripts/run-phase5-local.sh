#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export QA_OUTPUT_DIR="${QA_OUTPUT_DIR:-$ROOT_DIR/.qa/phase5-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
mkdir -p "$QA_OUTPUT_DIR"
echo "[phase5] evidence: $QA_OUTPUT_DIR"

export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-http://127.0.0.1:54321}"
export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-phase5-local-test-key}"

# Refuse inherited production URLs before installing tools or building the client.
node --input-type=module - <<'LOCAL_TARGET'
try {
  const url = new URL(process.env.VITE_SUPABASE_URL);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
} catch {
  console.error('[phase5] VITE_SUPABASE_URL must be a local HTTP origin without credentials or a path');
  process.exit(1);
}
LOCAL_TARGET

cleanup() {
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  if [[ -n "${API_PID:-}" ]]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[phase5] install"
bun install --frozen-lockfile

echo "[phase5] security dependency audit (high/critical block)"
bun audit --audit-level=high

echo "[phase5] check"
bun run check

echo "[phase5] lint baseline + changed"
(
  cd apps/web
  bun run lint:baseline
  bun run lint:changed
)

echo "[phase5] coverage"
(
  cd apps/web
  bun run test:coverage
  bun run check:coverage-baseline
)

echo "[phase5] bundle + secret guard"
(
  cd apps/web
  bun run build
  bun run report:bundle
  bun run check:bundle-budget
  bun run check:dist-secrets
)

if [[ "${PHASE5_INSTALL_PLAYWRIGHT:-0}" == "1" ]]; then
  echo "[phase5] installing chromium"
  (
    cd apps/web
    bunx playwright install --with-deps chromium
  )
fi

echo "[phase5] e2e"
(
  cd apps/web
  bun run test:e2e:smoke
)

echo "[phase5] axe + lighthouse"
(
  cd apps/web
  bun run preview -- --host 127.0.0.1 --port 8080 --strictPort >"$QA_OUTPUT_DIR/web-preview.log" 2>&1 &
  WEB_PID=$!
  trap 'kill "$WEB_PID" 2>/dev/null || true' EXIT
  READY=0
  for _ in {1..40}; do
    if ! kill -0 "$WEB_PID" 2>/dev/null; then cat "$QA_OUTPUT_DIR/web-preview.log"; exit 1; fi
    if grep -q "http://127.0.0.1:8080/" "$QA_OUTPUT_DIR/web-preview.log" && curl --fail --silent http://127.0.0.1:8080/login >/dev/null; then
      READY=1
      break
    fi
    sleep 0.25
  done
  if [[ "$READY" -ne 1 ]]; then
    cat "$QA_OUTPUT_DIR/web-preview.log"
    exit 1
  fi

  export CHROME_PATH="$(node -p 'require("@playwright/test").chromium.executablePath()')"
  QA_BASE_URL=http://127.0.0.1:8080 node ../../scripts/qa/run-a11y-local.mjs

  bunx lighthouse http://127.0.0.1:8080/     --chrome-flags="--headless --no-sandbox"     --output=json     --output-path="$QA_OUTPUT_DIR/lighthouse-home.json"     --quiet

  bunx lighthouse http://127.0.0.1:8080/login     --chrome-flags="--headless --no-sandbox"     --output=json     --output-path="$QA_OUTPUT_DIR/lighthouse-login.json"     --quiet

  node - <<'NODE'
const fs = require("fs");
for (const name of ["home", "login"]) {
  const report = JSON.parse(fs.readFileSync(`${process.env.QA_OUTPUT_DIR}/lighthouse-${name}.json`, "utf8"));
  const categories = report.categories;
  const audits = report.audits;
  console.log("[lighthouse]", name, JSON.stringify({
    performance: categories.performance.score,
    accessibility: categories.accessibility.score,
    bestPractices: categories["best-practices"].score,
    seo: categories.seo.score,
    lcpMs: audits["largest-contentful-paint"]?.numericValue ?? null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    tbtMs: audits["total-blocking-time"]?.numericValue ?? null,
  }));
}
NODE


  kill "$WEB_PID" 2>/dev/null || true
  trap - EXIT
  unset WEB_PID
)

node --test scripts/tests/a11y-runner.browser.mjs

echo "[phase5] edge functions"
(
  cd supabase/functions
  bunx vitest@3.2.4 run
)

echo "[phase5] api smoke"
PORT=3000 bun apps/api/dist/index.js >"$QA_OUTPUT_DIR/consubov-api.log" 2>&1 &
API_PID=$!
READY=0
for _ in {1..20}; do
  if curl --fail --silent http://127.0.0.1:3000/api/v1/health >"$QA_OUTPUT_DIR/health.json"; then
    READY=1
    break
  fi
  sleep 0.25
done
if [[ "$READY" -ne 1 ]]; then
  cat "$QA_OUTPUT_DIR/consubov-api.log"
  exit 1
fi

test "$(cat "$QA_OUTPUT_DIR/health.json")" = '{"status":"ok"}'
test "$(curl --fail --silent http://127.0.0.1:3000/api/v1/readiness)" = '{"status":"ready"}'
curl --fail --silent http://127.0.0.1:3000/api/v1/openapi.json >"$QA_OUTPUT_DIR/openapi.json"
grep -q '"openapi":"3.1.0"' "$QA_OUTPUT_DIR/openapi.json"
curl --fail --silent http://127.0.0.1:3000/api/docs >"$QA_OUTPUT_DIR/docs.html"
grep -q 'Consubov Developers' "$QA_OUTPUT_DIR/docs.html"

kill "$API_PID" 2>/dev/null || true
unset API_PID

# Keep pending performance approval visible without suppressing independent evidence.
node scripts/check-web-lighthouse-budget.mjs
echo "[phase5] PASS"
