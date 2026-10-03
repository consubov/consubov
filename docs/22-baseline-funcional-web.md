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

## Dependências de Supabase no Web
O frontend consome o Supabase via cliente instanciado em `@/integrations/supabase/client`.
- **Auth:** `supabase.auth.getSession()` utilizado para obter token de acesso.
- **Realtime:** `supabase.channel().on('postgres_changes', ...).subscribe()` utilizado em `useRealtimeSync.ts` para atualizar a UI.
- **Push Notifications:** Chamada via `fetch` para a Edge Function `send-push-notification` em `apps/web/src/lib/pushService.ts`.

## Edge Functions consumidas
- `send-push-notification` (POST `/functions/v1/send-push-notification`) - Enviando notificações via `pushService.ts`.

## Storage e Arquivos
- Utiliza `signedUrl` para download de imagens e logos (ex: `confinamentoPdf.ts`, `visitaPdf.ts`). URLs são obtidas via API/DB.

## Pontos Offline
- A aplicação utiliza PWA (Service Workers) para cache de assets.
- Não há implementação de fila de mutações offline (`SyncQueue`) no frontend atual.

## Resumo
Documentação baseada exclusivamente em análise de código da branch `main`.

Data: 2026-10-03
