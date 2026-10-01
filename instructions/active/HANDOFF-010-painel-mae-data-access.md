# HANDOFF-010 — Encapsular leitura do Painel Mãe

## Branch

`refactor/painel-mae-data-access`

## Implementado

- criado `apps/web/src/features/painel/repositories/painelMaeRepository.ts`;
- `usePainelMae` deixou de importar Supabase;
- preservada a RPC `get_painel_mae`;
- preservados `p_fazenda_id`, `p_retiro_id`, `p_mes` e `p_ano`;
- mapeamento, defaults, fallback e logging permaneceram no hook;
- adicionados testes do contrato da RPC.

## Validação

Pull Request #21 executa o workflow padrão do projeto com instalação, typecheck da API, build, smoke HTTP e testes do monorepo.

Nenhuma migration, conexão nova, cache/realtime/offline novo ou Vercel foi adicionado.

## Encerramento

Conhecimento permanente consolidado em `docs/12-web-data-access.md`.
