# Extensibilidade e Integrações da API

## Mecanismo de Credenciais Final
_Obs.: ainda em definição._ [PENDENTE] para:
- API Keys estáticas com rotação programada (sem período aprovado)
- JWTs de curta duração para chamadas server-to-server
- OAuth 2.0 Client Credentials para integrações de alto nível
- Armazenamento seguro de segredos (nenhum vault decidido)
- Revogação instantânea via dashboard de administração

> **Sem endpoints externos, brokers ou provedores configurados na fase atual.**
> Todas as integráveis descritas abaixo são contratuais e ainda não implementadas. O isolamento por tenant e ponto de autorização RBAC será mantido estritamente antes de qualquer produção.

## Limites de Rate (Rate Limits)
[PENDENTE] — sem decisão aprovada comprovada:
- Limites por tenant, por escopo e global (valores numéricos não definidos)
- Estratégia de retry/backoff e cronograma específico
- Dead Letter Queue

## Política Comercial
[PENDENTE] — sem plano aprovado comprovado:
- Planos (Gratuito/Profissional/Enterprise), quotas mensais e recursos
- SLAs e tempos de suporte
- Modelo de pagamento

- Cada integração deve adotar mecanismo de revogação de credenciais e manter auditoria de chamadas (logs com `tenant_id`, `consumer_id`, `event_id`).

---

> **Nota**: Esta documentação descreve contratos e políticas ainda não materializadas. Nenhum endpoint real, broker ou provedor externo está em operação até o momento. O isolamento de tenant e a estratégia RBAC permanecem como requisitos de segurança críticos.
