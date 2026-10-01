# HANDOFF-SEC-04 — Hardening e auditoria das Edge Functions legadas

## PRD relacionado

PRD-SEC-04 (recebido via prompt; sem arquivo em `instructions/active/`).
Checklist Mestre: item 1.6.

## Estado atual

Trabalho concluído e com QA independente aprovado em 2026-10-01:

- Inventário das **10** Edge Functions + matriz de segurança + matriz de
  testes negativos em `docs/16-seguranca-edge-functions-legadas.md` (§8–§12,
  anexado ao doc do SEC-02 sem alterar seu conteúdo).
- Hardening em 4 funções fora dos PRDs paralelos:
  `syncvet-delete-equipe` (IDOR crítico corrigido),
  `analisar-retiro`, `reset-password`, `syncvet-calcular-trajeto`.
- 37 testes negativos novos, todos verdes (15 + 11 + 11).
- Funções de SEC-01/02/03 **não tocadas**.

## Decisões tomadas

- Mesma-empresa OU admin-global em `syncvet-delete-equipe`: deriva do
  frontend escopado por `empresa_id` + padrão `requireAdmin` existente; sem
  trava por perfil interno ([PENDENTE], sem evidência de regra).
- `relatto-demo-signup` mantido público: fechar quebraria o
  `RelattoDemoModal` anônimo ([PENDENTE] captcha/rate-limit).
- CORS `*` mantido: sem lista de origens no repo ([PENDENTE] produto).
- `syncvet-calcular-trajeto` sem teste executável: imports `npm:` não
  resolvidos pelo runner vitest (não convertidos p/ `esm.sh` p/ não arriscar
  deploy); só revisão + parse validado.

## Arquivos alterados

- `supabase/functions/syncvet-delete-equipe/index.ts` (+ `index.test.ts`)
- `supabase/functions/analisar-retiro/index.ts` (+ `index.test.ts`)
- `supabase/functions/reset-password/index.ts` (+ `index.test.ts`)
- `supabase/functions/syncvet-calcular-trajeto/index.ts` (sem teste — motivo acima)
- `docs/16-seguranca-edge-functions-legadas.md` (§8–§12 adicionados)

## Pendências

- [ ] Marcar item 1.6 no Checklist Mestre (Notion — sem acesso pelo repo).
- [ ] Riscos [PENDENTE] p/ produto: push aberto (SEC-03), CORS, perfis
  SyncVet, auditoria persistente, PII em log do create-user (SEC-01).
- [ ] Commit/push SOMENTE com autorização explícita.

## Validações executadas

- [x] testes: `node ../../apps/web/node_modules/vitest/vitest.mjs run`
  (workdir `supabase/functions`) → 83 passam; 7 falham pré-existentes em
  `_shared/auth.test.ts` (fora do escopo, SEC-01).
- [x] sweeps: sem `*.message` interno ao cliente, sem token/segredo/PII em
  logs, service role só server-side.
- [x] `bun run typecheck` → api OK (web não possui script typecheck).
- [x] `bun run build` → api + web, 2 successful, EXIT=0.
- [x] `bun run lint` → api OK; web EXIT=1 com dívida pré-existente
  (1422 errors/106 warnings, zero em `supabase/functions`; nada em
  `apps/*` alterado aqui).
- [x] QA independente: **QA: APROVADO** (11 itens, evidências arquivo:linha).

## Riscos / atenção

- Convivência: working copy contém trabalho SEC-02 (seed/cleanup,
  `bun.lock`, `package.json`) + docs/13,14,16,adr (não meus) — preservar;
  `docs/16` foi renomeado 15→16 pelo agente paralelo durante este trabalho.
- `bun.lock`/`package.json`: não tocar (trabalho paralelo).
- Runner canônico: raiz tem vitest 5.0.3 quebrado (vite 5.4 sem
  `./module-runner`); usar vitest 3.2.4 do `apps/web` via node.

## Próximo passo exato

1. Responsável revisa diff (`git status`/`git diff`) e autoriza commit/push.
2. Marcar 1.6 no Checklist Mestre (Notion) — texto pronto abaixo.
3. SEC-03 pode usar este inventário p/ `send-push-notification`.

### Texto pronto para o Checklist Mestre (Notion), item 1.6

> **1.6 — Hardening das Edge Functions legadas: CONCLUÍDO (PRD-SEC-04,
> 2026-10-01, QA: APROVADO).** 10 funções inventariadas
> (`docs/16-seguranca-edge-functions-legadas.md` §8): verify_jwt=false =
> send-push-notification, relatto-demo-signup; service role = 8; CORS `*`
> privilegiado = 9; logs com PII = create-user (SEC-01); admin = 5;
> destrutivas = 4 (+2 rollbacks). Hardening em 4 funções fora dos PRDs
> paralelos (syncvet-delete-equipe/analisar-retiro/reset-password/
> syncvet-calcular-trajeto) + 37 testes negativos verdes. Validações:
> edge-tests 83 OK (7 falhas pré-existentes SEC-01), `typecheck` OK,
> `build` OK (EXIT=0), `lint` só dívida pré-existente da web.
> Pendências [PENDENTE] p/ produto: push aberto (SEC-03), CORS, perfis
> SyncVet, auditoria/rate-limit, PII create-user. Nenhuma ação
> remota/irreversível; sem commit/push sem autorização.

## Antes de encerrar

- [x] conhecimento permanente foi movido para `docs/`;
- [x] critérios do PRD foram atendidos (exceto Notion, sem acesso);
- [ ] usuário/proprietário aprovou;
- [ ] PRD e handoff podem ser removidos de `instructions/active/`.
