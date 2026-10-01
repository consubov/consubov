# HANDOFF-010 — Encapsular leituras de Eventos do Lote

## Branch

`refactor/eventos-lote-data-access`

## Estado inicial

`useEventosLote.ts` contém três leituras diretas do Supabase: eventos, última pesagem e último evento sanitário.

## Restrições

- sem regra nova;
- sem alterações sanitárias;
- sem migrations;
- sem cache/realtime/offline novo;
- sem Vercel;
- sem API nova.

## Plano

1. extrair somente as consultas para repository;
2. manter estado/orquestração nos hooks;
3. testar os três contratos;
4. abrir PR;
5. validar CI;
6. consolidar em `docs/12-web-data-access.md`;
7. remover PRD/handoff;
8. merge somente com CI verde.
