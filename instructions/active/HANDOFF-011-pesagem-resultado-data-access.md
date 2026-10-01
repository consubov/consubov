# HANDOFF-011 — Encapsular leituras do Resultado de Pesagem

## Branch

`refactor/pesagem-resultado-data-access`

## Implementado

- criado `apps/web/src/features/pesagens/repositories/pesagemResultadoRepository.ts`;
- `usePesagemResultado` deixou de importar Supabase;
- preservadas as queries de pesagem atual e anterior;
- repository preserva `data` e `error` para manter logs/fallbacks anteriores;
- cálculo de GMD, primeira pesagem, nomes e quantidade permaneceram no hook;
- adicionados testes dos dois contratos e fallbacks nulos.

## Validação

Pull Request #20:

- GitHub Actions `build-and-test`: SUCCESS na implementação funcional;
- build do monorepo passou;
- testes do monorepo passaram;
- smoke HTTP da API passou;
- nenhuma migration, cache/realtime/offline novo, conexão nova ou Vercel foi adicionado.

## Pendências

A issue #5 continua aberta. Fluxos com cache, realtime, offline e mutações ficam para etapas dedicadas.

## Encerramento

Conhecimento permanente consolidado em `docs/12-web-data-access.md`.
