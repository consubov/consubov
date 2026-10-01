# Fundação do monorepositório

## Estado consolidado

A primeira reorganização estrutural do Consubov foi concluída sem redesign e sem alteração intencional de regras de negócio.

```text
consubov/
├── apps/
│   ├── web/        # aplicação React/Vite existente
│   └── api/        # reserva arquitetural; runtime ainda não implementado
├── supabase/       # migrations, functions e configuração existentes
├── docs/
├── instructions/
├── turbo.json
├── package.json
└── bun.lock
```

## Decisões

- Bun é o package manager do repositório.
- Turborepo coordena tarefas do monorepo.
- `apps/web` preserva a aplicação existente.
- `apps/api` não possui scripts fictícios; será implementado em PRD próprio.
- `packages/` só será criado quando existir código compartilhado real.
- Supabase/PostgreSQL continua sendo usado nesta fase.
- Lovable foi removido do desenvolvimento/build.
- `.env` não é versionado.
- O web lê variáveis da raiz do monorepo.
- Produção deve receber variáveis pela plataforma de deploy.

## Variáveis principais do web

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY` quando aplicável

## Testes

- testes não devem usar credenciais reais do Supabase;
- testes pesados de geração de PDF podem possuir timeout específico;
- não aumentar o timeout global para ocultar lentidão;
- CI executa instalação com lockfile congelado, build e testes em Pull Requests para `main`.

## Git

`main` é a branch oficial. Trabalhos relevantes usam branches temporárias e Pull Request antes do merge.
