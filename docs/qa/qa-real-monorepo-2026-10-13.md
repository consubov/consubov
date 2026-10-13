# QA real do monorepo — Codespace CONSUBOV — 2026-10-13

**Repositorio unico:** `mmatteuus/consubov` | **Codigo validado:** `396bf2ff8411a47343e517683c168891c1b99f7b` | **branch:** `work/fase5-6-7-pwa-local` | **PR:** #43 draft. Worktree observado como `dirty=false` nos relatórios abaixo. O Codespace é `special garbanzo`. Esta e evidencia de **gates locais**, nao de producao ou de aceite integral de fases.

## Gates com saida e exit realmente observados

| Comando | Prova / resultado | Evidencia local nao versionada |
|---|---|---|
| `task doctor` | PASS exit 0; Bash, Git, Node, Bun 1.4.0, Task 3.54.0 | Saida de terminal |
| `task qa:check` | **PASS exit 0**, checkout `396bf2ff8411a47343e517683c168891c1b99f7b` com `workingTreeDirty:false`. Typecheck API/Web, builds API/Web, **Web 171/171 (42 arquivos)**, **API 539/539 (77 arquivos)**. Run Turbo cache de resultados verificados localmente; nao afirmar que houve nova compilacao de cada modulo nesta repeticao | `.qa/runs/20261013T190510Z-check-396bf2ff8411-6289/result.json` |
| `task qa:offline:core` | **61/61 PASS, exit 0**, IndexedDB/atomic queue e sincronizacao offline | `.qa/runs/20261013T191148Z-offline-core-396bf2ff8411-11746/result.json` |
| `task qa:pwa:smoke` | **25/25 PASS, exit 0**, Service Worker, consentimento e integridade | `.qa/runs/20261013T191216Z-pwa-smoke-396bf2ff8411-12023/result.json` |
| `task qa:phase5:contracts` | **10/10 PASS, exit 0**, fixtures/contratos estaticos; nao e E2E completo | `.qa/runs/20261013T191237Z-phase5-contracts-396bf2ff8411-12246/result.json` |
| `task qa:preprod:rehearsal` | **26/26 PASS, exit 0**, reconciliation/restore em JSON sintetico; nao e migracao de banco real | `.qa/runs/20261013T191309Z-local-rehearsal-396bf2ff8411-12506/result.json` |
| `task qa:offline:browser` | **22/22 PASS, exit 0**: 11 Chromium + 11 WebKit, incluindo duas abas, Blob/ArrayBuffer, tenant/user, idempotencia, ACK e conflitos | `.qa/runs/20261013T191342Z-offline-browser-396bf2ff8411-12859/result.json` |
| `task qa:pwa:build-preflight` | **PASS exit 0**, 349 assets no build e 349 cobertos pelo precache, sem chunks ausentes | `.qa/runs/20261013T191549Z-pwa-build-396bf2ff8411-16238/result.json` |

**Nota historica:** `task qa:regressions` passou com 191/191 no commit `e0f66b0c` limpo, nao foi repetido no mesmo `396bf2ff8411a47343e517683c168891c1b99f7b`. O unico codigo alterado entre estes SHAs foi tipagem do teste GPS, mas o resultado antigo NAO deve ser reetiquetado como evidência do SHA novo.

## Gate de release / escopo que permanecem pendentes

- `task qa:preprod:local-gates` **NAO APROVADO**. Foi chamado; o processo de terminal foi encerrado com codigo de saida 201 e a saida completa nao ficou disponivel. O codigo `scripts/qa/check-preprod-local-gates.mjs` exige explicitamente `QA_MATRIX_REPORT` e evidencias PASS de `qa:phase5`, `qa:phase6` e `qa:phase7` no mesmo SHA, alem de `sourceUnchanged` e `finalCommit`. Nao deduzir a causa exata do exit somente do script.
- `task qa:phase5` integral, `qa:phase6`, `qa:phase7`, `qa:matrix`, browser PWA upgrade fixture (nao executado), Lighthouse e a11y final: **PENDENTES**. A falta de gate e propositalmente fail-closed, nao autoriza release.
- Testes de GPS/QR em aparelho real, tenant/RLS/RBAC em backend autorizado, migracao de seis bancos reais e estrategia de rollback ainda **PENDENTES**.
- Nao conectar DB remoto/Supabase, nao executar migrations, deploy, Vercel, CI hospedado, rotacao de secrets ou merge na `main`.

## Continuidade segura

Os comandos acima utilizaram a mesma arvore limpa do code SHA `396bf2ff8411a47343e517683c168891c1b99f7b`, sem mudancas em UI ou comportamento de runtime. Os tres stashes anteriores permaneceram guardados, e foi acrescentado um quarto stash identificado como `consubov-gps-test-typecheck-before-ff-20261013`, contendo copia do diff de teste ja publicado. Nao eliminar backups automaticamente. Reavaliar `git status` / HEAD e criterios no PRD antes do proximo lote.

O relatorio anterior de correção TS2322 esta em [gps-provider-typecheck-2026-10-13.md](./gps-provider-typecheck-2026-10-13.md). QA de fases nao e sinonimo de readiness de producao.

## Evidencias posteriores em SHA documental `f15fa4bc` (2026-10-13)

- O Codespace `special garbanzo` estava com checkout limpo no SHA `f15fa4bc3725e8de9c089b01e4edf9ed1dff7a75`; quatro stashes permanecem preservados.
- `task qa:regressions`: **191/191 PASS, exit 0**; `.qa/runs/20261013T192749Z-regressions-f15fa4bc3725-22980/result.json`.
- `task qa:pwa:upgrade-fixture`: **34/34 PASS, exit 0**, Chromium/WebKit; `.qa/runs/20261013T192834Z-pwa-upgrade-fixture-f15fa4bc3725-24443/result.json`. Os testes examinam upgrade em fixture, nao migracao real com dados de clientes.
- `task qa:phase5` nao iniciou por bloqueio da ferramenta Browser-MTS; gates de FASES 5–7, matrix/Lighthouse/Axe e homologacao fisica seguem pendentes.
- Proximo executor local: seguir `instructions/active/HANDOFF-CODEX-LOCAL-FASES5-9-2026-10-13.md`; testes atuais continuam associados a seus SHAs, nunca ao novo commit documental sem reexecutar.
