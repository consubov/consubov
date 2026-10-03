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

Continuam `[PENDENTE]` até existir primeiro caso real:

- mecanismo final da credencial externa (API key/JWT/OAuth/etc.);
- periodicidade de rotação;
- valores de quota/rate limit;
- política comercial.

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