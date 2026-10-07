#!/usr/bin/env bash
# Gates locais da FASE 5 — executar a partir da raiz do repositório.
set -u
cd "$(dirname "$0")/.." || exit 1

echo "=== FASE 5 GATES ==="
echo "cwd: $(pwd)"

run() {
  local label="$1"; shift
  echo ""
  echo "--- $label ---"
  local out
  out="$("$@" 2>&1)"
  local code=$?
  echo "$out" | tail -40
  echo "EXIT[$label]=$code"
}

cd apps/web || exit 1

run "typecheck" bun run typecheck
run "test" bun run test
run "build" bun run build
run "report:bundle" bun run report:bundle
run "check:bundle-budget" bun run check:bundle-budget
run "check:dist-secrets" bun run check:dist-secrets
run "test:coverage" bun run test:coverage
run "check:coverage-baseline" bun run check:coverage-baseline

echo ""
echo "=== FIM ==="