# HANDOFF-009 — Encapsular leitura de Pastos do Retiro

## Branch

`refactor/pastos-retiro-data-access`

## Implementado

- criado `apps/web/src/features/pastos/repositories/pastosRetiroRepository.ts`;
- `usePastosRetiro` deixou de importar Supabase;
- as três consultas existentes foram preservadas;
- composição, somas e defaults permaneceram no hook;
- logs de erro foram preservados;
- adicionados testes dos contratos de consulta e retorno das fontes.

## Validação

Pull Request #18:

- GitHub Actions `build-and-test`: SUCCESS na implementação funcional;
- build do monorepo passou;
- testes do monorepo passaram;
- smoke HTTP da API passou;
- nenhuma migration, cache/realtime/offline novo, conexão nova ou Vercel foi adicionado.

## Pendências

A issue #5 continua aberta. Hooks com realtime, cache e offline permanecem para slices dedicados.

## Encerramento

Conhecimento permanente consolidado em `docs/12-web-data-access.md`.
