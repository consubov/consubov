# CONSUBOV - Checklist Mestre de Execucao

## Handoff Codex local / QA de retomada — 2026-10-13

- [x] Handoff especifico para Codex local criado em `instructions/active/HANDOFF-CODEX-LOCAL-FASES5-9-2026-10-13.md`, ligado ao PRD unico das FASES 5–9, sem nova branch ou PR. Sao 3 branches remotas (main, trabalho e backup), com **PR #43 draft** como unico PR aberto.
- [x] Codespace `special garbanzo` realizou fast-forward para `f15fa4bc3725e8de9c089b01e4edf9ed1dff7a75` com arvore limpa, mantendo quatro stashes. **Isto nao sincroniza automaticamente o computador local.**
- [x] `task qa:regressions`: 191/191 PASS, exit 0, SHA limpo `f15fa4bc`; `.qa/runs/20261013T192749Z-regressions-f15fa4bc3725-22980/result.json`.
- [x] `task qa:pwa:upgrade-fixture`: 34/34 PASS, exit 0, Chromium/WebKit no SHA limpo `f15fa4bc`; `.qa/runs/20261013T192834Z-pwa-upgrade-fixture-f15fa4bc3725-24443/result.json`. Teste sintetico, nao migracao real.
- [ ] **Codex no VS Code do responsavel:** validar origin/estado Git, fazer pull `--ff-only` da branch de trabalho e comprovar HEAD igual ao remoto; execucao local do Codex ainda sem evidencia.
- [ ] `task qa:phase5` integral **nao executado** na ultima tentativa via navegador (ferramenta bloqueou chamada), FASES 6/7 integrais e matrix ainda pendentes. Nao marcar WEB/PWA/OFFLINE READY nem liberar o PR.
- [ ] Revisar preservacao da branch de backup antes de propor sua exclusao; nada foi apagado.

## Verificacao real de monorepo e PWA no SHA 396bf2ff — 2026-10-13

- [x] `task qa:check` no checkout limpo `396bf2ff8411a47343e517683c168891c1b99f7b`: exit 0, API 539/539, Web 171/171, typecheck/build PASS, artefato `.qa/runs/20261013T190510Z-check-396bf2ff8411-6289/result.json` com `workingTreeDirty=false`.
- [x] `task qa:offline:core` 61/61; `task qa:pwa:smoke` 25/25; `task qa:phase5:contracts` 10/10; `task qa:preprod:rehearsal` 26/26, todos exit 0.
- [x] `task qa:offline:browser`: Chromium 11/11 + WebKit 11/11, total 22/22, exit 0; confirmados dois tabs, blobs, escopo de tenant, ACK e idempotencia em fixtures locais.
- [x] `task qa:pwa:build-preflight` exit 0: **349 assets construidos = 349 precache**.
- [ ] `task qa:regressions` no SHA `396bf2ff8411a47343e517683c168891c1b99f7b`: anterior 191/191 PASS em `e0f66b0c`, nao repetido no SHA atual.
- [ ] `task qa:preprod:local-gates` **NAO APROVADO**: processo saiu 201, output detalhado nao recuperado; gate exige QA_MATRIX_REPORT completo + FASES 5/6/7 PASS no mesmo SHA.
- [ ] QA integral de FASE 5, FASE 6, FASE 7, atualização de PWA entre versões, Lighthouse/a11y e homologacao real. Nao chamar a aplicacao de pronta para producao.
- [x] Relatorio com evidencias e limites em `docs/qa/qa-real-monorepo-2026-10-13.md`; cuatro stashes preservados. Nenhum outro repositorio alterado.


## FASE 6 — desbloqueio real da tipagem do teste GPS — 2026-10-13

- [x] `task doctor` no Codespace real: PASS, exit 0. Bun 1.4.0, Go Task 3.54.0, Bash/Git/Node disponiveis, sem exigir Docker/act.
- [x] `task qa:regressions` 191/191, exit 0, em `e0f66b0c` limpo; arquivo `.qa/runs/20261013T185600Z-regressions-e0f66b0c5ac3-2243/result.json`.
- [x] Falha RED reproduzida no check: `BrowserLocationProvider.test.ts:49`, TS2322. Corrigida exclusivamente a tipagem de getter da fixture, preservando o fluxo de GPS.
- [x] GREEN em checkout dirty de `681c9144`: `bun run typecheck` Web, Vitest GPS 12/12, `task qa:check` (tipagem, build API/Web e Web 171/171), `bunx eslint` do teste, todos com exit 0 e blob testado `477952d3743b5048ad07c5afdbca0d8ab0134513`.
- [ ] Revalidar `task qa:check` e regressions no novo SHA com arvore limpa apos commit, sem contar `dirty=true` como QA de release.
- [ ] Gates FASE 5–7 integrados, navegador Chromium/WebKit, tenancy e homologacao fisica permanecem pendentes. Ver `docs/qa/gps-provider-typecheck-2026-10-13.md`.


## Gates locais: verificacao isolada e impedimento do Codespace — 2026-10-13

- [x] Revalidacao independente do blob publicado da fila legada: `f77442eb94dee91b1e7f897942f024b807cbcf44`, Node 10/10 PASS e TS strict/noEmit isolado exit 0.
- [x] Documentado o impedimento de automacao: extension host remoto intermitente, timeout WebSocket, clipboard bloqueado. GUI de Git sem pull pendente, porem SHA local sem confirmacao de terminal.
- [ ] `task doctor` no Codespace: execucao/exit NAO verificados.
- [ ] `task qa:regressions`, `task qa:check`, Vitest Web, QA navegador offline e regressao API: NAO executados neste lote.
- [ ] Verificar SHA/dirty no unico Codespace, conservar stashes e registrar evidencia QA completa do HEAD; nenhuma fase integral aprovada.
- [ ] Revisar futuramente o backup `codespace-probable-acorn-v6vvq9rrvjjgcw6w` antes de eventual remocao. Nao tocar em main/ambientes remotos.


## Codespace CONSUBOV — alertas Act/Run resolvidos no workspace (2026-10-13)

- [x] Confirmados alertas de `act` ausente e nenhum runtime Docker: foram emitidos pela extensao Act/Run opcional, nao pelo aplicativo.
- [x] `Act/Run - GitHub Actions Visual locally` v2.11.0 desativada via `Desabilitar (Workspace)` exclusivamente no Codespace ativo, com reload.
- [x] Verificacao pos-reload: VS Code `Nenhum Problema` (0 erros e 0 avisos), Centro de Notificacoes vazio; indicador de ambiente obsoleto no terminal nao aparece. Sem testes de aplicacao neste lote.
- [ ] Tests de app / monorepo ainda pendentes no checkout mais recente; preservacao de stashes e fast-forward antes de rodar `task qa:check` e demais gates. Evitar CI hospedado e banco remoto.


## Ajuste na retomada da mesma conta apos aborto — 2026-10-13

- [x] RED reproduzido em teste Node: ao desmontar/reabrir tela rapidamente, a nova instancia podia compartilhar a promise abortada, deixando item seguinte sem sync.
- [x] Agora a trava registra tambem o AbortSignal da tentativa; requisição da mesma conta com sinal antigo abortado aguarda a finalizacao e abre uma nova rodada. O mesmo usuario com sinal vigente ainda compartilha a mesma promise sem duplicar.
- [x] Testes Node isolados **10/10 PASS**, TypeScript strict/noEmit exit 0, fonte candidata validada por hash Git `f77442eb94dee91b1e7f897942f024b807cbcf44`. Vitest no repositorio ainda nao executado por indisponibilidade do Codespace.
- [ ] Testes integrados e multiabas, RBAC server-side e homologacao; nenhuma fase integral aprovada.


## FASE 7 — isolamento por conta na Conferência (2026-10-13)

- [x] Reproduzido cruzamento de registros de usuários diferentes (RED 2/3); código corrigido para apenas o userId ativo, sem flush anônimo; abort de novos envios no cleanup.
- [x] Node 9/9 e TypeScript estrito isolado PASS; testes Vitest adicionais publicados, execução integrada PENDENTE.
- [ ] Executar `task qa:check`, `task qa:regressions`, Vitest Web, Chromium/WebKit e testes de auth/tenant; validar multiaba/ACK no backend antes de declarar FASE 7 pronta.


## FASE 7 - fila legada de Conferencia (2026-10-13)

- [x] Lote isolado de preservacao local: mesmo UUID no primeiro insert/retry, single-flight de sync na mesma guia, remocao apenas de IDs com ACK explicito sem sobrescrever registros novos, JSON danificado nao substituido silenciosamente.
- [x] Regressao RED 3/4 (tres falhas), GREEN Node 5/5 e TypeScript strict isolado exit 0; testes Vitest versionados (NAO EXECUTADOS no repo).
- [ ] QA integrado do checkout (Vitest, Taskfile, E2E Chromium/WebKit), sincronizacao multiabas com sessao/tenant, ACK perdido e idempotencia backend; sem aprovacao integral da FASE 7.
- [ ] Browser-MTS: transporte de clique/terminal intermitente; `act` opcional e Docker ausentes causam alertas na extensao Act/Run, sem falha confirmada no app. Registrar diagnostico em docs/qa/conferencia-legacy-sync-2026-10-13.md.


## Lote GPS da FASE 6 — 2026-10-13

- [x] Codigo implementado e publicado no commit `8a8538c5`: capabilities sem prompt, provider GPS com fallback/timeout e auditoria unica da Conferencia (contrato legado preservado).
- [x] Testes isolados Node 12/12 PASS apos RED (7 falhas esperadas); TypeScript isolado estrito PASS. Nao equivalem a QA completo de app.
- [ ] Vitest integrado, `task qa:check`, regressao completa e Playwright Chromium/WebKit no Codespace, pendentes de execucao/registro.
- [ ] QR fisico e homologacao de dispositivo, em gate posterior; nao bloquear desenvolvimento local independente.
- [ ] Gate integral FASE 6 ainda **NAO aprovado**. Handoff e matrizes: `docs/60-browser-capabilities.md`, `docs/qa/gps-conferencia-local-2026-10-13.md`.


## Codespace apos FF - 2026-10-13

- [x] FF local de b9ecba3d ate f9611b48, sem alterar main. PRD GPS reaplicado (5 linhas de planejamento), stashes mantidos.
- [ ] Codigo GPS/Conferencia, browser QA e homologacao fisica ainda pendentes; este lote e so documental.

## Sincronizacao e handoff - 2026-10-13

- [x] Branches historicas removidas; somente `main` e `work/fase5-6-7-pwa-local` existem no GitHub. Um PR aberto: #43 (draft), sem merge.
- [x] Publicado runbook de pull local e continuidade segura: `docs/68-sincronizacao-local-e-agentes.md`; README e AGENTS alinhados a PWA/IndexedDB.
- [ ] Codespace ainda nao confirmado sincronizado: ultimo snapshot mostrava 1 PRD local modificado e 52 commits atras. Preservar alteracao antes de fast-forward.
- [ ] QA integral das fases, homologacao e merge PR #43 seguem pendentes; documentacao nao altera gates.

## Estado consolidado em 2026-10-13

Branch ativa: `work/fase5-6-7-pwa-local`. PR #43 draft. Este painel consolida a reconciliacao Git; nao altera escopo, criterios de aceite ou resultados das fases.

## Planejamento integral preservado - leitura obrigatoria

- Snapshot completo imediatamente anterior: [checklist preservado](docs/archive/CHECKLIST_antes_reconciliacao_ramos_2026-10-13.md), mesmo blob `564b90abd1fa36150f8b31be586124a8543cc7f5`. Contem todos os itens, vinculos, resultados e o planejamento da FASE 11 existentes antes desta consolidacao.
- Criterios originais completos: [arquivo integral de 2026-10-09](docs/archive/CONSUBOV_CHECKLIST_MESTRE_antes_auditoria_2026-10-09.md). Ler o capitulo da fase antes de implementar.
- PRD unico: `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`.
- Handoff: `CONSUBOV_HANDOFF_CONTINUIDADE.md`; Notion ao vivo: `3ec8e0bd-0f4d-816d-9bb5-d807e8e2cdc9`.

## Git - reconciliacao autorizada

- [x] Historicos `quality/fase5-web-ready-20261005`, `feature/phase6-app-shell` e `main` incorporados como pais do merge `41a1f9f1a3728a3f4cf393c6520587bd45cab3a0`: 50 commits anteriores preservados, sem reescrita.
- [x] Resolucao seguindo PWA/IndexedDB, mantendo o codigo funcional de `b9ecba3d`; experimentos nativos ficam somente no historico. Backend, rotas e layouts ja incorporados nao foram substituidos por versoes antigas.
- [x] Recuperada a documentacao da direcao PWA e incorporada a regra para novos ZIPs, sem remover arquivos ja versionados.
- [x] Exclusao efetiva das branches historicas `quality/fase5-web-ready-20261005` e `feature/phase6-app-shell`; GitHub reconsultado: apenas `main` e a branch ativa permanecem, com 1 PR aberto (#43, draft). Commits historicos preservados na branch ativa.
- [ ] Sincronizacao segura do Codespace quando Browser-MTS voltar; preservar PRD local e demais alteracoes existentes.
- [ ] Aceite e merge do PR #43 na `main`. Esta reconciliacao nao executa esse merge nem libera producao.

## Estado das fases - sem alteracao de aceite

| Fase | Estado | Pendencia principal |
| --- | --- | --- |
| 0-4 | Fechamento historico | Nao revalidadas integralmente nesta tarefa Git |
| 5 | QA integral pendente | Desempenho, coverage/seguranca e aceite conforme criterios originais |
| 6 | Componentes PWA e fixtures presentes | Upgrade do legado real, capabilities/GPS, gate integral e homologacao no piloto |
| 7 | Fila/adapters locais presentes | Migracao retomavel, identidade autorizada, sync push/pull, ordem causal, anexos e caos |
| 8 | Preparacao local | Schema/migracao/backup apenas local; remoto exige autorizacao propria |
| 9 | Preparacao local, producao nao aprovada | Piloto, restauracao, rollback, operacao e autorizacao de release |
| 10 | Pos-producao, fora do trabalho ativo | Reavaliar apos estabilizacao |
| 11 | Planejamento documental | Perfis/hierarquia/curriculo/ranking; sem codigo, migracoes ou permissoes aprovadas |

FASE 11: [PRD existente](docs/67-fase11-perfis-auditoria-prd.md). Sua numeracao nao cria gate automatico para trabalho independente, mas contratos, privacidade e conflitos precisam ser resolvidos antes de implementar.

## Regras de continuidade

PWA React/Vite e IndexedDB continuam vigentes. Preservar origem/manifest, consentimento de update, seis bases legadas, UUIDs e idempotencia. Nenhum resultado de fixture aprova automaticamente migracao real, isolamento backend ou uma fase inteira.

Executar testes locais relevantes sem depender do GitHub Actions. Nao apresentar contagens antigas como reexecucao atual. Pendencia fisica nao impede desenvolvimento independente; testes automatizaveis de dados, tenant e seguranca nao sao dispensados. Sem banco remoto, deploy, rotacao de secrets ou alteracao de producao nesta tarefa.

Relatorio: [reconciliacao Git e limites](docs/qa/git-branch-reconciliation-2026-10-13.md). O historico detalhado continua nos snapshots preservados; nenhum item foi marcado como concluido apenas porque seus commits foram integrados.

## FASE 11 - Consultor: permissoes granulares de consulta (planejada 2026-10-13)

- [x] Auditoria read-only de codigo e metadados do legado: papel consultor, painel, visitas, IndexedDB e cadastro `fazendas_consultor` ja existem; este cadastro nao equivale a permissao de acesso a `fazendas` operacionais.
- [x] Item **11.3A - Consultor** acrescentado ao checklist detalhado da FASE 11 no Notion; preserve o PRD existente `docs/67-fase11-perfis-auditoria-prd.md` ate a proxima revisao autorizada de escopo.
- [ ] Acrescentar no cadastro atual de Consultores a arvore simples Fazenda > Retiro > Pasto, com selecao em lote, busca, resumo e revogacao. Reaproveitar o papel e as rotas existentes.
- [ ] Aprovar alçadas de concessao e matriz por acao. Leitura por escopo explicito como proposta conservadora; escrita, exportacao e administracao negadas ate aprovacao.
- [ ] Projetar grants aditivos por tenant, identidade, fazenda e retiro/pasto opcionais; validar hierarquia e origem de cada permissao no backend, sem confiar em UI, URL ou nomes.
- [ ] Cobrir APIs, relatorios, PDF, arquivos, QR, cache offline, sync, auditoria e revogacao; preservar os dados/visitas legados e os perfis existentes.
- [ ] Testar isolamento cross-tenant, URL/ID adulterado, tentativa de escalada de privilegio, fazenda inteira, retiro, pasto, multiplos vinculos, acesso revogado, offline e regressao; OpenAPI/docs/QA aprovados antes do aceite.
- [ ] Nao implementar nem migrar remoto nesta etapa; conflitos com trabalhos em curso devem ser avaliados antes de codigo.

## Planejamento FASE 12 - auditoria Supabase e correcoes de vulnerabilidades (2026-10-13)

- [x] FASE 12 detalhada criada no Notion: https://app.notion.com/p/3f98e0bd0f4d81dab582edcf1c304138
- [x] Auditoria **somente leitura**: 132 tabelas public; 107 sem RLS e com privilegios de SELECT/INSERT/UPDATE/DELETE para anon; 25 public com RLS. Exposicao potencial grave; nao afirmar vazamento efetivo sem teste isolado.
- [x] Inventario: 185 policies public, 20 storage; 35 alertas policies com RLS desligado; 8 views SECURITY DEFINER; 15 avisos search_path mutable; 49 funcoes SQL public (29 SECURITY DEFINER); 32 registros de triggers public; 132 PK, 223 FK; 143 migrations.
- [x] Inventario: 8 buckets (3 publicos: landing, mapas, relatorios) e 10 Edge Functions com verify_jwt=false; autenticacao interna deve ser auditada antes de classificar uma funcao como sem auth.
- [x] Lints de performance inventariados: 113 FKs sem indice de cobertura, 62 auth_rls_initplan, 76 multiple_permissive_policies, 25 unused_index e 1 duplicate_index; validar impacto antes de qualquer alteracao.
- [ ] **12.0 Baseline**: reconciliar schemas, tabelas, views, constraints, indices, grants, policies, SQL/RPC, triggers, Edge Functions, auth, storage, migrations, jobs, consumidores Web/PWA e backend; mapear risco com evidencia.
- [ ] **12.1 P0 - RLS/grants**: definir politicas por ator/tenant/fazenda/retiro/pasto e matriz allow/deny; planejar remediacao incremental dos privilegios anon e das 107 tabelas; nao ligar RLS em massa sem policy/teste.
- [ ] **12.2 Isolamento**: revisar policies existentes, SELECT true, com/sem RLS; incluir relatorios, URLs, recursos do Consultor FASE 11, storage, RPC e sync; testes negativos multi-tenant.
- [ ] **12.3 SQL**: auditar views definer, funcoes privilegiadas acessiveis a anon/authenticated, search_path, triggers, dynamic SQL, ownership e controles de tenant; corrigir apenas em ambiente e janela autorizados.
- [ ] **12.4 Auth/Edge**: revisar JWT ou autenticacao interna em cada funcao, caller/role/tenant, rate limiting, CORS, logs/PII, secrets e aviso de protecao contra senhas vazadas; preservar hardening ja realizado na FASE 1.
- [ ] **12.5 Storage/LGPD**: avaliar buckets publicos, PDF/relatorios, permissoes de objetos, URLs assinadas, caches, consentimento, retencao e dados pessoais; nao privatizar automaticamente.
- [ ] **12.6 Integridade/performance**: analisar 223 FKs, consultas, indices, transacoes, concorrencia, estoque/pesagem, idempotencia, auditoria e inconsistencias da migracao; nao remover indices apenas por lints.
- [ ] **12.7 Remediacao segura**: classificar P0/P1/P2, plano por dependencia e tabela, dry-run local/staging autorizado, backup/restore, rollback e monitoramento antes de qualquer migration remota.
- [ ] **12.8 QA**: testes anon/auth/perfil/cross-tenant/arquivos/Edge/SQL, regressao Web/PWA/offline, CI e relatorio com SHA/evidencias; QA reprovado bloqueia aceite.
- [ ] Publicar atualizacoes de docs/ADRs/OpenAPI/handoff e evidencias quando houver implementacao efetiva; nao marcar fase concluida por existir planejamento.
- [ ] **Gate**: nenhuma DDL, policy, migration, REVOKE, ALTER, deploy, alteracao Auth, bucket, segredo ou banco remoto nesta tarefa. Qualquer acao futura exige autorizacao expressa e criterios dos gates anteriores.

## GATE EXPLICITO - FASE 12 NAO PODE INICIAR SEM NOVO PEDIDO (2026-10-13)

- [x] Decisao do responsavel: FASE 12 permanece apenas PLANEJADA/BLOQUEADA. Nem achados P0 nem conclusao de fases previas autorizam iniciar, atribuir agente, criar PR de implementacao, executar migrations, RLS/grants/policies, mexer em storage/Auth/Edge Functions ou mudar status.
- [ ] **Liberacao obrigatoria:** receber nova solicitacao explicita do responsavel para INICIAR A FASE 12. Mesmo depois disso, alteracoes remotas/irreversiveis requerem autorizacao propria, PRD, testes, QA e revisao de conflitos.
- [x] Investigar metadados e codigo em read-only fora da execucao da FASE 12 e permitido; levantamento nao equivale a iniciar a fase nem a aprovar achados.

### Auditoria preparatoria complementar da aplicacao e banco (somente leitura)

- [x] Policies de `storage.objects` para `visitas-consultor-fotos` autorizam SELECT/INSERT/UPDATE/DELETE por `bucket_id` para qualquer authenticated; `logos-consultor` e `syncvet-medicamentos` tambem tem policies amplas sem vinculo de proprietario no predicado. Exige revisao por identidade/tenant.
- [x] Das 9 views public, 8 nao declaram `security_invoker=true`; todas possuem grant SELECT para anon. Alcance via API/tenant nao foi testado.
- [x] `GerentesPage.tsx` e `CapatazesPage.tsx` trocam todos os vinculos com DELETE seguido de INSERT em chamadas separadas: planejar atomicidade e rollback; ha exclusao fisica de cadastros.
- [x] Onboarding/reset de gerente/capataz usa senha predefinida no codigo; planejar convite/recuperacao com credencial unica e troca obrigatoria, sem revelar a senha no checklist.
- [x] API Bun atual documenta so health/readiness/OpenAPI/docs e nega rotas administrativas ate auth ser implementada; nenhuma integracao remota da nova arquitetura foi executada.
- [x] Consultoria faz leituras de dados por ID sem predicado de consultor no frontend; IndexedDB legado usa chave por visita e nao evidencia isolamento por tenant/conta no schema; testar backend, JWT, rotas, troca de sessao, cache offline e revogacao.
- [x] Consultas agregadas read-only: 0 referencias orfas entre retiro/fazenda, pasto/retiro, fazenda_consultor/consultor e gerente_fazenda/fazenda; 0 divergencias de vinculo principal nos grupos consultados. Nao generalizar para toda a base.
- [ ] Backlog futuro adicional: transacoes atomicas, soft-delete com historico, restauracao, governanca de senha, limites/rate limiting de fluxos publicos, policies de storage, isolamento de offline, observabilidade, backup/restore e regressao por papel/tenant.
- [ ] Todos os achados permanecem para futuro estudo/implementacao **somente quando a fase pertinente for explicitamente autorizada**. Nao marcar QA/FASE 12 como iniciado.

## FASE 13 - continuidade offline, migracao sem perda e preservacao (PLANEJADA / BLOQUEADA)

- [x] FASE 13 detalhada no Notion: https://app.notion.com/p/3f98e0bd0f4d81ec9208dd80c7fd85d4
- [x] Dossie de planejamento no repo: `docs/69-fase13-offline-migracao-preservacao-planejamento.md`. Registro nao constitui execucao nem PRD de implementacao liberado.
- [ ] **Gate FASE 12:** a FASE 12 continua PLANEJADA e NAO INICIA sem NOVA autorizacao explicita do responsavel; revisao/read-only nao equivale a iniciar.
- [ ] **Gate FASE 13:** somente pode INICIAR APOS encerramento e QA APROVADO da FASE 12 e nova autorizacao especifica de execucao. Conclusao da FASE 12 nao inicia automaticamente a FASE 13.
- [ ] **PRESERVACAO ABSOLUTA NESTE PLANEJAMENTO:** NAO apagar fotos, documentos, arquivos Storage, historicos, Auth, registros PostgreSQL, dados locais, IndexedDB/localStorage, backup, filas, ACKs ou tombstones. NAO criar prazo de validade/TTL, campo expires_at/delete_after, limite de retencao, lifecycle, expurgo, job de exclusao ou desativar dados. A antiga sugestao de 90 dias NAO foi aprovada.
- [ ] Verificar em leitura a rotina preexistente `limpar-fotos-diario` e a funcao `limpar_fotos_antigas()`, atualmente ativas no Supabase e relacionadas a limpeza de referencias; esta auditoria NAO interrompeu nem alterou a rotina. Qualquer mudanca exige autorizacao remota especifica.
- [ ] **FASE 7 NAO DEVE ESPERAR FASE 13:** finalizar por trabalho ja atribuido a persistencia duravel local (sem sucesso falso), autosync em reconexao, fila por tenant/user/device, idempotencia, ACK/retentativas, fotos, migracao das seis bases existentes e QA integrado. Evitar tarefa duplicada com PR #43 e agentes ativos.
- [ ] **FASE 8 permanece gate remoto:** inventariar e mapear schema PostgreSQL/relacionamentos, Auth, Storage fisico, arquivos base64, historiais e filas de aparelhos; fazer provas de reconciliacao e restauracao local/staging isolado autorizado, sem novo backend conectado ao Supabase produtivo agora.
- [ ] **Recomendacao de cutover:** manter app legado operacional e sua base atual; projetar schema/camadas seguras atras da API Bun, testar sem escrita dupla de saldo/estoque/pesagem/transferencias, migrar com IDs e checksums, rollback demonstrado. SOMENTE conectar nova API, mudar trafego ou desligar app atual com gates das FASES 5-9/12, QA e autorizacao externa expressa.
- [ ] Evidencia de QA futura: cliente iOS/Android rural, sem internet prolongada, reconexao, travamento, multiaba, troca de conta/tenant, falta de armazenamento, service worker, foto Blob, duplicacao, conflito, backup/restore, contagens/saldos e todas as filas migradas.
- [ ] Nenhuma configuracao de expiracao nem exclusao permitida apenas por este checklist; politica futura de descarte de imagens exige nova decisao separada e justificativa de dados/historico, sem prazos presumidos.

**Convivencia:** nao redesenhar FASE 7/8 ou reatribuir trabalho sem consultar Notion vivo; preservar `main`, PR #43 draft e stashes. Nenhum SQL, migration, RLS/grant, auth/storage/cron, deploy ou programa remoto alterado pela criacao deste plano.
