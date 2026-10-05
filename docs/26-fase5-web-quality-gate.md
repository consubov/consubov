# FASE 5 — Gate de qualidade da Web

> Status em 2026-10-04: **EM ANDAMENTO**.
>
> Branch: `quality/fase5-web-gate-main-20261004`.

## Objetivo
Criar evidência reproduzível de qualidade para a Web/API antes do gate `WEB READY`, sem antecipar infraestrutura remota.

## Gates implementados
- `bun run check` preservado;
- Web expõe `typecheck`;
- Playwright separado de Vitest;
- smoke E2E local cobre login renderizado, rota protegida sem sessão, 404 e landing;
- projetos Chromium desktop/mobile;
- `lint:baseline` mede dívida existente;
- `lint:changed` impede nova dívida nos arquivos alterados;
- `report:bundle` gera baseline bruto/gzip do build;
- CI executa em PRs e mantém Edge tests + smoke HTTP da API.

## Segurança
E2E usa apenas URL/chave locais de teste. Não há credencial real, conexão do novo backend a banco remoto, migration, Vercel ou deploy.

## Pendências comprovadas
- [PENDENTE] contagem exata de dívida lint após execução comprovada;
- [PENDENTE] coverage provider/baseline — não adicionar meta arbitrária;
- [PENDENTE] E2E autenticado dos fluxos de domínio com fixtures controladas;
- [PENDENTE] Lighthouse/Core Web Vitals e orçamento validado;
- [PENDENTE] axe + auditoria manual de teclado/foco/contraste;
- [PENDENTE] homologação responsiva completa de dashboards/tabelas/formulários/mapas/modais/PDFs.

## Critério de fechamento
FASE 5 só fecha com checks verdes, QA aprovado, evidências 5.1–5.10 registradas e critérios 5.11 comprovados. Como a FASE 4 ainda não está reconciliada, este trabalho não declara `WEB READY` por antecipação.
