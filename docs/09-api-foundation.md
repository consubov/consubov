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

## Superfícies da API e Inventário Central (FASE 2A.1)

A API define formalmente quatro superfícies semânticas em `apps/api/src/routes.ts`:
1. `/api/v1/...` — Produto
2. `/api/v1/sync/...` — Contratos de sincronização futura
3. `/api/public/v1/...` — API pública futura para parceiros
4. `/api/admin/...` — Endpoints administrativos

### Política de Endpoints Administrativos
- **Autenticação obrigatória**: Deny-by-default para qualquer endpoint administrativo ou interno (`surface: "admin"` ou `internal: true`).
- **Autorização server-side** e **tenant/escopo explícito**.
- Stack traces e segredos nunca são expostos.

## Request ID e Correlation ID

Cada requisição recebe um identificador de requisição individual exposto no header `x-request-id` e um identificador de correlação exposto/recebido via `x-correlation-id`.

- **`request_id` (`x-request-id`)**:
  - Identifica uma requisição HTTP individual.
  - Sempre gerado ou preservado (quando fornecido e válido, até 128 caracteres).
  - Nunca reutiliza ID inválido ou vazio enviado pelo cliente.
  - Retornado no header da resposta e no envelope de erro.

- **`correlation_id` (`x-correlation-id`)**:
  - Conecta múltiplas operações ou chamadas relacionadas.
  - Se o header `x-correlation-id` for enviado e válido, é preservado separadamente.
  - Não substitui automaticamente o `request_id`.
  - Política de fallback: se ausente, utiliza o `request_id` como fallback interno, garantindo rastreabilidade consistente em logs e respostas.

- **`trace_id` (Futuro)**:
  - Preparado conceitualmente para futura integração com ferramentas de rastreamento distribuído (sem acoplamento ou SDK nesta fase).

## Erros

Erros públicos usam um envelope estável e padronizado:

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

### Códigos de erro estáveis atuais
- `NOT_FOUND` (404)
- `UNAUTHORIZED` (401)
- `INTERNAL_ERROR` (500)

### Regras de segurança de erros
- Stack traces nunca são expostos em respostas HTTP (ficam restritos aos logs do processo).
- Segredos, tokens, queries e PII nunca são serializados em mensagens ou logs de erro.


## OpenAPI e documentação

`/api/v1/openapi.json` é o contrato formal e obrigatório da superfície implementada.
- **Versão**: OpenAPI 3.1.0.
- **Geração de Tipos**: Schemas centralizados sob `components/schemas` viabilizam a futura geração de clientes TypeScript fortemente tipados via ferramentas como `openapi-typescript` ou `kubb`.

### Checklist Mínimo para Novas Rotas (FASE 2A.2)
Ao adicionar qualquer novo endpoint, certifique-se de:
1. **Registrar no Inventário Central**: Adicionar a entrada correspondente em `apps/api/src/routes.ts`.
2. **Documentar no OpenAPI**: Mapear o `path`, `method`, `summary`, headers (`x-request-id`), schema de request/response e possíveis códigos de erro (ex: `ApiError`) em `apps/api/src/openapi.ts`.
3. **Autenticação & Tenant**: Declarar explicitamente exigência de auth/tenant e scopes necessários quando aplicável.
4. **Validar Anti-Divergência**: Executar a suíte de testes (`bun test`) para garantir que o teste de divergência `routes <-> openapi` passe com sucesso.

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
