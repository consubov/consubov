# HANDOFF-007 — Encapsular busca de nome do usuário

## Branch

`refactor/user-name-data-access`

## Implementado

- criado `apps/web/src/features/users/repositories/userNameRepository.ts`;
- `useNomeUsuario` deixou de importar Supabase;
- a ordem das tabelas fornecida pelo hook foi preservada;
- a regra de rejeitar nomes com `@` foi centralizada e preservada;
- fallback por metadata/texto continua no hook;
- adicionados testes unitários do repository.

## Validação

Pull Request #16:

- GitHub Actions `build-and-test`: SUCCESS;
- build e testes do monorepo passaram;
- nenhum arquivo de autenticação, roles, banco ou UI foi alterado.

## Pendências

A migração de acesso a dados continua aberta no issue #5. Próximos candidatos devem continuar pequenos e isolados; hooks com realtime/cache/offline exigem cuidado adicional.

## Encerramento

Conhecimento permanente consolidado em `docs/12-web-data-access.md`.
