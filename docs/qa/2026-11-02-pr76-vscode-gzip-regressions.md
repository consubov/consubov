# PR #76 — pacote local de correção e QA no VS Code da VPS

**Estado de origem:** `main=0de7260278551194d170b297495bbe4de5e3a667`; PR #76 `51b540e23fe453f54bdb7ec183c084fec0eb506c`. Checkout de QA autônomo: `/home/coder/workspace/consubov-pr76-head51-localqa-20261102`. Nenhum merge no `main`, banco remoto ou deploy.

## Causa e correções

- O HEAD publicado da PR #76 no build local usando `GITHUB_ACTIONS=true` e evento sintético do PR resultou em gzip **2.755.506 > 2.755.282** (NO-GO). Não aumentar os limites.
- `apps/web/src/hooks/useGerenteData.ts`: consolidou em um único `useMemo` a segmentação e ordenação de observações do escopo carregado, com a mesma comparação de datas e filtro de `resolvido`; reduz hooks/duplicação sem alterar o comportamento de autorização.
- `apps/web/tests/sw-build-injection.test.cjs`: fixture de VM passou a reconhecer o import `node:child_process` do novo código CI, usando `execFileSync` bloqueante e ambiente `GITHUB_ACTIONS=false` na fixture. O teste cobre o plugin real e rejeita operações Git acidentais; a proveniência no CI continua coberta por 4 testes separados.
- A aplicação segue com `Date.now()` para builds fora do GitHub Actions. Nenhuma mudança na RLS, no replay offline ou nos limits de bundle.

## Execuções realizadas

1. `bun install --frozen-lockfile --ignore-scripts`: PASS, Bun 1.4.0.
2. `GITHUB_ACTIONS=true GITHUB_EVENT_NAME=pull_request GITHUB_EVENT_PATH=<fixture sintética contendo SHA 51b540e2> bun run check`: PASS, Web **337/337** e typecheck/build.
3. `bun run --cwd apps/web test -- src/lib/observacoesGuard.test.ts`: **10/10 PASS**.
4. `bun run --cwd apps/web report:bundle && bun run --cwd apps/web check:bundle-budget`: PASS, **raw=8.754.367**, **gzip=2.755.108**, teto gzip 2.755.282 (**174 B** de margem), maior ativo 2.092.192.
5. `bun audit --audit-level=high`: PASS, 0 vulnerabilidades HIGH; `bun run --cwd apps/web check:dist-secrets`: PASS.
6. `task qa:security`: PASS após instalar no checkout o Gitleaks 8.30.1 já homologado da mesma VPS, SHA-256 `88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509` verificado conforme script. 0 sinais API/Web; sinais de source/history classificados, sem ignorar checks.
7. `CONSUBOV_E2E_PORT=18087 task qa:regressions`: **477/477 PASS** após correção da fixture SW; 8080 estava ocupada e não foi interrompida.
8. `task qa:offline:core`: **61/61 PASS**.
9. `task qa:pwa:smoke`: **32/32 PASS**.
10. `node --test apps/web/tests/sw-build-injection.test.cjs`: **2/2 PASS**; `CONSUBOV_E2E_PORT=18087 node --test scripts/tests/playwright-listener-integrity.test.mjs`: **3/3 PASS**.

**Limites da evidência:** o QA executou em árvore local com diff não publicado sobre SHA 51b540e2. O gzip depende também do timestamp do próximo commit; após criar commit e atualizar branch, deve ser reexecutado no SHA exato e verificado o CI oficial. Os scripts SQL sintéticos PostgreSQL 17 GREEN e JWT SQL simulado das rodadas anteriores **não** substituem Q4 em schema equivalente real.

## Bloqueios para integração real na main

- **Git remoto por VS Code não autenticado:** `GIT_TERMINAL_PROMPT=0 git push --dry-run origin HEAD:refs/heads/fix/app/f12-l34-observacoes-ack-20261029` -> exit 128 (`could not read Username for https://github.com`); não buscar credenciais ou usar conector GitHub contra pedido do responsável.
- **Segurança F12/Q4:** RLS/JWT HTTP A/B, schema/RPC/ACL/triggers equivalentes, replay e owner F12/L32 continuam sem aprovação.
- **Q5:** revisão independente ainda ausente. Não autoaprovar, não liberar DRAFT ou integrar na main à força.
- **Numeração:** seq033 / 2.0.33 apenas CANDIDATA após primeiro merge elegível; não criar release/version bump antes.

**Rollback local:** reverter somente o commit com este diff se reprovado; não apagar dados, IndexedDB, filas, branches de outros agentes, políticas de produção ou stashes. O Handoff Vivo/Checklist Mestre devem registrar este checkpoint; Handoff estático do Projeto precisa reconciliação posterior.
