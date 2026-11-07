# @consubov/web

Aplicação React/Vite existente do Consubov.

## Responsabilidade

Este workspace contém a UI e os fluxos web atuais. Ele continua usando a integração Supabase já existente; a API local em `apps/api` ainda não substitui esse acesso e não deve ser tratada como persistência do web.

As configurações de Vite, Vitest, Playwright, ESLint, Tailwind e TypeScript ficam aqui porque são específicas deste app. Os aliases `@/*` continuam apontando para `src/*`.

## Ambiente local

O Vite e o Vitest leem variáveis a partir da raiz do monorepositório. Para desenvolvimento manual, copie `.env.example` para `.env` na raiz e use somente credenciais locais apropriadas; `.env` não é versionado.

`VITE_API_BASE_URL` configura a futura fronteira Web -> API própria. Sem configuração, o client usa `http://127.0.0.1:3000`. Isso não altera os fluxos legados que ainda usam Supabase diretamente.

## Cliente HTTP da API

A camada única fica em:

```text
src/lib/api/
```

Use `apiClient` em novos consumidores da API própria. Não crie `fetch` paralelo para a mesma API e não mova um fluxo legado do Supabase para a API sem escopo/testes de comportamento.

O client fornece timeout explícito, correlação, idempotency key opcional e parsing padronizado do envelope de erro. Nenhum segredo pode ser colocado em variáveis `VITE_*`.

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
