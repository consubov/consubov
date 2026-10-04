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

### Modelo `ApiConsumer`

O modelo `ApiConsumer` prepara o principal de integração futura sem publicar um mecanismo externo real.

- tenant é explícito quando aplicável; ausência de tenant nunca concede acesso global automaticamente;
- scopes usam `recurso:acao`;
- status `active | revoked`;
- segredo não é armazenado no contrato, apenas `credentialReference`;
- `expiresAt` permite negar credencial expirada;
- rotação troca a referência opaca sem transportar o segredo;
- auditoria identifica `consumerId`, tenant quando aplicável e origem;
- quota/rate limit podem apontar para política configurável, sem valor numérico inventado.

Mecanismo final de credencial, periodicidade de rotação, quotas e política comercial continuam `[PENDENTE]`.

### Webhooks futuros

O contrato atual é conceitual:

- `eventId` é estável entre retries;
- idempotência usa o par subscription/event;
- assinatura usa somente referência de segredo;
- tentativa de entrega registra metadados sanitizados, nunca payload sensível integral;
- backoff e desativação são políticas abstratas, sem cronograma/limiar inventado;
- não existe dispatcher, broker, DLQ ou provider concreto nesta fase.

### Envelope de evento interno

O envelope em `apps/api/src/shared/domain/events.ts` mantém id, tipo, versão, timestamp, tenant quando aplicável, correlação/causação opcionais e payload. Eventos não substituem autorização/transação e consumidores devem ser idempotentes.

### Contrato base do adapter de integração

Integrações futuras devem declarar owner/finalidade, autenticação, tenant/scope, timeout, retry, idempotência quando aplicável, circuit breaker quando necessário, logs, rate limit, custo, dados enviados/recebidos, indisponibilidade e estratégia de substituição. Valores concretos dependentes de provider permanecem `[PENDENTE]`.

- `rate_limit`: Limites configurados para o provider externo
- `timeout`: Configuração de timeout para chamadas externas
- `circuit_breaker`: Configuração do padrão circuit breaker

#### Regras:
- **SDKs devem ficar nos adapters**: Nenhum SDK de provider externo pode ser importado diretamente pelos módulos de domínio ou application
- **Adaptadores ficam em**: `modules/<dominio>/integrations/` ou `packages/integrations/` quando houver múltiplos consumidores
- **Portas, não implementações**: Adapters implementam portas definidas no domínio (ex: `NotificationSenderPort`)
- **Teste com dublês**: Adapters devem ser testáveis com fakes/mocks sem depender de providers reais
- **Nenhuma lógica de negócio**: Adapters fazem apenas tradução de dados e chamadas de rede; regras de negócio ficam no domínio

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

## Cliente HTTP único do Web (FASE 3.4)

O Web possui uma fronteira única para consumo futuro da API em `apps/web/src/lib/api/`. A criação dessa camada **não** migra automaticamente o legado Supabase para a nova API.

Contrato atual:

- `apiClient`: instância única para novos consumidores;
- `VITE_API_BASE_URL`: base configurável, com default local `http://127.0.0.1:3000`;
- timeout explícito por request, com default técnico local de 10 s;
- `x-correlation-id` propagado quando fornecido;
- `idempotency-key` enviado somente quando o chamador fornece chave;
- erros HTTP usam `ApiClientError` e preservam `code`, `requestId` e `correlationId` quando o envelope da API os contém;
- headers existentes são preservados via `Headers`;
- opções internas (`timeoutMs`, `correlationId`, `idempotencyKey`) não vazam para `fetch`;
- nenhum segredo é embutido no cliente.
- geração automática de tipos/client SDK fica `[PENDENTE]` até existirem endpoints de domínio estáveis consumidos pelo Web; nesta fase o client permanece genérico e tipado por chamada, evitando gerar contrato artificial sobre uma API ainda fundacional.

O guardrail da FASE 3 impede novos imports diretos do client Supabase no Web após o baseline congelado. Fluxos legados existentes são migrados incrementalmente, sempre preservando comportamento, cache, realtime e offline.
