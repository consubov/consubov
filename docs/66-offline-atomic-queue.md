# FASE 7 — fila IndexedDB transacional: estado atual

## Retomada verificada da fila - 2026-10-13 UTC
Base `651534fb6a7e854658f1f6db1737e5ee322df8a3`, branch `work/fase5-6-7-pwa-local`, PR #43 draft; checkout dirty. Este bloco prevalece sobre status historicos, nao sobre criterios de aceite.

- [x] Corrigidas transicoes de ACK/conflito/retry que liam o envelope depois da espera: mutacao posterior nao valida tentativa antiga nem invalida uma tentativa aceita. Payload persistido, IDs, tenant/user, Blob e ArrayBuffer preservados.
- [x] Abertura IndexedDB abandonada: sucesso tardio fecha a conexao; upgrade tardio aborta antes de criar stores. Recuperacao explicita, versao/schema e seis bases legadas nao foram alterados.
- [x] RED: 6 falhas de snapshot em Node, 12 casos de navegador reprovados, 2 falhas de lifecycle. GREEN: 8/8 Node; regressao completa 191/191; PWA 34/34 Chromium/WebKit sem retries; check sem cache API 539/539 e Web 146/146, build/tipagem PASS; lint 0 erros/14 avisos. Fonte estavel por SHA-256.
- [ ] Aceite integral das FASES 5/6/7 e producao. Lighthouse anterior 44/home e 68/login nao foi reexecutado nem aprovado; migracao legada, sync autenticado, ordem causal e piloto fisico continuam pendentes. E2E geral 111/111 pertence a rodada anterior, nao a nova execucao.


Ver o relatorio `docs/qa/queue-transition-snapshot-2026-10-13.md` para limites, comandos e provas.

## Registros anteriores (historicos)

**Atualização:** auditoria consolidada de 2026-10-09. **Status:** componente testado; FASE 7 integral ainda não aprovada.

## Garantias implementadas

`IndexedDbAtomicCommandQueue` implementa `AtomicCommandQueue` para `localSyncRound`, no banco novo `consubov-vnext-command-queue`. Não lê, migra ou exclui as seis bases legadas.

A chave é `[tenantId,userId,commandId]`. `byIdempotency` exige unicidade de `[tenantId,userId,idempotencyKey]`; `byOwnerStatus` separa consultas por proprietário/estado. A abertura valida keyPath, autoIncrement, unicidade e multiEntry dos índices existentes. Encontrar apenas seus nomes não basta: schema incompatível é rejeitado sem tentativa de reparação destrutiva.

`enqueue` usa `add`, não sobrescreve registros, e captura o comando com `structuredClone` antes de abrir o banco assincronamente. Isso preserva o conteúdo aceito, mesmo se o formulário mudar enquanto o banco estiver abrindo. Blobs/ArrayBuffer fazem parte dessa captura.

Claim, ACK, conflito e retry são comparações/escritas na mesma transação `readwrite`. Sucesso só é devolvido em `transaction.oncomplete`. A transição valida proprietário, ID, chave de idempotência, device e tentativa; ACK antigo não substitui tentativa nova. ACK não apaga o registro.

`recoverUnconfirmed` continua exigindo confirmação explícita de emissor parado e tentativa persistida exata. Não há lease/TTL automático nem resolução LWW de operações críticas. Identidade local não substitui autorização do backend.

## Evidência nova, substituindo a limitação histórica do simulador

A suíte `apps/web/tests/atomic-command-queue.test.cjs` passou **17/17 com fake-indexeddb 6.2.5 verdadeiro**, extraído do arquivo de dependências fornecido. Houve 14 casos existentes e 3 regressões novas: índice sem unicidade, índice apontando a chave errada e alteração de payload após enqueue. Esses três casos falharam antes das correções.

TypeScript estrito do adapter, política de comandos e coordenador: PASS. Não foi utilizado simulador artesanal de IndexedDB neste bloco. A suíte completa selecionada da auditoria passou 111/111, mas não é o teste integral do aplicativo.

## Executar no checkout completo

```powershell
task setup
task qa:offline:core
task qa:offline:browser
task qa:pwa:upgrade-fixture
task qa:matrix
```

Os cenários Playwright existentes precisam executar em Chromium e WebKit permitidos. Esta auditoria não executou navegador: localhost retornou bloqueio administrativo.

## Pendências P0

Integração sob sessão autenticada, tenant válido, migração versionada/retomável das seis bases, ordem causal, idempotência no backend, anexos, sync push/pull, caos e rollback ainda precisam de evidência. Não usar o resultado do adapter para afirmar `OFFLINE LOCAL READY`. Não apagar armazenamento legado nem ativar transporte remoto sem autorização.
