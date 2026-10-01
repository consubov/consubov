# PRD-003 — Fundação local da API

## Status

`IN_REVIEW`

## Objetivo

Transformar `apps/api` de scaffold em uma API local real, testável e documentada, sem conectar Supabase remoto, banco de dados ou Vercel.

## Contexto

A arquitetura permanente define REST versionado em `/api/v1`, OpenAPI como contrato e documentação em `/api/docs`. A implementação deve ser mínima, incremental e preparada para evoluir como monólito modular.

## Restrições obrigatórias

- não conectar Supabase remoto;
- não executar migrations;
- não configurar Vercel;
- não alterar a aplicação web;
- não alterar autenticação existente;
- não inventar regras de negócio;
- não criar módulos de domínio vazios;
- não criar abstrações especulativas;
- não fazer merge sem CI e revisão.

## Escopo

### Incluído

- runtime real em `apps/api`;
- endpoint `GET /api/v1/health`;
- endpoint `GET /api/v1/readiness`;
- endpoint `GET /api/v1/openapi.json`;
- documentação navegável em `GET /api/docs`;
- resposta de erro HTTP padronizada;
- request/correlation id por requisição;
- testes automatizados da API;
- scripts reais de `dev`, `build`, `test` e `lint`;
- integração correta com o workspace/Turborepo existente;
- documentação técnica da fundação criada.

### Fora de escopo

- persistência;
- Supabase/PostgreSQL;
- autenticação/autorização real;
- tenancy persistida;
- endpoints de fazendas/animais/pesagens;
- webhooks;
- filas/workers;
- deploy.

## Critérios de aceite

- [x] `bun install --frozen-lockfile` funciona;
- [x] `bun run build` passa no monorepo;
- [x] `bun run test` passa no monorepo;
- [x] scripts da API são reais, sem `echo`;
- [x] nenhum acesso a banco remoto foi adicionado;
- [x] nenhum arquivo funcional do web foi alterado;
- [x] OpenAPI corresponde ao runtime;
- [x] documentação permanente foi atualizada;
- [x] CI do Pull Request está verde;
- [x] smoke HTTP real passa para os contratos implementados.

## Revisão

PR #11. O diff foi auditado e não altera arquivos funcionais de `apps/web`.
