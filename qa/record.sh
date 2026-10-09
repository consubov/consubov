#!/usr/bin/env bash
set -euo pipefail

# Obter diretorio do script e carregar caminhos de ambiente
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/env.sh" ]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/env.sh"
fi

if (($# < 2)); then
  echo 'Uso: record.sh NOME COMANDO [ARG...]' >&2
  exit 2
fi
name="$1"
shift
if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo 'Nome de teste invalido.' >&2
  exit 2
fi

# Ajustar raiz do repositorio para o pai de qa/
repo_root="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$repo_root"

git_sha="$(git rev-parse --short=12 HEAD 2>/dev/null || echo no-git)"
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
run_id="$(date -u +%Y%m%dT%H%M%SZ)-${name}-${git_sha}"
run_dir="$repo_root/.qa/runs/$run_id"
mkdir -p "$run_dir"
log_file="$run_dir/output.log"
printf '[qa] %s | %s | git %s\n' "$name" "$started" "$git_sha" | tee "$log_file"

set +e
"$@" 2>&1 | tee -a "$log_file"
exit_code=${PIPESTATUS[0]}
set -e

finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export QA_NAME="$name" QA_STARTED="$started" QA_FINISHED="$finished" QA_SHA="$git_sha" QA_EXIT_CODE="$exit_code" QA_RUN_DIR="$run_dir"

# Escolher runner para gravar o json de resultado (node ou bun)
RUNNER="node"
if ! command -v node >/dev/null 2>&1; then
  if command -v bun >/dev/null 2>&1; then
    RUNNER="bun"
  fi
fi

"$RUNNER" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const env = process.env;
const result = {
  task: env.QA_NAME,
  startedAt: env.QA_STARTED,
  finishedAt: env.QA_FINISHED,
  commit: env.QA_SHA,
  exitCode: Number(env.QA_EXIT_CODE),
  status: Number(env.QA_EXIT_CODE) === 0 ? 'PASS' : 'FAIL',
  log: 'output.log',
};
fs.writeFileSync(path.join(env.QA_RUN_DIR, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
NODE

printf '[qa] %s (exit=%s) -> %s\n' "$name" "$exit_code" "$run_dir/result.json"
exit "$exit_code"
