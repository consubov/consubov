#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BRANCH="$(git branch --show-current 2>/dev/null || true)"
if [[ "$BRANCH" != "quality/fase5-web-ready-20261005" ]]; then
  echo "[phase5-codespace] branch inesperada: $BRANCH; reporter não executado."
  exit 0
fi

LOG="/tmp/consubov-phase5-local.log"
EVIDENCE="docs/30-fase5-local-evidence.md"
: >"$LOG"

echo "[phase5-codespace] iniciando gate local em $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"

set +e
PHASE5_INSTALL_PLAYWRIGHT=1 bun run quality:phase5:local >>"$LOG" 2>&1
RC=$?
set -e

{
  echo "# FASE 5 — Evidência local automatizada"
  echo
  echo "> Gerado automaticamente pelo Codespace da branch de qualidade."
  echo
  echo "- Commit testado: $(git rev-parse HEAD)"
  echo "- Branch: $BRANCH"
  if [[ "$RC" -eq 0 ]]; then
    echo "- Resultado: PASS"
  else
    echo "- Resultado: FAIL"
  fi
  echo "- Exit code: $RC"
  echo "- Executado em: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "## Evidências selecionadas"
  echo "-----"
  grep -E "\\[phase5\\]|\\[coverage:baseline\\]|\\[bundle:baseline\\]|\\[bundle:budget\\]|\\[dist-secrets\\]|\\[lighthouse\\]|tests? passed|tests? failed|passed \\(|failed \\(" "$LOG" | tail -n 160 || true
  echo "-----"
  if [[ "$RC" -ne 0 ]]; then
    echo
    echo "## Tail da falha"
    echo "-----"
    tail -n 160 "$LOG"
    echo "-----"
  fi
} >"$EVIDENCE"

git config user.name "$(git config user.name || echo MATEUS)"
git config user.email "$(git config user.email || echo 138159754+mmatteuus@users.noreply.github.com)"
git add "$EVIDENCE"
if ! git diff --cached --quiet; then
  git commit -m "test: registrar evidencia local da FASE 5"
  git push origin HEAD
fi

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh pr comment 37 --repo mmatteuus/consubov --body-file "$EVIDENCE" || true
fi

echo "[phase5-codespace] finalizado rc=$RC em $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
exit 0
