# FASE 7 — Fila de comandos transacional e recuperação offline

**Atualizado:** 2026-10-09. **Track:** AUDITORIA DE QUALIDADE. **Status:** fundação implementada; QA geral pendente.

## Implementado no PR #43

- `apps/web/src/platform/adapters/IndexedDbAtomicCommandQueue.ts` implementa a porta `AtomicCommandQueue` de `localSyncRound.ts`. Nenhum backend remoto é criado.
- Banco **novo e separado** `consubov-vnext-command-queue` com store `commands`; não toca nas seis bases legadas.
- Chave de registro `[tenantId,userId,commandId]`; índice `byIdempotency` exclusivo por `[tenantId,userId,idempotencyKey]` rejeita dois comandos com a mesma chave; índice `byOwnerStatus` recupera filas pendentes só do proprietário informado.
- `enqueue` usa `add` e não substitui dados já gravados. `claimPending` faz leitura e escrita em **uma única transação IndexedDB readwrite**, serializável pelo mecanismo do navegador entre abas. `acknowledge`, `releaseForRetry` e `markConflict` rejeitam tentativas antigas pelo `attemptCount`/identidades do comando.
- Transações só retornam sucesso após `transaction.oncomplete`; em abort/error não confirmam operação. ACK é armazenado mas **não apaga o registro**.
- `recoverUnconfirmed` exige `confirmedNoActiveSender: true` e o número exato de tentativa. Não existe liberação automática por TTL/lease: a API deve deduplicar pelo mesmo `idempotencyKey`.

## Executar no VS Code

```powershell
task setup
task qa:offline:core
task qa:offline:browser
task qa:pwa:upgrade-fixture
task qa:matrix
```

O pacote `apps/web/package.json` **já inclui** a dependência local `fake-indexeddb`. A tarefa `qa:offline:core` usa 14 novos testes da fila; `qa:offline:browser` seleciona 5 testes locais Chromium/WebKit, incluindo disputa entre abas, Blob/ArrayBuffer offline, reabertura, idempotência e ACK após reconexão. `qa:pwa:upgrade-fixture` também os executa.

## Evidência, limites e riscos

- Ambiente isolado de auditoria: **14/14 testes Node PASS contra simulador transitório local da API IndexedDB**; **TypeScript estrito PASS**; Taskfile parse com 18 tarefas; parsing TypeScript dos cenários browser PASS.
- **Ainda não foram executados aqui:** os mesmos 14 testes com o pacote real `fake-indexeddb`, Chromium/WebKit Playwright, build Bun/Vite, aplicação integral, migração real legada e homologação física. O navegador disponível retorna `ERR_BLOCKED_BY_ADMINISTRATOR`, até em localhost.
- Índices garantem separação **no armazenamento local**, não autorização de API. `AtomicCommandQueue` deve receber identidade de uma sessão verificada antes de uso real. O backend permanece autoridade.
- **P0 aberto:** ordenação causal e dependências entre operações pecuárias; deduplicação no backend, migração de seis bancos e arquivos, ACK autoritativo e tratamento de conflitos por domínio; sync push/pull com fake local, multiabas real e rollback. Não ativar com dados de cliente antes de atender estes critérios.

## Segurança e reversão

Nunca excluir bases legadas, limpar CacheStorage, forçar upgrade de schema antigo, conectar Supabase/PostgreSQL remoto, fazer migrations/deploy, trocar secrets ou aprovar produção por teste fake. O adapter não apaga registros e pode ser retirado do código novo sem modificar o armazenamento legado. Homologação física permanece gate da pré-produção, sem bloquear desenvolvimento independente.
