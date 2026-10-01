# HANDOFF-010 — Encapsular leitura do Painel Mãe

## Branch

`refactor/painel-mae-data-access`

## Estado inicial

`usePainelMae` chama diretamente a RPC Supabase `get_painel_mae` e faz o mapeamento dos valores para o contrato do hook.

## Restrições

- não alterar RPC;
- não alterar mapeamento;
- não alterar UI;
- sem migrations;
- sem cache/realtime/offline novo;
- sem Vercel.

## Plano

1. extrair somente a chamada RPC para repository;
2. manter mapeamento/fallback no hook;
3. testar nome da RPC e parâmetros;
4. abrir PR e validar CI;
5. consolidar em `docs/12-web-data-access.md`;
6. remover PRD/handoff;
7. merge somente com CI verde.
