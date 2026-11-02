# PR #76 — Redução segura do payload geográfico do mapa

Data: 2026-11-02. Escopo: otimização **local** para vencer orçamento gzip real da PR #76, sem alterar o orçamento, PWA, autenticação, RLS ou comportamento visual esperado.

## Evidência da revisão

O componente `apps/web/src/components/landing/BrasilMap.tsx` importa `br-states.json` e lê somente `properties.sigla` e `properties.name`; a biblioteca do mapa também recebe a identidade e geometria GeoJSON. Os 27 estados possuíam metadados que não são consumidos na aplicação: `regiao_id`, `codigo_ibg`, `cartodb_id`, `created_at` e `updated_at`.

Foi aplicado **somente o trecho de redução do GeoJSON** do patch já existente na VPS `/home/coder/workspace/CONSUBOV_PR76_BUNDLE_GZIP_20261102.patch`, mantendo `id`, `name`, `sigla`, tipo e coordenadas originais. `Taskfile.yml` passa a executar `apps/web/tests/br-states-integrity.test.cjs` na matriz de regressões.

## Aceite/negativos

- 27 identificadores de estados únicos e geometria intacta, sem redução de vértices ou alteração de coordenadas.
- Hash SHA-256 sobre `[id,name,sigla,geometry]` de todos os 27 estados **antes/depois**: `f204352494b11ef5ec71f12022a092104de39be73b151ffe06929d45b6630db2`.
- Propriedades servidas restritas a `id`, `name`, `sigla`; qualquer mudança de geometria/nome/sigla deve reprovar o teste.
- Bundle real GitHub Actions-like com `GITHUB_EVENT_NAME=pull_request` + evento local com SHA validado, **sem** `CONSUBOV_CI_BUNDLE_BUDGET`.
- Testes inicialmente executados: `node --test apps/web/tests/br-states-integrity.test.cjs` **2/2 PASS**.
- Build real na VPS: raw **8.751.412**, gzip **2.752.928** (teto **2.755.282**, margem **2.354 bytes**), maior arquivo **2.088.907**, 338 assets; `check:bundle-budget`, gate PWA e guard de segredos PASS.

## Restrições de integração

O HEAD local inclui modificações pré-existentes de outra frente de trabalho em CI/PWA, preservadas. Nenhuma worktree adicional, branch remota, migração, segredo, deploy ou `main` foi alterada. Esta otimização resolve apenas o orçamento **local**; status do GitHub no SHA definitivo, Q4 JWT/RLS no schema equivalente, owner F12/L32 e revisão independente Q5 continuam necessários. Nunca usar os testes de mapa/visual para validar autorização no banco.

**Rollback:** reverter somente a remoção dos cinco campos de metadados, o novo teste e a entrada na matriz; não restaurar o resto do pacote de CI do outro agente.

**QA adicional:** repetir o build com outro commit de proveniência, os testes da matriz de regressões e as suítes de frontend/PWA/E2E aplicáveis antes de integrar a qualquer branch.
## QA final da otimização geográfica (02/11/2026)

- TURBO_FORCE=true bun run check: API 626/626 e Web 337/337, build/typecheck PASS, zero cache.
- Node tests de proveniência CI + integridade do mapa: 9/9 PASS.
- CONSUBOV_E2E_PORT=18089 task qa:regressions: 479/479 PASS.
- task qa:offline:browser: 22/22 PASS (Chromium/WebKit).
- task qa:pwa:upgrade-fixture: 44/44 PASS.
- E2E completo com fixtures locais (loopback): 180/180 PASS (desktop/tablet/mobile).
- Audit HIGH, lint changed, PWA release gate, guard de segredos, orçamento real e modelo RLS em memória: PASS; modelo não homologa RLS/JWT HTTP.
- Execução: 13/13 etapas exit 0; fingerprint Git diff antes/depois idêntico; novos arquivos idênticos durante toda a bateria.
- Logs: /tmp/consubov-pr76-map-opt-20261102 e /tmp/consubov-pr76-map-finalqa-20261102.
- Bloqueios: sem auth Git push na VPS, PR remota DRAFT em SHA antigo, CI remoto não verificado no candidato final, Q4 RLS/JWT real/owner e Q5 independente pendentes. MERGE_NO_GO.
