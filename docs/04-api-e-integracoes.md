# API e integrações

## Objetivo

O Consubov terá uma API própria para uso interno e integrações externas, com contratos estáveis e documentação pública controlada.

## Convenções

- REST inicialmente;
- versionamento explícito;
- OpenAPI como contrato;
- autenticação separada para usuários e integrações;
- autorização por tenant e escopo;
- idempotência em operações críticas.

### Prefixo

```text
/api/v1/
```

Exemplos:

```text
GET  /api/v1/fazendas
GET  /api/v1/animais
POST /api/v1/pesagens
GET  /api/v1/estoque
```

## Documentação

Endpoints previstos:

```text
/api/docs
/api/v1/openapi.json
```

A interface poderá usar Scalar ou ferramenta equivalente sobre OpenAPI, com identidade visual da Consubov.

## Portal Developers

Visão futura:

```text
Consubov Developers
├── Getting Started
├── Authentication
├── API Reference
├── Webhooks
├── Errors
├── Idempotency
└── Examples
```

## Integrações

No futuro, integrações devem ser isoladas do domínio principal. O exemplo abaixo não representa a estrutura atual e não autoriza criar packages sem múltiplos consumidores reais.

```text
packages/integrations/
├── balancas/
├── erp/
├── webhooks/
├── pagamentos/
└── parceiros/
```

## Autenticação de sistemas externos

Não reutilizar senha de usuário.

Prever credenciais próprias de integração e escopos, por exemplo:

```text
fazendas:read
animais:read
animais:write
pesagens:read
pesagens:write
estoque:read
```

## Compatibilidade

Mudanças incompatíveis em contratos públicos exigem nova versão ou estratégia explícita de depreciação.
