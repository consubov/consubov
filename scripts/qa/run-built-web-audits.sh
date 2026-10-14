#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
QA_OUTPUT_DIR="$(QA_OUTPUT_CANDIDATE="${QA_OUTPUT_DIR:-.qa/phase5-built-audits-$(date -u +%Y%m%dT%H%M%SZ)-$$}" node --input-type=module - <<'LOCAL_OUTPUT'
import { checkedOutputDir } from './scripts/qa/run-lighthouse-local.mjs';
try {
  const output = await checkedOutputDir(process.env.QA_OUTPUT_CANDIDATE);
  process.stdout.write(output.replaceAll('\\', '/'));
} catch {
  console.error('[phase5:built-audits] output must be a plain directory inside repository .qa');
  process.exit(1);
}
LOCAL_OUTPUT
)"
export QA_OUTPUT_DIR
mkdir -p "$QA_OUTPUT_DIR"
echo "[phase5:built-audits] evidence: $QA_OUTPUT_DIR"

PWA_BUILD_DIR=apps/web/dist node scripts/qa/check-pwa-build.mjs
echo "[phase5:built-audits] axe + lighthouse"
(
  cd apps/web
  bun run preview -- --host 127.0.0.1 --port 8081 --strictPort >"$QA_OUTPUT_DIR/web-preview.log" 2>&1 &
  WEB_PID=$!
  trap 'kill "$WEB_PID" 2>/dev/null || true' EXIT
  READY=0
  for _ in {1..40}; do
    if ! kill -0 "$WEB_PID" 2>/dev/null; then cat "$QA_OUTPUT_DIR/web-preview.log"; exit 1; fi
    if grep -q "http://127.0.0.1:8081/" "$QA_OUTPUT_DIR/web-preview.log" && curl --connect-timeout 1 --max-time 2 --fail --silent http://127.0.0.1:8081/login >/dev/null; then
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
  QA_BASE_URL=http://127.0.0.1:8081 node ../../scripts/qa/run-a11y-local.mjs

  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo '[phase5:built-audits] own Web preview exited during Axe' >&2
    exit 1
  fi
  QA_BASE_URL=http://127.0.0.1:8081 node ../../scripts/qa/run-lighthouse-local.mjs
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo '[phase5:built-audits] own Web preview exited during Lighthouse' >&2
    exit 1
  fi

  kill "$WEB_PID" 2>/dev/null || true
  trap - EXIT
  unset WEB_PID
)

echo '[phase5:built-audits] Measurements complete; full phase acceptance remains separate'
