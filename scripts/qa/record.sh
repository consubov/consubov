#!/usr/bin/env bash
set -euo pipefail
if (($# < 2)); then echo 'Uso: record.sh NOME COMANDO [ARGS...]' >&2; exit 2; fi
name="$1"
shift
if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then echo 'Nome de teste invalido.' >&2; exit 2; fi
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"
# Recorded QA uses this repository's binaries even when another workspace supplied a cache.
export PLAYWRIGHT_BROWSERS_PATH="$repo_root/.qa/tools/playwright-browsers"
initial_source="$(node scripts/qa/source-state.mjs capture)"
git_sha="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).commit)' "$initial_source")"
git_dirty="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).workingTreeDirty))' "$initial_source")"
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
short_sha="${git_sha:0:12}"
run_id="$(date -u +%Y%m%dT%H%M%SZ)-$name-$short_sha-$$"
# Keep the Node evidence path relative to cwd: Git Bash /d/... is not a native Node path.
run_dir=".qa/runs/$run_id"
mkdir -p "$run_dir"
log_file="$run_dir/output.log"
set +e
printf '[qa] %s | %s | git=%s | dirty=%s\n' "$name" "$started" "$git_sha" "$git_dirty" | tee "$log_file"
header_exits=("${PIPESTATUS[@]}")
"$@" 2>&1 | tee -a "$log_file"
pipeline_exits=("${PIPESTATUS[@]}")
# Capture the entire array immediately; any later command resets PIPESTATUS.
command_exit=${pipeline_exits[0]}
logger_exit=${pipeline_exits[1]}
if ((logger_exit == 0)); then logger_exit=${header_exits[1]}; fi
if ((logger_exit == 0)); then logger_exit=${header_exits[0]}; fi
final_source="$(node scripts/qa/source-state.mjs capture)"
capture_exit=$?
if ((capture_exit != 0)); then final_source='{"commit":"no-git","branch":null,"workingTreeDirty":true,"fingerprint":null}'; fi
finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export QA_NAME="$name" QA_STARTED="$started" QA_FINISHED="$finished" QA_RUN_DIR="$run_dir"
export QA_INITIAL_SOURCE="$initial_source" QA_FINAL_SOURCE="$final_source"
export QA_COMMAND_EXIT="$command_exit" QA_LOGGER_EXIT="$logger_exit"
node scripts/qa/source-state.mjs record
exit_code=$?
# Preserve the child even when the Node evidence writer itself is unavailable.
if ((command_exit != 0)); then exit_code=$command_exit; fi
set -e
printf '[qa] %s (exit=%s) -> %s/%s/result.json\n' "$name" "$exit_code" "$repo_root" "$run_dir"
exit "$exit_code"
