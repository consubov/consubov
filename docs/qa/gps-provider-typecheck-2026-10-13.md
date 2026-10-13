# QA no Codespace — FASE 6, TypeScript do teste GPS

**Ambiente:** unico Codespace `special garbanzo`, `/workspaces/consubov`, origin `https://github.com/mmatteuus/consubov`, branch `work/fase5-6-7-pwa-local`, PR #43 draft. Data: 2026-10-13.

## Falha real (RED) e diff minimo
Depois de fast-forward limpo para `681c9144555a356c303b64e65b232f24d1c81095`, `task qa:check` falhou com exit 2 dentro do runner (wrapper reportou `CHECK_EXIT=201`) durante o typecheck:
```text
apps/web/src/platform/adapters/BrowserLocationProvider.test.ts(49,24):
TS2322 Type 'void' is not assignable to type 'Pick<Geolocation, "getCurrentPosition">'.
```
Causa: um getter somente com `throw` nao declarava explicitamente o tipo esperado pelo ambiente da fixture. Alterou-se **uma linha do teste**, de `get geolocation() { throw Error("blocked"); }` para `get geolocation(): Pick<Geolocation, "getCurrentPosition"> { throw Error("blocked"); }`. Nenhum codigo de runtime, provider, UX, IndexedDB ou persistencia foi alterado.

## Verificacoes realmente executadas (PRE-PUSH)
- Em `e0f66b0c` limpo: `task doctor` PASS exit 0 (Bun 1.4.0; Go Task 3.54.0); `task qa:regressions` **191/191 PASS, exit 0**, evidencias `.qa/runs/20261013T185600Z-regressions-e0f66b0c5ac3-2243/result.json`.
- Em `681c9144` apos alterar apenas o teste (dirty=true): `cd apps/web && bun run typecheck` **PASS**; `bun run test src/platform/adapters/BrowserLocationProvider.test.ts` **12/12 PASS, exit 0**; `task qa:check` **PASS exit 0** com tipagem e builds API/Web e Vitest Web **171/171 em 42 arquivos**. Evidencia `.qa/runs/20261013T190022Z-check-681c9144555a-4368/result.json`.
- `cd apps/web && bunx eslint src/platform/adapters/BrowserLocationProvider.test.ts` PASS exit 0. `git diff --check` sem diagnosticos. `git status` reportava somente 1 arquivo modificado. Blob da fonte exata validada: `477952d3743b5048ad07c5afdbca0d8ab0134513`.

**PENDENTE:** apos publicar, atualizar checkout por fast-forward, confirmar a igualdade do blob e executar QA em HEAD com `dirty=false`; os testes acima nao sao prova de aprovacao no commit publicado. Permanecem pendentes FASES 5–7 integrais, Chromium/WebKit, idempotencia multiaba, auth/tenant no backend e QR em dispositivo real. Sem CI hospedado, Docker/act, remoto, migration, Vercel ou deploy.

Os tres stashes antigos de outros executores permanecem preservados.
