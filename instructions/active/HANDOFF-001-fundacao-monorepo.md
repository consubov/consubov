# HANDOFF-001 — Fundação do monorepositório

## Status

`IN_REVIEW`

## Estado atual

A reorganização estrutural está pronta para revisão final na branch `refactor/monorepo`.

### Concluído

- aplicação preservada em `apps/web`;
- Lovable removido;
- Bun/Turborepo configurados;
- apenas `bun.lock` mantido;
- `.env` fora do Git e `.env.example` disponível;
- cliente Supabase usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`;
- Vite carrega env da raiz do monorepo;
- scaffolds vazios de `packages/` removidos;
- `apps/api` permanece somente como reserva arquitetural, sem scripts falsos de build/test/lint;
- testes de PDF mantêm timeout apenas nos quatro casos realmente pesados, sem aumentar timeout global;
- Vitest usa credenciais locais fictícias de teste, nunca credenciais de produção;
- configuração do Turbo inclui variáveis de ambiente no hash/cache;
- documentação atualizada;
- CI de PR criado para `bun install --frozen-lockfile`, build e testes.

## Estrutura atual

```text
consubov/
├── apps/
│   ├── web/
│   └── api/
├── supabase/
├── docs/
├── instructions/
├── turbo.json
├── package.json
└── bun.lock
```

## Validação

A execução local anterior foi reportada com 36/36 testes passando. O Pull Request deve revalidar build e testes após este hardening final; o resultado do CI é a fonte de verdade para o merge.

O lint legado ainda possui problemas pré-existentes e não é critério de bloqueio desta refatoração.

## Restrições preservadas

- nenhum redesign;
- nenhuma regra de negócio alterada;
- nenhum fluxo funcional removido;
- invariantes de cache/offline descritas em `AGENTS.md` permanecem obrigatórias.

## Encerramento

Após CI verde e aceite do PR:

1. mover qualquer conhecimento permanente restante para `docs/`;
2. remover este handoff e o PRD ativo;
3. fazer merge em `main`;
4. excluir `refactor/monorepo`.
