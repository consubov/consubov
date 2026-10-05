# FASE 5 — Web Quality / WEB READY

> Estado: **EM ANDAMENTO** em 2026-10-05.
> Base: `main@bd9ad453424fa9ad220dca4f55626762a26b87f2`.
> Branch: `quality/fase5-web-ready-20261005`.
> PR: #37 (draft).

## Objetivo
Fechar o gate de qualidade da Web/API sobre a `main` consolidada, sem banco remoto, migrations, Vercel ou deploy.

## Evidência implementada
- `bun run check` segue como gate agregado.
- No último ciclo desta branch que chegou a executar steps, Web teve 129 testes verdes em 34 arquivos; API/Edge/contratos permanecem no pipeline.
- E2E local cobre nove papéis, acesso negado, logout e superfícies críticas de estrutura, QR, nutrição, transferência, visita, fábrica, pesagem e relatórios.
- `lint:baseline` expõe dívida histórica; `lint:changed` impede nova dívida nos arquivos alterados.
- Rotas usam `React.lazy` + `Suspense`.
- Baseline do bundle após route splitting: 8.730.802 bytes raw / 2.735.799 gzip; maior asset 2.849.003 bytes.
- Budget regressivo versionado valida total raw, gzip e maior asset.
- API aplica headers de segurança e possui testes para eles.
- Bundle Web possui guarda contra padrões de segredos administrativos.
- `ConsoleTelemetryAdapter` produz telemetria estruturada e sanitiza campos/strings sensíveis.
- Playwright inclui desktop, tablet Chromium e mobile Chromium; controles críticos do Admin receberam nomes acessíveis.

## Pendências antes de WEB READY
- coverage: obter baseline realmente representativo e ativar gate progressivo sem meta arbitrária;
- axe/Lighthouse/Core Web Vitals: executar baseline atual e corrigir violações bloqueantes;
- revalidar E2E corrigido em desktop/tablet/mobile;
- obter CI e Security Code Scan verdes no HEAD final.

## Bloqueio externo atual
Após um ciclo anterior em que check, lint, coverage, bundle e secret guard chegaram a executar, as execuções mais recentes do GitHub Actions passaram a encerrar antes de iniciar qualquer step, inclusive os três jobs independentes do Security Code Scan. Sem steps/logs de execução, esse estado não é tratado como evidência de falha ou sucesso do código.

## Gate
`WEB READY` permanece **ABERTO** até existir execução reproduzível do HEAD final e `AUDITORIA DE QUALIDADE: QA APROVADO`.
