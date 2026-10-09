#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/env.sh" ]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/env.sh"
fi

TASK_TARGET="${1:-qa:phase5}"

echo "[INFO] Executando $TASK_TARGET via Go Task..."
task doctor
task "$TASK_TARGET"
