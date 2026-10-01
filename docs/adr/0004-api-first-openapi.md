# ADR-0004 — API-first com OpenAPI/Swagger

**Status:** Aceito  
**Data:** 2026-10-01

## Contexto
Web, futuro App, sincronização e integrações precisam consumir contratos consistentes e versionados.

## Decisão
Adotar abordagem **API-first**, com OpenAPI/Swagger como contrato HTTP oficial.

Superfícies previstas:

```text
/api/v1/...              produto Web/App
/api/v1/sync/...         sincronização
/api/public/v1/...       integrações/empresas no futuro
```

Toda rota nova deve ter contrato OpenAPI correspondente.

## Consequências
- Requests, responses e erros devem possuir schemas explícitos.
- Auth, tenant, scopes e idempotência devem ser documentados quando aplicáveis.
- O contrato deve ser validado no CI.
- Deve ser possível gerar clientes/SDKs tipados futuramente.

## Não decidido aqui
- Mecanismo final de autenticação da API pública.
- Política comercial da API pública.
