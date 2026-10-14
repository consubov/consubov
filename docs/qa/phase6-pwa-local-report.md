# Relatório Técnico Local: FASE 6 (PWA Local Ready — Remediação Consolidada)

**Data-base de Execução:** 2026-10-14T05:38:44Z até 2026-10-14T05:41:03Z  
**Branch:** `work/fase5-6-7-pwa-local` (PR #43 draft)  
**HEAD Commit:** `6cf987874a7c6bf20c1bb9243cfb4c36a7331600`  
**Working Tree:** `dirty=true` (desenvolvimento local ativo e controlado)  
**Registro de Evidência:** `.qa/runs/20261014T053844Z-phase6-6cf987874a7c-688/result.json`  
**Status do Gate:** `PASS` (`commandExitCode: 0`, `sourceUnchanged: true`, `exitCode: 0`)  
**Fingerprint de Integridade:** `68f95d5b68ef6788110eacb83edc93d1c2a4b01679ddaccf5b57fb4b2d2ef1b1`

---

## 1. Resumo Executivo da Fase 6 (Iteração 2 — Remediação)

A FASE 6 (PWA Local Ready) comprova a substituição in-place da PWA legada em uso para a nova versão na mesma origem/escopo (`/`), assegurando:
1. **Preservação de Dados Legados (Zero Perda):** Retenção e integridade absoluta das 6 bases IndexedDB legadas (`consubov-capataz`, `consubov-session`, `consubov-consultor-offline`, `mais-arrobas-offline`, `mais-arrobas-sync`, `consubov-fotos-salga`) e de suas chaves em `localStorage`, incluindo registros pendentes e anexos binários (`Blob` e `ArrayBuffer`).
2. **Atualização Sob Consentimento Explícito:** O novo Service Worker nunca ativa silenciosamente via `skipWaiting` automático. A ativação requer ação deliberada do usuário na interface (`UpdateBanner` / `AtualizarAppButton`), com bloqueio ativo e adiamento automático caso haja operações críticas de campo em andamento (`hasCriticalOperations()`, pesagens ativas, conferências).
3. **Precache Atômico Fail-Closed e Rollback:** O Service Worker injeta todos os 643 assets construídos (rotas lazy, fontes, estilos e scripts). Caso o download de 1 chunk lazy falhe (ex: 404), todo o novo precache é descartado atomicamente e a versão legada em cache permanece ativa e servindo o shell intacto.
4. **Matriz Estrita de Detecção Passiva de Capacidades (`BrowserCapabilities`):** Remediação definitiva de checagens passivas em `BrowserLocationProvider.ts` aplicando verificação estrita de função (`typeof safeRead(...) === "function"`) para `share`, `badging`, `wakeLock` e `webrtc`, eliminando 100% de falsos positivos com `null`, primitivos ou objetos não invocáveis.
5. **Resiliência do Harness Playwright no Windows NTFS:** Remediação definitiva de locks de I/O (`EBUSY: chrome_debug.log`) e colisões transitórias de traces (`ENOENT`) através de `--disable-logging`, `--log-level=3`, drenagem de páginas ativas, fechamento tolerante de contexto e limpeza com retry exponencial (`safeRemoveProfile`).
6. **Isolamento de Ambiente e Gate Local:** Exportação impositiva de `PLAYWRIGHT_BROWSERS_PATH` local ao repositório em `scripts/run-phase6-local.sh`, execução com concorrência zero e validação com `sourceUnchanged: true` via `task qa:phase6`.

---

## 2. Matriz de Execução e Cobertura de Testes (Iteração 2 Remediada)

| Step | Suíte / Script | Escopo Testado | Total | PASS | FAIL | SKIP | Duração |
|---|---|---|---|---|---|---|---|
| 1 | `node scripts/qa/check-pwa-build.mjs` | Validação estática de `manifest.json` (`id: "/"`, `scope: "/"`, `start_url: "/"`, `display: "standalone"`), `version.json` e injeção de 643 assets | 1 | 1 | 0 | 0 | ~20ms |
| 2 | `apps/web/tests/sw-*.test.cjs` + scripts precache | Integridade do SW, ciclo de vida, skipWaiting restrito, precache atômico e injeção | 43 | 43 | 0 | 0 | ~4.5s |
| 3 | `apps/web/tests/legacy-offline-*.test.cjs` | Inspeção read-only das 6 bases legadas, isolamento e proibição de `deleteDatabase` | 11 | 11 | 0 | 0 | ~628ms |
| 4 | Vitest runtime (`swUpdateConsent` + `BrowserLocationProvider`) | Consentimento em runtime, adiamento sob operação crítica, matriz estrita de capabilities com 32 testes unitários | 35 | 35 | 0 | 0 | ~2.16s |
| 5 | Playwright (`upgrade.spec.ts`, `legacy-inventory.spec.ts`, `queue-atomic.spec.ts`) | Upgrade legado→novo em Chromium e WebKit com perfis persistentes, retenção de Blobs e filas (34 testes) | 34 | 34 | 0 | 0 | 1.2m |
| **Total** | **Gate `task qa:phase6` Consolidado** | **Todas as suítes automatizadas da FASE 6** | **124** | **124** | **0** | **0** | **139s** |

---

## 3. Comprovação das Garantias Técnicas e Remediações

### 3.1. Preservação das 6 Bases IndexedDB e LocalStorage
- **Bases validadas:**
  1. `consubov-capataz` (v7) — 12 object stores preservadas intactas.
  2. `consubov-session` (v1) — 2 stores mantidas com sessões offline.
  3. `consubov-consultor-offline` (v2) — 3 stores com Blobs e ArrayBuffers de fotos intactos.
  4. `mais-arrobas-offline` (v1) — 1 store com tabelas operacionais.
  5. `mais-arrobas-sync` (v2) — 2 stores com filas atômicas e inserts confirmados.
  6. `consubov-fotos-salga` (v1) — 2 stores com anexos de fotos.
- **LocalStorage:** Chaves preservadas (`pending_backup`, `ma-offline-mode`, `ma_pesagem_ativa`, `relatto:pwa-profile`, etc.).
- **Provas Playwright:** Executadas em `pwa-chromium` e `pwa-webkit` sob `persistentTest.ts`.

### 3.2. Consentimento Explícito e Não-Interrupção de Campo
- O Service Worker novo permanece em estado `installed/waiting` sem ativar automaticamente.
- A função `applyPendingUpdateNow()` consulta `hasCriticalOperations()`. Se houver pesagem em andamento (`ma_pesagem_ativa === 'true'`), a ativação é agendada para pós-drenagem (`onCriticalOperationsDrained`).
- O reload do shell só é invocado após consentimento comprovado e confirmação do evento `controllerchange`.

### 3.3. Precache Atômico e Fallback
- Se qualquer asset retornar código de erro HTTP (ex: 404 em chunk lazy), a função `precacheAppShell()` deleta as caches temporárias da versão em instalação e rejeita a promise de instalação.
- A versão legada ativa permanece respondendo normalmente sem qualquer degradação para o usuário.

### 3.4. Detecção Estrita de Capacidades e Eliminação de Falsos Positivos
- Em `BrowserLocationProvider.ts`, as checagens passivas utilizam `typeof safeRead(...) === "function"`:
  - `share`: `typeof safeRead(() => nav?.share) === "function"`
  - `badging`: `typeof safeRead(() => nav?.setAppBadge) === "function"`
  - `wakeLock`: `typeof safeRead(() => (nav?.wakeLock as { request?: unknown } | null | undefined)?.request) === "function"`
  - `webrtc`: `typeof safeRead(() => environment.rtcPeerConnection) === "function"`
- Valores como `null`, primitivos (`false`, `0`, `""`) ou objetos não invocáveis (`{}`) retornam estritamente `false`.
- Testes parametrizados adicionados cobrindo 32 cenários em `BrowserLocationProvider.test.ts` com 100% PASS.

### 3.5. Resiliência de Teardown no Windows
- `persistentTest.ts` configurado com `--disable-logging` e `--log-level=3` no Chromium, fechamento ordenado de páginas via `context.pages()`, `context.close()` tolerante a race conditions de traces no NTFS e função `safeRemoveProfile` com retries exponenciais (até 5 tentativas com backoff incremental de 150ms).
- `playwright.pwa.config.ts` atualizado para `trace: "off"`, mantendo diagnóstico visual via `screenshot: "only-on-failure"`.

---

## 4. Status de Homologação e Pré-Requisitos de Campo

- **DEV LOCAL READY:** **APROVADO.** O harness automatizado local Playwright (Chromium e WebKit) e as suítes de integridade comprovaram 100% de sucesso local sem regressões (`sourceUnchanged: true`).
- **HOMOLOGAÇÃO REAL PENDENTE:** Testes físicos em aparelhos móveis de campo reais (iOS Safari e Android Chrome com câmera de hardware, escaneamento de brinco bovino e ausência de sinal rural) permanecem como pendência controlada a ser realizada no piloto da FASE 9. Esta pendência física não bloqueia o desenvolvimento local das FASES 7 e 8.
