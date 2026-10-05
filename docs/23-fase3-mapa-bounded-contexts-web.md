# FASE 3.2 — Mapa de bounded contexts do Web

## Objetivo

Mapear as fronteiras de dados do Web atual sem mover arquivos, inventar regra de negócio ou expandir módulos congelados. Os nomes de contexto seguem os módulos vigentes da API sempre que a evidência permite: `identity-tenancy`, `farms`, `pastures`, `nutrition`, `inventory`, `visits`, `feed-mill`, `livestock`, `weighing`, `reporting`, `notifications`, `files`, `sync`, `saas-admin`, `integrations`.

`[PENDENTE]` significa que o legado mistura responsabilidades e a decomposição não pode ser decidida por inferência nesta fase.

## Mapa de dados e integrações

| Arquivo/símbolo | Contexto | Leitura | Escrita | RPC | Edge Function | Realtime | Cache | Offline | Repository atual | Risco |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `App.tsx` / `ProtectedRoute` / `RoleRedirect` | `identity-tenancy` | sessão/role | — | — | — | — | — | fallback offline de role | — | P0 |
| `hooks/useAuth.tsx` | `identity-tenancy` | auth/perfil | sessão/auth | — | — | auth events | sessão local | sim | — | P0 |
| `hooks/useGerenteTemFabrica.tsx` | `identity-tenancy` + `feed-mill` | associação do gerente/fábrica | — | — | — | — | — | — | — | P1 |
| `pages/FazendasPage.tsx` | `farms` | fazendas | legado existente | — | — | — | possível cache de tela | — | — | P1 |
| `pages/FazendaDetailPage.tsx` | `farms` | fazenda/retiros | legado existente | — | — | legado existente | possível cache de tela | — | — | P1 |
| `pages/AdminFazendaPainelPage.tsx` | `farms` + `reporting` | agregados da fazenda | — | indireto | — | — | screen cache | — | `features/painel/repositories/painelMaeRepository.ts` em fluxo relacionado | P1 |
| `pages/RetiroDetailPage.tsx` | `pastures` | retiro/pastos | legado existente | — | — | — | — | — | `features/pastos/repositories/pastosRetiroRepository.ts` em fluxo relacionado | P1 |
| `pages/PastoDetailPage.tsx` | `pastures` | pasto/ciclo | legado existente | `ensure_ciclo_atual` | — | legado existente | — | — | — | P1 |
| `hooks/useMapaData.ts` | `pastures` | mapa/pastos | — | — | — | sim | cache legado | snapshot/fallback legado | — | P1 |
| `hooks/useTotalAnimaisRetiro.ts` | `livestock` + `pastures` | ocupação do retiro | — | — | — | sim | — | — | — | P1 |
| `hooks/useDietaCategorias.ts` | `nutrition` | categorias/dietas | CRUD legado | — | — | — | cache local legado | sim | — | P1 |
| `hooks/useConsumoMineral.ts` | `nutrition` + `reporting` | consumo | — | RPC legado | — | sim | `screenCache` | — | — | P1 |
| `hooks/useEstoqueData.ts` | `inventory` | saldo/movimentações | legado existente | — | — | sim | cache legado | — | — | P1 |
| `components/estoque/EstoqueCapatazSection.tsx` | `inventory` | estoque | — | — | — | — | — | — | — | P1 |
| `components/estoque/SolicitarSalModal.tsx` | `inventory` + `nutrition` | dados da solicitação | solicitação | — | — | — | — | legado conforme fluxo atual | — | P1 |
| `components/fabrica/TransferenciasTab.tsx` | `inventory` + `feed-mill` + `files` | transferências | transferência/arquivo legado | — | — | — | — | — | — | P1 |
| `components/fabrica/ProducaoTab.tsx` | `feed-mill` + `inventory` + `files` | produção/estoque | batidas/baixas/arquivo legado | — | — | — | — | — | — | P1 |
| `components/fabrica/DadosTab.tsx` | `feed-mill` | dados da fábrica | legado existente | — | — | — | — | — | — | P1 |
| `components/fabrica/FormulasTab.tsx` | `feed-mill` | fórmulas | fórmulas legado | — | — | — | — | — | — | P1 |
| `features/lotes/repositories/eventosLoteRepository.ts` | `livestock` + `weighing` | `eventos_lote`, `pesagens`, `eventos_sanitarios` | — | — | — | — | — | — | **sim** | P1 |
| `hooks/useEventosLote.ts` | `livestock` + `weighing` | via repository | — | — | — | — | estado React | — | `eventosLoteRepository.ts` | P1 |
| `hooks/useMortalidadesData.ts` | `livestock` | mortalidades | — | — | — | legado existente | — | — | — | P1 |
| `hooks/useAbatesData.ts` | `livestock` | abates | — | — | — | legado existente | — | — | — | P1 |
| `features/pesagens/repositories/pesagemResultadoRepository.ts` | `weighing` | pesagem atual/anterior | — | — | — | — | — | — | **sim** | P1 |
| `hooks/useOfflinePesagem.ts` | `weighing` + `sync` | estado local/pesagem | fila/escrita local | — | — | — | IndexedDB/local | **sim** | — | P0 |
| `pages/PecuaristaPesagemExecPage.tsx` | `weighing` + `sync` | lote/animais/pesos | pesagem local + sync legado | — | — | — | local | **sim** | — | P0 |
| `pages/PesadorPesagemExecPage.tsx` | `weighing` | pesagem | pesagem legado | — | — | — | — | comportamento legado | — | P0 |
| `pages/PecuaristaApartacaoPage.tsx` | `livestock` + `weighing` + `files` | animais/lote | apartação/relatório legado | — | — | — | local conforme fluxo | sim | — | P0 |
| `pages/VisitaTecnicaPage.tsx` | `visits` | visita/tópicos | visita/fotos/assinaturas legado | — | — | — | offline específico | sim | — | P0 |
| `pages/RevisaoVisitaPage.tsx` | `visits` + `files` | revisão/arquivos | revisão/remove arquivo legado | — | — | — | offline específico | sim | — | P0 |
| `components/consultor/VisitaTopicosSection.tsx` | `visits` + `files` | tópicos/fotos | tópicos/fotos legado | — | — | — | — | sim quando suportado pelo fluxo | — | P1 |
| `components/consultor/PhotoGrid.tsx` | `visits` + `files` | fotos | remove arquivo legado | — | — | — | — | sim quando suportado pelo fluxo | — | P1 |
| `hooks/usePainelData.ts` | `reporting` | indicadores | — | RPC legado | — | legado existente | `screenCache` | — | — | P1 |
| `features/painel/repositories/painelMaeRepository.ts` | `reporting` | `get_painel_mae` | — | **sim** | — | — | — | — | **sim** | P1 |
| `components/relatorio/ExportarRelatorioModal.tsx` | `reporting` | indicadores | — | `get_painel_mae`, `previsao_abate`, `get_consumo_real_v2` | — | — | — | — | — | P1 |
| `lib/pushService.ts` | `notifications` + `integrations` | sessão/config | envio | — | `send-push-notification` | — | — | — | — | P1 |
| `hooks/usePushNotifications.ts` | `notifications` | preferência/subscription | subscription legado | — | indireta | — | browser storage/service worker | PWA | — | P1 |
| `pages/CapatazesPage.tsx` e páginas administrativas de criação de usuário | `saas-admin` | usuários/perfis | criação | — | `create-user` | — | — | — | — | P0 |
| `components/admin/CriarAdminModal.tsx` | `saas-admin` | — | criação admin | — | `create-user` | — | — | — | — | P0 |
| `components/admin/CriarEscritorioModal.tsx` | `saas-admin` | — | criação escritório | — | `create-user` | — | — | — | — | P0 |
| `pages/SyncVetEquipePage.tsx` | `integrations` **[PENDENTE: fronteira legada SyncVet]** | equipe | equipe | — | `create-user`, `syncvet-delete-equipe` | — | — | — | — | P1 |
| `pages/SyncVetAgendaPage.tsx` | `integrations` **[PENDENTE: fronteira legada SyncVet]** | agenda/trajeto | — | — | `syncvet-calcular-trajeto` | — | — | — | — | P1 |
| `features/syncvet-trajetos/repositories/syncVetTrajetosRepository.ts` | `integrations` **[PENDENTE: fronteira legada SyncVet]** | equipe/trajetos/fazendas | — | — | — | — | — | — | **sim** | P1 |
| `features/syncvet-auditoria/repositories/syncVetAuditoriaRepository.ts` | `integrations` **[PENDENTE: fronteira legada SyncVet]** | equipes/auditoria | — | — | — | — | — | — | **sim** | P1 |
| `hooks/useSyncEngine.ts` | `sync` | estado/pendências | sync legado | RPC/queries legado | — | sim | IndexedDB/local | **sim** | — | P0 |
| `hooks/useRemoteSyncCommands.ts` | `sync` | comandos/estado | envio de comandos | legado | — | — | local | **sim** | — | P0 |
| `hooks/useRealtimeSync.ts` | `sync` | mudanças remotas | — | — | — | **sim** | local | **sim** | — | P0 |
| `lib/maisArrobasQueue.ts` | `sync` + `weighing` | fila | fila local | — | — | — | IndexedDB/local | **sim** | — | P0 |
| `lib/fotoSalgaQueue.ts` | `sync` + `files` | fila de fotos | fila local | — | — | — | IndexedDB/local | **sim** | — | P1 |
| `components/landing/ParceirosEditor.tsx` / `ImageUploadField.tsx` | `files` | assets | upload | — | — | — | — | — | — | P2 |
| `pages/ConsultorDespesasPage.tsx` | `visits` + `files` | despesas/comprovantes | despesas/upload | — | — | — | offline específico | sim | — | P1 |
| `pages/EntradaMateriasPrimasPage.tsx` | `feed-mill` + `inventory` + `files` | matéria-prima | entrada/upload | — | — | — | — | — | — | P1 |
| `components/retiro/AnaliseIaRetiroCard.tsx` | `integrations` | dados do retiro | — | — | `analisar-retiro` | — | — | — | — | P2 |
| `components/landing/RelattoDemoModal.tsx` | `integrations` | — | cadastro demo | — | `relatto-demo-signup` | — | — | — | — | P2 |

## Hooks compartilhados e caches

- `screenCache.ts`: contrato legado de cache de telas Admin/Gerente; mudanças devem preservar chave por filtros e invalidar após write bem-sucedido.
- `offlineSession.ts`, `maOffline.ts`, `maisArrobasQueue.ts`, `fotoSalgaQueue.ts`, `conferenciaOffline.ts`, `consultorOffline/`: persistência local/filas específicas; não são substituídas nesta fase.
- React Query em `App.tsx`: cache de queries com configuração global existente; não alterar parâmetros sem evidência de necessidade.

## Repositories já existentes no Web

O inventário permanente e seus contratos preservados estão em `docs/12-web-data-access.md`. A FASE 3 não deve duplicar repository existente nem criar camada vazia.

## Pontos deliberadamente não resolvidos nesta fase

- A fronteira definitiva de SyncVet continua `[PENDENTE]`; o módulo é preservado e não expandido.
- Regras de negócio de estoque, pesagem, sync e visita não são reinterpretadas.
- O motor offline definitivo permanece para a FASE 7.
- Persistência remota da nova API permanece bloqueada para a FASE 8.
- Este mapa é de **fronteiras com impacto de dados**; componentes puramente visuais não precisam de bounded context próprio.

Data da revisão: 2026-10-04.
