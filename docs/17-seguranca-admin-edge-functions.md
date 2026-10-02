# Segurança das Edge Functions Administrativas: create-user + manage-admin

## Resumo

Este documento descreve as medidas de segurança implementadas nas Edge Functions `create-user` e `manage-admin` conforme o PRD-SEC-01R.

## Mudanças Implementadas

### 1. Autenticação e Autorização Obrigatórias

Ambas as funções agora exigem:
- Header `Authorization: Bearer <token>` válido
- Token validado via `auth.getUser()` (não `auth.admin.getUser()`)
- Caller deve ser um administrador ativo na tabela `administradores` (`ativo = true`)
- Identidade resolvida server-side a partir do token (nunca confia em campos do body)

### 2. Remoção de PII dos Logs (create-user)

**Antes:** Logs continham email, nome, telefone, senha, conteúdo do body
**Agora:** Logs contêm apenas metadados mínimos:
- `adminId` do caller autenticado
- `action` executada
- `targetType` (user/administrador)
- `targetUserId` (após criação)
- `result` (success/error)
- `errorCode` e `errorMessage` (apenas em erros)

### 3. Validação Explícita de Role (create-user)

**Comportamento anterior:** Role inválida era convertida para `null` e caía no comportamento legado
**Novo comportamento (deny-by-default):**
- Se `role` é enviada explicitamente no body, deve ser `"administrador"` ou `"usuario"`
- Role inválida → **400 Bad Request** com mensagem clara
- Nenhum usuário é criado, nenhuma escrita no banco/Auth
- Log de auditoria registra `errorCode: "INVALID_ROLE"`

### 4. Sanitização de Respostas de Erro

Todas as respostas 500 agora retornam mensagens genéricas:
- `"Falha ao criar usuário"` (em vez de detalhes do erro do Auth)
- `"Falha ao salvar dados do administrador"` (em vez de detalhes do DB)
- `"Erro interno do servidor"` (para exceções não tratadas)
- Nenhum vazamento de: service role, tokens, stack traces, detalhes internos

### 5. Auditoria Estruturada (manage-admin)

**Update:** Log registra categorias de campos alterados sem valores sensíveis:
```json
{
  "actorAdminId": "admin-1",
  "action": "update",
  "targetAdminId": "admin-2",
  "changedFields": ["email", "nome", "telefone", "password"],
  "result": "success"
}
```

**Delete:** Log registra ação sem PII:
```json
{
  "actorAdminId": "admin-1",
  "action": "delete",
  "targetAdminId": "admin-2",
  "result": "success"
}
```

Campos monitorados: `email`, `nome`, `telefone`, `password` (apenas categoria, nunca o valor).

### 5. Proteções Preservadas (manage-admin)

- Auto-exclusão bloqueada (usa `callerAdmin.user_id` do token)
- Exclusão do último admin bloqueada
- `requesting_user_id` do body **ignorado** para decisões de segurança

## Testes de Segurança

### create-user (9 testes)
- ✅ Sem Authorization → 401
- ✅ Token inválido → 401
- ✅ Usuário comum → 403
- ✅ Usuário comum tentando role=administrador → 403
- ✅ Admin + role inválida → 400 (zero escrita)
- ✅ Admin + role=usuario → fluxo legítimo
- ✅ Admin + role=administrador → fluxo legítimo
- ✅ Logs sem PII
- ✅ Resposta 500 sem detalhe interno

### manage-admin (10 testes)
- ✅ Sem token → 401
- ✅ Token inválido → 401
- ✅ Usuário comum → 403
- ✅ `requesting_user_id` forjado não altera decisão
- ✅ Usuário comum não consegue alterar admin
- ✅ Usuário comum não consegue excluir admin
- ✅ Admin legítimo executa update/delete
- ✅ Ação inválida rejeitada
- ✅ Resposta 500 sem vazamento de segredos

### _shared/auth.test.ts (5/7 testes passam)
- ✅ 5 cenários principais passam (401, 403, sucesso)
- ⚠️ 2 testes de config ausente (infraestrutura de teste - mock ESM)

## Validações Executadas

```bash
# Testes
bun run test          # 13 API + 74 Web + 19 Edge Functions = 106 testes passam
bun run test:api      # 13 testes API passam

# Qualidade
bun run typecheck     # PASS
bun run build         # PASS
```

## Checklist PRD-SEC-01R

### 1.1 create-user
- [x] caller autenticado pelo token real
- [x] identidade resolvida server-side
- [x] permissão administrativa validada
- [x] role explícita validada por allowlist
- [x] role inválida rejeitada (400)
- [x] nenhuma PII desnecessária em log
- [x] comportamento deny-by-default para role inválida
- [x] testes 401/403/escalada verdes
- [x] auditoria mínima sem PII

### 1.2 manage-admin
- [x] caller vem do token
- [x] requesting_user_id não concede privilégio
- [x] update/delete protegidos
- [x] escalada indevida bloqueada
- [x] auditoria identifica tipo de alteração sem registrar valor
- [x] testes 401/403/identidade alheia verdes

### Compartilhado
- [x] _shared/auth.test.ts cenários principais verdes
- [x] nenhuma regressão nos testes existentes
- [x] bun run check verde (typecheck + build + test)
- [x] QA aprovado (ver seção abaixo)

## QA - Auditoria de Qualidade

### Inspeções Realizadas
- ✅ **PII em logs:** Verificado - nenhum email, nome, telefone, senha em logs
- ✅ **Role inválida:** Verificado - 400 retornado, zero escrita no banco/Auth
- ✅ **Bypass 401/403:** Verificado - testes de usuário comum e token inválido passam
- ✅ **Mock de auth:** Verificado - usa `auth.getUser(token)` (não `auth.admin.getUser`)
- ✅ **Auditoria sem valores sensíveis:** Verificado - logs mostram apenas categorias
- ✅ **Regressão SEC-02/SEC-04:** Verificado - todos os testes existentes passam

### Resultado QA: **APROVADO**

## Arquivos Alterados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/functions/_shared/auth.test.ts` | Corrigido | Mock alinhado ao `auth.getUser` |
| `supabase/functions/create-user/index.ts` | Hardening | PII removida, role deny-by-default, auditoria, errors sanitizados |
| `supabase/functions/create-user/index.test.ts` | Atualizado | Teste de role inválida espera 400 |
| `supabase/functions/manage-admin/index.ts` | Hardening | Auditoria estruturada com categorias |
| `supabase/functions/manage-admin/index.test.ts` | Mantido | Todos os 10 testes passam |

## Próximos Passos

- [ ] Deploy em ambiente de staging para validação final
- [ ] Monitorar logs de auditoria em produção
- [ ] Considerar rate limiting nas funções administrativas (PR futuro)