# PR #93 — reconciliacao dos testes de quantidade utilizada (01/11/2026)

## Objetivo e estado anterior

Recuperar exclusivamente os 3 testes originais da PR #93 para `quantidadeUtilizadaPadraoKg`, sem sobrescrever os worktrees pertencentes a outro agente. A PR original foi testada em uma `main` antiga e ficou bloqueada por regressões de infraestrutura do QA, posteriormente corrigidas em outras PRs. Nenhum resultado de QA anterior equivale a aprovacao no SHA corrente.

## Escopo e fora do escopo

- Dentro: `apps/api/src/modules/feed-mill/domain/batida.test.ts` original, blob Git `503693da3b1297e8c25b81372caab7a370113aea`, e esta documentacao.
- Fora: modificar `batida.ts` ou regras de quantidade, banco, calculos de fabrica, UI, lockfile, dependencias, APIs, sync/offline, versao de app, deploy.
- O teste deve cobrir positivo, decimal, zero, null e undefined, sem modificar o comportamento de dominio.

## Criterios de aceite e QA na VPS

- Comparar blobs do novo teste com a PR original e a `main` vigente; nenhum conflito com worktrees de agentes.
- Validar 3/3 testes Bun focalizados e `git diff --check`.
- Rodar no container Docker do VS Code a tarefa `scripts/qa/run-ci-vscode-local.sh`: frozen install, API/Web, regressões, PWA, offline, contratos, security local, F23, bundle budget, audit HIGH, lint changed e Chromium E2E 180 com fixtures ficticias em loopback.
- Se qualquer gate reprovar, corrigir e repetir antes do merge; nao usar GitHub Actions nem credenciais reais.
- Na integracao, usar somente uma PR substituta sobre a main atual, comparar hashes QA/PR/merge, repetir check pos-merge e registrar a PR original como substituida, sem apagar branches historicas.

## Git e restricoes

Sem force push, sem reset hard, nao alterar worktree de outro agente, nao editar release marker nem executar deploy/Vercel/migration/SQL remoto/rotacao de secrets. Preservar tenant isolation e todas as regras existentes. Registrar resultados reais no Checklist Mestre e Cérebro Obsidian quando disponivel. Este documento e um plano de QA, nao e evidencia de execucao.
