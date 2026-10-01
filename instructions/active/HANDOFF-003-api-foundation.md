# HANDOFF-003 — Fundação local da API

## PRD relacionado

`PRD-003-api-foundation.md`

## Branch

`feat/api-foundation`

## Estado atual

Implementação concluída e validada no PR #11. Aguardando apenas encerramento/merge da fase.

## Restrições preservadas

- nenhum Supabase remoto conectado;
- nenhum banco conectado;
- nenhuma migration executada;
- Vercel não configurado;
- nenhum arquivo funcional de `apps/web` alterado;
- nenhuma regra de negócio adicionada;
- nenhum `packages/` vazio criado.

## Dependências e decisão

Nenhuma dependência de runtime foi adicionada.

A fundação usa servidor HTTP nativo do Bun + APIs Web padrão. Isso atende a superfície atual com menor dependência. Framework poderá ser introduzido quando rotas de domínio, validação compartilhada ou middleware justificarem.

O lint da API usa o TypeScript já instalado no workspace, sem alterar `bun.lock`.

## Estrutura

```text
apps/api/
├── README.md
├── package.json
├── tsconfig.json
└── src/
    ├── app.ts
    ├── app.test.ts
    ├── docs.ts
    ├── http.ts
    ├── index.ts
    └── openapi.ts
```

## Contratos

- `GET /api/v1/health` → `200 {"status":"ok"}`;
- `GET /api/v1/readiness` → `200 {"status":"ready"}`;
- `GET /api/v1/openapi.json` → OpenAPI 3.1;
- `GET /api/docs` → documentação baseada no OpenAPI;
- rotas inexistentes → erro `NOT_FOUND` padronizado;
- toda resposta inclui `x-request-id`.

## Resultado do CI

Workflow do PR #11 concluído com sucesso.

- instalação: `bun install --frozen-lockfile` — OK, 1272 packages;
- API lint/typecheck: `bunx tsc --noEmit --project tsconfig.json` — OK;
- build: 2/2 workspaces — OK;
- bundle API: 9.28 KB + source map;
- smoke HTTP real — OK para health, readiness, OpenAPI, docs e 404;
- testes API: 6/6 — OK;
- testes web: 36/36 — OK;
- total Turbo test: 2/2 tasks — OK.

## Auditoria do diff

Arquivos funcionais de `apps/web`: nenhum alterado.

Mudanças limitadas a:

- `apps/api/**`;
- CI para lint/smoke da API;
- devcontainer para expor a porta 3000;
- README/documentação;
- PRD/handoff desta fase.

## Warnings fora do escopo

O build do web reporta warnings existentes no código atual:

- uso de `eval` em `ConfiguracoesGeraisPage.tsx`;
- chunk principal acima do limite recomendado;
- módulos com import dinâmico e estático simultaneamente;
- `actions/checkout@v4` gera aviso de runtime Node legado no GitHub Actions.

Nenhum desses warnings foi introduzido pela API e eles não quebram o CI.

## Próximo passo

Após merge:

1. encerrar a issue #3;
2. remover branch temporária quando possível;
3. iniciar PRD separado para contratos de autenticação/autorização/tenancy, ainda sem banco remoto.
