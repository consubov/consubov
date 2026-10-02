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

### Superfícies da API

A API é organizada em superfícies semânticas para separar o ciclo de vida e o público-alvo:

- `/api/v1/...` (Produto): API principal para consumo da aplicação Web e Mobile.
- `/api/v1/sync/...` (Sincronização): Contratos dedicados a sincronização offline-first.
- `/api/public/v1/...` (Pública): API futura para parceiros e integrações externas (comercial).
- `/api/admin/...` (Administrativa): Endpoints de gerenciamento interno, proibidos para acesso público.

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

## Erros e Correlação

### Envelope de Erro Padronizado

Todas as respostas de erro da API seguem um formato estável e desacoplado da infraestrutura interna:

```json
{
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "Mensagem pública sanitizada e segura",
    "requestId": "req-12345",
    "correlationId": "corr-67890"
  }
}
```

### Rastreabilidade (Headers e IDs)
- `x-request-id`: Identificador único da requisição individual.
- `x-correlation-id`: Identificador de contexto/transação distribuída. Se ausente no request, assume o valor de `requestId` como fallback.
- `trace_id`: Reservado para observabilidade futura (OpenTelemetry/tracing).

### Códigos de Erro Estáveis
- `NOT_FOUND`: Rota ou recurso não encontrado (HTTP 404).
- `UNAUTHORIZED`: Autenticação necessária ou inválida (HTTP 401).
- `INTERNAL_ERROR`: Erro inesperado do servidor (HTTP 500).

### Diretrizes de Segurança
- Stack traces e detalhes de erros internos jamais são enviados para o cliente.
- Nenhuma PII, segredo ou detalhe do provedor é exposto nas mensagens de erro.

