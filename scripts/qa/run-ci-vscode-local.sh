#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/../.." || exit 20
export PATH="/usr/local/bin:/home/ubuntu/.bun/bin:$PATH"
workspace_root="$PWD"
# VS Code Docker only mounts worktree contents, not the host Git directory path.
# Create a local full-history clone to ensure tests that create nested Git repos work.
if [ -f .git ] && [ ! -d "$(sed -n 's/^gitdir: //p' .git)" ]; then
  workspace_root="$PWD"
  shared_gitdir="/home/coder/workspace/consubov/.git/worktrees/$(basename "$PWD")"
  if [ ! -d "$shared_gitdir" ]; then
    echo '[local-ci] metadados Git indisponiveis' >&2
    exit 21
  fi
  export GIT_DIR="$shared_gitdir" GIT_WORK_TREE="$workspace_root"
  candidate_sha="$(git rev-parse HEAD)" || exit 21
  patch_file="$(mktemp /tmp/consubov-local-ci-patch.XXXXXX)"
  git diff --binary HEAD > "$patch_file" || exit 21
  unset GIT_DIR GIT_WORK_TREE
  scratch="$(mktemp -d /tmp/consubov-local-ci.XXXXXX)"
  git clone --quiet --no-hardlinks --local /home/coder/workspace/consubov "$scratch" || exit 21
  git -C "$scratch" checkout -q --detach "$candidate_sha" || exit 21
  git -C "$scratch" apply --check "$patch_file" || exit 21
  git -C "$scratch" apply "$patch_file" || exit 21
  if [ -f "$workspace_root/.qa/tools/gitleaks-8.30.1/gitleaks" ]; then
    mkdir -p "$scratch/.qa/tools/gitleaks-8.30.1"
    cp "$workspace_root/.qa/tools/gitleaks-8.30.1/gitleaks" "$scratch/.qa/tools/gitleaks-8.30.1/gitleaks"
  fi
  rm -f "$patch_file"
  cd "$scratch" || exit 21
  echo "[local-ci] clone local isolado: $scratch commit=$candidate_sha"
fi
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo '[local-ci] historico Git indisponivel' >&2
  exit 21
fi
# The code-server UI owns :8080. Reserve a free loopback port for all local Playwright tests.
# No service is stopped or reused; Playwright still requires --strictPort.
if [ -z "${CONSUBOV_E2E_PORT:-}" ]; then
  CONSUBOV_E2E_PORT="$(node -e 'const net=require("node:net");const s=net.createServer();s.once("error",e=>{console.error(e);process.exitCode=1});s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')" || exit 22
fi
export CONSUBOV_E2E_PORT
printf '[local-ci] porta Playwright isolada: %s\n' "$CONSUBOV_E2E_PORT"
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
logdir="${CONSUBOV_LOCAL_CI_LOGDIR:-$workspace_root/.qa/runs/vscode-ci-local/$run_id}"
mkdir -p "$logdir"
status=0
run() {
  label="$1"; shift
  printf '\n[local-ci] %s\n' "$label"
  "$@" > "$logdir/$label.log" 2>&1
  code=$?
  printf '[local-ci] %s EXIT=%s\n' "$label" "$code"
  tail -n 4 "$logdir/$label.log"
  [ "$code" -eq 0 ] || status=1
}
run frozen-install bun install --frozen-lockfile --ignore-scripts
run check bun run check
run regressions task qa:regressions
run pwa-smoke task qa:pwa:smoke
run offline-core task qa:offline:core
run contracts task qa:phase5:contracts
run security task qa:security
run f23 node --test scripts/tests/release-gate.test.mjs
run bundle-report bun run --cwd apps/web report:bundle
run bundle-budget bun run --cwd apps/web check:bundle-budget
run audit-high bun audit --audit-level=high
run lint-changed bun run --cwd apps/web lint:changed
# Full Chromium E2E runs inside the VS Code container using the isolated port.
# CI=1 enables Playwright retry discipline; --workers=2 bounds local resource use.
run e2e-chromium env CI=1 VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=phase5-local-test-key bun run --cwd apps/web test:e2e --workers=2
printf '[local-ci] overall EXIT=%s logs=%s\n' "$status" "$logdir"
exit "$status"
