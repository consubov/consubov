# FASE 7 - hardening da fila legada de checklist (2026-10-13)

**Estado:** alteracao local isolada; aceita apenas a verificacao descrita aqui. Base anterior `8659cb33eec8d536fb85afa2476328b2a7423986`. Lote limitado a `conferenciaOffline.ts` e regressao Vitest, sem novos endpoints, schema, tenant, storage nem UI.

## Reproducao e alteracoes
- A fila `pendingConferencias` removia entradas adicionadas enquanto o sync aguardava resposta, porque substituia o array inteiro por um snapshot antigo.
- Cada retry gerava um novo ID no insert, arriscando duplicacao se a resposta original se perdesse.
- Duas execucoes simultaneas no mesmo contexto enviavam o mesmo registro; JSON ilegivel podia ser substituido ao salvar novos dados.
- Agora a tentativa online/pendente reutiliza o mesmo clientId como checklistId, o sync no mesmo contexto e single-flight, e somente IDs confirmados sao removidos da leitura mais recente. Dados legados ilegíveis nao sao sobrescritos.

## Testes realizados
- Node v22.16.0, `node --experimental-strip-types --test check.mjs`, executado em harness isolado com stub do provider: **RED 3/4 falhas**, depois **GREEN 5/5, exit 0**. Casos: ACK perdido, enqueue durante sync, sync concorrente, falha conservando payload e JSON corrompido.
- `tsc --strict --noEmit` ES2022/DOM em harness isolado com stub de Supabase: **exit 0**.
- Teste Vitest correspondente foi adicionado ao repositorio, mas **nao foi executado no Codespace**. Nao afirmar check/build/E2E completo; nenhum dado real foi usado.

## Limites e proximos gates
- A trava e por contexto JavaScript. Multiplas abas e confirmacao ambigua do servidor ainda exigem um protocolo autenticado com idempotencia, lock/claim e verificacao de ACK; **nao tratar UNIQUE/409 como sucesso automaticamente**.
- A fila localStorage e legado: nao foi migrada para IndexedDB, nao apagou registros, nao mexeu nas seis bases existentes e nao substitui `IndexedDbAtomicCommandQueue`.
- QA pendente: Vitest no checkout, `task qa:regressions`, `task qa:check`, E2E Chromium/WebKit, isolamento por conta/tenant e testes multiabas. Producao e aceite integral da FASE 7 seguem nao aprovados.
- Browser-MTS: snapshots funcionaram intermitentemente, mas comandos de interacao retornaram `No tab with given id`, `Esta pagina nao pode ser automatizada` e cancelamentos de leitura remota no console. Causa de infraestrutura/roteamento de guia nao estabelecida; impossivel corrigir o servico remoto por arquivos do produto. A extensao opcional Act/Run tambem notificou falta de `act`/Docker e nao e dependencia dos gates Go Task.
