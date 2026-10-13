# QA local - snapshots de transicao e lifecycle da fila

## Retomada verificada da fila - 2026-10-13 UTC
Base `651534fb6a7e854658f1f6db1737e5ee322df8a3`, branch `work/fase5-6-7-pwa-local`, PR #43 draft; checkout dirty. Este bloco prevalece sobre status historicos, nao sobre criterios de aceite.

- [x] Corrigidas transicoes de ACK/conflito/retry que liam o envelope depois da espera: mutacao posterior nao valida tentativa antiga nem invalida uma tentativa aceita. Payload persistido, IDs, tenant/user, Blob e ArrayBuffer preservados.
- [x] Abertura IndexedDB abandonada: sucesso tardio fecha a conexao; upgrade tardio aborta antes de criar stores. Recuperacao explicita, versao/schema e seis bases legadas nao foram alterados.
- [x] RED: 6 falhas de snapshot em Node, 12 casos de navegador reprovados, 2 falhas de lifecycle. GREEN: 8/8 Node; regressao completa 191/191; PWA 34/34 Chromium/WebKit sem retries; check sem cache API 539/539 e Web 146/146, build/tipagem PASS; lint 0 erros/14 avisos. Fonte estavel por SHA-256.
- [ ] Aceite integral das FASES 5/6/7 e producao. Lighthouse anterior 44/home e 68/login nao foi reexecutado nem aprovado; migracao legada, sync autenticado, ordem causal e piloto fisico continuam pendentes. E2E geral 111/111 pertence a rodada anterior, nao a nova execucao.

As 17 alteracoes do lote anterior foram preservadas. A consolidacao documental enviada anteriormente nao existia no Codespace; este registro e o manifesto novo a substituem, sem alegar existencia do manifesto antigo. Preparacao local das FASES 8/9 e tarefas independentes continuam permitidas. Nao esperar testes fisicos para desenvolver; nao afrouxar integridade/seguranca.

Git: nenhum commit/push/sync realizado nesta retomada; origin conhecido um commit documental a frente (`d988ff32`, FASE 11). Nao contornar a recusa anterior de sincronizacao. Preservar o planejamento FASE 11 e reconciliar os documentos compartilhados antes da publicacao. Sem banco remoto, migrations remotas, deploy ou CI hospedado. Auto-revisao do executor; nenhum revisor independente foi simulado.

Relatorio: `docs/qa/queue-transition-snapshot-2026-10-13.md`. Manifesto sanitizado: `docs/qa/evidence/2026-10-13-queue-continuation-local.json`. Checklist Mestre no Notion atualizado e relido com sucesso em 2026-10-13T00:43:22.964Z; confirmar o estado mais recente em cada retomada. Fontes do Projeto precisam receber o handoff atualizado.

## Comandos e provas
`task qa:check` com TURBO_FORCE=true e backend loopback ficticio; `task qa:regressions`; `task qa:pwa:upgrade-fixture`; `bun run lint:changed` em apps/web. Execucao sequencial, sem builds concorrentes com browsers. Testes novos: `node --test apps/web/tests/atomic-queue-transition-snapshot.test.cjs` e cenarios "snapshot boundary" do Playwright.

Os seis testes de snapshot usam fake-indexeddb instalado. Os dois de lifecycle controlam somente a sequencia de eventos de abertura com um test double e validam retry no fake-indexeddb; nao sao alegacao de reproducao desse evento em aparelho real. Os doze cenarios novos de snapshot foram executados em IndexedDB real de Chromium/WebKit, com reabertura e verificacao de bytes/Blob.

## Causa e correcao
`assertSameAttempt` consultava um objeto mutavel dentro de um callback posterior ao await. As tres entradas agora capturam um objeto local antes de abrir a transacao; a escrita usa exclusivamente o payload ja armazenado. Abertura rejeitada agora fica marcada como abandonada para fechar/abortar eventos tardios. Sem novos stores, TTL, protocolo de ACK ou regras de negocio.

## QA e reversao
QA do escopo local: testes especificos e regressao PASS; auto-revisao. Nao e aprovacao das fases ou revisao independente. Nao repetir reset/limpeza de storage para reverter: futura reversao de codigo deve ser revisada e repetir as suites, preservando dados e outros diffs. Retornar ao codigo anterior reintroduz os defeitos comprovados.

Scanners completos, Lighthouse, E2E geral de 111 casos e upgrade do build de campo nao foram repetidos neste lote. Resultados anteriores continuam historicos. Sem dados de clientes, segredo ou dump nos arquivos versionados.

## Evidencias por execucao
- red: exit 1, FAIL, `.qa/runs/20261013T003022Z-queue-snapshot-red-651534fb6a7e-5818/result.json` (2026-10-13T00:30:22Z -> 2026-10-13T00:30:23Z).
- lifecycle-red: exit 1, FAIL, `.qa/runs/20261013T003244Z-queue-lifecycle-red-651534fb6a7e-7670/result.json` (2026-10-13T00:32:44Z -> 2026-10-13T00:32:45Z).
- browser-red: exit 1, FAIL, `.qa/runs/20261013T003148Z-queue-snapshot-browser-red-651534fb6a7e-6511/result.json` (2026-10-13T00:31:48Z -> 2026-10-13T00:33:06Z).
- green: exit 0, PASS, `.qa/runs/20261013T003437Z-queue-snapshot-green-651534fb6a7e-9185/result.json` (2026-10-13T00:34:37Z -> 2026-10-13T00:34:38Z).
- check: exit 0, PASS, `.qa/runs/20261013T003505Z-check-651534fb6a7e-9807/result.json` (2026-10-13T00:35:05Z -> 2026-10-13T00:37:21Z).
- regressions: exit 0, PASS, `.qa/runs/20261013T003721Z-regressions-651534fb6a7e-11549/result.json` (2026-10-13T00:37:21Z -> 2026-10-13T00:37:31Z).
- pwa: exit 0, PASS, `.qa/runs/20261013T003731Z-pwa-upgrade-fixture-651534fb6a7e-12715/result.json` (2026-10-13T00:37:31Z -> 2026-10-13T00:38:40Z).
- lint: exit 0, PASS, `.qa/runs/20261013T003840Z-queue-lint-final-651534fb6a7e-16577/result.json` (2026-10-13T00:38:40Z -> 2026-10-13T00:38:44Z).


## Reconciliacao e QA para publicacao - 2026-10-13

Browser-MTS recuperado por terminal novo. Fast-forward para d988ff32 preservou a FASE 11 e todas as 26 alteracoes locais; conflito apenas no indice de docs resolvido mantendo os dois lados. Backup e stash c13744f0a87f87efbf45dc169f4ede063985e3fa preservados localmente.

Revalidacao fresca sequencial: 191/191 Node, API 539/539, Web 146/146, PWA 34/34, build/tipagem PASS, lint 0 erros/14 avisos. Fonte original preservada por SHA-256. Auto-revisao do lote local PASS; nao e aceite integral das fases. E2E geral e Lighthouse anteriores nao repetidos. Publicacao deste lote autorizada; confirmar SHA remoto antes de afirmar push. Sem CI hospedado, banco remoto ou deploy.
- regressions: `.qa/runs/20261013T112139Z-regressions-d988ff32d7d2-9883/result.json`.
- check: `.qa/runs/20261013T112150Z-check-d988ff32d7d2-11057/result.json`.
- pwa: `.qa/runs/20261013T112414Z-pwa-upgrade-fixture-d988ff32d7d2-12477/result.json`.
- lint: `.qa/runs/20261013T112552Z-publish-lint-d988ff32d7d2-16064/result.json`.
