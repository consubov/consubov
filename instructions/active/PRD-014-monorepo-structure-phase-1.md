# PRD-014 — Fundação estrutural do monorepositório

## Status

`READY_FOR_REVIEW`

## Objetivo

Consolidar a estrutura atual do monorepositório sem alterar comportamento do web, da API ou do Supabase e sem antecipar a arquitetura futura.

## Contexto

A migração de acesso a dados está pausada. Esta fase deve tornar workspaces, scripts, ownership de tooling e documentação explícitos, usando apenas mudanças estruturais de baixo risco.

## Auditoria inicial

- A raiz já contém somente os dois workspaces reais, `apps/web` e `apps/api`; não há `packages/` vazio nem scaffolds vazios.
- Os apps não possuem imports cruzados nem dependências entre `@consubov/web` e `@consubov/api`.
- Configurações de Vite, Vitest, Playwright, Tailwind e ESLint pertencem apenas ao web e já estão no workspace correto.
- Os `tsconfig` têm semânticas diferentes: compartilhar uma base agora aumentaria risco sem reutilização suficiente.
- A API chama `bunx tsc`, mas não declara TypeScript no próprio workspace; hoje ela depende acidentalmente do tooling instalado pelo web.
- Os scripts raiz agregam tarefas, porém não oferecem atalhos explícitos por app nem um typecheck nomeado.
- A tarefa `test` do Turbo declara `^build`, embora não existam packages dependentes; a relação não representa uma necessidade real.
- O web não possui README próprio, enquanto a API possui; isso deixa comandos e responsabilidades do workspace ambíguos.
- `docs/02-arquitetura.md` mistura a estrutura efetivamente existente com packages e módulos futuros.
- Bun 1.3.12 já está consistente em `package.json`, devcontainer, CI e documentação.
- Não foram encontrados configs duplicados seguros para extração, pastas vazias, packages falsos ou dependências de runtime a mover.

## Escopo

### Incluído

- tornar scripts raiz por app e agregados explícitos;
- declarar TypeScript como tooling local da API e nomear seu typecheck;
- simplificar a relação de tarefas do Turbo para refletir o grafo real;
- documentar o workspace web;
- separar estrutura atual de arquitetura futura na documentação;
- registrar inventário, decisões, validações e riscos neste PRD/handoff.

### Fora de escopo

- qualquer arquivo funcional em `apps/web/src`;
- endpoints ou comportamento da API;
- Supabase, migrations, banco remoto, Vercel e secrets;
- auth, RBAC, tenancy, offline, cache, realtime e service worker;
- repositories, regras de negócio, UI ou dependências de runtime;
- criação de `packages/` ou de tsconfig compartilhado;
- correção em massa do lint legado do web.

## Requisitos

- [x] preservar os dois apps e seus paths/imports;
- [x] usar Bun 1.3.12;
- [x] scripts agregados não podem esconder workspaces aplicáveis;
- [x] API deve resolver o TypeScript declarado localmente;
- [x] documentação deve distinguir estado atual e direção futura;
- [x] nenhum teste ou smoke deve acessar serviços remotos.

## Plano aprovado pelo inventário

1. Ajustar manifests e Turbo sem mudar runtime.
2. Criar README do web e reconciliar documentação estrutural.
3. Executar instalação congelada, build, testes, typecheck/lint aplicável e smoke HTTP local.
4. Comparar o diff com o baseline para comprovar que `apps/web/src` e `supabase/` não mudaram.

## Critérios de aceite

- [x] `git diff --check` passa;
- [x] `bun --version` retorna `1.3.12`;
- [x] `bun install --frozen-lockfile` passa;
- [x] `bun run build` passa;
- [x] `bun run test` passa;
- [x] typecheck da API com binário local passa;
- [x] smoke HTTP local da API passa sem dependências externas;
- [x] `apps/web/src` e `supabase/` permanecem idênticos ao baseline;
- [x] verificação de secrets não encontra credenciais reais adicionadas.

## Validação manual

Revisar a árvore e os scripts documentados. Não há mudança visual ou funcional que exija screenshot.

## Riscos

- O lint completo do web possui dívida legada conhecida; esta fase não deve mascará-la nem corrigi-la em massa.
- Extrair configs compartilhados agora poderia mudar a semântica permissiva do web.

## Handoff

Arquivo: `HANDOFF-014-monorepo-structure-phase-1.md`
