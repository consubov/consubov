# CONSUBOV P0 — correção estrutural do gerente 2.0.45 (candidata local)

Status: QA_LOCAL_PASS / PROD_SQL_PENDENTE / RELEASE_NO_GO.

## Falha e solução
A versão 2.0.44 publicou o frontend antes da nova RPC; 404 foi inevitável. A RPC compartilhada get_consumo_mineral continuou dependendo de view_consumo_tempo_real e view_painel_mae_pasto (57014/500). A curva de consumo lia até 10.000 registros da view. A confirmação de fazendas e o ranking disparavam consultas caras ao mudar o mês.

Candidata: consulta única para autorizar fazendas (get_gerente_fazendas_rapido), custo agrupado por retiro (get_gerente_custos_rapido), curva anual agrupada por mês (get_gerente_curva_rapida), lançamentos mensais autenticados (get_gerente_lancamentos_rapido) e os seis indicadores existentes (get_painel_mae_rapido). Para evitar regressão: cancelamento de consultas obsoletas e falha explícita em vez de zero ou fanout de views, ranking só na aba Ranking, escopo por fazenda e mês no backend e frontend. Outros perfis preservados.

## Implementação/estado real
Worktree isolado da VPS: /srv/workspaces/consubov-gerente-custos-p0-20261103. Base 5e18ca9d. Integradas localmente também as mudanças verificadas de um segundo agente no checkout /srv/workspaces/consubov-p0-mae-sql-20261103, sem alterar sua árvore. Candidata Web 2.0.45/revision 10, não publicada.

- Migration: supabase/migrations/20261103021156_p0_gerente_painel_mae_fast.sql: RPCs de painel e roster, com timeout de 30s só na função de painel, como já aplicado em produção na conversa anterior. Atenção: painel já existe em produção; reconciliar histórico antes da próxima migration.
- Nova SQL: supabase/migrations/20261103042200_p0_gerente_custos_rapido_local_candidate.sql.
- Nova SQL: supabase/migrations/20261103042900_p0_gerente_curva_rapida_local_candidate.sql.
- Nova SQL: supabase/migrations/20261103043200_p0_gerente_lancamentos_rapido_local_candidate.sql.
- Todas as três novas RPCs são SECURITY INVOKER, revogam PUBLIC/anon e concedem EXECUTE a authenticated. A RPC de fazendas é SECURITY DEFINER com autenticação e vínculo explícitos e exige aprovação de segurança independente.
- Taskfile local: qa:check e qa:pwa:build-preflight executam verificação estática de existência, autorização e referências de RPC, scripts/tests/gerente-rpc-release-contract.test.mjs.
- Gate real do banco: scripts/qa/gerente-rpc-predeploy-readonly.sql. Todos os cinco retornos devem ser PASS **antes** de publicar. O gate estático não substitui o gate remoto.

## Evidências verificadas
- Comparação apenas SELECT com papel authenticated e contexto temporário de usuário gerente no banco: outubro/2026 R$ 52.109,40 custo mensal, 653 sacos e 159.539 cabeças-dia, com equivalência exata à RPC original; julho R$ 21.785,40 / 273 sacos / 32.985 cabeças-dia e setembro R$ 61.765,20 / 774 sacos / 131.120 cabeças-dia. A fórmula do custo por cabeça-dia é custo total dividido por soma de cabeças-dia; não é média das médias.
- Curva de consumo: fonte nova e view original idênticas nos oito meses de 2026 com lançamentos (fev, mar, abr, jun, jul, ago, set, out), em sessão SQL autenticada com teto de 8s.
- Lançamentos de outubro: 340 registros, 653 sacos, 108 pastos, 328 índices e consumo médio 173,87, iguais à view original sob role SQL do gerente.
- PostgreSQL 17 PGlite isolado: 34/34 testes PASS em três RPCs, segurança invoker, acesso a fazenda primária/secundária, admin e exclusão de outros usuários/tenants, RLS, mês vazio e períodos inválidos.
- QA código integrado: 427/427 testes Web, build/TypeScript/API PASS; 484/484 regressões; offline 61/61; gate release 18/18; PWA build preflight 343/343; segurança local PASS com Gitleaks 8.30.1 com SHA pinado; gate de contrato 8/8. Logs em .qa/gerente-custos e recibos .qa/runs. QA foi em checkout dirty=true e precisa repetição no SHA definitivo.
- PWA instalada e JWT real HTTP de um gerente ainda não foram homologados. A aba navegador da VPS segue v2.0.44; não afirmar resolução de custos em produção.

## Sequência de GO/NO-GO para produção
1. Revisão independente das 4 funções ainda não instaladas, do SECURITY DEFINER da listagem e dos contratos F12/RLS (owner reservado), incluindo dados com gerente em fazenda secundária.
2. Aprovação explícita da aplicação SQL na produção. Aplicar migrations de forma controlada antes de liberar frontend; não redefinir timeout global, roles, RLS ou dados.
3. Rodar scripts/qa/gerente-rpc-predeploy-readonly.sql no MESMO banco de produção: todas as cinco linhas devem ser PASS, incluindo grants e timeout configurado. Qualquer NO_GO bloqueia deploy.
4. Homologação HTTP com JWT real de gerente e admin em preview, teste negativo cross-farm, julho/outubro/novembro, troca rápida de mês e também UI instalada (sem limpeza de filas ou caches). O browser de admin visualizando gerente não substitui sessão real de gerente.
5. Só então integrar com a main após reconciliar alterações paralelas e passar gates no SHA final e obter autorização explícita para publicar 2.0.45.
6. Rollback: reverter primeiro frontend ao artefato anterior e confirmar sessões/offline, depois revogar/drop das funções NOVAS apenas após checar consumidores; preservar a função de painel já publicada. Nunca limpar IndexedDB, dados, histórico ou desabilitar RLS.

Sem GitHub, merge, push, mudança Supabase/Vercel nesta execução. Handoff estático deve registrar o estado final para continuidade.


## Continuação 03/11/2026 — readback remoto somente leitura e QA adicional
- Gate SQL somente leitura executado na base Supabase CONSUBOV: `get_painel_mae_rapido` = PASS (instalada, SECURITY INVOKER, authenticated SIM, anon NÃO, timeout exclusivo 30s). As outras quatro RPCs da candidata (`get_gerente_fazendas_rapido`, `get_gerente_custos_rapido`, `get_gerente_curva_rapida`, `get_gerente_lancamentos_rapido`) = NO_GO/ausentes. **Não aplicar frontend 2.0.45 antes de provisionar e homologar todas as funções**.
- Corrigida possível reutilização de cache entre sessões: custos e curva não mantêm dados globais em memória; snapshot geral de gerente agora diferencia também `auth.user.id` na chave. Sem limpeza de IndexedDB, filas ou caches de outros módulos.
- PostgreSQL 17 isolado ampliado para **41/41 PASS**, incluindo execução do SQL `get_gerente_fazendas_rapido` (SECURITY DEFINER) com gerente A principal/secundário, gerente B, administrador visualizando gerente, anônimo, inativo e sem uid; isto **não substitui** sessão JWT real nem revisão independente de SECURITY DEFINER.
- `task qa:check` com gate estático das cinco RPCs passou após hardening; `useGerenteCustos.test.tsx` 5/5 PASS. Registros em `.qa/gerente-custos/qa-check-with-rpc-gate-20261103.log`, `pg17-four-rpcs-20261103.log`. Validações anteriores deste relatório permanecem válidas para a candidata anterior; requisição de build no SHA final ainda pendente.
- Não houve `commit`, merge, push, deploy, mutation no Supabase, Auth real nem alteração da `main`. Estado: `QA_LOCAL_PASS / DB_PREDEPLOY_1_OF_5_PASS / RELEASE_NO_GO`. Próximo passo dependente: revisão por owner SQL/RLS, JWT real e autorização específica para novas migrations + publicação.


- Hardening final de troca de sessão: chave de custo e curva agora inclui também `sessionId` do usuário autenticado, e teste de troca de identidade na mesma fazenda garante não reaproveitar valores antigos. Novo `task qa:check` **428/428 Web + typecheck/build/API + contrato RPC PASS**; o teste específico `useGerenteCustos.test.tsx` **6/6 PASS**. Sem publicação ou SQL remoto mutante. Gate de produção permanece 1/5 PASS, 4/5 NO-GO.

## 03/11/2026 — instalação SQL autorizada e bloqueio de publicação (estado real)

- **Supabase PRODUÇÃO atualizado** por quatro migrations aditivas da candidata 2.0.45: `p0_gerente_fazendas_rapido_v2045`, `p0_gerente_custos_rapido_v2045`, `p0_gerente_curva_rapida_v2045`, `p0_gerente_lancamentos_rapido_v2045`. `get_painel_mae_rapido` 2.0.44 preservada com timeout próprio de 30 s; nenhuma ALTER ROLE, alteração global de RLS, DML ou deleção.
- Gate de produção `scripts/qa/gerente-rpc-predeploy-readonly.sql`: **5/5 PASS** (funções existentes, SECURITY INVOKER/DEFINER conforme contrato, authenticated autorizado, anon negado, timeout config). Consultas reais em transação com `SET LOCAL ROLE authenticated` e uid gerente, limite 8 s: fazendas=1, custos out/2026 retiros=4/sacos=653/R$52.109,40, curva=8 meses, lançamentos out=340/pastos=108. Não equivale a browser HTTP JWT real.
- Base local de release conciliada com SHA 769dcef4, que é a produção 2.0.44. Preservada a tradução i18n da PR #165 e o SQL existente da PR #166. QA local dessa base: Web 428/428, regressões 484/484, segurança PASS, release gate 18/18, build PWA 343/343 e RPC contrato 8/8 PASS.
- **Frontend 2.0.45 NÃO publicado**: `git push` via VPS SSH falhou `Permission denied (publickey)` e HTTPS falhou por ausência de autenticação. Vercel `consubov-app` ainda aponta para deployment `dpl_H84jbA5BoqVw24JPKXhYXvuaSNPi`, commit `769dcef4`, versão 2.0.44; `origin/main` permanece em 769dcef4. Não houve uso do conector GitHub conforme pedido anterior.
- Próximo bloqueio é exclusivamente o canal de publicação autenticado (autorizar um método Vercel direto validado ou habilitar autenticação Git na VPS). Após publicar, confirmar Vercel READY, mesma aba Browser VPS, meses e perfil gerente real, readback, rollback, e Notion/Obsidian. **Status: DB_5_OF_5_PASS / FRONTEND_NOT_DEPLOYED / RELEASE_PARTIAL**.
