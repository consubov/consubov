# HANDOFF-010 — Encapsular leituras de Eventos do Lote

## Branch

`refactor/eventos-lote-data-access`

## Implementado

- criado `apps/web/src/features/lotes/repositories/eventosLoteRepository.ts`;
- `useEventosLote.ts` deixou de importar Supabase;
- preservadas as consultas de eventos, última pesagem e último sanitário;
- `refreshKey` continua participando da dependência de recarga;
- `calcCarenciaDias` permaneceu sem alteração;
- adicionados testes dos três contratos e fallbacks.

## Validação

Pull Request #19:

- GitHub Actions `build-and-test`: SUCCESS na implementação funcional;
- build do monorepo passou;
- testes do monorepo passaram;
- smoke HTTP da API passou;
- nenhuma migration, cache/realtime/offline novo, conexão nova ou Vercel foi adicionado.

## Pendências

A issue #5 continua aberta. Hooks com cache, realtime, offline e guards de autorização permanecem para slices dedicados.

## Encerramento

Conhecimento permanente consolidado em `docs/12-web-data-access.md`.
