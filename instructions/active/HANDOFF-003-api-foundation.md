# HANDOFF-003 — Fundação local da API

## PRD relacionado

`PRD-003-api-foundation.md`

## Branch

`feat/api-foundation`

## Estado atual

A fundação local da API foi implementada e aguarda validação do CI/revisão.

## Restrições preservadas

- nenhum Supabase remoto conectado;
- nenhum banco conectado;
- nenhuma migration executada;
- Vercel não configurado;
- nenhum arquivo funcional de `apps/web` alterado;
- nenhuma regra de negócio adicionada;
- nenhum `packages/` vazio criado.

## Dependências

Nenhuma dependência de runtime foi adicionada.

Decisão: usar o servidor HTTP nativo do Bun + APIs Web padrão nesta fundação reduz superfície de dependências e atende completamente aos quatro endpoints atuais. Framework poderá ser introduzido quando rotas de domínio, validação compartilhada ou middleware justificarem o custo.

O lint da API usa o TypeScript já instalado pelo workspace web, sem alterar `bun.lock`.

## Estrutura criada

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
- `GET /api/docs` → documentação navegável gerada do OpenAPI;
- rotas inexistentes → erro `NOT_FOUND` padronizado;
- toda resposta inclui `x-request-id`.

## Decisões

- runtime stateless;
- request id reutiliza `x-request-id` ou `x-correlation-id` válido e gera UUID quando ausente;
- erros internos podem registrar stack apenas em logs do processo;
- stack trace nunca é serializado na resposta;
- documentação não depende de CDN ou serviço externo.

## Validação esperada no CI

O PR deve executar:

1. `bun install --frozen-lockfile`;
2. `cd apps/api && bun run lint`;
3. `bun run build`;
4. `bun run test`.

Após o CI, registrar aqui resultados exatos e SHA final antes do merge.

## Arquivos alterados

- `apps/api/**`;
- `.github/workflows/ci.yml` apenas para validar lint da API;
- `README.md`;
- `docs/README.md`;
- `docs/09-api-foundation.md`;
- este handoff.

Nenhum arquivo funcional de `apps/web` foi alterado.

## Riscos e pendências

- a API ainda não possui autenticação, tenancy ou persistência por decisão de escopo;
- o lint atual da API é typecheck estrito; uma configuração ESLint compartilhada pode ser introduzida futuramente quando existir necessidade real;
- smoke HTTP será validado adicionalmente quando houver executor com processo local persistente; os testes exercitam o mesmo handler Fetch diretamente.
