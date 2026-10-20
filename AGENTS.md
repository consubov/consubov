# Architecture rules

## Git baseline for human and AI continuity

- **Codex no VS Code local:** executar o handoff `instructions/active/HANDOFF-CODEX-LOCAL-FASES5-9-2026-10-13.md` e o PRD ativo FASES 5–9. O Codex deve fazer `pull --ff-only` da branch de trabalho depois de confirmar clone correto e arvore limpa; nao criar branches nem PRs adicionais.

- **Branch canônica de produção unificada:** A branch `main` é agora a única branch ativa do repositório (todas as entregas das FASES 5, 6 e 7, bem como a separação Site Institucional vs App Nativo, foram repassadas e unificadas em `main`). Branches de trabalho secundárias foram incorporadas e removidas. Trabalhar diretamente sobre `main` com árvore limpa.
- Before a local pull or agent edit, read `docs/68-sincronizacao-local-e-agentes.md`, inspect `git status --short --branch` and `git diff`, fetch origin, and require fast-forward only on a clean target branch. Preserve uncommitted files, stashes and other agents' work; never use hard reset, forced push or blind merges.
- One Codespace `special garbanzo` was verified clean on `396bf2ff`; real local gates passed including `qa:check`, offline core, PWA smoke/build, and Chromium/WebKit offline queue. Evidence and nonapproved gates: `docs/qa/qa-real-monorepo-2026-10-13.md`. Four stashes remain and must not be dropped. Always recheck HEAD before QA; these are not full phase or production acceptance.
- This project follows PWA React/Vite plus IndexedDB; Capacitor/SQLite are historical experiments, not active. Follow existing acceptance gates; a Git cleanup is not a production release.

- Writing to any other repository (including MarkMap) is forbidden unless the user explicitly authorizes it. Reference-only consultation may be read-only and must not navigate or mutate another product when operating the CONSUBOV Codespace.

## Mandatory project workflow

- Before changing code, read `CONSUBOV_HANDOFF_CONTINUIDADE.md` and `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`, then `CONSUBOV_CHECKLIST_MESTRE.md`, `docs/README.md`, `instructions/README.md`, and the active PRD/handoff in `instructions/active/`.
- `CONSUBOV_CHECKLIST_MESTRE.md` is the current operational status. Its linked archive preserves every detailed phase requirement; read the relevant phase chapter before implementation. Historical progress labels do not approve the current revision.
- When you complete an item that is explicitly programmed/assigned in the checklist or active PRD, update `CONSUBOV_CHECKLIST_MESTRE.md` in the same work: mark it `[x]` only with objective evidence and record that evidence briefly. Do not mark items you did not execute or items outside your assigned scope.
- Preserve existing visual behavior and every feature that already works unless an active PRD explicitly changes it.
- Existing flows that are not functional yet may remain frontend-only; do not invent missing business rules.
- Keep code small, explicit, testable, and organized by responsibility. Comments should explain domain decisions, constraints, and non-obvious reasons.
- PRDs and handoffs are temporary. After acceptance, move durable knowledge to `docs/` and delete the completed files from `instructions/active/`.
- A branch oficial é `main` e deve-se preservar o histórico limpo e as entregas homologadas. Não criar branches nem PRs desnecessários.

## QA local obrigatório (Go Task + VS Code)

- Usar somente o `Taskfile.yml` da raiz no VS Code e `docs/qa/QA-LOCAL-VSCODE-GO-TASK.md` como guia operacional; seguir os scripts efetivamente existentes, não inventar comandos.
- O executor pode instalar ferramentas **locais** necessárias (Git Bash/Node/Bun, browsers Playwright, extensões VS Code; act/Docker são opcionais), verificando versões e sem tocar em produção.
- Executar `task doctor`, `task setup` e os gates por fase; registrar `.qa/runs/**/result.json` + `output.log` e produzir relatório sanitizado por SHA em `docs/qa/`.
- A matriz deve comprovar estabilidade do código durante a execução. `sourceUnchanged`, `finalCommit`, SHA inicial e estado dirty precisam ser coerentes; não aprovar a revisão atual usando evidência antiga, nula, simulada ou de outro checkout.
- `qa:pwa:smoke` é parcial; scripts FASE 6/7 inexistentes devem falhar até sua implementação, sem sinal verde fictício.
- Progredir na **implementação** com `DEV LOCAL READY` comprovado; pendência exclusiva de teste em aparelho real não bloqueia desenvolvimento posterior. Trabalho independente pode prosseguir mesmo com QA pendente, sem marcar fase como aprovada.
- **HOMOLOGAÇÃO REAL PENDENTE** é requisito antes de liberar a nova PWA a usuários em produção; não substitui testes automatizados locais de dados, segurança, tenant e migração.
- GitHub Actions hospedado não é dependência do QA local; `act` opcional roda somente em Docker local. Banco remoto, deploy, migrations e secrets permanecem condicionados à autorização explícita.

## Existing runtime rules

- Keep the circular month picker isolated in `CircularMonthSelect`; only the Gerente GMD seasons block uses its infinite-scroll behavior.
- Gerente/Admin screen data is cached in memory via `apps/web/src/lib/screenCache.ts` (keys include every filter; any successful DB write invalidates; resume refresh only after 5 min); why: back/minimize must not reload screens. Capataz hooks must not use it.
- New PWA updates require explicit user consent and verified worker activation. Recheck critical work at the side-effect boundary after asynchronous waits; never purge the installed offline shell on manual refresh. A cold start alone is not consent to interrupt work.
- **Site vs. App Separation (`docs/70-separacao-site-e-app-nativo.md`):** The institutional site (`/` and `/relatto`, built via `bun run build:site` into `apps/web/dist-site`) and the operational App (`app.*` subdomain, built via `bun run build` into `apps/web/dist`) are separated. Header CTAs on Landing Pages must say **"Baixar App"** (pointing to `/baixar` or `VITE_APP_URL/baixar`), never `"Entrar"`. Never mention the acronym `"PWA"` in user-facing UI or copy—always refer to it as **"App"** or **"Aplicativo"**. On the `app.*` subdomain (`VITE_SURFACE_MODE=app`), opening routes in a regular browser tab redirects to `/baixar`; users access the system exclusively via the installed home-screen/device icon (`standalone` mode, which routes `/` and `/baixar` directly to `/app` or `/consultor`).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
