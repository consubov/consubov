# Consubov

Monorepositório do Consubov. A aplicação existente continua em React/Vite e usa Supabase/PostgreSQL nesta fase.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/mmatteuus/consubov?quickstart=1)

## Estrutura atual

```text
apps/
├── web/        # aplicação atual
└── api/        # scaffold reservado; API ainda não implementada
supabase/       # migrations, functions e configuração existentes
docs/           # documentação permanente
instructions/   # PRDs e handoffs temporários
```

Pacotes compartilhados em `packages/` serão criados somente quando houver código reutilizável real.

## Ambiente local

1. Instale Bun.
2. Copie `.env.example` para `.env` na raiz.
3. Preencha as variáveis locais sem versionar o arquivo.
4. Execute:

```sh
bun install
bun run dev
```

O `apps/web` carrega o arquivo de ambiente da raiz do monorepo.

## GitHub Codespaces

O repositório possui `.devcontainer/devcontainer.json` para criar um ambiente reproduzível com Bun 1.3.12.

O Codespace instala dependências com `bun install --frozen-lockfile` e prepara a porta `8080` para o web.

Credenciais e arquivos `.env` não fazem parte da imagem nem do repositório.

## Variáveis de produção

Na Vercel, configure pelo menos:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY` quando push estiver habilitado

Não versionar credenciais ou arquivos `.env`.

## Scripts

- `bun run dev` — desenvolvimento
- `bun run build` — build das aplicações que possuem build implementado
- `bun run lint` — lint
- `bun run test` — testes
