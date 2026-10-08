#!/usr/bin/env bash
set -euo pipefail
missing=0
for name in bash git node bun task; do
  if command -v "$name" >/dev/null 2>&1; then
    printf '[OK] %s: %s\n' "$name" "$(command -v "$name")"
  else
    printf '[FALTA] %s nao encontrado no PATH\n' "$name" >&2
    missing=1
  fi
done
if command -v bun >/dev/null 2>&1; then printf '[INFO] Bun: '; bun --version; fi
if command -v task >/dev/null 2>&1; then printf '[INFO] Go Task: '; task --version; fi
if command -v act >/dev/null 2>&1 && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo '[OK] Docker/act presentes (opcionais)'
else
  echo '[INFO] Docker/act indisponiveis (opcionais)'
fi
if ((missing != 0)); then
  echo '[FALHA] Instale dependencias e reinicie terminal VS Code; consulte docs/qa/QA-LOCAL-VSCODE-GO-TASK.md' >&2
  exit 2
fi
echo '[OK] Ambiente basico pronto. QA nao aprovado por este comando.'
