# HANDOFF-014 — Fundação estrutural do monorepositório

## PRD relacionado

`PRD-014-monorepo-structure-phase-1.md`

## Estado atual

Auditoria e lote estrutural de baixo risco concluídos sobre o baseline `4aa6398`, na branch `refactor/monorepo-structure-phase-1`. O trabalho está pronto para revisão, sem merge.

## Árvore antes

```text
consubov/
├── apps/
│   ├── api/       # API local, com README
│   └── web/       # web sem README próprio
├── docs/
├── instructions/  # active vazio no baseline
├── supabase/
├── package.json
├── bun.lock
└── turbo.json
```

## Decisões tomadas

- Não criar `packages/`: inexiste código/config usado de verdade pelos dois apps.
- Não compartilhar tsconfig: API estrita e web legado possuem necessidades diferentes.
- Manter configs específicas no web: nenhum outro workspace usa Vite, Vitest, Playwright, Tailwind ou ESLint.
- Declarar TypeScript na API: elimina a dependência acidental do devDependency do web.
- Não tocar no lint legado do web: dívida conhecida exige escopo próprio.
- Remover `^build` de `test`: os apps não dependem entre si e seus testes não consomem artefatos de build.
- Corrigir no lockfile o nome legado da raiz e registrar o mesmo TypeScript já resolvido para a API.

## Árvore depois

```text
consubov/
├── apps/
│   ├── api/       # README, scripts e TypeScript local explícito
│   └── web/       # README próprio; código funcional preservado
├── docs/          # estado atual separado da arquitetura futura
├── instructions/
│   └── active/    # PRD e handoff desta fase
├── supabase/      # preservado
├── package.json   # agregados e atalhos por app
├── bun.lock
└── turbo.json     # grafo real de build/test/typecheck
```

## Arquivos alterados

- `instructions/active/PRD-014-monorepo-structure-phase-1.md`
- `instructions/active/HANDOFF-014-monorepo-structure-phase-1.md`
- `README.md`
- `apps/api/README.md`
- `apps/api/package.json`
- `apps/web/README.md`
- `bun.lock`
- `docs/02-arquitetura.md`
- `docs/04-api-e-integracoes.md`
- `docs/07-fundacao-monorepo.md`
- `package.json`
- `turbo.json`

## Itens rejeitados por risco

- package de config e `packages/` vazio: não há dois consumidores reais;
- tsconfig base compartilhado: alteraria ou confundiria semânticas diferentes entre API estrita e web legado;
- mover tooling específico do web para a raiz: criaria ownership artificial;
- corrigir lint completo do web: mudança massiva fora do objetivo;
- continuar repositories ou mover código funcional: migração explicitamente pausada;
- qualquer mudança em CI, Supabase, migrations, deploy ou dependências de runtime.

## Pendências

- [x] implementar o lote aprovado;
- [x] atualizar documentação permanente;
- [x] executar todas as validações obrigatórias;
- [ ] revisão e aceite do proprietário;

## Validações executadas

- [x] Bun 1.3.12 e instalação congelada (640 instalações / 689 packages, sem mudanças)
- [x] build dos dois apps (warnings legados conhecidos no web)
- [x] typecheck/lint local da API
- [x] testes: API 13/13; web 74/74 em 23 arquivos
- [x] smoke local da API em loopback, incluindo health, readiness, OpenAPI, docs e 404
- [x] invariantes de escopo e segurança

## Riscos / atenção

- Não introduzir um package de config apenas para uniformidade visual.
- Não interpretar documentação futura como autorização para continuar repositories ou conectar persistência.
- O build mantém warnings preexistentes de `eval`, chunks grandes, Browserslist e imports mistos.
- O teste congelado inicial encontrou bloqueio HTTP 403 ao tentar resolver a nova declaração; o lockfile foi reconciliado com o TypeScript 5.8.3 que já estava resolvido e a execução congelada seguinte passou sem downloads ou mudanças.

## Próximo passo exato

Revisar o PR e, após aceite/merge pelo proprietário, remover estes arquivos temporários de `instructions/active/` em trabalho posterior.

## Antes de encerrar

- [x] conhecimento permanente foi movido para `docs/`;
- [x] critérios do PRD foram atendidos;
- [ ] usuário/proprietário aprovou;
- [ ] PRD e handoff podem ser removidos de `instructions/active/`.
