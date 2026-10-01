# @consubov/web

Aplicação React/Vite existente do Consubov.

## Responsabilidade

Este workspace contém a UI e os fluxos web atuais. Ele continua usando a integração Supabase já existente; a API local em `apps/api` ainda não substitui esse acesso e não deve ser tratada como persistência do web.

As configurações de Vite, Vitest, Playwright, ESLint, Tailwind e TypeScript ficam aqui porque são específicas deste app. Os aliases `@/*` continuam apontando para `src/*`.

## Ambiente local

O Vite e o Vitest leem variáveis a partir da raiz do monorepositório. Para desenvolvimento manual, copie `.env.example` para `.env` na raiz e use somente credenciais locais apropriadas; `.env` não é versionado.

## Comandos

A partir da raiz:

```sh
bun run dev:web
bun run build:web
bun run test:web
```

A partir deste workspace:

```sh
bun run dev
bun run build
bun run test
bun run lint
```

O lint completo possui dívida legada conhecida e não é apresentado como uma validação verde da fundação do monorepositório.
