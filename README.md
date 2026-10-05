# Consubov

Monorepositório do **CONSUBOV**, plataforma SaaS multitenant de gestão pecuária.

A aplicação Web/Admin existente continua em **React/Vite**. O backend alvo está definido em **Bun + TypeScript**, com arquitetura de **monólito modular**, API-first e contratos documentados em OpenAPI/Swagger.

Nesta fase, a nova API permanece sem persistência remota conectada. O legado atual pode continuar usando Supabase/PostgreSQL durante a transição, mas a nova arquitetura não deve ser conectada ao Supabase remoto nem ao Vercel antes dos gates definidos pelo projeto.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/mmatteuus/consubov?quickstart=1)

## Decisões arquiteturais vigentes

- Backend: **Bun + TypeScript**.
- Web/Admin: **React + Vite + TypeScript**.
- Arquitetura: **monólito modular**.
- API: **API-first**, versionada em `/api/v1`.
- Contrato HTTP: **OpenAPI/Swagger**.
- Persistência principal planejada: **PostgreSQL** atrás de repositories/adapters.
- Integrações e infraestrutura: **ports/adapters**.
- App: reaproveitar/empacotar a Web React; wrapper final ainda pendente.
- Persistência local futura do App: **SQLite**, sujeita à tecnologia de empacotamento escolhida.
- Ordem de entrega: **Web → App → Offline → infraestrutura remota/staging → produção**.
- Supabase/PostgreSQL remoto e Vercel: **bloqueados nesta etapa para a nova arquitetura**.

## Estrutura atual

```text
apps/
├── web/        # aplicação React/Vite atual
└── api/        # API Bun/TypeScript local; persistência remota ainda não conectada

supabase/       # migrations, functions e configuração do legado atual
docs/           # documentação técnica permanente e ADRs
instructions/   # PRDs e handoffs temporários
```

Não existe `packages/` nesta etapa. Pacotes compartilhados serão criados somente quando houver código ou configuração com consumidores reais em mais de um workspace.

## Documentação e governança

A documentação técnica faz parte da **Definition of Done**.

Toda mudança relevante deve atualizar, no mesmo trabalho, os artefatos afetados, quando aplicável:

- código;
- documentação técnica em `docs/`;
- ADRs em `docs/adr/`;
- OpenAPI/Swagger;
- Instruções-Mestre;
- checklist/status do projeto;
- README/runbooks.

Principais referências:

```text
CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md
docs/01-principios.md
docs/02-arquitetura.md
docs/03-padroes-de-codigo.md
docs/04-api-e-integracoes.md
docs/05-fluxo-de-desenvolvimento.md
docs/06-contrato-sistema-atual.md
docs/07-fundacao-monorepo.md
docs/08-github-free-codespaces.md
docs/09-api-foundation.md
docs/10-auth-tenancy-contracts.md
docs/11-offline-sync-regression.md
docs/12-web-data-access.md
docs/13-politica-mudancas-estruturais.md
docs/14-politica-codigo-terceiros.md
docs/15-ports-adapters-fundamentais.md
docs/16-seguranca-edge-functions-legadas.md
docs/17-seguranca-admin-edge-functions.md
docs/17-web-platform-contracts.md
docs/18-identificadores-tempo.md
docs/19-exclusao-sync-futuro.md
docs/19-seguranca-push.md
docs/20-extensibilidade-api-integracoes.md
docs/20-seguranca-ci-codigo.md
docs/21-tenancy-rbac-auth-auditoria.md
docs/22-baseline-funcional-web.md
docs/23-fase3-mapa-bounded-contexts-web.md
docs/24-fase3-persistencia-config-local.md
docs/25-fase3-auditoria-correcao-2026-10-04.md
docs/adr/
```

Os ADRs registram decisões arquiteturais importantes e não devem ser apagados quando forem substituídos; decisões superadas devem ser marcadas como substituídas e relacionadas ao novo ADR.

## Ambiente local

1. Instale Bun.
2. Copie `.env.example` para `.env` na raiz apenas quando for trabalhar com o Web.
3. Preencha variáveis locais sem versionar o arquivo.
4. Execute:

```sh
bun install
bun run dev
```

O `apps/web` carrega o arquivo de ambiente da raiz do monorepo.

A API local não depende de Supabase ou banco remoto nesta fase.

## API local

Por padrão, `@consubov/api` usa a porta `3000`.

Endpoints básicos atuais:

- `GET /api/v1/health`
- `GET /api/v1/readiness`
- `GET /api/v1/openapi.json`
- `GET /api/docs`

Toda nova rota deve manter o contrato OpenAPI correspondente atualizado no mesmo trabalho.

O Web expõe uma camada única de consumo futuro em `apps/web/src/lib/api/`, com timeout, correlação, idempotency key opcional e erro padronizado. A existência desse client não migra automaticamente os acessos Supabase legados.

## GitHub Codespaces

O repositório possui `.devcontainer/devcontainer.json` para criar um ambiente reproduzível com Bun 1.4.0, alinhado ao `packageManager` da raiz e ao CI.

O Codespace instala dependências com:

```sh
bun install --frozen-lockfile
```

e prepara:

- porta `3000` para a API local;
- porta `8080` para o Web.

Credenciais e arquivos `.env` não fazem parte da imagem nem do repositório.

## Variáveis de produção

A configuração de ambiente remoto/produção permanece condicionada ao gate próprio do projeto.

Quando essa fase for autorizada, as variáveis necessárias deverão ser configuradas no ambiente de destino sem versionar credenciais ou arquivos `.env`.

O legado atual utiliza, entre outras, variáveis como:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY` quando push estiver habilitado
- `VITE_API_BASE_URL` para o client local da API própria (default local `http://127.0.0.1:3000`)

Essas referências não significam autorização para conectar a nova arquitetura ao Supabase remoto ou configurar Vercel nesta etapa.

## Scripts

- `bun run dev` — inicia os dois apps em modo de desenvolvimento;
- `bun run dev:web` / `bun run dev:api` — inicia somente um app;
- `bun run build` — build de todos os workspaces que implementam a tarefa;
- `bun run build:web` / `bun run build:api` — build isolado por app;
- `bun run test` — testes de todos os workspaces;
- `bun run test:web` / `bun run test:api` — testes isolados por app;
- `bun run typecheck` — typecheck dos workspaces que possuem contrato estrito;
- `bun run check` — contrato canônico local e do CI: typecheck, build e testes;
- `bun run lint` — executa os lints declarados por todos os workspaces, incluindo a dívida legada conhecida do Web.

O CI executa `bun run check` e, em seguida, um smoke HTTP do artefato compilado da API usando somente `127.0.0.1`.

O smoke permanece explícito no workflow porque gerencia o processo temporário e verifica respostas HTTP reais. Ele não deve acessar Supabase nem qualquer serviço externo nesta etapa.

## Regras rápidas para mudanças

Antes de uma mudança estrutural, consulte:

- `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`;
- `docs/13-politica-mudancas-estruturais.md`;
- ADRs em `docs/adr/`.

Mudanças em auth, tenancy, RBAC, banco, sync, estoque, pesagem, API pública, migração, secrets ou infraestrutura exigem revisão especial.

Ações externas ou irreversíveis como deploy, migration remota, alteração de segredo, rotação de credencial, commit/push/merge quando não autorizados e mudanças de produção continuam condicionadas à autorização explícita definida pelo projeto.

## Mais informações

Consulte os READMEs em `apps/web` e `apps/api` para responsabilidades e comandos específicos.

A arquitetura vigente está documentada em:

- [`docs/02-arquitetura.md`](./docs/02-arquitetura.md)
- [`docs/13-politica-mudancas-estruturais.md`](./docs/13-politica-mudancas-estruturais.md)
- [`docs/adr/`](./docs/adr/)
