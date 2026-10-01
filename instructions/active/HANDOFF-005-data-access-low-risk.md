# HANDOFF-005 — Migração de acesso a dados de baixo risco

## PRD relacionado

`PRD-005-data-access-low-risk.md`

## Estado atual

Implementação concluída e aguardando revisão na branch
`fase2/data-access-low-risk`, criada no
snapshot `31a2ccbfecbb2568dd5d720d46d83feb98800bdd`.

## Decisões tomadas

- selecionar `GerenteProdutosPage`, `SyncVetAuditoriaPage` e
  `SyncVetTrajetosPage` por serem fluxos pequenos e somente leitura;
- criar um repository por página/feature, sem service de delegação;
- manter os identificadores de escopo como argumentos obrigatórios dos
  repositories SyncVet, sem mover ou alterar auth/tenancy.

## Inventário focal e rejeições

- selecionados: os três slices acima, sem cache, realtime, offline ou escrita;
- rejeitados: `useAbatesData` e `useMortalidadesData` (screenCache e realtime),
  `useEstoqueData` (realtime e CRUD), `usePainelData` (screenCache/realtime/RPC),
  `useGerenteData` (screenCache/realtime/escrita), `useMapaData` e páginas
  correlatas (fluxo amplo e sensível), páginas Mais Arrobas/Consultor
  (`maOffline`, IndexedDB, filas, storage ou CRUD), layouts/guards (auth/RBAC),
  páginas administrativas de cadastro (CRUD), além dos hooks nominalmente
  bloqueados pelo orquestrador;
- `usePainelProduto` é somente leitura, mas foi rejeitado por concentrar muitas
  queries e cálculos de domínio, não sendo uma mudança pequena de baixo risco;
- `EscritoriosPage` foi rejeitada porque compartilha o fluxo com criação e
  refresh pós-escrita, apesar das consultas locais serem leituras.

## Arquivos alterados

- `apps/web/src/pages/GerenteProdutosPage.tsx`
- `apps/web/src/pages/SyncVetAuditoriaPage.tsx`
- `apps/web/src/pages/SyncVetTrajetosPage.tsx`
- `apps/web/src/features/gerente-produtos/repositories/gerenteProdutosRepository.ts`
- `apps/web/src/features/gerente-produtos/repositories/gerenteProdutosRepository.test.ts`
- `apps/web/src/features/syncvet-auditoria/repositories/syncVetAuditoriaRepository.ts`
- `apps/web/src/features/syncvet-auditoria/repositories/syncVetAuditoriaRepository.test.ts`
- `apps/web/src/features/syncvet-trajetos/repositories/syncVetTrajetosRepository.ts`
- `apps/web/src/features/syncvet-trajetos/repositories/syncVetTrajetosRepository.test.ts`
- `docs/12-web-data-access.md`
- este PRD e handoff temporários.

## Pendências

- [x] executar validações completas;
- [x] registrar resultados exatos;
- [x] commit `f3ebc0f` e metadados de PR preparados para revisão;
- [ ] aguardar aceite antes de remover PRD/handoff.

## Validações executadas

- [x] `git diff --check`: passou sem saída;
- [x] lint focal dos nove arquivos TypeScript/TSX: passou sem saída;
- [x] testes focais: 3 arquivos, 7 testes aprovados;
- [x] `bun run build`: 2/2 tasks aprovadas em 48,047 s; web compilado
  em 45,79 s, apenas warnings legados de `eval`, imports mistos e chunk grande;
- [x] `bun run test`: 2/2 tasks aprovadas; API 13/13 e web 74/74;
- [x] smoke API local: health e readiness OK, OpenAPI JSON válido, docs OK e
  rota desconhecida retornou 404;
- [x] auditoria de arquivos proibidos: nenhum arquivo de cache, realtime,
  offline, auth, service worker ou migration alterado.

## Riscos / atenção

- nenhuma validação deve conectar Supabase remoto;
- os filtros de tenant existentes são contratos obrigatórios dos testes.

## Próximo passo exato

Revisar o commit/PR sem fazer merge. Após aceite, consolidar eventual
aprendizado restante e remover os arquivos temporários de `instructions/active/`.

## Antes de encerrar

- [x] conhecimento permanente foi movido para `docs/`;
- [x] critérios técnicos do PRD foram atendidos;
- [ ] usuário/proprietário aprovou;
- [ ] PRD e handoff podem ser removidos de `instructions/active/`.
