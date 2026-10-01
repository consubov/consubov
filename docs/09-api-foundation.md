# Fundação local da API

## Objetivo

A primeira etapa executável da API existe em `apps/api` sem qualquer dependência de banco de dados ou infraestrutura remota.

## Contratos implementados

```text
GET /api/v1/health
GET /api/v1/readiness
GET /api/v1/openapi.json
GET /api/docs
```

Todos os endpoints são stateless.

## Request ID

Cada requisição recebe um identificador exposto no header `x-request-id`.

Quando o cliente envia `x-request-id` ou `x-correlation-id`, o valor é preservado se for não vazio e tiver no máximo 128 caracteres. Caso contrário, a API gera um UUID.

Erros HTTP incluem o mesmo identificador no corpo para correlação com logs.

## Erros

Erros públicos usam um envelope estável:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found",
    "requestId": "..."
  }
}
```

Stack traces não são enviados para o cliente.

## OpenAPI e documentação

`/api/v1/openapi.json` é o contrato da superfície implementada.

`/api/docs` é uma interface local sem dependências externas que lê esse contrato e lista as operações disponíveis. Uma interface mais sofisticada pode ser adotada depois sem mudar o contrato.

## Dependências

Esta fase não adiciona dependências de runtime. Ela usa apenas APIs Web padrão suportadas pelo Bun.

## Validação da fundação

O Pull Request #11 validou em GitHub Actions:

- Bun 1.3.12 e `bun install --frozen-lockfile`;
- typecheck estrito da API;
- build de `@consubov/api` e `@consubov/web`;
- smoke HTTP real de health, readiness, OpenAPI, docs e 404;
- 6/6 testes da API;
- 36/36 testes existentes do web.

Warnings observados no build do web permanecem fora do escopo desta fundação: uso de `eval` em configuração existente, avisos de chunk grande e imports dinâmicos/estáticos mistos.

## Fora desta fase

- persistência;
- Supabase/PostgreSQL;
- autenticação e autorização;
- tenancy persistida;
- endpoints de domínio;
- Vercel/deploy;
- filas, workers e webhooks.
