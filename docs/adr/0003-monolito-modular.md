# ADR-0003 — Monólito modular

**Status:** Aceito  
**Data:** 2026-10-01

## Contexto
O CONSUBOV precisa de separação clara por domínio, mas não há necessidade comprovada de microserviços.

## Decisão
Adotar **monólito modular** no backend.

Módulos devem ser organizados por responsabilidade/domínio, com fronteiras explícitas.

Exemplos atuais:
- Identity/Tenancy
- Farms
- Pastures
- Nutrition
- Inventory
- Visits
- FeedMill
- Livestock
- Weighing
- Sync
- Files
- Reporting
- Notifications
- SaaSAdmin
- Integrations

## Consequências
- Não criar microserviços automaticamente.
- Evitar dependências cruzadas desnecessárias.
- Escalar por evidência, não por hipótese.

## Não decidido aqui
- Divisão física futura caso algum módulo realmente precise virar serviço independente.
