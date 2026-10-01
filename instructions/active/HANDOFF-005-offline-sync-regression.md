# HANDOFF-005 — Regressão offline e sincronização

## PRD

`PRD-005-offline-sync-regression.md`

## Branch

`test/offline-sync-regression`

## Estado

Início da fase. Nenhum comportamento será alterado intencionalmente.

## Áreas auditadas

- `apps/web/src/lib/consultorOffline/mutationQueue.ts`;
- `apps/web/src/lib/consultorOffline/db.ts`;
- `apps/web/src/lib/maisArrobasQueue.ts`;
- `apps/web/src/lib/maOffline.ts`;
- `apps/web/src/lib/maGmdResync.ts`;
- `apps/web/src/lib/swRegistration.ts`;
- `apps/web/src/lib/screenCache.ts`;
- suíte atual em `apps/web/src/test/`.

## Próxima execução

Adicionar testes focados nos invariantes do PRD usando somente estado local/mocks. Depois executar CI completo e registrar resultados.

## Restrições

Sem Supabase remoto, banco, Vercel, migrations ou mudança de regra de negócio.
