#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/env.sh" ]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/env.sh"
fi

echo "[INFO] Iniciando verificacao do ambiente..."

# Verificar bash e git
for name in bash git; do
  if command -v "$name" >/dev/null 2>&1; then
    printf '[OK] %s: %s\n' "$name" "$(command -v "$name")"
  else
    printf '[PENDENTE] %s nao encontrado no PATH\n' "$name" >&2
    exit 2
  fi
done

# Verificar bun
if command -v bun >/dev/null 2>&1; then
  printf '[OK] bun: %s\n' "$(command -v bun)"
else
  printf '[PENDENTE] bun nao encontrado no PATH\n' >&2
  exit 2
fi

# Verificar task
if command -v task >/dev/null 2>&1; then
  printf '[OK] task: %s\n' "$(command -v task)"
else
  printf '[PENDENTE] task nao encontrado no PATH\n' >&2
  exit 2
fi

printf '[INFO] Bun: '; bun --version
printf '[INFO] Go Task: '; task --version

if command -v act >/dev/null 2>&1 && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  printf '[OK] act/Docker disponiveis para teste opcional\n'
else
  printf '[INFO] act/Docker indisponiveis; QA principal com Go Task continua utilizavel\n'
fi

echo "[SUCCESS] Ambiente pronto para execucao QA"
