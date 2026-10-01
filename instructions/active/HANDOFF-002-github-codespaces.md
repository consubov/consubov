# HANDOFF-002 — GitHub Free e ambiente Codespaces

## PRD relacionado

`PRD-002-github-codespaces.md`

## Estado atual

Branch: `chore/github-codespaces-foundation`.

A fase começou a partir da `main` após o merge da fundação do monorepo.

## Restrições obrigatórias

- não conectar banco de dados/Supabase remoto;
- não configurar Vercel;
- não alterar UI;
- não alterar regras de negócio;
- não tocar em migrations ou dados remotos;
- não fazer merge direto sem CI/revisão.

## Implementado

- `.devcontainer/devcontainer.json` com Bun 1.3.12, instalação congelada e porta 8080;
- CI apenas em Pull Requests para `main` + disparo manual, com concurrency e timeout;
- template de Pull Request;
- templates de issue para bug e feature;
- Dependabot mensal apenas para GitHub Actions;
- README atualizado com Codespaces;
- documentação do fluxo GitHub Free/Codespaces;
- backlog criado em issues para API, tenancy, encapsulamento de dados e regressão offline;
- integrações reais com Supabase e Vercel registradas como bloqueadas.

## Issues criadas

- #3 — Fundação da API versionada sem banco remoto
- #4 — Contratos de autenticação, autorização e tenancy
- #5 — Encapsular acesso a dados do web progressivamente
- #6 — Ampliar regressão offline e sincronização
- #7 — Integração real com Supabase/PostgreSQL, RLS e multitenancy (BLOQUEADO)
- #8 — Deploy inicial e configuração Vercel (BLOQUEADO)

## Codespaces

A página de criação foi validada para o repositório e branch desta fase, usando máquina de 2 cores.

A automação do navegador conseguiu navegar e ler a página, mas o comando de clique do Browser MTS falhou por erro interno de referência de aba. Por isso, a criação efetiva do Codespace ainda precisa ser confirmada após o merge ou iniciada manualmente pelo botão do README.

## Validações

O Pull Request desta fase deve confirmar:

- `bun install --frozen-lockfile`;
- `bun run build`;
- `bun run test`.

A fase não altera arquivos funcionais da aplicação nem integrações remotas.
