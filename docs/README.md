# Documentação técnica — Consubov

Esta pasta é a fonte permanente de contexto técnico do projeto.

## Ordem de leitura

1. [Princípios de evolução](./01-principios.md)
2. [Arquitetura alvo](./02-arquitetura.md)
3. [Padrões de código](./03-padroes-de-codigo.md)
4. [API e integrações](./04-api-e-integracoes.md)
5. [Fluxo de desenvolvimento](./05-fluxo-de-desenvolvimento.md)
6. [Contrato do sistema atual](./06-contrato-sistema-atual.md)
7. [Fundação do monorepositório](./07-fundacao-monorepo.md)
8. [GitHub Free e Codespaces](./08-github-free-codespaces.md)
9. [Fundação local da API](./09-api-foundation.md)
10. [Autenticação, autorização e tenancy](./10-auth-tenancy-contracts.md)
11. [Regressão offline e sincronização](./11-offline-sync-regression.md)
12. [Migração progressiva de acesso a dados do Web](./12-web-data-access.md)
13. [Política de mudanças estruturais](./13-politica-mudancas-estruturais.md)
14. [Política de código open source e terceiros](./14-politica-codigo-terceiros.md)
15. [Ports e Adapters Fundamentais](./15-ports-adapters-fundamentais.md)
16. [Segurança das Edge Functions legadas](./16-seguranca-edge-functions-legadas.md)
17. [Segurança das Edge Functions administrativas](./17-seguranca-admin-edge-functions.md)
18. [Contratos de plataforma Web](./17-web-platform-contracts.md)
19. [Identificadores e tempo](./18-identificadores-tempo.md)
20. [Exclusão e sincronização futura](./19-exclusao-sync-futuro.md)
21. [Segurança de push](./19-seguranca-push.md)
22. [Extensibilidade da API e integrações](./20-extensibilidade-api-integracoes.md)
23. [Segurança de CI e código](./20-seguranca-ci-codigo.md)
24. [Tenancy, RBAC, auth e auditoria](./21-tenancy-rbac-auth-auditoria.md)
25. [Baseline funcional da Web — FASE 3.1](./22-baseline-funcional-web.md)
26. [Mapa de bounded contexts do Web — FASE 3.2](./23-fase3-mapa-bounded-contexts-web.md)
27. [Persistência/configuração local — FASE 3.5–3.6](./24-fase3-persistencia-config-local.md)
28. [Auditoria corretiva da FASE 3](./25-fase3-auditoria-correcao-2026-10-04.md)
29. [Inventário de componentes de terceiros](./THIRD_PARTY_COMPONENTS.md)
30. [Auditoria da FASE 4 — paridade funcional Web](./27-fase4-auditoria-2026-10-05.md)
31. [Fechamento consolidado das FASES 0–4](./28-fases0-4-fechamento-2026-10-05.md)
32. [FASE 5 — Web Quality / WEB READY](./29-fase5-web-ready-2026-10-05.md)

> Os números da lista são apenas a ordem de leitura. Alguns nomes de arquivo preservam numeração histórica duplicada (`17`, `19`, `20`) e não devem ser renomeados dentro desta correção sem um trabalho específico de referências.

33. [QA local com Go Task e VS Code](./qa/QA-LOCAL-VSCODE-GO-TASK.md)
34. [Auditoria local 2026-10-09](./qa/auditoria-local-2026-10-09.md)
35. [Inventário verificado do offline legado](./62-offline-legacy-migration.md)

## Regra

- `docs/` contém conhecimento permanente.
- Decisões arquiteturais aprovadas devem ser registradas aqui.
- PRDs e handoffs temporários ficam em `instructions/active/`.
- Antes de apagar um PRD concluído, qualquer aprendizado permanente deve ser transferido para `docs/`.
### Avanços incrementais de QA e offline (2026-10-09)

- [Fundações do banco local e comando idempotente](./63-offline-vnext-foundations.md)
- [QA local: Go Task, matriz e PWA upgrade fixture](./qa/QA-LOCAL-VSCODE-GO-TASK.md)
