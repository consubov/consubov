# PR #76 — QA RLS local, 2026-11-02

**Escopo:** migration F12-L34 que exige consistência fazenda/retiro/pasto para INSERT/UPDATE em public.observacoes, com SELECT somente leitura de pais para gerentes ativos e restritos à fazenda. Sem SECURITY DEFINER. Não altera RLS das demais 106 tabelas.

**Migration:** supabase/migrations/20261102153021_observacoes_parent_integrity_rls.sql (gerada via Supabase CLI 2.122.0).
**Testes:** supabase/tests/rls/observacoes_parent_integrity_qa.sql (transação com ROLLBACK), scripts/qa/verify-observacoes-rls-http.mjs (PostgREST local), scripts/tests/observacoes-parent-rls-contract.test.mjs (guards estáticos CI).

## Resultados obtidos na VPS, PostgreSQL 17.11 isolado
- RED: clone qa_pr76_red_20261102 com associações inconsistentes — migração abortou antes do DDL (esperado).
- GREEN: clone qa_pr76_green_20261102 — migração aplicada; política RESTRICTIVE INSERT+UPDATE; matriz de papéis SQL PASS.
- SUPPORT: clone qa_pr76_support_20261102, RLS ligada em capatazes/retiros/pastos — migration aplicada e matriz SQL PASS após garantir acesso de leitura dos pais a gerentes ativos de sua fazenda. Administração de teste ausente no fixture foi cadastrada somente no clone.
- PostgREST v16.5 em contêiner efêmero na VPS: HTTP **17/17 PASS** contra GREEN e **17/17 PASS** contra SUPPORT. Casos: JWT inválido/anônimo 401, isolamento de gerente A/B, POST de capataz válido, 403 para pasto de outro retiro da mesma fazenda, 403 de outro tenant, PATCH de gerente autorizado, 403 para UPDATE cruzado, replay ON CONFLICT DO NOTHING preserva resolvido=true, admin com pais NULL.
- Em cada clone sintético, auth.uid() foi ajustada somente no fixture para ler request.jwt.claims (PostgREST v16), com fallback legado de request.jwt.claim.sub.
- As chaves JWT foram geradas apenas localmente em .qa/ (ignorada, modo 600), nunca enviadas ao Git ou serviços externos. PostgREST de QA esteve acessível apenas via loopback e rede local VS Code.

## Limites e gates restantes
**NÃO equivalem a Q4 total**: os bancos sintéticos têm 8 tabelas, não as 107 do esquema alvo; JWTs locais foram assinados para PostgREST sem usuários GoTrue reais. Sem homologar ACL/RPC, cron/pg_net, triggers e autenticação real A/B no schema equivalente. Supabase remoto intocado. **Q5**: revisão independente não efetuada; testes pelo próprio agente não são aprovação independente. CI do SHA anterior #76 estava verde 5/5; qualquer novo commit exige CI do SHA final.

**Rollout:** migration é apenas código em PR. Para aplicá-la em banco real será necessária autorização específica, conferência prévia dos dados históricos e grants de tabelas pais. O preflight falha fechado se já houver associação inválida, sem correção automática. Rollback controlado: DROP POLICY das quatro policies novas, mantendo RLS habilitada. Nenhuma migration remota/deploy foi executada.

**Resultado:** SQL+HTTP LOCAL PASS; REMOTE RLS/GoTrue NOT VALIDATED; INDEPENDENT REVIEW PENDING; MERGE NO-GO.
