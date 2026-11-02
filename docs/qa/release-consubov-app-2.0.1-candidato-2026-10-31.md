# Release candidata — CONSUBOV Fazendas App 2.0.1
**Estado:** CANDIDATA / DRAFT / NAO PUBLICADA
**APP_ID:** `consubov-fazendas-app`
**Projeto Vercel exclusivo:** `consubov-app`; dominio `app.consubov.com.br`
**Base Git verificada:** `678799bb3a139cd1df70bd239ec86dd5f75e3a5c`; PR #131 (melhoria 001) e PR #133 ja integradas.
**Contrato F23:** `releases/consubov-app.json` revision `0 -> 1`; `APP_VERSION` `2.0.0 -> 2.0.1`.
**Rollback anterior (validar novamente no momento da publicacao):** `dpl_9YmZX66n6bNKwRCEqVuBAwN7gpxi`.

## Objetivo
Preparar e avaliar uma candidata de release **somente** do aplicativo CONSUBOV, respeitando consentimento de atualizacao PWA, isolamento tenant, integridade de IndexedDB/filas e bloqueio de downgrade. A publicacao production NAO esta autorizada por este PRD/PR.

## Escopo
- Ajustar exclusivamente `apps/web/src/lib/appVersion.ts` para `2.0.1`.
- Ajustar exclusivamente `releases/consubov-app.json` para `revision:1` e `appVersion:2.0.1`.
- Executar/recolher evidencias QA no **SHA exato** desta PR.
- Validar gate F23: CONSUBOV App permitiria BUILD apenas em merge explicitamente autorizado; os demais destinos SKIP por revision inalterada.
- Registrar validacoes, riscos, dono do gate e rollback no Checklist Mestre do Notion e no Cerebro Obsidian.

## Fora do escopo / acoes proibidas
Sem merge na `main`, release production, promote, redeploy, mudanca Vercel settings, flags, env/secrets, migrations SQL, Supabase remoto, alteracao manual de dados, migracao ou limpeza IndexedDB, SW forcado, alteracao de Relatto, CONSUBOV Site ou outros APP_IDs. Nunca executar `--force`/force-push nem apagar branches. Nao alterar contadores de melhoria: #001 continua PR131; PR133 nao recebe ordinal automaticamente. Nao criar tag como se fosse versao publicada.

## Criterios de aceite / QA (GO apenas com evidencia)
- [ ] CI completo no SHA final: frozen install, TypeScript/build, unit/integration, lint, cobertura, budget e secrets.
- [ ] F23 release-gate tests: `consubov-app` em preview BUILD, em producao com marker valido BUILD; `consubov-site`, `relatto-app` e `relatto-site` SKIP; version downgrade/manifest inconsistente bloqueados.
- [ ] Testes PWA/service worker: nova versao sem update forçado; waiting SW corresponde ao build verificado; caches e IndexedDB com zero perda.
- [ ] QA de tenant/RBAC: login autorizado, consulta apenas da fazenda autorizada, tenant cruzado DENY, erro fail-closed; dados reais apenas com ambiente isolado/autorizaçao.
- [ ] QA de campo em aparelho instalado: offline, comando pendente + anexo/foto, reconexao, sincronizacao sem duplicar ou perder dados, consentimento de update e rollback. Nao simular aparelho fisico como aprovado.
- [ ] Conferir build VERSION+SHA, recursos/assets, /sw.js no-cache, manifest e protecao anti-downgrade 2.0.0; rollback preparado.
- [ ] Autorizacao separada e especifica do responsavel para publicacao production `consubov-app`, apos evidencias; verificar aliases dos outros tres destinos antes e depois.

## Git / ownership / relatorio
Ramo exclusivo de release baseado na `main` aprovada, PR DRAFT com changeset minimo. Sem tocar branch F12/#76, hotfix #134 ou F23/#135. Rever concorrencia e SHA de `main` antes de promover.
Relatorio final deve informar: SHA, files diff, cada teste PASS/FAIL/NAO EXECUTADO, matrizes tenant/offline, release-gate por produto, autorizacao production, evidencias de Vercel, aliases, versao de codigo/publicada/instalada e plano de rollback. Sem marcar release PUBLICADA antes de deployment READY/alias validado.
