# CONSUBOV - Checklist Mestre de Execucao

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
