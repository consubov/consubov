# Continuidade QA do CONSUBOV — tentativa no Codespace e prova isolada

Data: 2026-10-13. Repositorio unico: `mmatteuus/consubov`; branch `work/fase5-6-7-pwa-local`; PR #43 draft. HEAD remoto de base: `e0f66b0c5ac39d0141eab55b6deda33a67bcd4da`.

## Observacoes reais no Codespace

- VS Code aberto na URL do Codespace `special-garbanzo-jj55qv775vj43pjx4.github.dev`; shell anterior identificava `/workspaces/consubov` e `origin=https://github.com/mmatteuus/consubov`.
- O indicador da branch no VS Code passou de `6↓ 0↑` para `Sincronizar as Alterações` sem contagem pendente apos acionar `Git: Pull`. A lista de alteracoes no Source Control estava vazia. **O SHA do checkout apos o pull nao foi confirmado por saida fresca do shell**; nao registrar FF concluido so pela GUI.
- Tres stashes locais preexistentes foram identificados, sem qualquer operacao de limpeza: `codespace-docs-9d9ca5`, `consubov-prd-gps-preserve-before-ff-20261013`, `consubov-preserve-26-before-documentary-ff`.
- A tentativa de enviar comandos ao terminal pelo Browser-MTS mostrou erro de permissao do clipboard: `Nao e possivel ler da area de transferencia do navegador`. Cliques de automacao retornaram `WebSocket response timeout after 30000ms`.
- O console do VS Code mostrou `Extension host (Remote) is unresponsive` repetidamente, alternando com `responsive`, alem de `Remote network connection appears to have high latency (25584.50ms last, 8780.00ms average)`.
- A tarefa configurada `CONSUBOV: Verificar ambiente` foi selecionada via `Tasks: Run Task`, mas a saida/exit code nao apareceu. **`task doctor` NAO APROVADO/NAO VERIFICADO**.
- A extensao opcional Act/Run havia sido desabilitada somente neste workspace, com notificacoes de act/Docker ausentes apos reload, conforme `docs/qa/codespace-actrun-workspace-2026-10-13.md`. Nao confundir essa correcao de alertas com a saude do extension host remoto.

## Execucao independente no container, com blob Git comprovado

- O arquivo `apps/web/src/lib/conferenciaOffline.ts` da branch de trabalho tem blob Git `f77442eb94dee91b1e7f897942f024b807cbcf44`. A copia local testada apresenta exatamente o mesmo hash Git, confirmado nesta sessao.
- Node `v22.16.0`: `node --experimental-strip-types --test test-runner.mjs` em harness isolado do modulo, **10/10 PASS, 0 FAIL, exit 0**. Casos de retry, isolamento de usuario, ausencia de login, abort, FIFO ao alternar usuario, novo enqueue durante ACK, coalescencia, erro remoto, JSON corrompido, remount apos abort.
- `tsc --project tsconfig.json --pretty false` para esse harness, TypeScript 5.8.3: **exit 0, sem diagnosticos**.
- Limites: o harness substitui o provider externo por stub e nao contem todo o monorepo; esta evidencia NAO e `bun run check`, Vitest oficial do Web, Taskfile, Playwright, auditoria backend ou homologacao.

## Proximos gates (todos [PENDENTE])

1. No unico Codespace CONSUBOV, confirmar `git status --short --branch`, `git rev-parse HEAD`, `git rev-parse origin/work/fase5-6-7-pwa-local`, preservar stashes; executar FF somente se necessario e limpo.
2. Investigar/reparar a responsividade do extension host remoto sem desativar arbitrariamente extensoes de outros agentes. Se a ferramenta nao puder observar o exit code, nao marcar PASS.
3. Executar `task doctor`, `task qa:regressions`, `task qa:check`; registrar `.qa/runs` e sumarizar outputs sanitizados por SHA. Depois executar Vitest Web da Conferencia e browser offline Chromium/WebKit conforme gate.
4. FASES 5-7 permanecem sem aceite integral; FASES 8/9 continuam so em preparo local. Sem CI hospedado, producao, Vercel, DB remoto, migrations, secrets ou merge na main.

Nao foram editados arquivos de codigo, layout ou outros repositorios neste lote.
