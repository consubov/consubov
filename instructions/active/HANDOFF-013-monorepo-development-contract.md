# HANDOFF-013 — Contrato de desenvolvimento do monorepositório

## PRD relacionado

`PRD-013-monorepo-development-contract.md`

## Estado atual

Auditoria e implementação concluídas sobre o baseline `5e41a2bd5c50039e729ffc0b5f873a3f6ed10565` na branch `refactor/monorepo-structure-phase-2`. O trabalho está pronto para revisão, sem merge.

## Decisões tomadas

- usar o `typecheck` raiz no CI, pois ele é o contrato explícito criado na Fase 1;
- manter o smoke HTTP no workflow: ele sobe o artefato compilado e consulta apenas `127.0.0.1`;
- não alterar `turbo.json`: tarefas, dependências e outputs correspondem aos scripts atuais;
- não alterar o devcontainer: versão do Bun, frozen install e portas já estão corretos;
- não executar `bun run lint` como gate, pois a dívida legada do web é real e não deve ser mascarada.

## Arquivos alterados

- `instructions/active/PRD-013-monorepo-development-contract.md`
- `instructions/active/HANDOFF-013-monorepo-development-contract.md`
- `package.json`
- `.github/workflows/ci.yml`
- `README.md`
- `docs/05-fluxo-de-desenvolvimento.md`
- `docs/07-fundacao-monorepo.md`
- `docs/08-github-free-codespaces.md`
- `.gitignore`
- `.npmrc` (removido)

## Pendências

- [x] implementar contrato agregado e ajuste do CI;
- [x] atualizar documentação permanente;
- [x] executar e registrar validações completas;
- [x] abrir Pull Request para `main` sem fazer merge.

## Validações executadas

- [x] `bun --version` → `1.3.12`
- [x] `bun install --frozen-lockfile`
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] smoke HTTP local do workflow
- [x] `bun run test` → API 13 testes; web 74 testes
- [x] `bun run check`
- [x] JSON, YAML e `git diff --check`
- [x] integridade de `apps/web/src`, `apps/api/src`, `supabase/` e `bun.lock`

## Riscos / atenção

- não confundir o typecheck verde da API com o lint completo do web;
- não fazer requests para Supabase, Vercel ou qualquer host remoto;
- os warnings legados do build web continuam visíveis e fora deste escopo.

## Próximo passo exato

Revisar o Pull Request e seu CI. Não fazer merge antes do aceite do proprietário.

## Antes de encerrar

- [x] conhecimento permanente foi movido para `docs/`;
- [x] critérios do PRD foram atendidos;
- [ ] usuário/proprietário aprovou;
- [ ] PRD e handoff podem ser removidos de `instructions/active/`.
