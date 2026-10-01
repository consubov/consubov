# HANDOFF-011 — Encapsular leituras do Resultado de Pesagem

## Branch

`refactor/pesagem-resultado-data-access`

## Estado inicial

`usePesagemResultado` faz duas leituras diretas do Supabase e calcula GMD/resultado no próprio hook.

## Restrições

- não alterar fórmula;
- não alterar UI;
- sem migrations;
- sem cache/realtime/offline novo;
- sem Vercel;
- sem API nova.

## Plano

1. extrair somente as duas consultas para repository;
2. manter cálculo e composição no hook;
3. testar os contratos;
4. abrir PR;
5. validar CI;
6. consolidar em `docs/12-web-data-access.md`;
7. remover PRD/handoff;
8. merge somente com CI verde.
