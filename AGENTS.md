# Architecture rules

- Keep the circular month picker isolated in `CircularMonthSelect`; only the Gerente GMD seasons block uses its infinite-scroll behavior.- Gerente/Admin screen data is cached in memory via `src/lib/screenCache.ts` (keys include every filter; any successful DB write invalidates; resume refresh only after 5 min); why: back/minimize must not reload screens. Capataz hooks must not use it.
- New app versions never auto-reload except on a cold start (first 15s, never backgrounded) or user click; why: never interrupt work (e.g. a salga) when returning to the app.
