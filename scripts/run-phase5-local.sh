#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-http://127.0.0.1:54321}"
export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-phase5-local-test-key}"

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
  bun run preview -- --host 127.0.0.1 --port 8080 >/tmp/consubov-web-preview.log 2>&1 &
  WEB_PID=$!
  READY=0
  for _ in {1..40}; do
    if curl --fail --silent http://127.0.0.1:8080/login >/dev/null; then
      READY=1
      break
    fi
    sleep 0.25
  done
  if [[ "$READY" -ne 1 ]]; then
    cat /tmp/consubov-web-preview.log
    exit 1
  fi

  bunx @axe-core/cli     http://127.0.0.1:8080/     http://127.0.0.1:8080/login     http://127.0.0.1:8080/recuperar-senha

  bunx lighthouse http://127.0.0.1:8080/     --chrome-flags="--headless --no-sandbox"     --output=json     --output-path=/tmp/lighthouse-home.json     --quiet

  bunx lighthouse http://127.0.0.1:8080/login     --chrome-flags="--headless --no-sandbox"     --output=json     --output-path=/tmp/lighthouse-login.json     --quiet

  node - <<'NODE'
const fs = require("fs");
for (const name of ["home", "login"]) {
  const report = JSON.parse(fs.readFileSync(`/tmp/lighthouse-${name}.json`, "utf8"));
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
  unset WEB_PID
)

echo "[phase5] edge functions"
(
  cd supabase/functions
  bunx vitest@3.2.4 run
)

echo "[phase5] api smoke"
PORT=3000 bun apps/api/dist/index.js >/tmp/consubov-api.log 2>&1 &
API_PID=$!
READY=0
for _ in {1..20}; do
  if curl --fail --silent http://127.0.0.1:3000/api/v1/health >/tmp/health.json; then
    READY=1
    break
  fi
  sleep 0.25
done
if [[ "$READY" -ne 1 ]]; then
  cat /tmp/consubov-api.log
  exit 1
fi

test "$(cat /tmp/health.json)" = '{"status":"ok"}'
test "$(curl --fail --silent http://127.0.0.1:3000/api/v1/readiness)" = '{"status":"ready"}'
curl --fail --silent http://127.0.0.1:3000/api/v1/openapi.json >/tmp/openapi.json
grep -q '"openapi":"3.1.0"' /tmp/openapi.json
curl --fail --silent http://127.0.0.1:3000/api/docs >/tmp/docs.html
grep -q 'Consubov Developers' /tmp/docs.html

kill "$API_PID" 2>/dev/null || true
unset API_PID

echo "[phase5] PASS"
