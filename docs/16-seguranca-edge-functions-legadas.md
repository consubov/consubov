# CONSUBOV — Segurança das Edge Functions legadas (auditoria geral SEC-04 + hardening SEC-02)

> **Fase:** 0–1 — Governança e segurança P0 (PRD-SEC-02 e PRD-SEC-04)
> **Versão:** 1.1 (SEC-04: inventário das 10 funções + hardening de 4 funções fora dos PRDs paralelos)
> **Data:** 2026-10-01
> **Status:** VIGENTE após endurecimento local
> **Objetivo:** registrar o contrato e as garantias de segurança das funções Supabase legadas endurecidas (SEC-02), o inventário completo das 10 Edge Functions (SEC-04, Checklist Mestre 1.6) e as pendências remotas que permanecem bloqueadas.

---

## 1. Escopo desta mudança

Duas funções legadas em `supabase/functions/` foram endurecidas localmente:

1. `seed-app-secrets` — eliminou persistência insegura de segredo administrativo.
2. `cleanup-demo-accounts` — eliminou exposição pública de operação destrutiva.

Nenhuma outra função foi alterada (`create-user`, `manage-admin` e `send-push-notification` permanecem conforme seus respectivos trabalhos).

---

## 2. seed-app-secrets

### 2.1 Problema corrigido

A função original fazia upsert em `public.app_secrets` das chaves `supabase_url` **e** `service_role_key` (com o valor de `SUPABASE_SERVICE_ROLE_KEY`), sem autenticação e em qualquer método HTTP. Qualquer leitor da tabela herdaria privilégio administrativo de banco.

### 2.2 Contrato vigente

| Item | Comportamento |
|---|---|
| Método | Somente `POST` grava; `OPTIONS` responde `200`; demais métodos → `405` com `Allow: POST, OPTIONS` |
| Autenticação | `Bearer` de administrador ativo via `_shared/auth.ts` (`requireAdmin`) → `401` sem token / `401` inválido / `403` não-admin |
| Allowlist | Persiste somente `supabase_url` (valor sempre vindo do servidor, nunca do body) |
| Body fora da allowlist | `403` e **nenhuma escrita** (negar por padrão) |
| Body JSON inválido/malformado | `null` → seeding da allowlist (sem efeito adverso); JSON válido não-objeto (ex.: lista) → `400` |
| Resposta de sucesso | `{ ok: true, keys: [...] }` — nunca valores persistidos |
| Erros | Mensagens genéricas (`500`) sem vazar configuração ou segredo |
| Logs | Somente `adminId`, nomes de chaves e resultado — nunca valor sensível |

### 2.3 Garantias e testes

- O código-fonte da função **não contém** `SUPABASE_SERVICE_ROLE_KEY`/`SERVICE_ROLE` (guarda de regressão estática no teste falha se alguém reintroduzir a persistência).
- Testes em `supabase/functions/seed-app-secrets/index.test.ts` cobrem 401/403/405, body hostil, ausência de segredo em resposta e em logs.

---

## 3. cleanup-demo-accounts

### 3.1 Problema corrigido

A função executava exclusão em cascata (consultores demo, visitas, storage, usuários auth) sem autenticação, e `supabase/config.toml` a marcava com `verify_jwt = false` (acesso público). O campo `force` do body podia pular o corte de 24h sem qualquer autorização.

### 3.2 Contrato vigente

| Item | Comportamento |
|---|---|
| `verify_jwt` | Entrada removida do `config.toml` → herda o default `true` (não exposta publicamente) |
| Método | Somente `POST` executa; `OPTIONS` responde `200`; demais métodos → `405` com `Allow: POST, OPTIONS` |
| Autenticação/Autorização | `requireAdmin(req)` **antes** de qualquer lógica destrutiva → `401`/`401`/`403` |
| Identidade | Vem exclusivamente do token; campos de identidade no body (`user_id`, `role`, `admin`, `requested_by`) são ignorados e não concedem privilégio algum |
| `force` | Interpretado somente após autorização; sem autorização não altera nada; preserva o comportamento original (com `force` pula o corte de 24h) |
| Cascata destrutiva | Preservada integralmente, apenas atrás da autorização |
| Auditoria | Acesso negado: `console.warn` somente com status; execução: `admin=<id> force=<bool> removidos=<n>`; sem e-mail/token/PII |
| Erros | Resposta `500` genérica; log de erro redigido (substitui a service key por `[REDACTED]`) |

### 3.3 Garantias e testes

- Testes em `supabase/functions/cleanup-demo-accounts/index.test.ts` são **100% mockados**: nenhuma exclusão real, nenhum acesso a rede ou ambiente remoto.
- Cobrem: sem Authorization, credencial inválida, usuário comum, identidade forjada no body, `force=true` sem privilégio, método incorreto, e fluxo autorizado com operação simulada.

---

## 4. Política de `verify_jwt` no legado

`verify_jwt = false` só permanece para funções com fluxo publicamente chamável por decisão existente:

- `send-push-notification`
- `relatto-demo-signup`

Toda função com operação destrutiva ou administrativa deve herdar `verify_jwt = true` **e** exigir autorização server-side (`requireAdmin`) internamente (defesa em profundidade).

---

## 5. Comandos de validação reais

```sh
# workdir: supabase/functions
bunx vitest@3.2.4 run
```

Observação: o `vitest` instalado na raiz do monorepo (`5.0.3`) é incompatível com o `vite@5` hoisted e falha no startup (`ERR_PACKAGE_PATH_NOT_EXPORTED` em `./module-runner`); por isso o comando pinna `3.2.4`. Pendência de tooling registrada, fora do escopo deste PRD.

O contrato canônico do repositório (`bun run check` = typecheck + build + test) passa; o `bun run lint` falha apenas com a dívida preexistente do `apps/web` (1422 erros já declarados no README), sem qualquer erro nos arquivos deste trabalho.

---

## 6. Pendências reais (não resolvidas por este trabalho)

- `[PENDENTE]` Auditoria remota: verificar se `app_secrets.service_role_key` já está persistido no banco remoto e rotacionar credencial — **bloqueado** até a fase remota do projeto (nenhum acesso remoto foi feito).
- `[PENDENTE]` A função SQL legada `send_push_async` (migração `20260921140209_...`) lê `app_secrets` de `supabase_url` **e** `service_role_key` e retorna silencioso se ausente; com o bloqueio de persistência, push via SQL depende de linha pré-existente. Substituir o segredo no banco por mecanismo próprio (ex.: Vault/secret do banco) em PRD específico.
- `[PENDENTE]` `supabase/functions/_shared/auth.test.ts` (arquivo não commitado, WIP do PRD-SEC-01) falha porque o mock usa `@supabase/supabase-js` enquanto `auth.ts` importa `https://esm.sh/...` — correção pertence ao trabalho do PRD-SEC-01.
- `verify_jwt = false` restante em `send-push-notification` e `relatto-demo-signup` (fora do escopo deste PRD).

---

## 7. Relacionamento com outras políticas

- Política de mudanças estruturais: `docs/13-politica-mudancas-estruturais.md` (auth/RBAC exige revisão reforçada e testes 401/403 — atendidos).
- Política de terceiros: `docs/14-politica-codigo-terceiros.md` (nenhuma dependência nova adicionada).
- Nenhuma alteração de ADR: mudança de segurança local reversível, sem troca de arquitetura.
- Nenhum contrato OpenAPI do `/api/v1` foi afetado (funções legadas do Supabase não constam do OpenAPI da nova API).

---

## 8. Inventário SEC-04 — todas as 10 Edge Functions (Checklist Mestre 1.6)

> Convenção: **[PENDENTE]** = não comprovado por evidência no repositório.
> `JWT` = `verify_jwt` em `supabase/config.toml` (`true` por default quando
> ausente); `SR` = usa service role; `ADMIN`/`DEST` = operação
> administrativa/destrutiva. Owner formal: **[PENDENTE]** para todas (sem
> CODEOWNERS no repositório).

| # | Função | Finalidade comprovada | Chamadores | HTTP | JWT | AuthN/AuthZ | SR | CORS | ADMIN | DEST |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `create-user` | Criar usuário no Auth + opcional `insert` em `administradores`; rollback com `deleteUser` (SEC-01) | `CriarAdminModal.tsx:108`, `CriarEscritorioModal.tsx:42`, `GerentesPage.tsx:143`, `CapatazesPage.tsx:150`, `ConsultoresPage.tsx:83`, `PesadoresPage.tsx:113`, `OperadoresFabricaPage.tsx:90`, `FabricaDetailPage.tsx:390`, `SyncVetEquipePage.tsx:107`, `AdminSyncVetOnboardingPage.tsx:78` | POST | default true | `requireAdmin` | SIM | `*` | SIM | rollback |
| 2 | `manage-admin` | `update`/`delete` em `administradores` + Auth; travas anti auto-exclusão/último-admin (SEC-01) | `AdminListSection.tsx:126-167` | POST | default true | `requireAdmin` + travas | SIM | `*` | SIM | SIM |
| 3 | `seed-app-secrets` | Seeding não-sensível (allowlist: só `supabase_url`) — ver §2 (SEC-02) | nenhum em produção | POST, 405 resto | default true | `requireAdmin` | SIM | `*` | SIM | UPSERT |
| 4 | `cleanup-demo-accounts` | Cascata de contas demo (`is_demo=true`) + Auth — ver §3 (SEC-02) | nenhum em produção | POST, 405 resto | default true | `requireAdmin` | SIM | `*` | SIM | SIM |
| 5 | `send-push-notification` | Web Push (VAPID) p/ `push_subscriptions`; filtros fazenda/fábrica/users/`all` (SEC-03) | `pushService.ts:31`; migrations `send_push_async` (2) | qualquer (sem check) | **false** | **nenhuma** | SIM | `*` | não | parcial |
| 6 | `relatto-demo-signup` | Conta demo Relatto (Auth + `consultores`); retorna `{email, senha}` | `RelattoDemoModal.tsx:37` | POST, 405 resto | **false** | **nenhuma** (público) | SIM | `*` | não | rollback |
| 7 | `reset-password` | `updateUserById` só por admin ativo — **endurecida na SEC-04 (§9.3)** | `CapatazesPage.tsx:215-217` (senha fixa `Consubov@2025`) | POST, 405 resto | default true | JWT + `administradores.ativo` | SIM | `*` | SIM | credencial |
| 8 | `syncvet-calcular-trajeto` | Estimativa Haversine; sem DB — **endurecida na SEC-04 (§9.4)** | `SyncVetAgendaPage.tsx:318` | POST, 405 resto | default true | Bearer + `getClaims` | NÃO | [PENDENTE] (vem de pacote externo `npm:@supabase/supabase-js@2/cors`) | não | não |
| 9 | `syncvet-delete-equipe` | Excluir/desativar membro + revogar Auth — **CRÍTICA, endurecida na SEC-04 (§9.1)** | `SyncVetEquipePage.tsx:140` | POST, 405 resto | default true | mesma-empresa OU admin global | SIM | `*` | SIM | SIM |
| 10 | `analisar-retiro` | Análise via Lovable AI Gateway (SSE no servidor) — **endurecida na SEC-04 (§9.2)** | `AnaliseIaRetiroCard.tsx:28` | POST, 405 resto | default true | JWT válido | NÃO | `*` | não | não |

Listas: **verify_jwt=false** = 5, 6; **service role** = 1, 2, 3, 4, 5, 6, 7, 9
(sempre server-side); **CORS `*` privilegiado** = 1, 2, 3, 4, 5, 6, 7, 9, 10;
**logs com PII** = `create-user` (nome/email/telefone — SEC-01, não tocado);
nenhum log de token/segredo; **sem auditoria persistente** em nenhuma
([PENDENTE] decisão de retenção).

## 9. Hardening SEC-04 (só fora dos PRDs paralelos)

### 9.1 syncvet-delete-equipe — IDOR destrutivo cross-tenant (CRÍTICO)
Sem auth intra-função; qualquer JWT + `equipe_id` arbitrário excluía equipes
de outro tenant e apagava contas do Auth; `delErr.message` vazado. Correção:
somente POST (405); Bearer + `getUser` (401); `equipe_id` UUID (400);
autoriza só membro ativo da **mesma empresa** do alvo OU admin global ativo
(403 resto — base: frontend sempre escopa por `empresa_id`,
`SyncVetEquipePage.tsx:51-63`, `useAuth.tsx:172-186`); erros genéricos.
[PENDENTE] restrição por perfil interno da equipe (sem evidência de regra).

### 9.2 analisar-retiro — IA sem auth + fingerprint
Sem validação intra-função; `contexto` sem limite (cota compartilhada);
`status` do gateway repassado. Correção: somente POST (405); JWT válido
(401); teto 8000 chars no contexto (400); 429/402 mapeados, resto vira 502
genérico; detalhe do gateway só no log truncado.
[PENDENTE] rate-limit/tenant e retenção de dados enviados ao gateway.

### 9.3 reset-password — método aberto + enumeração
Aceitava qualquer método; `error.message`/`err.message` vazados. Correção:
somente POST (405); esquema `Bearer` (401); erros genéricos, detalhe no log.
Auth/admin e sucesso inalterados.

### 9.4 syncvet-calcular-trajeto — método aberto + detalhe interno
GET sem body → 500 com detalhe; `String(err)` ao cliente. Correção: somente
POST (405); 500 genérico; faixas geográficas no Zod (±90/±180). `getClaims`
inalterado.

### 9.5 Bloqueadas com justificativa
`send-push-notification` (SEC-03 — risco alto registrado, correção com o
SEC-03); `relatto-demo-signup` (`verify_jwt=false` compatível com signup
público; [PENDENTE] captcha/rate-limit); CORS `*` (sem lista de origens no
repo); RBAC por perfil, senha fixa `Consubov@2025`, auditoria persistente
(sem evidência de regra — decisão de produto).

## 10. Matriz de testes negativos SEC-04

`EXECUTADO` = `index.test.ts` da função, verde em 2026-10-01
(`bunx vitest@3.2.4 run`, workdir `supabase/functions`).

| Caso | delete-equipe (15) | analisar-retiro (11) | reset-password (10) | calcular-trajeto |
|---|---|---|---|---|
| Anônimo → 401 | EXECUTADO | EXECUTADO | EXECUTADO | código exige Bearer |
| Token inválido → 401 | EXECUTADO | EXECUTADO | EXECUTADO | `getClaims` |
| Sem permissão → 403 | EXECUTADO (outsider) | n/a (sem papel) | EXECUTADO | n/a |
| Identidade forjada no body | EXECUTADO (403) | n/a | EXECUTADO (403) | body só coordenadas |
| Cross-tenant | EXECUTADO (outra empresa → 403) | [PENDENTE] | alvo arbitrário exige admin | n/a (sem DB) |
| Método indevido → 405 | EXECUTADO | EXECUTADO | EXECUTADO | implementado (sem runner p/ `npm:`) |
| Payload inválido → 400 | EXECUTADO (UUID) | EXECUTADO | EXECUTADO | Zod + faixas |
| Destrutiva indevida bloqueada | EXECUTADO (sem `deleteUser`) | n/a | EXECUTADO (sem `updateUserById`) | n/a |
| Erro sem detalhe | EXECUTADO (sem SQLSTATE) | EXECUTADO (502) | EXECUTADO (sem `User not found`) | 500 genérico |
| Log sem segredo/PII | só UUIDs internos | detalhe só no log | sem log de senha | sem coords/token |

## 11. Validação SEC-04 (comandos reais, 2026-10-01)

- `bunx vitest@3.2.4 run` (workdir `supabase/functions`): ver §12 de QA;
  7 falhas pré-existentes em `_shared/auth.test.ts` (mock usa
  `@supabase/supabase-js`, `auth.ts` importa `https://esm.sh/...` — SEC-01).
- `syncvet-calcular-trajeto`: parse TS validado via esbuild (imports `npm:`
  não resolvidos pelo runner vitest; sem teste executável).
- Sweeps: nenhum `*.message` de erro interno retornado ao cliente nos 4
  arquivos; nenhum `console.*` com token/segredo/PII; service role só
  server-side. `bun.lock`/`package.json`: só o trabalho SEC-02 (não tocados).

## 12. QA SEC-04

Veredicto independente do revisor: **QA: APROVADO** (revisão registrada no
handoff do PRD-SEC-04 em `instructions/active/`). Escopo verificado: bypass
de auth/RBAC, cross-tenant, secrets/PII, `verify_jwt=false`, service role,
destrutivas, administrativas, CORS, logging e regressão dos fluxos legítimos
(`SyncVetEquipePage`, `AnaliseIaRetiroCard`, `CapatazesPage`,
`SyncVetAgendaPage` — todos invocam via POST autenticado, compatível).
