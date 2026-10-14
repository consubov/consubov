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

# Strict local dummy environment for offline dry-run validation (zero external network)
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-http://127.0.0.1:54321}"
export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-phase8-local-dryrun-key}"

echo "[phase8] step 1: toolchain & schema migrations preflight"
for tool in bash git node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[ERRO] Ferramenta essencial ausente no PATH: $tool" >&2
    exit 2
  fi
done

UP_MIGRATION="supabase/migrations/20261014000000_phase8_unified_relational_contracts.sql"
DOWN_MIGRATION="supabase/migrations/down/20261014000000_phase8_unified_relational_contracts.down.sql"
MATRIX_DOC="docs/70-matriz-origem-destino-postgresql.md"

for file in "$UP_MIGRATION" "$DOWN_MIGRATION" "$MATRIX_DOC"; do
  if [ ! -f "$file" ]; then
    echo "[ERRO] Arquivo essencial da Fase 8 ausente: $file" >&2
    exit 2
  fi
done

echo "[phase8] step 2: static postgresql ddl validation & idempotency cycle (UP -> DOWN -> UP)"
node scripts/qa/sql-ddl-validator.mjs "$UP_MIGRATION"
node scripts/qa/migration-idempotency-runner.mjs "$UP_MIGRATION" "$DOWN_MIGRATION"

echo "[phase8] step 3: schema & ddl integrity tests"
node --test scripts/tests/phase8-ddl-schema-integrity.test.mjs

echo "[phase8] step 4: relational contracts vs typescript & domain tests"
node --test scripts/tests/phase8-relational-contracts.test.mjs

echo "[phase8] step 5: relational simulation, referential integrity & multi-tenant rls dry-run"
node --test scripts/tests/phase8-relational-rls-dryrun.test.mjs

echo "[phase8] PASS: all phase 8 postgresql local dry-run gates passed"
