# Baseline Funcional da Web (FASE 3.1)

## Rotas atuais da Web (React Router)
As rotas são definidas em `apps/web/src/App.tsx`. A maioria é protegida por `ProtectedRoute`.

| Path | Componente | Papéis Permitidos |
|------|------------|-------------------|
| `/` | LandingPage | Público |
| `/relatto/*` | RelattoLandingPage | Público |
| `/login` | Login | Público |
| `/app` | RoleRedirect | Autenticado |
| `/conferencia` | ConferenciaPage | administrador, gerente |
| `/dashboard/retiro/:retiroId` | AdminRetiroPainelPage | administrador, gerente |
| `/mapa/retiro/:retiroId` | MapaFazendaPage | administrador, gerente, capataz |
| `/admin` | AdminLayout | administrador |
| `/admin/fazendas` | FazendasPage | administrador |
| `/admin/fazendas/:fazendaId` | FazendaDetailPage | administrador |
| `/admin/fazendas/:fazendaId/painel` | AdminFazendaPainelPage | administrador |
| `/admin/fazendas/:fazendaId/retiros/:retiroId/mapa` | MapaFazendaPage | administrador |
| `/admin/fazendas/:fazendaId/retiros/:retiroId` | RetiroDetailPage | administrador |
| `/admin/fazendas/:fazendaId/retiros/:retiroId/painel` | LegacyRetiroPainelRedirect | administrador |
| `/admin/fazendas/:fazendaId/retiros/:retiroId/pastos/:pastoId` | PastoDetailPage | administrador |
| `/admin/gerentes` | GerentesPage | administrador |
| `/admin/capatazes` | CapatazesPage | administrador |
| `/admin/escritorios` | EscritoriosPage | administrador |
| `/admin/produtos` | ProdutosPage | administrador |
| `/admin/qrcodes` | QrCodesPage | administrador |
| `/admin/lancamento-manual` | LancamentoManualPage | administrador |
| `/admin/configuracoes` | ConfiguracoesGeraisPage | administrador |
| `/admin/notificacoes` | NotificacoesPage | administrador |
| `/admin/landing-page` | LandingPageConfigPage | administrador |
| `/admin/ciclos` | CiclosPage | administrador |
| `/admin/inteligencia` | PainelInteligenciaPage | administrador |
| `/admin/auditoria` | AuditoriaConfigPage | administrador |
| `/admin/recuperar` | RecuperarDadosPage | administrador |
| `/admin/fabricas` | FabricasPage | administrador |
| `/admin/fabricas/:id` | FabricaDetailPage | administrador |
| `/admin/operadores-fabrica` | OperadoresFabricaPage | administrador |
| `/admin/materias-primas` | MateriasPrimasPage | administrador |
| `/admin/entrada-materias-primas` | EntradaMateriasPrimasPage | administrador |
| `/admin/consultores` | ConsultoresPage | administrador |
| `/admin/pesadores` | PesadoresPage | administrador |
| `/admin/formulas-sistema` | FormulasSistemaPage | administrador |
| `/admin/premiacao` | AdminPremiacaoPage | administrador |
| `/admin/syncvet-onboarding` | AdminSyncVetOnboardingPage | administrador |
| `/gerente` | GerenteDashboard | gerente |
| `/gerente/fazendas/:fazendaId/retiros/:retiroId/painel` | LegacyRetiroPainelRedirect | gerente |
| `/gerente/materias-primas` | MateriasPrimasPage | administrador, gerente |
| `/gerente/entrada-materias-primas` | EntradaMateriasPrimasPage | administrador, gerente |
| `/gerente/produtos` | GerenteProdutosPage | gerente |
| `/gerente/auditoria-fotos` | GerenteAuditoriaFotosPage | gerente |
| `/gerente/gmd` | GerenteGmdPage | gerente |
| `/gerente/previsao-abate` | GerentePrevisaoAbatePage | gerente |
| `/capataz` | CapatazRoute | capataz |
| `/capataz/transferencia-retiro` | TransferenciaRetiroPage | capataz, administrador |
| `/escritorio` | EscritorioLayout | escritorio |
| `/fabrica` | FabricaDashboard | operador_fabrica |
| `/consultor` | ConsultorLayout | consultor |
| `/consultor/fazendas/:fazendaId` | ConsultorFazendaDetalhePage | consultor |
| `/consultor/visitas/:visitaId` | VisitaTecnicaPage | consultor |
| `/consultor/visitas/:visitaId/revisao` | RevisaoVisitaPage | consultor |
| `/consultor/historico` | ConsultorHistoricoPage | consultor |
| `/consultor/painel` | ConsultorPainelPage | consultor |
| `/consultor/despesas` | ConsultorDespesasPage | consultor |
| `/consultor/configuracoes` | ConsultorConfiguracoesPage | consultor |
| `/pesador` | PesadorLayout | pesador |
| `/pesador/clientes` | PesadorClientesPage | pesador |
| `/pesador/pesagem` | PesadorPesagemPage | pesador |
| `/pesador/pesagem/novo` | PesadorPesagemNovoPage | pesador |
| `/pesador/pesagem/:pesagemId` | PesadorPesagemExecPage | pesador |
| `/pesador/pesagem/:pesagemId/resumo` | PesadorPesagemResumoPage | pesador |
| `/pecuarista` | PecuaristaLayout | pecuarista |
| `/pecuarista/fazendas` | PecuaristaFazendasPage | pecuarista |
| `/pecuarista/fazendas/:fazendaId` | PecuaristaFazendaDetalhePage | pecuarista |
| `/pecuarista/fazendas/:fazendaId/lotes/:loteId` | PecuaristaLoteDetalhePage | pecuarista |
| `/pecuarista/fazendas/:fazendaId/lotes/:loteId/buscar` | PecuaristaBuscarAnimalPage | pecuarista |
| `/pecuarista/fazendas/:fazendaId/lotes/:loteId/pesagem/:pesagemId` | PecuaristaPesagemExecPage | pecuarista |
| `/pecuarista/fazendas/:fazendaId/lotes/:loteId/pesagem/:pesagemId/resumo` | PecuaristaPesagemResumoPage | pecuarista |
| `/pecuarista/fazendas/:fazendaId/lotes/:loteId/apartacao` | PecuaristaApartacaoPage | pecuarista |
| `/pecuarista/fazendas/:fazendaId/lotes/:loteId/apartacao/:apartacaoId/resumo` | PecuaristaApartacaoResumoPage | pecuarista |
| `/pecuarista/lotes` | PecuaristaHistoricoPage | pecuarista |
| `/syncvet` | SyncVetLayout | syncvet |
| `/syncvet/empresa` | SyncVetEmpresaPage | syncvet |
| `/syncvet/equipe` | SyncVetEquipePage | syncvet |
| `/syncvet/fazendas` | SyncVetFazendasPage | syncvet |
| `/syncvet/fazendas/:fazendaId` | SyncVetFazendaDetalhePage | syncvet |
| `/syncvet/fazendas/:fazendaId/lotes/:loteId` | SyncVetLoteDetalhePage | syncvet |
| `/syncvet/fazendas/:fazendaId/novo-manejo` | SyncVetNovoManejoPage | syncvet |
| `/syncvet/manejos/:manejoId/executar` | SyncVetManejoExecucaoPage | syncvet |
| `/syncvet/fazendas/:fazendaId/estacoes/:estacaoId` | SyncVetEstacaoDetalhePage | syncvet |
| `/syncvet/medicamentos` | SyncVetMedicamentosPage | syncvet |
| `/syncvet/semen` | SyncVetSemenPage | syncvet |
| `/syncvet/protocolos` | SyncVetProtocolosPage | syncvet |
| `/syncvet/protocolos/:protocoloId` | SyncVetProtocoloDetalhePage | syncvet |
| `/syncvet/agenda` | SyncVetAgendaPage | syncvet |
| `/syncvet/partos` | SyncVetPartosPage | syncvet |
| `/syncvet/preferencias` | SyncVetPreferenciasPage | syncvet |
| `/syncvet/trajetos` | SyncVetTrajetosPage | syncvet |
| `/syncvet/precos` | SyncVetPrecosPage | syncvet |
| `/syncvet/servicos/novo` | SyncVetServicoNovoPage | syncvet |
| `/syncvet/contas` | SyncVetContasPage | syncvet |
| `/syncvet/auditoria` | SyncVetAuditoriaPage | syncvet |
| `/syncvet/meu-painel` | SyncVetMeuPainelPage | syncvet |

## Perfis e Redirects
- **Papéis (Roles):** `administrador`, `gerente`, `capataz`, `escritorio`, `operador_fabrica`, `consultor`, `pesador`, `pecuarista`, `syncvet`.
- **Redirecionamento:** Implementado via `RoleRedirect` em `apps/web/src/App.tsx`.

## Módulos/superfícies visíveis por perfil

Este mapa registra as superfícies de entrada comprovadas pelo router. Componentes internos de cada tela são detalhados em `docs/23-fase3-mapa-bounded-contexts-web.md` quando possuem acesso a dados relevante.

| Perfil | Superfícies de entrada comprovadas |
| --- | --- |
| `administrador` | dashboard, fazendas/retiros/pastos/mapa, gerentes, capatazes, escritórios, produtos, QR, lançamento manual, configurações, notificações, landing CMS, ciclos, inteligência, auditoria, recuperação, fábrica, matérias-primas, consultores, pesadores, fórmulas, premiação, onboarding SyncVet |
| `gerente` | dashboard, painel de retiro, matérias-primas/entrada quando `GerenteFabricaGuard` autoriza, produtos, auditoria de fotos, GMD, previsão de abate |
| `capataz` | dashboard/rota do capataz, mapa de retiro, transferência de retiro |
| `escritorio` | `EscritorioLayout` e navegação interna existente |
| `operador_fabrica` | `FabricaDashboard` |
| `consultor` | fazendas, detalhe da fazenda, visitas, revisão, histórico, painel, despesas, configurações |
| `pesador` | dashboard, clientes, nova pesagem, execução e resumo |
| `pecuarista` | dashboard, fazendas, lotes, busca por animal, pesagem, apartação, histórico |
| `syncvet` | dashboard, empresa, equipe, fazendas/lotes, manejos, estações, medicamentos, sêmen, protocolos, agenda, partos, preferências, trajetos, preços, serviços, contas, auditoria, painel pessoal |

## Telas críticas por módulo

A classificação abaixo não cria novas prioridades de produto; apenas consolida telas/entradas já comprovadas no router e nos fluxos de dados atuais para servir de baseline de regressão.

| Módulo/contexto | Telas/entradas críticas comprovadas | Motivo de risco |
| --- | --- | --- |
| `identity-tenancy` | `Login`, `/app` (`RoleRedirect`), `ProtectedRoute` | controla sessão, perfil e acesso às superfícies autenticadas |
| `farms` / `pastures` | `FazendasPage`, `FazendaDetailPage`, `RetiroDetailPage`, `PastoDetailPage`, `MapaFazendaPage`, `AdminRetiroPainelPage` | estrutura operacional e navegação fazenda → retiro → pasto |
| `nutrition` / `inventory` | `ProdutosPage`, `LancamentoManualPage`, `EntradaMateriasPrimasPage`, fluxos de estoque/salga | altera ou apresenta consumo, lançamentos e saldo legado |
| `feed-mill` | `FabricaDashboard`, `FabricaDetailPage`, `MateriasPrimasPage`, `EntradaMateriasPrimasPage` | produção, matérias-primas, estoque e transferências |
| `visits` / `files` | `VisitaTecnicaPage`, `RevisaoVisitaPage`, `ConsultorDespesasPage` | histórico de visita, fotos, comprovantes e finalização |
| `weighing` / `livestock` | `PesadorPesagemExecPage`, `PecuaristaPesagemExecPage`, `PecuaristaApartacaoPage` | histórico de peso, UUID/local-first e operações de campo |
| `reporting` | `AdminFazendaPainelPage`, `PainelInteligenciaPage`, `ExportarRelatorioModal` | indicadores/RPCs/exportações que precisam manter semântica |
| `sync` | hooks `useSyncEngine`, `useRemoteSyncCommands`, `useRealtimeSync` e filas locais | retry, reconexão e dados offline legados não podem regredir |
| `saas-admin` | páginas/modais de criação de usuários por perfil | autorização e criação de identidade são superfícies sensíveis |
| `integrations` / SyncVet | rotas `SyncVet*` já existentes | módulo preservado/congelado para expansão nesta etapa |

## Fluxos críticos preservados nesta fase

A FASE 3 não muda regra de negócio destes fluxos; eles funcionam como baseline de regressão:

1. autenticação -> `/app` -> `RoleRedirect` -> superfície do papel;
2. navegação admin/gerente -> fazenda -> retiro -> painel/mapa/pasto;
3. operação local/offline já existente de pesagem/filas legadas, sem substituição pelo motor definitivo da FASE 7;
4. acesso a dados legado do Web -> repositories já extraídos ou cliente Supabase existente;
5. nova API local -> apenas contrato HTTP/local, sem persistência remota.

## Dependências diretas de Supabase no Web

O legado continua usando o cliente em `apps/web/src/integrations/supabase/client.ts`. A FASE 3 **não** tenta removê-lo em big-bang. O baseline de novos imports diretos fica congelado mecanicamente no commit `c5196bf732af7420c2022e12016aa89c1ab67f06`; o teste `apps/web/src/test/architecture/supabaseGuardrail.test.ts` reprova qualquer linha adicionada depois desse baseline que importe o client legado ou `@supabase/supabase-js` fora do adapter oficial.

Dependências relevantes comprovadas e que precisam permanecer visíveis no mapa:

- autenticação/sessão: `hooks/useAuth.tsx`, `lib/offlineSession.ts`, `integrations/supabase/client.ts`;
- hooks legados com acesso direto ou composição realtime/offline: `useDietaCategorias.ts`, `useConsumoMineral.ts`, `useGerenteData.ts`, `useGerenteTemFabrica.tsx`, `useTotalAnimaisRetiro.ts`, `useMapaData.ts`, `useEstoqueData.ts`, `useOfflinePesagem.ts`, `usePainelData.ts`, `useRemoteSyncCommands.ts`, `useSyncEngine.ts`, `useRealtimeSync.ts`, `useMortalidadesData.ts`, `useAbatesData.ts`;
- repositories já extraídos: landing, usuário, premiação, pastos, eventos de lote, painel mãe, resultado de pesagem, produtos do gerente, auditoria SyncVet e trajetos SyncVet; ver `docs/12-web-data-access.md`;
- páginas/componentes ainda legados que usam queries/RPC/Storage/Edge Function estão listados nas seções abaixo e em `docs/23-fase3-mapa-bounded-contexts-web.md`.

**Regra:** nenhum arquivo novo pode importar Supabase diretamente. Fluxo alterado deve preferir repository/service existente, preservando comportamento, cache, realtime e offline.

## Edge Functions consumidas

Chamadas comprovadas no inventário atual:

- `create-user`: `CapatazesPage.tsx`, `AdminSyncVetOnboardingPage.tsx`, `CriarAdminModal.tsx`, `CriarEscritorioModal.tsx`, `ConsultoresPage.tsx`, `GerentesPage.tsx`, `OperadoresFabricaPage.tsx`, `PesadoresPage.tsx`, `SyncVetEquipePage.tsx`;
- `syncvet-delete-equipe`: `SyncVetEquipePage.tsx`;
- `syncvet-calcular-trajeto`: `SyncVetAgendaPage.tsx`;
- `relatto-demo-signup`: `components/landing/RelattoDemoModal.tsx`;
- `analisar-retiro`: `components/retiro/AnaliseIaRetiroCard.tsx`;
- `send-push-notification`: `lib/pushService.ts` via endpoint da Edge Function.

Nenhuma destas integrações é migrada ou expandida na FASE 3.

## RPCs consumidas pelo Web

Inventário comprovado de chamadas críticas/representativas:

- `get_painel_mae`;
- `previsao_abate`;
- `get_consumo_real_v2`;
- `ensure_ciclo_atual`;
- `sync_capataz_lancamento`;
- `ensure_ciclo_retiro`.

Os contratos que já foram encapsulados em repository permanecem documentados em `docs/12-web-data-access.md`. Assinaturas não comprovadas no código não são inferidas aqui.

## Realtime atual

Subscriptions comprovadas no baseline incluem:

- `EscritorioLayout.tsx` (`esc-realtime-${fazendaId}`);
- `PainelInteligenciaPage.tsx` (`inteligencia-realtime`);
- `AdminDashboard.tsx` (`admin-dashboard-realtime`);
- `CiclosPage.tsx` (`ciclos-admin-realtime`);
- hooks de sync/mapa/estoque que compõem realtime legado, conforme `docs/23-fase3-mapa-bounded-contexts-web.md`.

Realtime continua mecanismo de atualização de UI; não passa a ser autoridade de integridade.

## Storage e arquivos

O Web mantém operações legadas de upload/remove/signed URL em buckets já existentes. Consumidores inventariados incluem landing, despesas de consultor, mapas/fábrica, relatórios, fotos de salga, visitas, pesagem e SyncVet. A FASE 3 não cria bucket, policy, migration ou storage remoto novo.

## Cache, IndexedDB e pontos offline atuais

O baseline **já possui** mecanismos offline/cache e não deve ser descrito como “sem fila offline”:

- `lib/screenCache.ts`: cache de telas para superfícies Gerente/Admin;
- `lib/offlineSession.ts`: sessão local/offline;
- `lib/maOffline.ts`: persistência/estado local do fluxo Mais Arrobas;
- `lib/maisArrobasQueue.ts`: fila local já existente;
- `lib/fotoSalgaQueue.ts`: fila de fotos;
- `lib/conferenciaOffline.ts` e `lib/consultorOffline/`: suporte offline legado específico;
- `hooks/useOfflinePesagem.ts`, `hooks/useSyncEngine.ts`, `hooks/useRealtimeSync.ts`: orquestração existente;
- `lib/swRegistration.ts` / `lib/pwaManifest.ts`: PWA/service worker;
- IndexedDB é usado pelos mecanismos locais já existentes e pelos contratos de plataforma; o motor offline definitivo continua reservado à FASE 7.

## Estado do baseline

- Fonte funcional: `apps/web/src/App.tsx`, hooks, repositories, libs e consumers inventariados acima.
- Baseline de imports Supabase congelado: `c5196bf732af7420c2022e12016aa89c1ab67f06`.
- Nenhuma conexão da nova API com Supabase/PostgreSQL remoto foi autorizada.
- Nenhuma configuração de Vercel/deploy foi autorizada.
- Divergências ou regras de negócio não comprovadas permanecem `[PENDENTE]`; não devem ser preenchidas por inferência.

Data da revisão: 2026-10-04.
