# CONSUBOV - Continuidade operacional

## Gates locais comprovados no Codespace — 2026-10-13

**Codigo funcional no SHA `396bf2ff8411a47343e517683c168891c1b99f7b` validado no unico Codespace CONSUBOV, checkout limpo:** `task doctor` PASS; `task qa:check` PASS (API 539/539, Web 171/171, typecheck e build, `.qa/.../check-396bf2ff8411-6289/result.json` com `workingTreeDirty:false`); `task qa:offline:core` 61/61; `task qa:pwa:smoke` 25/25; `task qa:phase5:contracts` 10/10; `task qa:preprod:rehearsal` 26/26; `task qa:offline:browser` 22/22 em Chromium/WebKit; `task qa:pwa:build-preflight` PASS 349/349 assets precache. Resultados com exit 0 registrados individualmente em `docs/qa/qa-real-monorepo-2026-10-13.md`. `task qa:regressions` 191/191 pertence ao SHA anterior `e0f66b0c` (nao reclassificar).

**PENDENTE:** FASES 5–7 completas, local QA matrix, `qa:pwa:upgrade-fixture`, Lighthouse/a11y, seguranca auth/tenant end-to-end, piloto fisico, seis bancos, rollback real, autorizacao de release. `task qa:preprod:local-gates` foi chamado sem evidencia de matriz completa, terminou em erro 201 no terminal; stdout detalhado nao foi recuperado. O script exige `QA_MATRIX_REPORT` explicito e tres fases PASS no mesmo SHA. **Nenhum gate de producao ou aceite integral esta aprovado.**

**Ambiente:** `work/fase5-6-7-pwa-local` (PR #43 draft), `main` intacta, Codespace `special garbanzo` confirmado sincronizado no SHA do codigo. Quatro stashes preservados, incluindo copia da fixture GPS ja publicada. Backup de branch `codespace-probable-acorn-v6vvq9rrvjjgcw6w` deve ser somente revisado, sem exclusao automatica. Nao tocar em MarkMap ou qualquer outro repositorio.


## FASE 6 — desbloqueio real da tipagem do teste GPS — 2026-10-13

Revisao em Codespace real na branch `work/fase5-6-7-pwa-local`: `task doctor` PASS (exit 0), `task qa:regressions` PASS 191/191 (exit 0) no commit `e0f66b0c`. O primeiro `task qa:check` no checkout atualizado `681c9144` FALHOU em `BrowserLocationProvider.test.ts:49`, TS2322: o getter de fixture que lanca excecao inferiu `void` em vez de `Pick<Geolocation, "getCurrentPosition">`. Foi acrescentada somente a anotacao de tipo, sem mudar runtime da PWA.

Verificacoes PRE-PUSH no Codespace, com arvore dirty apenas neste teste: TypeScript da Web `tsc -b --pretty false` PASS; Vitest GPS 12/12 PASS; `task qa:check` PASS com TypeScript (API/Web), build (API/Web) e testes (Web 171/171 em 42 arquivos), exit 0; ESLint especifico do arquivo PASS, exit 0; `git diff --check` sem erros. Blob Git exato da fonte testada: `477952d3743b5048ad07c5afdbca0d8ab0134513`. Todos estes checks foram executados com `dirty=true`; faltam revalidacao no SHA limpo apos publicacao e gates Chromium/WebKit, FASES 5–7 completas. Relatorio: `docs/qa/gps-provider-typecheck-2026-10-13.md`.

O Codespace foi fast-forward por ancestralidade a `681c9144` antes da edicao; tres stashes de trabalhos antigos preservados. Sem merge da main, deploy, backend remoto, secrets ou reconfiguracao de assinatura.


## Retomada dos gates locais e diagnostico Codespace — 2026-10-13

- A GUI do Git no Codespace deixou de indicar os 6 commits atras apos comando `Git: Pull`, mas NAO existe verificacao fresca do SHA do shell. Arvore SCM sem arquivos alterados; tres stashes preexistentes protegidos.
- Browser-MTS/VS Code com `Extension host (Remote) is unresponsive` repetido, timeout WebSocket 30000ms, latencia remota 25584.50ms e clipboard recusado. Tarefa `CONSUBOV: Verificar ambiente` selecionada sem output/exit verificavel; NAO aprovar `task doctor`.
- Container isolado com blob identico ao GitHub `conferenciaOffline.ts` (`f77442eb94dee91b1e7f897942f024b807cbcf44`): Node 10/10 PASS; TS 5.8.3 `noEmit` isolado exit 0. Isto NAO e QA do monorepo.
- Evidencias, bloqueios e ordem de retomada em `docs/qa/codespace-gates-2026-10-13.md`. Corrigir operacao local/rodar gates antes de aceita-la como DEV LOCAL READY.
- O ramo `codespace-probable-acorn-v6vvq9rrvjjgcw6w` permanece exclusivamente como backup exportado do Codespace antigo, nao e nova branch para desenvolvimento; nao apagar enquanto nao for revisado.


## Codespace CONSUBOV — extensao Act/Run desativada neste workspace (2026-10-13)

- Ambiente confirmado no navegador: `/workspaces/consubov`, `origin=https://github.com/mmatteuus/consubov`, branch `work/fase5-6-7-pwa-local`.
- Causa reproduzida dos avisos: extensao instalada `Act/Run - GitHub Actions Visual locally` v2.11.0 tentava encontrar `act` e um runtime de conteiner, embora os gates do projeto sejam Go Task locais e nao dependam dessa extensao.
- Acao REAL no VS Code: pagina da extensao > Mais Acoes de Desabilitar > `Desabilitar (Workspace)` > `Recarregar a Janela`. Nao desinstalada, nao configurado Docker/act e nenhuma alteracao do frontend.
- Verificacao apos reload e ativacao da sessao: status `Nenhum Problema` (0 erros, 0 avisos); `Centro de Notificacoes` mostra `Nao ha novas notificacoes`; terminal nao exibe mais o indicador de ambiente obsoleto. Esta verificacao e apenas do ambiente VS Code, NAO equivale a build/testes funcionais.
- Escopo: somente o Codespace `special garbanzo` do CONSUBOV. Uma recriacao do ambiente pode precisar repetir a desativacao; nao foi alterada configuracao de outras areas, repositorios, contas ou infraestrutura externa.
- Proximo executor: preservar 3 stashes locais, conferir `git status`, fazer fast-forward seguro do HEAD remoto (ultimo HEAD verificado antes deste lote `987902be`) e rodar gates locais planejados sem CI hospedado. Nenhum merge, migracao, banco remoto ou deploy autorizado.


## Ajuste na retomada da mesma conta apos aborto — 2026-10-13

- [x] RED reproduzido em teste Node: ao desmontar/reabrir tela rapidamente, a nova instancia podia compartilhar a promise abortada, deixando item seguinte sem sync.
- [x] Agora a trava registra tambem o AbortSignal da tentativa; requisição da mesma conta com sinal antigo abortado aguarda a finalizacao e abre uma nova rodada. O mesmo usuario com sinal vigente ainda compartilha a mesma promise sem duplicar.
- [x] Testes Node isolados **10/10 PASS**, TypeScript strict/noEmit exit 0, fonte candidata validada por hash Git `f77442eb94dee91b1e7f897942f024b807cbcf44`. Vitest no repositorio ainda nao executado por indisponibilidade do Codespace.
- [ ] Testes integrados e multiabas, RBAC server-side e homologacao; nenhuma fase integral aprovada.


## FASE 7 — isolamento da fila da Conferência por usuário (2026-10-13)

Falha reproduzida: sync podia enviar pendências de outra conta após troca de login. Corrigido com `syncPendingChecklists(userId, signal?)`, filtro por owner, bloqueio sem identidade, serialização por usuário e cleanup com AbortController em `ConferenciaPage`. UI existente preservada. TDD Node: RED 2/3, GREEN 9/9; TypeScript strict isolado PASS. Vitest/check/E2E do monorepo PENDENTES. Segurança por tenant/autorização é do backend, não garantida por este filtro. Ver `docs/qa/conferencia-owner-isolation-2026-10-13.md`.


## Lote independente - fila legada da Conferencia (2026-10-13)

Aprimorado `apps/web/src/lib/conferenciaOffline.ts`: preserva identidade de checklist entre envio/retry, impede a perda de novos itens enquanto ha sync pendente, impede dois flushes sobrepostos no mesmo contexto e nao sobrescreve JSON corrompido. Teste Node isolado RED 3/4, GREEN 5/5, typecheck TS strict isolado exit 0; suite Vitest criada mas nao executada no Codespace. NAO aprovar FASE 7 ou marcar migracao. Ver `docs/qa/conferencia-legacy-sync-2026-10-13.md`.

Browser-MTS apresenta falhas de controle de guia/click apesar de snapshot; console do VS Code registra reads remotos cancelados. Nao ha prova de causa unica ou de conserto do plugin. A extensao Act/Run opcional alerta por falta de Docker/act; o QA usa Go Task. Sem nova conexao remota, deploy, CI hospedado, alteracao no frontend ou banco.


## Lote funcional atual - GPS FASE 6, 2026-10-13

O commit `8a8538c5` publicou provider GPS/browser capability detection, helper de auditoria e testes Vitest, integrando o novo provider somente ao QR da Conferencia. Sem alteracoes de schema, autenticacao, filas, tenant, origem/scope PWA ou conexoes novas com backend remoto. Teste isolado Node RED (7 falhas esperadas), GREEN 12/12; TypeScript estrito isolado PASS. **QA no Codespace / Vitest / Chromium / WebKit / check integral nao executado neste lote**. Nao considerar a FASE 6 pronta. Evidencias e pendencias: `docs/qa/gps-conferencia-local-2026-10-13.md` e `docs/60-browser-capabilities.md`.

O Codespace havia sido atualizado ate `9d9ca5fe` com arvore limpa antes do novo commit funcional; esta publicacao exige novo fast-forward local. Browser-MTS apresentou reconexoes/intermitencia durante a tentativa de revalidacao. PR #43 unico e draft; preservar stashes existentes. Resolucao da falha GPG local continua pendente, sem desativar assinatura.


## Codespace - retomada documental 2026-10-13

Codespace atualizado por fast-forward ate f9611b48. Reaplicado o PRD local: 5 linhas de escopo/aceite GPS da FASE 6. Nenhum codigo funcional implementado neste lote, nem QA integral reexecutado. Os dois stashes existentes foram preservados.

## Ultima verificacao - 2026-10-13

GitHub reconfirmado: restam somente `main` e `work/fase5-6-7-pwa-local`; PR #43 e o unico aberto (draft), ainda sem merge. As branches `quality/fase5-web-ready-20261005` e `feature/phase6-app-shell` foram removidas apos preservar historicos no merge `41a1f9f1` e na revisao publicada `3a529837`. Os textos anteriores sobre exclusao pendente sao historicos.

**Para pull local e agentes:** `docs/68-sincronizacao-local-e-agentes.md`, alem de `AGENTS.md`, Checklist Mestre (Git e Notion) e PRD ativo. `main` nao e a branch de desenvolvimento; nao puxar apenas `main` esperando a evolucao da PWA.

**Codespace (PENDENTE):** ultimo snapshot mostrou 1 modificacao nao commitada no PRD de capacidades/GPS e checkout 52 commits atras do remoto; tentativas de comandar o terminal nao forneceram prova de execucao. Nao houve confirmacao de stash, sincronizacao ou commit desse arquivo. Proteger o diff local antes de atualizar.

**QA:** alteracoes desta organizacao sao documentais; nao indicam novo PASS de API/Web/PWA/E2E. FASES 5-7 ainda sem aceite integral, 8/9 preparacao local, 11 planejada; sem deploy, migrations, remote DB, CI hospedado ou merge.

## Reconciliacao dos ramos - 2026-10-13

Este estado substitui os avisos de divergencia anteriores, sem aprovar fases nem mudar a arquitetura. Repositorio: `mmatteuus/consubov`. Branch unica de desenvolvimento: `work/fase5-6-7-pwa-local`. PR canonico: #43, ainda draft. A `main` nao foi alterada.

A integracao `41a1f9f1a3728a3f4cf393c6520587bd45cab3a0` tem como primeiro pai `b9ecba3d1b7fed02a21cfc01e340b8b8e0ac4c2c` e preserva como pais os tres historicos: `main` em `161cf184cbf6f36018dd497d42787883bb2cf850`, `quality/fase5-web-ready-20261005` em `d314db58a2c3d455974bc53a4847f2b875da8f01` e `feature/phase6-app-shell` em `dc41ceab49f3624eb63defea1859db7d58d3568b`. Sao 50 commits anteriores recuperados na ancestralidade, sem rebase, squash ou force-push.

Resolucao deliberada: conservar Web/API, PWA e IndexedDB da linha evoluida; nao reativar Capacitor/SQLite, gates antigos ou declaracoes antigas de fases aprovadas. O historico nativo continua recuperavel por SHA. Recuperada a direcao PWA documental do ramo antigo e incorporado o ignore de novos ZIPs. Isso e integracao de historico com resolucao seletiva, nao ativacao de todo codigo experimental.

## Leia antes de continuar

1. `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`, `AGENTS.md` e `docs/README.md`.
2. `CONSUBOV_CHECKLIST_MESTRE.md` e Checklist Mestre ao vivo no Notion: `3ec8e0bd-0f4d-816d-9bb5-d807e8e2cdc9`.
3. PRD unico: `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`.
4. Relatorio desta integracao: `docs/qa/git-branch-reconciliation-2026-10-13.md`.
5. Detalhes funcionais e evidencias anteriores: `docs/archive/HANDOFF_antes_reconciliacao_ramos_2026-10-13.md`, copia integral do blob `4b939657d86267ff0a6d5811d42c71894341d3a8`. Nenhum detalhe anterior foi descartado.

## Estado funcional preservado

FASES 0-4: fechamento historico, nao revalidado aqui. FASES 5-7: aceite integral pendente. Ultima revisao de codigo funcional: `b9ecba3d`; testes API/Web/PWA/E2E nao foram repetidos nesta integracao Git. As contagens antigas permanecem historicas, nao sao QA fresco deste commit.

FASE 6: capacidades passivas e GPS tolerante a falhas da Conferencia estavam em andamento; o ultimo estado local conhecido era somente acrescimo no PRD. Nao declarar implementacao entregue sem conferir arquivos/testes. FASE 7: fila/adapters existentes; migracao legada, sync autenticado, ordem causal e anexos continuam pendentes. FASES 8/9: ensaios locais e preparacao; nenhum remoto autorizado. FASE 11: planejamento em `docs/67-fase11-perfis-auditoria-prd.md`, sem implementacao ou novas permissoes aprovadas.

Lighthouse e homologacao fisica nao aprovados. Pendencias fisicas nao bloqueiam trabalho local independente; integridade, autorizacao, tenant e preservacao offline continuam obrigatorias.

## Limpeza e ambiente

As duas branches historicas foram EXCLUIDAS no GitHub nesta data, apos preservar seus snapshots na ancestralidade da branch ativa. `main` e a branch de trabalho permaneceram; o PR #43 continua draft. Nao apagar refs, stashes ou worktrees adicionais automaticamente.

O Codespace respondeu a snapshots, mas os comandos de terminal via Browser-MTS nao tiveram resultado executado verificavel. O ultimo estado comprovado pelo painel continua: PRD com mudancas locais e checkout atras do remoto. Prioridade operacional: revisar/preservar esse diff, aplicar fast-forward sem reset, validar SHA e so entao retomar novas tarefas.

Relatorio de operacao: `docs/qa/git-branch-reconciliation-2026-10-13.md`; runbook: `docs/68-sincronizacao-local-e-agentes.md`. Atualizar tambem Fontes do Projeto com este handoff quando possivel. Sem alteracoes de aplicacao, CI hospedado, banco remoto, deploy ou aprovacao de producao.
