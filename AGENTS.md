# Architecture rules

## Mandatory project workflow

- Before changing code, read `CONSUBOV_CHECKLIST_MESTRE.md`, then read `docs/README.md`, `instructions/README.md`, and the active PRD/handoff in `instructions/active/`.
- `CONSUBOV_CHECKLIST_MESTRE.md` is the operational checklist for repository agents; do not depend on Notion access.
- When you complete an item that is explicitly programmed/assigned in the checklist or active PRD, update `CONSUBOV_CHECKLIST_MESTRE.md` in the same work: mark it `[x]` only with objective evidence and record that evidence briefly. Do not mark items you did not execute or items outside your assigned scope.
- Preserve existing visual behavior and every feature that already works unless an active PRD explicitly changes it.
- Existing flows that are not functional yet may remain frontend-only; do not invent missing business rules.
- Keep code small, explicit, testable, and organized by responsibility. Comments should explain domain decisions, constraints, and non-obvious reasons.
- PRDs and handoffs are temporary. After acceptance, move durable knowledge to `docs/` and delete the completed files from `instructions/active/`.

## Existing runtime rules

- Keep the circular month picker isolated in `CircularMonthSelect`; only the Gerente GMD seasons block uses its infinite-scroll behavior.
- Gerente/Admin screen data is cached in memory via `apps/web/src/lib/screenCache.ts` (keys include every filter; any successful DB write invalidates; resume refresh only after 5 min); why: back/minimize must not reload screens. Capataz hooks must not use it.
- New app versions never auto-reload except on a cold start (first 15s, never backgrounded) or user click; why: never interrupt work (e.g. a salga) when returning to the app.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
