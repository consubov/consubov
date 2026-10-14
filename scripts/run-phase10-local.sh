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
export VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-phase10-local-dryrun-key}"

echo "[phase10] step 1: toolchain & essential documentation preflight"
for tool in bash git node; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "[ERRO] Ferramenta essencial ausente no PATH: $tool" >&2
    exit 2
  fi
done

SPEC_DOC="docs/75-fase10-pos-producao-modulos-expansoes.md"
AI_CONTRACT="apps/web/src/platform/contracts/aiProvider.ts"
SCALE_CONTRACT="apps/web/src/platform/contracts/scaleDevice.ts"
EXPORT_CONTRACT="apps/web/src/platform/contracts/enterpriseExport.ts"

for file in "$SPEC_DOC" "$AI_CONTRACT" "$SCALE_CONTRACT" "$EXPORT_CONTRACT"; do
  if [ ! -f "$file" ]; then
    echo "[ERRO] Arquivo essencial da Fase 10 ausente: $file" >&2
    exit 2
  fi
done

echo "[phase10] step 2: contracts integrity & enterprise exports (CSV, JSON, SHA-256)"
node --experimental-strip-types --test scripts/tests/phase10-contracts-integrity.test.mjs

echo "[phase10] step 3: ai provider port & offline deterministic mock"
node --experimental-strip-types --test scripts/tests/phase10-ai-provider.test.mjs

echo "[phase10] step 4: scale device parser & simulated weighing hardware"
node --experimental-strip-types --test scripts/tests/phase10-scale-device.test.mjs

echo "[phase10] step 5: syncvet & relatto domain and manifest verification"
node --experimental-strip-types --test scripts/tests/phase10-syncvet-domain.test.mjs

echo "[phase10] step 6: syncvet repositories vitest validation"
if command -v bunx >/dev/null 2>&1; then
  bunx vitest run apps/web/src/features/syncvet-auditoria apps/web/src/features/syncvet-trajetos
elif command -v npx >/dev/null 2>&1; then
  npx vitest run apps/web/src/features/syncvet-auditoria apps/web/src/features/syncvet-trajetos
fi

echo "[phase10] step 7: security preflight & remote traffic prohibition check"
# Verifica que nenhuma chave Lovable ou host externo está exposto em arquivos de produção da plataforma
if grep -rn "ai.lovable.dev" apps/web/src/platform/ >/dev/null 2>&1; then
  echo "[ERRO] Dependência direta de host Lovable detectada em apps/web/src/platform!" >&2
  exit 1
fi

echo "[phase10] PASS: all phase 10 local post-production gates passed"

