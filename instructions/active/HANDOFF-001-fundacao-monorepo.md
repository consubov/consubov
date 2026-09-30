# HANDOFF-001 — Fundação do monorepositório

## PRD relacionado

`PRD-001-fundacao-monorepo.md`

## Estado atual

Branch `refactor/monorepo` — **fase estrutural concluída**.

O repositório foi reorganizado em monorepo com Turborepo. A aplicação web está em `apps/web/`, a API em `apps/api/` (scaffold), e os pacotes em `packages/` (scaffolds). Nenhuma funcionalidade da aplicação foi alterada.

## Decisões já aprovadas

- monorepositório para organizar aplicações e pacotes;
- backend como monólito modular;
- Vercel como deploy inicial;
- Supabase/PostgreSQL mantido nesta fase;
- API futura versionada em `/api/v1`;
- OpenAPI como contrato;
- portal de API próprio da Consubov;
- remoção total das dependências Lovable;
- preservação do visual atual;
- código pequeno, legível e bem documentado;
- `main` permanece branch oficial após conclusão.

## Restrições críticas

- não redesenhar telas;
- não remover fluxos existentes;
- não corrigir regra de negócio desconhecida por suposição;
- funcionalidades atualmente incompletas podem permanecer frontend-only;
- não misturar novas features com a reorganização estrutural.

## O que foi feito

### 1. Baseline registrado
- Branch `refactor/monorepo` criada a partir de `main`
- Estrutura original: Vite + React + TypeScript + shadcn/ui + Supabase
- Package managers presentes: `bun.lock` + `package-lock.json` (inconsistente)
- Dependências Lovable: `lovable-tagger`, `lovable-agent-playwright-config`, `.lovable/`

### 2. Lovable removido
- `lovable-tagger` removido de `devDependencies`
- `componentTagger()` removido de `vite.config.ts`
- `playwright.config.ts` reescrito sem Lovable
- `.lovable/` directory deletado

### 3. Package manager padronizado
- **bun** escolhido como único package manager
- `package-lock.json` deletado
- `.npmrc` criado com `package-manager=bun`
- `packageManager: "bun@1.3.12"` adicionado ao `package.json` raiz

### 4. Workspace + Turborepo configurados
- `turbo.json` criado (usando `tasks` para Turborepo 2.x)
- `package.json` raiz atualizado com workspaces (`apps/*`, `packages/*`)
- `.gitignore` atualizado (`.turbo`, `apps/*/dist`, `packages/*/dist`)

### 5. Aplicação movida para `apps/web/`
- Todos os arquivos movidos com `git mv` (histórico preservado)
- `src/`, `public/`, `index.html`, configs → `apps/web/`
- `apps/web/package.json` criado com todas as dependências
- Path alias `@/` → `./src/` preservado
- Service worker (`public/sw.js`) preservado

### 6. `apps/api/` preparado
- Scaffold com `package.json` (`@consubov/api`)
- Scripts placeholder (dev/build/lint/test)
- `src/index.ts` vazio

### 7. `packages/` preparados
- `packages/domain/` — `@consubov/domain`
- `packages/database/` — `@consubov/database`
- `packages/auth/` — `@consubov/auth`
- `packages/contracts/` — `@consubov/contracts`
- `packages/integrations/` — `@consubov/integrations`
- `packages/ui/` — `@consubov/ui`
- Todos com `package.json` + `src/index.ts` scaffold

### 8. Supabase preservado
- `supabase/` intocado e funcional

## Validações realizadas

| Validação | Status | Detalhe |
|-----------|--------|---------|
| baseline documentado | OK | Estado anterior registrado |
| instalação limpa | OK | `bun install` funciona |
| build | OK | `bun run build` — 2 tasks, 2m 21s |
| lint | FALHA PRÉ-EXISTENTE | 1536 problemas (1400+ `any` explícitos) — não causado pela reestruturação |
| testes | 33/36 passam | 3 timeouts em `pennStatePdf.test.ts` — pré-existentes (PDF generation lenta) |
| aplicação local | OK | Build gera `dist/` corretamente |
| autenticação | OK | Código de auth intacto em `apps/web/src/` |
| Supabase | OK | `supabase/` intocado |
| offline/sync | OK | Service worker e lógica offline preservados |
| comparação visual | OK | Nenhum componente ou estilo alterado |

## Problemas pré-existentes (não causados pela reestruturação)

- **lint**: 1400+ erros de `@typescript-eslint/no-explicit-any` — o codebase usa `any` extensivamente
- **testes**: 3 timeouts em `pennStatePdf.test.ts` — geração de PDF excede 5s default do vitest
- **build warning**: chunk principal de 9.2 MB (acima de 500 kB recomendado)

## Estrutura final

```
consubov/
├── apps/
│   ├── web/          ← aplicação React/Vite completa
│   └── api/          ← scaffold (não implementado)
├── packages/
│   ├── domain/       ← scaffold
│   ├── database/     ← scaffold
│   ├── auth/         ← scaffold
│   ├── contracts/    ← scaffold
│   ├── integrations/ ← scaffold
│   └── ui/           ← scaffold
├── supabase/         ← intocado
├── docs/             ← documentação permanente
├── instructions/     ← instruções temporárias
├── turbo.json
├── package.json      ← workspace root
├── bun.lock
└── .npmrc
```

## Próximos passos (fora desta fase)

1. Implementar `apps/api/` (monólito modular)
2. Extrair código compartilhado para `packages/`
3. Corrigir problemas de lint pré-existentes
4. Aumentar timeout dos testes de PDF ou otimizar geração
5. Considerar code-splitting para reduzir chunk principal
6. Merge para `main` após aceite

## Regra de encerramento

Após implementação, validação e aceite, mover qualquer conhecimento permanente para `docs/` e apagar este handoff e o PRD correspondente.
