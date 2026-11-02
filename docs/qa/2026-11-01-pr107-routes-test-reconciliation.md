# PR #107 — reconciliacao dos testes de getRoute (01/11/2026)

## Objetivo e origem

Integrar somente os 5 testes de `getRoute` propostos na PR original #107, preservando o arquivo exato `apps/api/src/routes.test.ts` (blob `2b46f616f472ae5cbbafc9fc44f70402fa450d57`) sobre o HEAD atual da main. O QA de outubro era de uma main antiga; os worktrees do outro agente apresentam modificacoes nao commitadas e nao devem ser editados.

## Escopo, invariantes e exclusoes

- Escopo: `apps/api/src/routes.test.ts` original com caminho valido, rota inexistente, metodo incorreto e sensibilidade a maiusculas de caminho/metodo; mais esta documentacao QA.
- Nao alterar `routes.ts` ou tabela de rotas, contratos da API, permissao/tenant, entradas de frontend, dependencies, lockfile, deploy, versao de app ou dados remotos.
- Confirmar que o arquivo da PR original e identico em bytes ao candidato e ao commit final; nenhuma alteracao de worktrees de outros agentes ou nova implementacao de production.

## Testes e gate QA

- `bun install --frozen-lockfile --ignore-scripts`, testes Bun focados **5/5**, `git diff --check`.
- CI 100% local no Docker VS Code via `scripts/qa/run-ci-vscode-local.sh`: API/Web, typecheck/build, regressões, PWA, offline, contratos, scanner local, F23, budget de bundle, audit HIGH, lint e Playwright Chromium desktop/tablet/mobile com fixtures ficticias localhost.
- So considerar aprovado apos `EXIT=0` de todos os gates no diff atual; reexecutar Bun check no SHA de merge.

## Seguranca e Git

Sem GitHub Actions, push/merge antes do QA, sem overwrite de branches antigos, force push, reset hard, deploy, Vercel, SQL remoto, migracoes, secrets, mudanca em filas offline ou release marker. Relatar resultado observado no Checklist Mestre, no cerebro local quando conector responder e atualizar handoff de continuidade. Este arquivo fixa escopo/criterios, nao representa prova antecipada de QA.
