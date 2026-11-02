# F12-L34 — QA e correção de integridade da tela de observações
Data: 29/10/2026. Status: DRAFT, sem merge ou deploy.

## Problemas comprovados na main
- `useGerenteData` tratava falha SELECT `observacoes` como `[]` e gravava em cache, ocultando observações.
- `resolverObservacao` considerava UPDATE sem retorno um sucesso; falha de RLS ou zero linhas poderia marcar a UI como resolvida.
- Respostas de requisições antigas não tinham guarda de chave de fazenda e sequência.

## Escopo
- Validar resposta SELECT por fazenda/IDs, exigir ACK de UPDATE com id/fazenda/status/data e filtros redundantes.
- Bloquear resposta atrasada de outro contexto e evitar duplo clique; não atualizar cache sem confirmação.
- Preservar cache anterior **apenas para a mesma chave de contexto**; mostrar erro e retry em vez de spinner infinito ao falhar carregamento.
- Remover casts `any` do hook no trecho afetado, usando tipos Supabase gerados.
- Testes puros `observacoesGuard.test.ts`, QA de typecheck/lint/build/testes no CI da branch.

## Fora de escopo
- RLS, GRANT/REVOKE, schema, migrations, RPC, trigger, push, consumo, sincronização offline do capataz, estoque, app P0, PRs alheios, deploy e produção.
- **O frontend não autoriza usuários:** `public.observacoes` permanece RLS OFF e `authenticated` com CRUD. Portanto não liberar por este PR.

## Critérios e QA
- Leitura 42501/nula/duplicada/outra fazenda falha fechado sem cache vazio; leitura vazia legítima aceita.
- UPDATE 0 rows/42501/outro id/fazenda/sem data nunca gera toast de sucesso nem altera UI/cache; ACK único permite sucesso.
- Mudança de fazenda A→B e requisição antiga não podem reaplicar snapshot A; sem cache de B, mostrar loading e erro com retry.
- Unitário: helpers negativos/positivos; E2E de troca A→B e offline ainda **NÃO EXECUTADOS**.
- Validação local do helper: `tsc --strict` e 18 testes Node sintéticos PASS; **não equivale a typecheck/Vitest/CI do repositório**. Revisar resultados do novo commit.

## Regras Git, reversão e relato final
- Só branch isolada `fix/app/f12-l34-observacoes-ack-20261029`, PR DRAFT; não alterar main, branches do agente local, CapatazDashboard, lockfile ou migrations.
- Reversão via revert exclusivo dos commits deste PR. Sem force-push/reset; requer QA real e autorização antes de merge.
- Reportar HEAD/base SHA, arquivos, resultado por teste/gate, riscos remanescentes, autorização, atualização Cérebro/Handoff/Notion e bloqueios F12.

## 29/10/2026 — hardening de revogação e QA complementar

- Correção para revogação de permissões de observações: erro SQL `42501` e códigos HTTP 401/403 em consulta invalidam os snapshots de gerente, removem a chave aplicada e exibem bloqueio/relogin, **mesmo quando havia cache da mesma fazenda**. Erro transitório conserva informação histórica apenas do mesmo contexto, mas a resolução fica desabilitada enquanto o erro persistir.
- Atualização com autorização negada também invalida a exibição; nenhum ACK é emitido. Os erros retornados ao usuário não contêm mensagens SQL.
- Teste adicional em `observacoesGuard.test.ts` distingue negação de acesso e falha transitória. Execução CI do novo SHA ainda deve ser confirmada; E2E de revogação e reinstalação da RLS não foram realizados.
- Evidência do SHA anterior `57d0ad4`: `build-and-test` SUCCESS, 251 testes Web, 180 E2E Web, 122 Edge, SAST e Secret Scanning SUCCESS; Dependency Audit FAILURE com três HIGH (DOMPurify, Vite/launch-editor, Zod). O passo `Web axe baseline` ficou marcado como SUCCESS na job, mas `axe` saiu com erro de ChromeDriver incompatível e `continue-on-error: true`; **não considerar acessibilidade aprovada** até corrigir o runner/driver e executar axe efetivamente. Não alterar workflows da frente de CI compartilhada neste PR.


## 02/11/2026 - Retry offline idempotente (ampliacao solicitada pelo responsavel)

A pedido do responsavel para corrigir bloqueios de integracao da PR #76, o escopo foi ampliado somente na sincronizacao de observacoes em CapatazDashboard.tsx. Esta secao prevalece sobre a exclusao desse arquivo e do fluxo offline nas secoes historicas acima. Nao houve alteracao de lancamentos, banco remoto, RPC, triggers ou filas de outras entidades.

- Upsert com onConflict=id e ignoreDuplicates=true preserva dados existentes e nao reabre observacao resolvida nem reemite trigger INSERT.
- SELECT de confirmacao por id e fazenda_id exige um unico registro, com fazenda_id, retiro_id, pasto_id, capataz_nome, tipo, descricao e foto_url identicos ao envio. resolvido=true no servidor e valido em um retry.
- RLS negada, nenhum registro, outro tenant, colisao de ID ou conteudo divergente mantem a fila pendente, sem ACK falso.
- Classes JSX repetidas foram consolidadas apenas para cumprir o teto de bundle, preservando CSS byte-a-byte (SHA256 f1e430aa23f91b590d741e58d11cd313dbeb39497856e04597396ec13004c1a1) e sem alterar limites.

QA: 9/9 testes unitarios do guard, typecheck e build PASS. PostgreSQL 17 isolado, fixture sintetica em transacao com ROLLBACK: retry preserva estado resolvido e dispara uma unica notificacao. Esse teste usa claims SQL simulados, nao login JWT do GoTrue. Auditoria HIGH do candidato anterior PASS; novo build passa orcamento de bundle raw/gzip. CI GitHub e QA completo exigem revalidacao no novo SHA.

Risco residual: RLS efetiva de public.observacoes no alvo, grants e ACL, reenvio real PostgREST com JWT A/B e revisao independente de F12 nao homologados. Nao e liberacao para merge/release. Nenhuma migration remota ou deploy.


## 02/11/2026 - Isolamento da fila por contexto

Foi constatado que handleSync lia todas as observacoes pendentes sem filtrar o contexto atual. O caminho de observacoes do capataz agora filtra leitura e envio por usuario autenticado, fazenda e retiro ativo. A ausencia de um dos IDs nega exibicao e envio; observacoes de outros retiros/fazendas permanecem na fila local sem marca de sincronizacao. Ao mudar de retiro durante o lote, o processo interrompe novos envios de observacoes e conserva os itens restantes. A autorizacao backend/RLS continua obrigatoria; isto e uma barreira de integridade do cliente, nao substitui policy no banco.
