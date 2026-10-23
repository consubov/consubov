# Preflight tecnico v1.155.0, API e Supabase Preview (2026-10-22)

## Implementacao minima
- `APP_VERSION`: 1.146.0 -> 1.155.0, prosseguindo do legado 1.154.0.
- `DEFAULT_API_BASE_URL`: string vazia em lugar de `http://127.0.0.1:3000`. Cliente de API recusa requisicoes sem URL com erro 503 / `API_NOT_CONFIGURED`, sem `fetch` acidental.
- Teste regressivo novo garante recusa antes de rede. `.env.example` agora exige configurar explicitamente URL remota.

## QA executado
- Node 22 em conjunto isolado de arquivos pertinentes: 3/3 testes PASS (config ausente, sem fetch, com URL HTTPs explicita).
- **NAO EXECUTADOS**: `task qa:matrix`, `qa:check`, `qa:phase6`, `qa:phase7`, lint monorepo, E2E em aparelhos e migracao offline 1.154.0 -> 1.155.0. Clone integral sem DNS neste ambiente.
- O deployment Preview CONSUBOV foi iniciado separadamente com a revisão anterior e deve ser verificado; não inventar aprovação de login ou tenant.

## Supabase / seguranca
- Conexao configurada **somente no Preview** dos Apps Consubov e Relatto, usando `VITE_SUPABASE_URL` + chave publicavel, sem admin/service_role. Nenhuma configuracao publica Production atualizada nesta etapa.
- O Supabase real apresenta 107 tabelas public com RLS desabilitado e privilegios amplos previamente auditados. Antes de expor o cliente publicamente, exigir isolamento tenant/autorizacao comprovados.
- Sem writes/schema/migrations, sem corte do dominio do legado, sem apagar IndexedDB/filas. O deploy estatico de quatro sites pode atualizar por GitHub, mas isso nao e cutover.

## Reversao
- Caso o candidato apresente regressao, voltar ao deployment Vercel anterior do candidato; nunca restaurar banco nem limpar cache offline de usuarios.
- Corrigir API funcional somente quando existir endpoint publico HTTPS protegido e operante, testado separadamente; nao apontar para o Supabase PostgREST como se fosse a nova API Bun.
