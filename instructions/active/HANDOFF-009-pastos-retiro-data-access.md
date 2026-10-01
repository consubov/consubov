# HANDOFF-009 — Encapsular leitura de Pastos do Retiro

## Branch

`refactor/pastos-retiro-data-access`

## Estado inicial

`usePastosRetiro` executa diretamente três consultas Supabase em paralelo e compõe os resultados no próprio hook.

## Restrições

- não alterar composição dos dados;
- não alterar views/tabelas;
- não introduzir cache/realtime/offline;
- sem migrations;
- sem Vercel;
- sem regra de negócio nova.

## Plano

1. extrair somente as consultas para repository;
2. manter composição no hook;
3. testar os contratos das três queries;
4. abrir PR;
5. validar CI;
6. consolidar em `docs/12-web-data-access.md`;
7. remover PRD/handoff e mergear somente com CI verde.
