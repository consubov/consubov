# @consubov/api

Fundação local da API do Consubov.

## Estado

Esta aplicação é deliberadamente stateless e ainda não possui integração com banco de dados, Supabase remoto, autenticação real ou deploy.

## Desenvolvimento

A partir da raiz do monorepo:

```sh
bun install --frozen-lockfile
bun run dev
```

Por padrão a API usa a porta `3000`. Para alterar localmente, defina `PORT`.

## Endpoints atuais

- `GET /api/v1/health`
- `GET /api/v1/readiness`
- `GET /api/v1/openapi.json`
- `GET /api/docs`

Toda resposta inclui `x-request-id`. Uma requisição que já tenha `x-request-id` ou `x-correlation-id` tem esse identificador reutilizado quando ele é válido.

## Scripts

```sh
bun run dev
bun run build
bun run test
bun run lint
```

O script `lint` executa o TypeScript em modo estrito sem emitir arquivos. O TypeScript já faz parte do workspace web existente, então esta fase não adiciona dependências nem altera o lockfile.
