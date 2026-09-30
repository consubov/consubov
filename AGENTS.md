# Architecture rules

## Mandatory project workflow

- Before changing code, read `docs/README.md`, `instructions/README.md`, and the active PRD/handoff in `instructions/active/`.
- Preserve existing visual behavior and every feature that already works unless an active PRD explicitly changes it.
- Existing flows that are not functional yet may remain frontend-only; do not invent missing business rules.
- Keep code small, explicit, testable, and organized by responsibility. Comments should explain domain decisions, constraints, and non-obvious reasons.
- PRDs and handoffs are temporary. After acceptance, move durable knowledge to `docs/` and delete the completed files from `instructions/active/`.

## Existing runtime rules

- Keep the circular month picker isolated in `CircularMonthSelect`; only the Gerente GMD seasons block uses its infinite-scroll behavior.
- Gerente/Admin screen data is cached in memory via `src/lib/screenCache.ts` (keys include every filter; any successful DB write invalidates; resume refresh only after 5 min); why: back/minimize must not reload screens. Capataz hooks must not use it.
- New app versions never auto-reload except on a cold start (first 15s, never backgrounded) or user click; why: never interrupt work (e.g. a salga) when returning to the app.
