# FASE 7 — Fundações locais (2026-10-09)

## Implementado e limitado por escopo

- **IndexedDbLocalDatabase** implementa a interface `LocalDatabase`, numa base nova `consubov-vnext-local`, separada das seis bases legadas. As chaves usam a tupla JSON [tenantId,userId,key] para impedir colisões acidentais e escrita/leitura cruzada dentro do adapter.
- **commandPolicy** cria comandos pendentes com commandId e idempotencyKey estáveis. Reenvio após timeout conserva os IDs; ACK requer coincidência explícita de tenant, usuário, comando e chave; conflito não é aceito nem resolvido automaticamente.
- Ambos são **fundamentos ainda não conectados aos fluxos legados**. Isolamento nesse adapter não substitui autorização na API. A persistência local pode falhar por quota/evicção/permissão, retornando erro em vez de sinalizar falso sucesso.
- A inspeção `legacyOfflineInventory` permanece separada, não destrutiva, e o novo DB não executa upgrade nem limpeza do legado.

## Evidências e limites

- Testes isolados Node dos dois módulos: `node --test apps/web/tests/indexeddb-local-adapter.test.cjs apps/web/tests/local-command-policy.test.cjs`.
- Testes com factory IndexedDB simulada incluem owner isolation, usuário/tenant, encoding de chaves, conservação de Blob, indisponibilidade, retries, ACK, conflitos.
- TypeScript estrito dos dois módulos: PASS no ambiente isolado em 2026-10-09.
- **Pendente:** validar no Chromium/WebKit reais com IndexedDB de verdade; autenticação de tenant; Command Queue durável transacional com múltiplas abas; migração versionada do legado; sync push/pull com fake transport; grande volume/fotos; dados offline reais anonimizados. Nenhuma homologação de fase resulta apenas destes testes.

## Segurança

Não ler nem gravar bases legadas por este adapter; não executar `deleteDatabase`, `localStorage.clear`, migrations remotas, alteração de produção ou sincronização com API remota. Não copiar tokens ou payloads para logs de QA. FASE 7 permanece **EM ANDAMENTO**.

## Riscos residuais após a implementação (2026-10-09)

- Adapter ainda precisa ser integrado com identidade de sessão validada e testado com IndexedDB real em WebKit/Chromium; chave scoped não implementa autenticação backend.
- O comando em estado `inflight` não pode receber segundo dispatch simultâneo; em timeout, voltar a `pending` preservando IDs antes do retry. Só ACK explícito da API autorizada muda para `acked`.
- A implementação atual não drena fila antiga nem faz migração. Não inferir que trocar a PWA muda os valores do IndexedDB. Homologação física posterior não substitui testes de integridade local.

## Coordenador de sincronização estritamente local (2026-10-09)

Arquivo: `apps/web/src/platform/offline/localSyncRound.ts`. Porta `AtomicCommandQueue` exige reserva **atômica e persistida** por ID, para que abas concorrentes não enviem a mesma operação em paralelo; a implementação durável ainda está pendente. `OfflineCommandTransport` é injetado e não possui cliente HTTP remoto embutido.

Cenários codificados/testados em `apps/web/tests/local-sync-round.test.cjs` (8/8 Node PASS): ACK correto e manutenção do registro; timeout incerto com a **mesma chave de idempotência**; retry e ACK posterior; conflito persistindo como conflito; rejeição de ACK de outro tenant; rejeição de ACK com idempotencyKey distinta; fila vazia sem envio; resposta não reconhecida falha fechada. Sem tentativa de aplicar resolução de domínio via LWW.

**Importante:** o teste usa **fake queue local**, não demonstra transação IndexedDB multiaba nem backend idempotente real. Não integrar a dados de usuário antes do adapter durável + autorização e migração terem evidências de QA.

## Avanço de persistência transacional (bloco 4 — 2026-10-09)

Foi adicionado `IndexedDbAtomicCommandQueue` em banco local novo, `consubov-vnext-command-queue`, com transações IndexedDB atômicas. O coordenador `localSyncRound` aceita esse adapter pelo contrato existente `AtomicCommandQueue`. Este avanço **não conecta filas legadas nem API remota**. Consulte [66-offline-atomic-queue.md](./66-offline-atomic-queue.md) para garantias, limitações, testes e passos restantes.
