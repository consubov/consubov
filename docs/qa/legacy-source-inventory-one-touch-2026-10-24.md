# CONSUBOV 2.0 - Inventário seguro do legado


## Adendo 24/10/2026 — prova de inventário local (não é backup)

O conector GitHub instalado lista apenas os owners `mmatteuus` e `consubov`. O repositório do legado informado (`consubov-app/sweet-sync-forge`) retorna HTTP 404 na integração conectada; a busca por nome nas instalações também retorna vazia. O Lovable `Consubov.app` (projeto `b4a91162-f81a-48ed-9e5c-2a184ebce31f`, commit `f1172663...`) permite **leitura**, confirmando `src/lib/offlineDb.ts` (banco `consubov-capataz`), `src/lib/maisArrobasQueue.ts` (`mais-arrobas-sync`), `src/lib/fotoSalgaQueue.ts` (`consubov-fotos-salga`) e `src/hooks/useSyncEngine.ts` (sincronização do Capataz exige comando manual/forçado). Nenhuma edição foi feita no projeto publicado do legado.

Adicionado `apps/web/src/platform/migration/inspectMigrationSourceFootprint.ts`:
- inventário **somente leitura** por origem exata, seis bases, stores e contagem de registros;
- não enumera valores nem exporta tokens/PII; não cria bases ausentes; bloqueia versões/stores desconhecidos ou IndexedDB sem suporte;
- `readyToHandoff: false` invariavelmente. Contagem bruta **não indica dados pendentes, ACK do servidor, backup nem migração segura**;
- testes com `fake-indexeddb` incluem ausência, Safari sem `databases()`, confidencialidade da sessão, Blob sintético, schema incorreto e não destruição.

**Próxima dependência externa:** o proprietário do repo `consubov-app` precisa autorizar a integração GitHub (Settings → Plugins / GitHub) para aquele repositório ou conceder acesso de escrita seguro em branch. Somente então criar patch do legado em branch separada e implementar os adaptadores de sync e o aviso. Também será necessário aprovar **separadamente** a conexão ao banco remoto e o mecanismo de ACK/auth/tenant do novo backend antes da campanha. Não alterar domínio, hospedagem ou banco enquanto houver bloqueios.
