# Fundação do monorepositório

## Estado consolidado

A primeira reorganização estrutural do Consubov foi concluída sem redesign e sem alteração intencional de regras de negócio.

```text
consubov/
├── apps/
│   ├── web/        # aplicação React/Vite existente
│   └── api/        # API Bun local e stateless; sem persistência remota
├── supabase/       # migrations, functions e configuração existentes
├── docs/
├── instructions/
├── turbo.json
├── package.json
└── bun.lock
```

## Decisões

- Bun é o package manager do repositório.
- Bun 1.3.12 é a versão oficial do projeto e do CI.
- Turborepo coordena tarefas do monorepo.
- `apps/web` preserva a aplicação existente.
- `apps/api` possui uma fundação executável local com health, readiness, OpenAPI, documentação HTTP e contratos de segurança.
- A API permanece stateless e não possui persistência, endpoints de domínio ou integração com Supabase/PostgreSQL.
- Os contratos de identidade, autorização e tenancy da API definem fronteiras para adapters futuros; eles não autenticam usuários ou integrações reais.
- `packages/` só será criado quando existir código compartilhado real.
- Supabase/PostgreSQL continua sendo usado pela aplicação web nesta fase.
- Lovable foi removido do desenvolvimento/build.
- `.env` não é versionado.
- O web lê variáveis da raiz do monorepo.
- Produção deve receber variáveis pela plataforma de deploy quando o deploy for autorizado.

## Variáveis principais do web

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY` quando aplicável

## Testes

- testes não devem usar credenciais reais do Supabase;
- testes pesados de geração de PDF podem possuir timeout específico;
- não aumentar o timeout global para ocultar lentidão;
- CI executa instalação com lockfile congelado, build e testes em Pull Requests para `main`.

## Baseline de validação

No estado consolidado em `e95a4ea`, build, testes e smoke HTTP local da API estão verdes. A suíte possui 13 testes da API e 67 testes do web. O build do web ainda emite avisos conhecidos sobre `eval`, chunks grandes e imports estáticos/dinâmicos mistos.

O comando raiz `bun run lint` não está verde porque inclui o lint completo do web, que possui dívida legada. A auditoria desse baseline encontrou 1.423 erros e 105 warnings no web. Essa dívida deve ser tratada incrementalmente em escopo próprio; ela não deve ser ocultada por relaxamento de regras nem corrigida em massa junto de mudanças funcionais. O typecheck estrito da API permanece verde e é o lint executado pelo CI atual.

Supabase/banco remoto, migrations remotas e Vercel/deploy permanecem bloqueados até autorização e PRD específicos. Validações locais não devem usar secrets reais nem fazer chamadas a produção.

## Git

`main` é a branch oficial. Trabalhos relevantes usam branches temporárias e Pull Request antes do merge.
