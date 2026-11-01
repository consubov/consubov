# CONSUBOV — Reconciliacao segura da PR #103 via VPS (31/10/2026)

## Escopo aprovado
- Recuperar apenas a melhoria original da PR #103: nomes de imagens de landing com `crypto.randomUUID()` em vez de `Math.random()`.
- Consolidar as 15 correcoes de baseline QA ja preparadas no worktree isolado `consubov-qa-fix-20261031` e os quatro ajustes de fixtures/classificacao da segunda worktree, com autoria/proveniencia rastreada. **Nao sobrescrever nenhum desses worktrees.**
- Adicionar teste Vitest direcionado de dois arquivos, UUID independente e retorno de erro Storage; manter os testes PWA, seguranca e regressao estritos.
- Reconciliar a PR #103, cujo HEAD de Jules `97f233a...` trouxe 115 arquivos no diff, usando merge commit de estado com base main verificada e sem force-push, e so entao squash merge do diff minimo aprovado.

## Fora de escopo / proibicoes
- Nao incorporar alteracoes de PWA/bun.lock/workflows da PR #103 original que nao tenham sido aprovadas em QA local.
- Nao tocar nas PRs #107, #76 ou nos worktrees em andamento de outros agentes.
- Nao alterar `releases/*`, APP_VERSION, ambiente Vercel, dominio, secrets, banco remoto, RLS, migrations ou dados reais. Nao rodar CI GitHub como gate de decisao (pedido do responsavel).
- Nao forcar push, reescrever o historico do owner nem excluir branches.

## Criterios de aceite e QA independente
- [ ] Diff final da PR contra `main` contem somente os arquivos revisados e documentacao; nenhuma remocao de workflows, SW publico ou arquivo de release.
- [ ] `bun install --frozen-lockfile --ignore-scripts`, TypeScript, build, Vitest Web/API, lint global e lint dos arquivos alterados PASS.
- [ ] Teste UUID, erro Storage, coverage baseline, bundle budget, dist secrets PASS.
- [ ] Suites PWA SW, offline, regression Node e scanner de seguranca local PASS sem reduzir validacao; registrar achados agregados sem dados sensiveis.
- [ ] Playwright real Chromium desktop, tablet e mobile com fixtures localhost e ambiente isolado; Axe/Lighthouse/Edge/API smoke conforme disponivel e originalidade de logs.
- [ ] Revalidar HEAD remoto da PR, SHA da main e ausencia de outros autores concorrentes imediatamente antes do push/merge; parar se divergirem.

## Git, documentacao e QA
- Trabalho via worktree novo, commits e push fast-forward somente sob guarda de SHA; preferir squash no merge para evitar introduzir commits historicos inseguros.
- Atualizar Obsidian, Checklist Mestre Notion e Handoff Vivo com SHA, comando de QA, PASS/FAIL/NAO EXECUTADO e estado de PR.
- Reportar tambem riscos: PWA instalada fisica e tenant JWT A/B reais seguem pendentes do responsavel; fixture local nao comprova producao.

## Relatorio de QA local — execucao em /srv/workspaces/consubov-pr103-merge-ready-20261031
**Base fonte:** main `5fc806090e0ebdda290859a388dcb85dcf83f95a`; Bun 1.4.0, Node 24.19.0 isolado. Evidencia capturada exclusivamente por VPS_MTS, SEM usar Github CI como oraculo.

| Gate | Evidencia real | Resultado |
|---|---|---|
| Frozen dependencies | `bun install --frozen-lockfile --ignore-scripts` 749 packages | PASS |
| TypeScript + build + suites | `bun run check`: 309/309 Web e 555/555 API (79 files) | PASS |
| UUID upload e erro Storage | `imageUploadUuid.test.tsx` 2/2 com mock de storage local | PASS |
| Lint global | `bun run lint`: 0 erros, 1218 avisos historicos | PASS com avisos |
| Offline core + inventory | Go Task: 61/61 + 11/11 | PASS |
| SW PWA integridade | Go Task: 32/32 | PASS |
| QA historica | `task qa:regressions`: 477/477, `sourceUnchanged=true`, exit0 | PASS |
| Scanner local | 4 estadios PASS; api0/web0/source1/history2 achados agregados; nenhuma conclusao de risco zero | PASS com ressalva |
| Web build budget + secretos em dist | raw 8.752.529 B, gzip 2.753.590 B, dentro da politica; `check:dist-secrets` | PASS |
| Coverage baseline | 437/437 arquivos, statements 7.44%, lines 8.24%, piso vigente sem regressao | PASS |
| E2E Chromium real VPS | 180/180 desktop/tablet/mobile, fixtures http localhost:54321, porta Web isolada 8098 | PASS |
| Edge Functions | 122/122 Vitest (9 arquivos), sem banco remoto | PASS |
| API smoke HTTP | 5/5 contratos em localhost:3111, sem servico de producao | PASS |
| Contratos FASE5 | 10/10 | PASS |
| PWA build-preflight | 342/342 assets + precache | PASS |
| `git diff --check` | sem erros de whitespace | PASS |

**Nota de rastreio:** a primeira chamada de regressao teve todos os 477 testes verdes, mas a captura terminou NO-GO porque o config temporario do navegador foi removido antes da captura final (`sourceUnchanged=false`). A repeticao, sem editar o codigo, encerrou `sourceUnchanged=true`, `exitCode=0` e 477/477 PASS. O primeiro comando Edge foi montado com caminho duplicado de config, corrigido usando a instrução nativa do projeto (`cd supabase/functions; node ../../node_modules/vitest/vitest.mjs run`) e 122/122 PASS. O scanner inicialmente nao encontrava Gitleaks nesse worktree; copiada somente a ferramenta aprovada da propria VPS e SHA-256 conferido contra o hash fixo da policy antes de rodar PASS.

## Evidencia de autoria e concorrencia
- Os 15 arquivos QA inicialmente vieram da branch LOCAL separada `fix/platform/qa-baseline-lint-sw-20261031`, sem tocar nesse workspace. Patches adicionais de fixtures PWA/classificacao foram conferidos no worktree anterior `consubov-pr103-safe-20261031` e transferidos para este worktree novo, igualmente sem sobrescrever origem. A correcao `activationInFlight` em SW faz parte apenas do trabalho consolidado validado; teste de SW verificou idempotencia, fail-closed, consentimento e update concorrente.
- PR #107 excluida pelo pedido do responsavel. PR #76 F12 em outro owner possui **zero caminhos comuns** com a conciliacao. Nao houve alteracao de banco remoto, PWA instalada ou endpoints de producao.
- A PR #103 original com 115 arquivos divergentes sera reconciliada por commit com dois pais (HEAD antigo e main exata) com arvore revisada; somente **squash** autorizado para a main. O SHA original sera preservado no historico do ramo, sem force push. Caso o owner mude o HEAD antes do update, ABORTAR sem substituir trabalho.

## Limites de cobertura restantes
- 1218 avisos ESLint de baseline ainda existentes. A cobertura geral do codigo eh baixa (7.44% statements), porem o gate de nao regressao vigente passou: nao interpretar como 100% cobertura.
- Hardware/campo PWA instalada real, credenciais JWT de dois tenants e real-world rollback NAO EXECUTADOS: seguem sob responsabilidade do usuario conforme decisao previa; testes locais sao sinteticos e isolados.
- Nenhum deploy manual, alias custom, SQL/migration, secret ou configuracao de Vercel e parte desse patch. F23 vai bloquear publicacao automatica porque releases/* nao foi alterado.
