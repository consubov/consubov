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

## Evolucao local da nova arquitetura

As fundacoes do banco local scoped e das transicoes dos comandos encontram-se em [63-offline-vnext-foundations.md](./63-offline-vnext-foundations.md). O inventario e os stores legados permanecem intocados, e essa fundacao ainda nao realiza migracao de dados.


## Correcao independente de offline e revalidacao - 2026-10-12

**FASE 5:** a suite completa passou 111/111 em desktop/tablet/mobile, sem retries, no commit limpo 10230f043d6f45291248a266d1d4f4b1554bba3a. Duracao 8.8min; .qa/runs/20261012T132551Z-e2e-published-10230f043d6f-12558/result.json, exit 0. As 42 falhas historicas nao representam essa revisao. Check anterior foi reexecutado sem cache Turbo: API 539/539, Web 136/136, build e tipagem PASS. Isso ainda nao aprova o gate Lighthouse, mantido PENDING_LOCAL_BASELINE.

**FASE 7, implementacao entregue:** o inventario readonly agora tolera getters bloqueados de IndexedDB/localStorage, distingue armazenamento indisponivel de backup ausente, conserva o resultado dos outros bancos quando uma abertura falha e informa autoIncrement, keyPath e restricoes reais de cada indice. Nao consulta registros, nao escreve, nao infere tenant e nao migra dados.

Regressao reproduzida inicialmente em bancada isolada com fake-indexeddb 6.2.5 verdadeiro: 5 falhas/6; depois 11/11 PASS. Reexecutado no Codespace: inventario 11/11; suite PWA ampliada 22/22 em Chromium/WebKit (inclui 6 cenarios novos de inventario e os 16 existentes de fila/update); regressao Node 148/148; Web 136/136, tipagem e lint:changed exit 0. O lint registra 14 avisos de analise estatica, nao ocultados; nao equivalem a zero avisos.

Evidencias do candidato, base 10230f04 e dirty=true: .qa/runs/20261012T133442Z-offline-inventory-10230f043d6f-23501/result.json; .qa/runs/20261012T133444Z-pwa-upgrade-fixture-10230f043d6f-23569/result.json; .qa/runs/20261012T133558Z-regressions-10230f043d6f-26381/result.json; .qa/retomada-20261012/offline-verification.log e .exit=0. A fonte so foi alterada depois que a E2E anterior terminou.

**Limites:** no inventario, status=ok significa enumeracao concluida; nao certifica migracao. Antes de migrar, exigir contexto autorizado e avaliar error por banco, versoes, stores faltantes e localStorageStatus. localStorageStatus=unavailable nunca autoriza tratar backups como inexistentes. Fixture sintetica nao homologa o build legado de producao nem conclui as FASES 6/7.

Trabalho local independente segue permitido: integrar identidade validada e migracao retomavel preservando origens; concluir ensaio do build legado e desempenho sem afrouxar gates. Nenhuma base de cliente foi alterada. Sem CI hospedado, merge, deploy, banco remoto ou novo roadmap. Revisao pelo proprio executor, sem alegar revisor independente.
