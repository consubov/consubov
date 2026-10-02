# @consubov/api

Fundação local da API do Consubov.

## Estado

Esta aplicação é deliberadamente stateless e ainda não possui integração com banco de dados, Supabase remoto, autenticação real ou deploy.

### Novos Contratos de Integração

A API implementa contratos de extensibilidade definidos na Fase 2A:
- **ApiConsumer**: principals de integração com isolamento de tenant, escopos granulares e credenciais revogáveis/expiráveis.
- **Webhook Subscription**: entrega de eventos com `event_id` estável, idempotência e estratégia de retry/backoff.
- **Internal Event Envelope**: padronização de eventos internos com versionamento via `EventPublisherPort`.
- **Base Integration Adapter**: contrato obrigatório para adapters externos (owner, purpose, auth, etc), mantendo SDKs isolados.

Esta aplicação é deliberadamente stateless e ainda não possui integração com banco de dados, Supabase remoto, autenticação real ou deploy.

## Desenvolvimento

A partir da raiz do monorepo:

```sh
bun install --frozen-lockfile
bun run dev
```

Por padrão a API usa a porta `3000`. Para alterar localmente, defina `PORT`.

## Endpoints atuais

- `GET /api/v1/health`
- `GET /api/v1/readiness`
- `GET /api/v1/openapi.json`
- `GET /api/docs`

Toda resposta inclui `x-request-id`.

## Erros e Rastreabilidade

Erros retornam um envelope padronizado contendo `code`, `message`, `requestId` e `correlationId`:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found",
    "requestId": "...",
    "correlationId": "..."
  }
}
```

- `x-request-id`: rastreia a requisição individual (gerado ou preservado).
- `x-correlation-id`: rastreia a cadeia de correlação (utiliza fallback para `requestId` quando não informado).
- Stack traces e dados sensíveis nunca são expostos nas respostas da API.


## Estrutura de módulos

```text
src/
├── app.ts, http.ts, openapi.ts, docs.ts   # fundação HTTP stateless
├── architecture/                          # regras arquiteturais automatizadas
└── modules/
    ├── index.ts                           # superfície pública (namespaces)
    ├── identity-tenancy/                  # identidade, tenant, escopo, autorização
    ├── farms/  pastures/  livestock/
    ├── nutrition/  feed-mill/  inventory/
    ├── weighing/  visits/  reporting/
    ├── notifications/  files/  sync/
    └── saas-admin/  integrations/
```

Os 15 módulos do ADR-0003 existem porque há contrato, regra pura ou porta real em
cada um. `apps/api/src/modules/index.ts` os expõe como namespace, para que dois
módulos nunca colidam por nome exportado; a API pública de cada módulo é o seu
próprio `index.ts`, e novos consumidores não importam arquivo interno de domínio.

Convenção: `modules/<module>/{domain,application,interfaces/http,platform,integrations}`.
Só existe diretório quando há código real naquela camada — nesta fase só `domain/`,
mais `adapters/` e `infrastructure/`, que contêm apenas dublês em memória para
teste. Regra de dependência: `interfaces/http → application → domain`;
`platform`/`integrations` ficam fora do domínio.
O teste `architecture/layer-rules.test.ts` falha se a regra for violada.

`src/modules/observability/` e `src/shared/` vêm de trabalho anterior a
esta fase e não fazem parte dos 15 módulos; ver `docs/02-arquitetura.md`.

## Segurança local

`src/modules/identity-tenancy/domain/` contém apenas contratos e regras puras:

- contexto autenticado com tenant explícito;
- principal `user` ou `integration`;
- escopos namespaced no formato `recurso:acao`;
- autorização tenant-first;
- porta para verificação futura de credenciais.

Nenhum token, API key, Supabase Auth ou banco é verificado nesta fase.

## Scripts

```sh
bun run dev
bun run build
bun run test
bun run typecheck
bun run lint
```

O script `typecheck` usa o TypeScript declarado neste workspace em modo estrito e sem emitir arquivos. `lint` é um alias compatível para essa mesma validação.
