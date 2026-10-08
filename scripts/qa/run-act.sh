#!/usr/bin/env bash
set -euo pipefail
if ! command -v act >/dev/null 2>&1; then echo '[PENDENTE] Instale act se quiser executar qa:act.' >&2; exit 2; fi
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo '[PENDENTE] Docker Desktop/Engine precisa estar ativo.' >&2
  exit 2
fi
mkdir -p .qa/act-artifacts
# Apenas build-and-test local; nao inicia GitHub Actions hospedado.
exec act pull_request --workflows .github/workflows/ci.yml --job build-and-test --artifact-server-path .qa/act-artifacts
