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

### Modelo ApiConsumer

O modelo `ApiConsumer` representa um principal de integração com as seguintes características:

- **Isolamento de Tenant**: Cada `ApiConsumer` está associado a um único tenant e não pode acessar dados de outros tenants
- **Escopos**: Permissões granulares no formato `recurso:acao` (ex: `animais:write`)
- **Credenciais**: API keys ou JWTs específicos para integração (não reutilizam credenciais de usuário)
- **Revocação**: Credenciais podem ser revogadas a qualquer momento pelo admin do tenant
- **Expiração**: Credenciais têm validade configurável (padrão: 90 dias) e requerem rotação periódica
- **Auditoria**: Todas as ações são registradas com o `consumerId` para rastreabilidade

### Contrato de Subscription de Webhook

Webhooks são gerenciados através do modelo `WebhookSubscription` com as seguintes garantias:

- **event_id estável**: Cada evento publicado tem um `event_id` UUID v4 imutável que permanece o mesmo em todas as tentativas de entrega
- **Idempotência**: O mesmo `event_id` nunca será entregue duas vezes para a mesma subscription (garantido pelo provedor de mensageria)
- **Estratégia de Retry/Backoff**:
  - Tentativa imediata → 1min → 5min → 15min → 1h → 6h → 12h (exponencial com jitter)
  - Máximo de 7 tentativas antes de marcar como failed
  - Dead Letter Queue após esgotar tentativas
- **Formato do Payload**: 
  ```json
  {
    "event_id": "uuid-v4",
    "event_type": "fazenda.atualizada",
    "timestamp": "ISO 8601 UTC",
    "payload": {/* dados do evento específicos */},
    "version": "1.0"
  }
  ```

### Envelope de Evento Interno

Eventos internos entre módulos seguem o envelope padrão:

```json
{
  "event_id": "uuid-v4",
  "event_type": "dominio.nome.evento",
  "timestamp": "ISO 8601 UTC",
  "version": "1.0",
  "payload": {
    // dados específicos do evento
  },
  "metadata": {
    "source_module": "string",
    "correlation_id": "opcional-uuid",
    "tenant_id": "uuid"
  }
}
```

- **Versioning**: O campo `version` permite evolução segura do schema; consumers devem ignorar campos desconhecidos
- **Relation to EventPublisherPort**: O `EventPublisherPort` é responsável por publicar eventos neste envelope padrão, garantindo consistência entre módulos
- **Imutabilidade**: Uma vez publicado, o envelope não pode ser alterado

### Contrato Base do Adapter de Integração

Todos os adapters de integração externa devem seguir este contrato:

#### Campos Obrigatórios:
- `owner`: Equipe ou sistema responsável pelo adapter
- `purpose`: Descrição clara da finalidade da integração
- `auth`: Mecanismo de autenticação usado (API key, OAuth, mTLS, etc.)
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

