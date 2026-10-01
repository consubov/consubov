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
12. [Migração progressiva de acesso a dados do web](./12-web-data-access.md)
13. [Política de mudanças estruturais](./13-politica-mudancas-estruturais.md)
14. [Política de código open source e terceiros](./14-politica-codigo-terceiros.md)
16. [Segurança das edge functions legadas (seed-app-secrets + cleanup-demo-accounts)](./16-seguranca-edge-functions-legadas.md)

## Regra

- `docs/` contém conhecimento permanente.
- Decisões arquiteturais aprovadas devem ser registradas aqui.
- PRDs e handoffs temporários ficam em `instructions/active/`.
- Antes de apagar um PRD concluído, qualquer aprendizado permanente deve ser transferido para `docs/`.
