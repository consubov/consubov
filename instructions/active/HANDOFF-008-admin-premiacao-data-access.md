# HANDOFF-008 — Encapsular acesso de dados da Premiação Admin

## Branch

`refactor/admin-premiacao-data-access`

## Estado inicial

`AdminPremiacaoPage` consulta diretamente o Supabase para listar fazendas ativas.

## Restrições

- sem redesign;
- sem regra nova;
- sem migrations;
- sem serviço remoto novo;
- sem Vercel;
- sem alteração de auth.

## Plano

1. criar repository de fazendas para premiação;
2. criar hook de carregamento;
3. remover acesso direto ao Supabase da página;
4. adicionar testes;
5. abrir PR e validar CI;
6. consolidar conhecimento em `docs/12-web-data-access.md`;
7. remover PRD/handoff;
8. merge somente após CI verde.
