# PRD-003 — Fundação local da API

## Status

`IN_PROGRESS`

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
- validação de variáveis/configuração local quando necessária;
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

## Decisões de implementação

1. Preferir a menor solução Bun/TypeScript que permita:
   - rotas;
   - testes rápidos;
   - OpenAPI;
   - composição modular futura.
2. Framework não está pré-fixado. Se uma dependência nova for necessária, justificar no handoff por que é menor/mais segura que uma implementação manual.
3. Não criar `packages/` nesta fase a menos que exista código realmente compartilhado.
4. A API deve ser stateless.
5. OpenAPI deve refletir exatamente os endpoints implementados.

## Contrato mínimo

### GET /api/v1/health

Resposta 200:

```json
{
  "status": "ok"
}
```

### GET /api/v1/readiness

Sem dependências externas nesta fase. Resposta 200 quando o processo está apto a receber requisições:

```json
{
  "status": "ready"
}
```

### Erros

Formato mínimo:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found",
    "requestId": "..."
  }
}
```

Não expor stack trace em resposta HTTP.

## Testes mínimos

- health retorna 200 e contrato esperado;
- readiness retorna 200 e contrato esperado;
- rota inexistente retorna 404 no formato padronizado;
- OpenAPI retorna JSON válido e contém os endpoints implementados;
- request id existe nas respostas/erros conforme decisão implementada;
- build da API funciona;
- testes existentes do web continuam verdes.

## Critérios de aceite

- [ ] `bun install --frozen-lockfile` funciona;
- [ ] `bun run build` passa no monorepo;
- [ ] `bun run test` passa no monorepo;
- [ ] scripts da API são reais, sem `echo`;
- [ ] nenhum acesso a banco remoto foi adicionado;
- [ ] nenhum arquivo funcional do web foi alterado;
- [ ] OpenAPI corresponde ao runtime;
- [ ] documentação permanente foi atualizada;
- [ ] CI do Pull Request está verde.

## Execução

O executor deve trabalhar somente em `feat/api-foundation`, registrar decisões e comandos no handoff e parar antes do merge para revisão.
