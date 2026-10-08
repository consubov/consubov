#!/usr/bin/env bash
set -euo pipefail
if (($# < 2)); then echo 'Uso: record.sh NOME COMANDO [ARGS...]' >&2; exit 2; fi
name="$1"
shift
if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then echo 'Nome de teste invalido.' >&2; exit 2; fi
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
git_sha="$(git rev-parse HEAD 2>/dev/null || echo no-git)"
git_dirty="false"
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then git_dirty="true"; fi
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
short_sha="$(printf '%s' "$git_sha" | cut -c1-12)"
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$name-$short_sha-$$"
run_dir="$repo_root/.qa/runs/$run_id"
mkdir -p "$run_dir"
log_file="$run_dir/output.log"
printf '[qa] %s | %s | git=%s | dirty=%s\n' "$name" "$started" "$git_sha" "$git_dirty" | tee "$log_file"
set +e
"$@" 2>&1 | tee -a "$log_file"
exit_code=${PIPESTATUS[0]}
set -e
finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export QA_NAME="$name" QA_STARTED="$started" QA_FINISHED="$finished" QA_SHA="$git_sha" QA_DIRTY="$git_dirty" QA_EXIT_CODE="$exit_code" QA_RUN_DIR="$run_dir"
node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const env = process.env;
const result = {
  task: env.QA_NAME,
  startedAt: env.QA_STARTED,
  finishedAt: env.QA_FINISHED,
  commit: env.QA_SHA,
  workingTreeDirty: env.QA_DIRTY === 'true',
  exitCode: Number(env.QA_EXIT_CODE),
  status: Number(env.QA_EXIT_CODE) === 0 ? 'PASS' : 'FAIL',
  log: 'output.log',
};
fs.writeFileSync(path.join(env.QA_RUN_DIR, 'result.json'), JSON.stringify(result, null, 2) + '\n');
NODE
printf '[qa] %s (exit=%s) -> %s\n' "$name" "$exit_code" "$run_dir/result.json"
exit "$exit_code"
