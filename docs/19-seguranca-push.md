# 19 — Segurança da edge function `send-push-notification` (PRD-SEC-03)

Estado: implementado e verificado localmente. Fecha o risco crítico de broadcast/seleção
arbitrária de destinatários sem inventar RBAC.fonte da verdade: `supabase/functions/send-push-notification/index.ts`.

## 1. Chamadores mapeados (evidência, pré-mudança)

Único chamador HTTP direto no código: `apps/web/src/lib/pushService.ts` (`sendPush`, `fetch` para
`/functions/v1/send-push-notification`). Chamadas reais de `sendPush(...)`:

| Fluxo | Arquivo | Seleção | Caller |
|---|---|---|---|
| Lead da landing → admins | `apps/web/src/pages/LandingPage.tsx:316` | `admins_only` | **anônimo** (sem sessão) |
| Lançamento manual (capataz) | `apps/web/src/components/capataz/LancamentoManualModal.tsx:207` | `fazenda_id` | capataz |
| Recusa de transferência (gerente) | `apps/web/src/components/gerente/GerenteNotificacoesBell.tsx:189` | `user_ids:[registrado_por]` | gerente |
| Atribuição de manejo (SyncVet) | `apps/web/src/pages/SyncVetAgendaPage.tsx:255` | `user_ids:[member.user_id]` | syncvet administrador |

Imports mortos (nenhuma chamada): `TransferenciasTab.tsx:26`, `CapatazDashboard.tsx:25`.

Chamada máquina legada: `public.send_push_async(...)` (SECURITY DEFINER, `supabase/migrations/20260921140209...sql:4-52`)
faz `net.http_post` com `Authorization: Bearer <service_role_key>` e body
`{title, body, url, fazenda_id, fabrica_id, admins_only}`. Acionada por triggers (observação,
mortalidade, transferência de fábrica/estoque) e pelo pg_cron `verificar-salgas-atrasadas`.

`all=true`: **nenhum chamador** no repositório. `user_id` (singular): nenhum chamador.

## 2. Política final de autorização (deny-by-default)

Identidade é determinada só no servidor (`authenticate`): Bearer igual à service role key do
env ⇒ caller **máquina**; senão `auth.getUser(token)` ⇒ caller **humano**; sem token/token
inválido ⇒ 401. Nenhum campo do payload (nem `user_id`/`user_ids`, nem role vindo do cliente)
é fonte de autorização.

| Seleção | Máquina (service role) | Humano |
|---|---|---|
| `fazenda_id` | permitido (contrato `send_push_async`) | admin global **ou** fazenda no escopo do caller (`gerentes.fazenda_id` ∪ `gerentes_fazendas`; `capatazes.retiro_id`/`capatazes_retiros` → `retiros.fazenda_id`), senão 403 |
| `fabrica_id` | permitido (contrato) | admin global **ou** `operadores_fabrica.fabrica_id` do caller, senão 403 |
| `admins_only` | permitido (contrato) | apenas `administradores.ativo`, senão 403 |
| `user_ids`/`user_id` | **403** (não faz parte do contrato legado) | apenas mediante relação comprovável (abaixo), senão 403 |
| `all` (qualquer valor truthy) | **403** | **403** |
| sem seleção / payload inválido | 400 genérico | 400 genérico |

Relações comprováveis para `user_ids` humano (`authorizeUserTargets`):

- **R1** — mesmo tenant SyncVet: alvo é `syncvet_equipe.ativo` da mesma `empresa_id` e o caller
  tem `perfil = administrador` (evidência: `SyncVetAgendaPage` só permite atribuir com
  `isSyncvetFullAccess`; membros carregados por `empresa_id`).
- **R2** — fábrica que serve o caller: alvo é `operadores_fabrica.ativo` cuja fábrica tem
  `fabrica_destinos.fazenda_id` no escopo de fazendas do caller (evidência: `useGerenteTemFabrica.tsx:6-11`
  — “o mesmo vínculo que faz as transferências de fábrica chegarem a ele”).
- **R3** — dono da fazenda: alvo é o `administradores.user_id` dono (`fazendas.administrador_id`)
  de uma fazenda do caller.

Qualquer alvo fora do conjunto permitido ⇒ 403 (múltiplos destinatários não ampliam escopo).

## 3. Caller anônimo / fallback removido

`pushService.ts` deixou de usar a anon key como `Authorization` fallback: sem `session.access_token`
o envio é cancelado com `console.warn` (o contrato “falha silenciosa” é preservado).
Motivo: `admins_only` é operação privilegiada e não pode ser capacidade pública (PRD §6).

**[PENDENTE]** — o push do formulário de leads da landing (`LandingPage.tsx:316`, visitante sem
sessão) passa a ser cancelado no cliente. O registro do lead e a notificação in-app continuam
(funcionando via trigger `trg_lead_notificacao`). Caminho sugerido: mover o push para o trigger
do banco no futuro (exige migration remota, fora do escopo deste PRD).

## 4. Decisão de `verify_jwt`

`supabase/config.toml:3` permanece `verify_jwt = false` — **não comprovável** que o gateway
aceitaria a credencial da máquina legada sem teste em produção (formato da chave remota em
`app_secrets` não é verificável a partir do repositório). Como exige o PRD, a função valida
explicitamente a credencial **antes de qualquer consulta/envio**:

- máquina: comparação em tempo constante do Bearer com `SUPABASE_SERVICE_ROLE_KEY`;
- humano: `auth.getUser`;
- ausente/inválido: 401.

**[PENDENTE]** — remover `verify_jwt = false` desta função após provar em produção que o fluxo
`send_push_async` (Bearer = service role key) passa pelo gateway com `verify_jwt = true`.
(`relatto-demo-signup` é escopo de outro PRD.)

## 5. Método HTTP

Somente `POST` executa. `OPTIONS` → 200 com CORS (`Access-Control-Allow-Methods: POST, OPTIONS`).
Demais métodos → `405` + header `Allow: POST, OPTIONS`.

## 6. Rate limit / proteção

Sem serviço pago e sem estado remoto: contador em memória por isolate (janela fixa de 60s),
chaveado por identidade **server-side** (`machine` ou `user:<user_id>`), nunca por dados do payload.

| Env | Default | Status |
|---|---|---|
| `PUSH_RATE_LIMIT_HUMAN_PER_MIN` | 30 | **[PENDENTE]** valor de produto |
| `PUSH_RATE_LIMIT_MACHINE_PER_MIN` | 120 | **[PENDENTE]** valor de produto |

429 ⇒ `{"error":"Limite de requisições excedido"}`. Limite local é best-effort (memória por
isolate, sem coordenação entre instâncias) — documentado como proteção técnica, não quota.

## 7. Auditoria

Entrada única `[push:audit] ` + JSON por request:

- `push.request.denied` (`console.warn`): `reason ∈ auth_ausente | auth_invalida | rate_limit |
  payload_invalido | broadcast_proibido | sem_selecao | selecao_proibida | escopo_negado | sem_destinos`
- `push.request.skipped`: desativado pelo toggle global
- `push.request.completed`: `selections`, `scope` (`fazendaId`/`fabricaId` quando aplicáveis),
  `resolved`, `subscriptions`, `sent`, `failed`
- `push.request.error`: apenas `name` do erro (nunca mensagem)

Comuns: `requestId` (header `x-request-id` ou `crypto.randomUUID()`), `caller`
(`machine|human|unknown`), `actor` (user id quando humano). **Nunca** são registrados: endpoint
de subscription, tokens/JWT, VAPID, service role, título/corpo da mensagem, mensagens cruas de
erro (interno ou do provedor).

## 8. Contrato de erro (não vaza detalhe interno)

| Status | Body |
|---|---|
| 400 | `{"error":"Requisição inválida"}` |
| 401 | `{"error":"Token de autorização ausente"}` / `{"error":"Token inválido ou expirado"}` |
| 403 | `{"error":"Acesso negado"}` |
| 405 | `{"error":"Método não permitido"}` |
| 429 | `{"error":"Limite de requisições excedido"}` |
| 500 | `{"error":"Erro interno ao processar notificação"}` |

Sucesso: `{"total","sent","results":[{"id","ok",("status" numérico do provedor)?}]}` — o campo
`message` do provedor foi removido do retorno (podia conter endpoint); `results` é reconstruído
a partir das subscriptions (nunca inclui `reason` de promise rejeitada). Falha 403/404/410 do
provedor ainda auto-limpa a subscription.

## 9. Testes

Novos:

- `supabase/functions/send-push-notification/index.test.ts` — 26 testes (OPTIONS, GET 405,
  401 sem token/inválido, 403 sem escopo/`all`/`admins_only`/`user_ids` cross-scope/múltiplos
  destinatários/fazenda cross-tenant/fábrica cross-tenant, fluxos legítimos (capataz, gerente
  fazenda, gerente→operador R2, syncvet R1, máquina, admin `admins_only`), máquina com
  `user_ids` ⇒ 403, vazamento de erro do provedor, vazamento em logs, rate limit (30ª/31ª),
  zero rede, 500 sanitizado).
- `apps/web/src/lib/pushService.test.ts` — 3 testes (sem sessão ⇒ sem fetch; sessão sem
  `access_token` ⇒ sem fetch; com sessão ⇒ fetch com Bearer do usuário).

Comandos (executados):

```text
# suíte das Edge Functions (workdir supabase/functions)
node ../../apps/web/node_modules/vitest/vitest.mjs run
  → 116 testes: 109 pass, 7 fail — todos os 7 em _shared/auth.test.ts (pré-existente,
    baseline do HEAD, escopo do Agente 1; falha isolada do PRD-SEC-03)

node ../../apps/web/node_modules/vitest/vitest.mjs run send-push-notification
  → 26/26 pass

# web
node node_modules/vitest/vitest.mjs run src/lib/pushService.test.ts (workdir apps/web)
  → 3/3 pass

git diff --check → ok
bun run check → ver relatório final (typecheck/build/test)
```

## 10. PENDENTE consolidado

1. **[PENDENTE]** valor dos thresholds de rate limit (produto).
2. **[PENDENTE]** remoção de `verify_jwt = false` após prova em produção do fluxo máquina.
3. **[PENDENTE]** push do lead anônimo da landing: migrar para trigger de banco (migration remota futura).
4. **[PENDENTE]** relação “gerente notifica qualquer admin criador de transferência”: sem o id da
   transferência no payload não é verificável — hoje só R3 (dono da fazenda) é permitido.
5. **[PENDENTE]** `send_push_async` continua com `EXECUTE` público (RPC) — mitigation seria
   migration remota (`REVOKE`), fora do escopo deste PRD.
6. **[PENDENTE]** escopo de `gerentes` na *resolução* de destinatários ignora `gerentes_fazendas`
   (comportamento pré-existente do `resolveTargetUserIds`, não alterado para preservar fluxo).
7. **[PENDENTE]** limite grosseiro **pré-auth**: enquanto `verify_jwt=false` estiver ativo,
   requisições anônimas com token inválido chegam a `auth.getUser` (round-trip ao serviço Auth)
   antes de qualquer limite. Um breaker por IP usaria dado enviado pelo cliente — vedado pelo
   PRD (§3.5) — e um breaker global único permitiria que um atacante esgote a cota de tráfego
   legítimo. Avaliar junto com a remoção de `verify_jwt=false` (item 2), que é a correção real.
   Achado MEDIUM da auditoria QA de PRD-SEC-03 (não bloqueante).

## 11. Fora de escopo (não alterado)

Provider push, fila/broker, migrations remotas, deploy, VAPID/service role, `_shared/auth.ts`,
`create-user`/`manage-admin`, workflows CI, `relatto-demo-signup`.


## Defaults numéricos de rate limit

Os limites default atualmente presentes no handler são provisórios e permanecem `[PENDENTE]` de decisão de produto. O gate exige apenas que o mecanismo seja aplicado por identidade, configurável e testado; alterar números sem aprovação é proibido.