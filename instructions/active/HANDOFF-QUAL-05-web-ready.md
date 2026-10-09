# HANDOFF-QUAL-05 — FASE 5 Web Quality e continuidade PWA/Offline

> **Última revisão:** 2026-10-08. Este texto substitui as referências históricas à branch FASE 5 e ao PR #37, que estão congelados/encerrados.

## Estado atual

- **Branch de trabalho:** `work/fase5-6-7-pwa-local`.
- **PR:** #43 (**draft, sem merge**).
- **Checklist:** `CONSUBOV_CHECKLIST_MESTRE.md` e Checklist Mestre Notion.
- **PRD:** `instructions/active/PRD-QUAL-05-web-ready.md` e `ROADMAP-PRD-HANDOFF-FASES-5-6-7-LOCAL-PWA-OFFLINE.md`.
- **FASE 5:** QA LOCAL ainda não aprovado; é necessário rodar suite completa/axe/Lighthouse/security.
- **FASE 6:** PWA-base presente, alguns testes isolados SW existentes. QA LOCAL de migração/upgrade legacy→next ainda não comprovado.
- **FASE 7:** migration engine e fila canônica ainda sem QA local comprovado.
- **FASE 8:** planejamento/preparação local permitidos; conexões e migrations remotas bloqueadas.
- **Homologação física:** adiada para piloto pré-produção, sem bloquear desenvolvimento posterior.

## Runner disponível

O responsável instalou Go Task **3.54.0** (winget) e extensão **Task** do VS Code. Foram versionados:
- `Taskfile.yml`;
- `.vscode/tasks.json` e `extensions.json`;
- `scripts/qa/doctor.sh`, `record.sh`, `run-package-script.sh`, `run-act.sh`;
- `docs/qa/QA-LOCAL-VSCODE-GO-TASK.md`.

Comandos após abrir a raiz do repo no VS Code (reabrir terminal):
```powershell
task doctor
task setup
task qa:check
task qa:pwa:smoke
task qa:phase5
task qa:phase6
task qa:phase7
task qa:all
task qa:act
```

`qa:act` é **opcional** e usa Docker local; não consome minutos GitHub Actions. Scripts de gate `quality:phase6:local` e `quality:phase7:local` **ainda não existem** e os comandos correspondentes foram configurados para **falhar** em vez de aprovar falsamente.

## Última evidência confiável / bloqueios

- Evidência histórica incompleta da FASE 5: E2E registrou **30/48** em execução anterior; fixes posteriores não substituem reexecução local verde. Axe/Lighthouse ainda precisam de gates bloqueantes/thresholds adequados.
- Auditoria independente de 2026-10-08: `docs/qa/auditoria-estatica-2026-10-08.md`.
- Teste isolado SW: **7/7 Node** passou em ambiente isolado conforme relatório da auditoria; não comprova PWA real, WebKit, migração ou zero-loss.
- Para FASE 6: falta harness de navegador real/local que sirva SW legado, semeie IndexedDB/filas/blobs, aplique nova versão no mesmo origin e valide zero perda/rollback.
- Para FASE 7: faltam migrations retomáveis/idempotentes, fila canônica, testes de caos e isolamento tenant/user.

## Próximos trabalhos executáveis

1. Checar `git status` e evitar conflito com alterações locais de outros agentes.
2. Rodar `task doctor`/`task setup`; agente pode instalar **ferramentas locais** faltantes.
3. Executar `task qa:phase5`, corrigir todas as falhas automatizáveis, gerar `.qa/runs/*` e relatório sanitizado por SHA em `docs/qa/`.
4. Implementar e testar os scripts `quality:phase6:local` / `quality:phase7:local` de verdade; nunca devolver PASS falso.
5. Avançar trabalho independente de fases seguintes sem depender de aparelho físico; marcar `HOMOLOGAÇÃO REAL PENDENTE` em vez de declarar teste não executado.
6. Na pré-produção, executar piloto iOS/Android/conectividade rural, upgrade sem perda offline, backup/rollback; sem `PRODUCTION READY` antes disso.
7. Atualizar checklist repositório/Notion e este handoff quando houver evidência real do HEAD.

**Restrições:** nenhuma nova conexão Supabase/PostgreSQL remoto, migration remota, Vercel/deploy, rotação de secrets, merge, publicação ou limpeza de dados reais sem autorização explícita. Não mexer em `apps/mobile/`/Capacitor.

**Relatório final:** SHA + dirty, ferramentas/versões, todos os comandos e exit codes, falhas P0/P1/P2 e correções, QA local por fase, pendências reais, próximos passos e ações externas (esperado: nenhuma).

## Auditoria incremental — 2026-10-09

- Branch ativa permanece `work/fase5-6-7-pwa-local`; **não trabalhar nas refs congeladas**.
- Corrigido Service Worker para servir HTML do shell instalado até atualização explícita e incluir JS/CSS/fonts lazy no precache Vite (commit `0b107013`).
- FASE 5 tem relatório de Lighthouse com thresholds obrigatórios e pendentes de **baseline real aprovado**; logs ficam em `.qa/phase5-*` (commit `2758ac1f`).
- FASE 7 tem inventário readonly das bases IndexedDB legadas e suas keys, sem migração/destruição (commit `a3280f16`).
- **25/25 testes isolados Node PASS** (SW, guard de registro, Vite, orçamento Lighthouse e inventory); sem Bun, Vitest completo, E2E no navegador, Axe, Lighthouse real ou act; QA integral ainda pendente.
- A tentativa de E2E Chromium neste ambiente foi impedida por `ERR_BLOCKED_BY_ADMINISTRATOR` em localhost; deve ser repetida no VS Code do executor.
- Continuação detalhada: `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`.
- Homologação física não impede desenvolvimento, mas **produção e migração remota exigem autorização separada**.

## Handoff operacional — aceleração 2026-10-09

**Fonte de verdade:** PR #43 na branch `work/fase5-6-7-pwa-local`; consultar SHA no VS Code antes de iniciar, pois outros agentes podem ter alterações locais.

**Agora no repositório:** PWA com ativação verificada e timeout conservador; teste estático de cache/build; suite sintética de upgrade Chromium/WebKit local; `IndexedDbLocalDatabase` por tenant/user em banco novo; `commandPolicy` idempotente/ACK explícito; matriz QA que não perde relatórios após falhas; preflight local FASES 8/9 sem deploy. Todos são componentes incrementais, **não foram integrados a todos os fluxos legados**.

**Evidência da auditoria:** 60/60 testes isolados Node PASS e TypeScript estrito dos módulos novos; ainda sem Bun/E2E da aplicação/Playwright browser físico ou virtual rodando nesta conversa. Mais detalhes: `docs/qa/auditoria-local-2026-10-09.md`.

**Executar no VS Code:**
```powershell
task doctor
task setup
task qa:regressions
task qa:offline:core
task qa:pwa:build-preflight
task qa:pwa:upgrade-fixture
task qa:matrix
```
`task qa:matrix` não deve retornar PASS enquanto `qa:phase5/6/7` estiverem pendentes. `task qa:preprod:local-gates` só serve para revisar evidências de QA local e nunca autoriza implantação.

**Pendências principais:** medir/aprovar Lighthouse real; executar E2E completas; migrar IndexedDB sem perda comprovada; integrar Command Queue e adapter com o backend local e teste de caos; preparar dry-runs locais FASE 8 e piloto FASE 9; revisar Playwright WebKit/Chrome com logs.

**Bloqueios externos:** GitHub Actions não usar; deploy/merge/release/remote DB/migrations/secrets proibidos sem autorização explícita. Homologação física fica pendente para o piloto, sem impedir implementar etapas independentes. Atualizar `CONSUBOV_HANDOFF_CONTINUIDADE.md` das Fontes do Projeto após os testes completos.
