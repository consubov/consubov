# Extensibilidade e Integrações da API

## Mecanismo de Credenciais Final
_Obs.: ainda em definição, mas previsto para ser:_
- API Keys estáticas com rotação programada (padrão 90 dias)  
- JWTs de curta duração para chamadas server‑to‑server  
- OAuth 2.0 Client Credentials para integrações de alto nível  
- Armazenamento seguro em vault (ex.: HashiCorp Vault) para gerenciamento de segredos  
- Revogação instantânea via dashboard de administração  

> **Sem endpoints externos, brokers ou provedores configurados na fase atual.**  
> Todas as integrazioníveis descritas abaixo sao contratuais e ainda nao implementadas. O isolamento por tenant e ponto de autorização RBAC sera mantido estritamente antes de qualquer produzioné.

## Limites de Rate (Rate Limits)
- **Por tenant**: 1.000 requisições/minuto (configurável via claims do tenant)  
- **Por escopo**: limites específicos por recurso – ex.:  
  - `animais:read` – 500 rpm  
  - `animais:write` – 200 rpm  
  - `estoque:read` – 300 rpm  
- **Global**: 10.000 requisições/minuto no gateway da API  
- Estratégia de retry/backoff exponencial com jitter (tentativas: 1 min → 5 min → 15 min → 1 h → 6 h → 12 h, máximo 7 tentativas)  
- Após esgotar tentativas, o evento é encaminhado para Dead Letter Queue  

## Política Comercial
| Plano | Quota Mensal | Recursos | SLA | Suporte |
|------|--------------|----------|-----|---------|
| **Gratuito** | 5.000 requisições<br>1 integration ativo | Acesso a contratos estáveis, documentação pública | 99 % uptime (melhor esforço) | Comunitário (GitHub Discussions) |
| **Profissional** | 100.000 requisições | Integrações ilimitadas, rate limits configuráveis, contratos de retro‑compatibilidade | 99.9 % uptime | E‑mail prioritário, resposta ≤ 4 h |
| **Enterprise** | Negociado | Integração privada, tratamento prefen cial de eventos, auditoria de acesso, SLA personalizado | Acordado por contrato | Engenharia dedic­ada, resposta ≤ 1 h |

- Pagamento via assinatura mensal ou anual.  
- Restrições de uso: somente para fins legais e dentro dos limites de quota; abuso ou uso não autorizado pode levar à suspensão da conta.  
- Cada integração deve adotar mecanismo de revogação de credenciais e manter auditoria de chamadas (logs com `tenant_id`, `consumer_id`, `event_id`).  

---  

> **Nota**: Esta documentação descreve contratos e políticas ainda não materializadas. Nenhum endpoint real, broker ou provedor externo está em operação até o momento. O isolamento de tenant e a estratégia RBAC permanecem como requisitos de segurança críticos.