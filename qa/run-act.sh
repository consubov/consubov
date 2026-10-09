#!/usr/bin/env bash
set -euo pipefail
if ! command -v act >/dev/null 2>&1; then
  echo '[PENDENTE] Instalar act CLI antes de qa:act.' >&2
  exit 2
fi
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo '[PENDENTE] Docker Engine precisa estar em execucao para act.' >&2
  exit 2
fi
mkdir -p .qa/act-artifacts
# Roda workflow local. Pode baixar imagens/actions na primeira execucao.
# Nao usa minutos dos runners remotos do GitHub.
exec act pull_request --workflows .github/workflows/ci.yml --job build-and-test --artifact-server-path .qa/act-artifacts
