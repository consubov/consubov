# HANDOFF-014 — Reconciliação documental e baseline

## PRD relacionado

`PRD-014-reconciliacao-documental-baseline.md`

## Estado atual

Implementação documental concluída na branch `docs/fase-1-baseline`, baseada em `e95a4ea2cfedb5ba757f72b5de925162c6693a1e`, e pronta para revisão. Nenhum arquivo de runtime, pacote, lockfile, workflow ou configuração foi alterado.

## Decisões

- concentrar o baseline em `docs/07-fundacao-monorepo.md`;
- registrar lint do web como dívida conhecida, sem relaxar regras;
- distinguir contratos de segurança de autenticação real;
- não instalar ou atualizar dependências nesta fase;
- manter Supabase remoto, migrations e Vercel bloqueados.

## Validações executadas pelo executor Codex

- `git diff --check`: passou;
- build do monorepo: passou;
- testes: API 13/13 + web 67/67 = 80/80;
- smoke HTTP local da API: health, readiness, OpenAPI e docs passaram;
- lint raiz: continua não verde por dívida legada do web (1.423 erros e 105 warnings);
- nenhum secret real foi adicionado à documentação.

## Arquivos alterados

- `docs/07-fundacao-monorepo.md`;
- `instructions/active/PRD-014-reconciliacao-documental-baseline.md`;
- `instructions/active/HANDOFF-014-reconciliacao-documental-baseline.md`.

## Pendências

- [x] conhecimento permanente registrado em `docs/`;
- [x] critérios técnicos atendidos;
- [ ] revisão e aceite do orquestrador;
- [ ] remover PRD/handoff após aceite.
