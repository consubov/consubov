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
SUMMARY="/tmp/consubov-phase5-summary.md"
: >"$LOG"

echo "[phase5-codespace] iniciando gate local em $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"

set +e
PHASE5_INSTALL_PLAYWRIGHT=1 bun run quality:phase5:local >>"$LOG" 2>&1
RC=$?
set -e

{
  echo "## FASE 5 — execução local no Codespace"
  echo
  echo "- Commit: $(git rev-parse HEAD)"
  echo "- Branch: $BRANCH"
  if [[ "$RC" -eq 0 ]]; then
    echo "- Resultado: PASS"
  else
    echo "- Resultado: FAIL"
  fi
  echo "- Exit code: $RC"
  echo
  echo "### Evidências selecionadas"
  echo "-----"
  grep -E "\[phase5\]|\[coverage:baseline\]|\[bundle:baseline\]|\[bundle:budget\]|\[dist-secrets\]|\[lighthouse\]|tests? passed|tests? failed|passed \(|failed \(" "$LOG" | tail -n 120 || true
  echo "-----"
  if [[ "$RC" -ne 0 ]]; then
    echo
    echo "### Tail da falha"
    echo "-----"
    tail -n 120 "$LOG"
    echo "-----"
  fi
} >"$SUMMARY"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh pr comment 37 --repo mmatteuus/consubov --body-file "$SUMMARY" || true
else
  echo "[phase5-codespace] gh indisponível/não autenticado; resumo em $SUMMARY" | tee -a "$LOG"
fi

echo "[phase5-codespace] finalizado rc=$RC em $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
exit 0
