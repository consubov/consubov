#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Ensure Git Bash, Node, Bun, and Task tools are available in PATH across Git Bash & WSL
for p in \
  "/c/Program Files/Git/bin" "/c/Program Files/Git/usr/bin" \
  "/c/Program Files/nodejs" \
  "/c/Users/MATEUS/.bun/bin" "$HOME/.bun/bin" \
  "/c/Users/MATEUS/scoop/shims" \
  "/mnt/c/Program Files/Git/bin" "/mnt/c/Program Files/Git/usr/bin" \
  "/mnt/c/Program Files/nodejs" \
  "/mnt/c/Users/MATEUS/.bun/bin" \
  "/mnt/c/Users/MATEUS/scoop/shims"; do
  if [ -d "$p" ]; then
    export PATH="$p:$PATH"
  fi
done

if ! command -v node >/dev/null 2>&1 && command -v node.exe >/dev/null 2>&1; then
  node() { node.exe "$@"; }
  export -f node
fi

# Strict local dummy environment for offline preprod validation (zero external network)
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-http://127.0.0.1:54321}"
export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-phase9-local-preprod-key}"

echo "[phase9] step 1: toolchain & essential documentation preflight"
for tool in bash git node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[ERRO] Ferramenta essencial ausente no PATH: $tool" >&2
    exit 2
  fi
done

DOC_71="docs/71-runbook-operacional-consubov.md"
DOC_72="docs/72-plano-rollback-contingencia.md"
DOC_73="docs/73-relatorio-carga-reconciliacao-local.md"
DOC_74="docs/74-roteiro-homologacao-fisica-campo.md"
SCRIPT_LOAD="scripts/qa/load-simulation-local.mjs"
TEST_LOAD="scripts/tests/phase9-load-reconciliation.test.mjs"

for file in "$DOC_71" "$DOC_72" "$DOC_73" "$DOC_74" "$SCRIPT_LOAD" "$TEST_LOAD"; do
  if [ ! -f "$file" ]; then
    echo "[ERRO] Arquivo essencial da Fase 9 ausente: $file" >&2
    exit 2
  fi
done

echo "[phase9] step 2: synthetic multi-tenant load simulation (1,000+ commands)"
node scripts/qa/load-simulation-local.mjs

echo "[phase9] step 3: phase 9 load reconciliation, adversarial stress & empirical challenger tests"
node --test scripts/tests/phase9-load-reconciliation.test.mjs scripts/tests/adversarial-phase9-challenge.test.mjs scripts/tests/phase9-challenger2-empirical.test.mjs

echo "[phase9] step 4: local snapshot rehearsal & verification"
node --test scripts/tests/local-snapshot-rehearsal.test.mjs

echo "[phase9] step 5: preprod documentation integrity, runbook validation & fail-closed remote security check"
node -e "
import fs from 'node:fs';
const files = [
  'docs/71-runbook-operacional-consubov.md',
  'docs/72-plano-rollback-contingencia.md',
  'docs/73-relatorio-carga-reconciliacao-local.md',
  'docs/74-roteiro-homologacao-fisica-campo.md'
];
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  if (content.length < 1000) {
    console.error('[ERRO] Documento muito curto ou incompleto:', f);
    process.exit(1);
  }
  // Fail-closed against remote production leaked hosts
  const forbidden = [/https?:\/\/[a-z0-9.-]+\.supabase\.co/i, /service_role/i, /api\.consubov\.com\.br/i];
  for (const re of forbidden) {
    if (re.test(content)) {
      console.error('[ERRO] Possivel segredo ou host remoto de producao vazado em:', f);
      process.exit(1);
    }
  }
}
console.log('Documentacao e politicas de seguranca da Fase 9 verificadas com sucesso.');
"

echo "[phase9] PASS: all phase 9 preprod local gates passed"
