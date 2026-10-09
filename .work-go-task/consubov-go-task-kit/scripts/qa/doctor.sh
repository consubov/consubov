#!/usr/bin/env bash
set -euo pipefail
for name in bash git node bun task; do
  if command -v "$name" >/dev/null 2>&1; then
    printf '[OK] %s: %s\n' "$name" "$(command -v "$name")"
  else
    printf '[PENDENTE] %s nao encontrado no PATH\n' "$name" >&2
    exit 2
  fi
done
printf '[INFO] Bun: '; bun --version
printf '[INFO] Go Task: '; task --version
if command -v act >/dev/null 2>&1 && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  printf '[OK] act/Docker disponiveis para teste opcional\n'
else
  printf '[INFO] act/Docker indisponiveis; QA principal com Go Task continua utilizavel\n'
fi
