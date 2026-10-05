#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bun install --frozen-lockfile

if [[ "$(git branch --show-current 2>/dev/null || true)" == "quality/fase5-web-ready-20261005" ]]; then
  nohup bash scripts/run-phase5-codespace-reporter.sh >/tmp/consubov-phase5-reporter.out 2>&1 &
  echo "[codespace] FASE 5 gate iniciado em background; evidência será enviada à branch."
fi
