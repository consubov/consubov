# CONSUBOV - Continuidade operacional

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

Remocao das duas refs historicas: PENDENTE, nao executada. Antes de remover, conferir que os SHAs nao avancaram e que todos sao ancestrais da branch de trabalho publicada. Nao excluir `main` nem a branch ativa; nao apagar stashes, worktrees, alteracoes locais ou dados offline.

Browser-MTS retornou `Session terminated`; Desktop Commander sem dispositivos conectados. GitHub acessivel. Nao foi possivel sincronizar nem confirmar o checkout atual do Codespace. Ao reconectar: `git status --short --branch`, conferir SHA/diff/processos, preservar o acrescimo local no PRD e so entao fazer fetch/fast-forward. Nunca resetar para esconder trabalho local.

Sem CI hospedado, deploy, banco remoto, migrations, secrets ou aprovacao de producao. Atualizar as Fontes do Projeto com este handoff quando possivel; este commit atualiza o repositorio, nao o anexo do ChatGPT.
