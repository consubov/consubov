# FASE 7 — Inventario verificavel do offline legado (2026-10-09)

**Estado:** inventario de codigo confirmado; migracao real e homologacao ainda pendentes. O arquivo nao define prazos de retencao nem formatos de registro nao comprovados.

## Bases versionadas e seus stores (fontes do repositorio)

| Base (versao) | Arquivo fonte | Stores e chaves comprovadas |
| --- | --- | --- |
| consubov-capataz v7 | apps/web/src/lib/offlineDb.ts | lancamentos (id), pastos (id), retiro (id), ciclos (id), config (key), observacoesOffline (id), produtoAtivo (id), fazendaCache (id), pesagensPendentes (id), syncQueue (id), syncErrors (id), lastPdfs (id) |
| consubov-session v1 | apps/web/src/lib/offlineSession.ts | auth_session (chave explicita current), offline_data (chave explicita current) |
| consubov-consultor-offline v2 | apps/web/src/lib/consultorOffline/db.ts | foto_queue (localId), snapshots (visitaId), text_mutations (id) |
| mais-arrobas-offline v1 | apps/web/src/lib/maOffline.ts | tables (chave explicita definida por tabela) |
| mais-arrobas-sync v2 | apps/web/src/lib/maisArrobasQueue.ts | queue (id), acknowledged-inserts (key) |
| consubov-fotos-salga v1 | apps/web/src/lib/fotoSalgaQueue.ts | fotos (lancamento_id), feitos (chave explicita) |

Indices comprovados: capataz/lancamentos by-status, by-pasto, by-data; pastos by-qr; observacoesOffline by-status; pesagensPendentes by-sincronizado. Consultor/foto_queue by-visita e by-parent; text_mutations by-visita.

Chaves de localStorage a preservar: pending_backup, pending_backup_at, ma-offline-mode. Esses valores nao devem aparecer em logs, Git, Notion ou inventario.

## Instrumentacao nao destrutiva adicionada

- apps/web/src/lib/legacyOfflineInventory.ts: inspecao **somente de metadata** de bases existentes; lista nomes, stores, indices, keyPath e versoes; sem ler registros, sem alterar dados ou criar base se databases() estiver indisponivel.
- apps/web/tests/legacy-offline-inventory.test.cjs: verifica lista de bases, ausencia de criacao quando API indisponivel, transacoes readonly, protecao contra corrida de exclusao e ausencia de vazamento de valores.
- task qa:offline:inventory: executa apenas esta suite. Resultado nao equivale a FASE 7 concluida.

## Requisitos P0 para o futuro mecanismo de migracao

- [ ] Aprovar schema-alvo, regras de identidade tenant/user/device e regras por dominio, sem inferencia.
- [ ] Implementar migration engine versionado, retomavel, idempotente e transacional por unidade de migracao.
- [ ] Preservar UUID/idempotency keys, ordem de fila, blobs/ArrayBuffer, tentativas, registros pendentes e backup redundante.
- [ ] Diferenciar observacao local de ACK real do backend: nao apagar nenhum dado nao confirmado.
- [ ] Repeticao/interrupcao/rollback de codigo sem corrupcao ou duplicidade.
- [ ] Validar migracao com fixtures anonimizadas representativas de todas as versoes de stores e no Chromium/WebKit.
- [ ] Definir retencao, expulsao, schema final, duracao de sessao offline e conflitos mediante decisoes de negocio aprovadas.
- [ ] Testar isolamento entre tenants/users e todas as operacoes de campo ao menos em ambiente local.

## Fora do escopo deste inventario

Sem escrita em bancos, sem IndexedDB.deleteDatabase, sem limpeza de localStorage, sem conexao Supabase/PostgreSQL remota, sem deploy ou migracao real. Homologacao fisica iOS/Android e conectividade rural ficam para pre-producao, mas testes automatizaveis de integridade nao podem ser dispensados.

**QA:** apenas inventario readonly implementado/testado isoladamente. FASE 7: EM ANDAMENTO; OFFLINE READY: NAO VALIDADO.
