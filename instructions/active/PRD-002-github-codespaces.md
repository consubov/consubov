# PRD-002 — GitHub Free e ambiente Codespaces

## Status

`IN_PROGRESS`

## Objetivo

Preparar o repositório Consubov para um fluxo sustentável usando recursos disponíveis no GitHub Free e GitHub Codespaces, sem conectar Supabase remoto, banco de dados ou Vercel.

## Escopo

### Incluído

- padronizar o ambiente de desenvolvimento em Codespaces por `.devcontainer/`;
- manter Bun 1.3.12 como runtime/package manager do projeto;
- otimizar o GitHub Actions existente para reduzir consumo desnecessário;
- adicionar template de Pull Request;
- adicionar templates de issue para bug e feature;
- configurar Dependabot somente para GitHub Actions;
- documentar limitações do GitHub Free em repositório privado;
- criar backlog rastreável para as próximas fases;
- preservar integralmente a aplicação existente.

### Fora de escopo

- conectar Supabase remoto;
- executar migrations remotas;
- conectar/configurar Vercel;
- alterar regras de negócio;
- redesign;
- implementar a API;
- mudar autenticação;
- alterar fluxos offline/sincronização.

## Requisitos

- [ ] Codespaces abre o repositório com Bun disponível;
- [ ] `bun install --frozen-lockfile` é executável no ambiente;
- [ ] porta 8080 fica preparada para preview do web;
- [ ] nenhuma credencial real é incluída no devcontainer;
- [ ] CI continua executando build + testes;
- [ ] CI evita execuções redundantes quando possível;
- [ ] templates de colaboração existem;
- [ ] documentação explica o fluxo de desenvolvimento;
- [ ] nenhum comportamento funcional da aplicação é alterado.

## Critérios de aceite

- [ ] CI verde;
- [ ] diff contém apenas configuração, documentação e automação de desenvolvimento;
- [ ] nenhuma alteração em componentes, hooks, services, regras de domínio ou Supabase;
- [ ] criação de Codespace pode ser iniciada a partir do repositório;
- [ ] próximas fases estão registradas em issues.

## Handoff

`instructions/active/HANDOFF-002-github-codespaces.md`
