#!/bin/sh
# Vercel: exit 0 = SKIP, exit 1 = BUILD. Fail closed for script/runtime errors.
set -u
script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)" || exit 0
if ! command -v node >/dev/null 2>&1; then exit 0; fi
node "$script_dir/release-gate.mjs" "${1:-}"
result=$?
if [ "$result" -eq 42 ]; then exit 1; fi
exit 0
