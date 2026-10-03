# Extensibilidade e Integrações da API

## API consumer

O modelo `ApiConsumer` prepara integrações futuras sem publicar API externa nesta fase.

Contratos definidos:

- consumidor identificado por `consumerId`;
- tenant explícito quando aplicável; `tenantId = null` nunca concede acesso global automaticamente;
- scopes namespaced;
- estado `active | revoked`;
- `credentialReference` opaca, sem segredo em claro;
- expiração por `expiresAt`; credencial expirada ou revogada é negada;
- rotação representada pela substituição da referência opaca, sem transportar segredo;
- auditoria usa `consumerId`, tenant quando aplicável e origem;
- rate limit e quota são representáveis por referências de política, sem valores numéricos inventados.

Gate atual da API pública:

- `API_PUBLIC_ACCESS_POLICY.exposure = "disabled"`;
- `credentialMechanism = null` até existir primeiro consumidor real;
- nenhum endpoint externo é publicado nesta fase;
- a referência opaca de credencial continua válida como contrato de lifecycle, sem transportar segredo;
- periodicidade de rotação, valores de quota/rate limit e política comercial continuam decisões do caso real.

Isso **não é pendência da FASE 2**: é um gate de ativação futura. A decisão vigente é manter a API pública desabilitada até que exista consumidor, escopo e política aprovados.

## Webhooks futuros

Existe contrato conceitual, não dispatcher.

Definido:

- `eventId` estável;
- retries preservam `eventId` + `subscriptionId`;
- chave de idempotência conceitual por subscription/event;
- `secretReference` guarda somente referência do segredo de assinatura;
- tentativa de entrega registra número da tentativa, horário, resultado e status HTTP opcional, sem payload/secret;
- backoff e desativação usam referências de política abstratas, sem inventar cronograma ou limiar;
- logs de entrega devem ser sanitizados;
- consumidores futuros devem ser idempotentes.

Não implementado nesta fase:

- endpoint público real;
- provider/HMAC concreto;
- broker;
- fila cloud;
- retry remoto real;
- DLQ.

## Integrações externas

Integrações continuam atrás de ports/adapters. Contratos devem declarar owner, finalidade, auth, tenant/scope, timeout, retry, idempotência quando aplicável, circuit breaker quando necessário, logs, erro, disponibilidade, dados enviados/recebidos, rate limit, custo e estratégia de substituição.

Nenhuma integração pode contornar tenancy/RBAC.