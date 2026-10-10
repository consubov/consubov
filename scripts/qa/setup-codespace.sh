#!/usr/bin/env bash
# Provision development tools only. No phase gate, push, database connection or deploy.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
command -v bun >/dev/null
command -v node >/dev/null
export PATH="$HOME/.local/bin:$PATH"

if ! command -v task >/dev/null; then
  TASK_VERSION="3.54.0"
  case "$(uname -m)" in x86_64) ARCH="amd64" ;; aarch64|arm64) ARCH="arm64" ;; *) echo "Unsupported Task architecture" >&2; exit 2 ;; esac
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
  ASSET="task_linux_${ARCH}.tar.gz"
  BASE="https://github.com/go-task/task/releases/download/v${TASK_VERSION}"
  curl --fail --location --silent --show-error "$BASE/$ASSET" -o "$WORK/$ASSET"
  curl --fail --location --silent --show-error "$BASE/task_checksums.txt" -o "$WORK/checksums.txt"
  (cd "$WORK"; grep " ${ASSET}$" checksums.txt | sha256sum -c -)
  tar -xzf "$WORK/$ASSET" -C "$WORK" task
  mkdir -p "$HOME/.local/bin"
  install -m 0755 "$WORK/task" "$HOME/.local/bin/task"
fi

bun install --frozen-lockfile
(cd apps/web; bunx playwright install --with-deps chromium webkit firefox)

if command -v code >/dev/null; then
  INSTALLED="$(code --list-extensions)"
  while IFS= read -r extension; do
    if ! grep -Fxiq "$extension" <<<"$INSTALLED"; then
      code --install-extension "$extension"
    fi
  done < <(node -e 'for(const id of require("./.vscode/extensions.json").recommendations) console.log(id)')
fi

# PostgreSQL is an optional local test engine. Never start or connect a shared DB.
if [[ "${CONSUBOV_QA_POSTGRES:-0}" == "1" ]]; then
  sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postgresql-15 postgresql-client-15
fi

task doctor
echo "[setup] Tools ready. Tests, commits and publishing require explicit commands."
