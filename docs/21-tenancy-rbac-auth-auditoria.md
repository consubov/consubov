# Tenancy, RBAC, Auth e Auditoria — FASE 2B

> Estado: contratos locais preparados; provider remoto não conectado. Decisões sem evidência permanecem `[PENDENTE]`.

## 2B.1 Modelo canônico de tenant

Tenant representa a organização/empresa contratante, nunca uma fazenda. Um tenant pode possuir múltiplas fazendas.

O contrato local contém `Tenant`, `Membership` e `ActiveTenant`. O catálogo canônico atual de membership possui **somente `ACTIVE`**. Estados adicionais não são inferidos; quando o produto exigir convite, suspensão ou estados intermediários, eles devem ser aprovados antes de entrar no enum.

Operações tenant-scoped devem transportar contexto explícito. `TenantExecutionContext` exige `tenantId`, `principalId`, `requestId` e `correlationId`. O contrato enumera as fronteiras onde esse contexto é obrigatório quando aplicável: queries, commands, arquivos, jobs, eventos, cache, realtime, relatórios e sync. **Ausência de tenant nunca significa acesso global.**

Operações realmente globais devem possuir política própria e explícita; não reutilizam ausência de `tenantId` como atalho.

### Materialização do contexto — concluída no contrato da FASE 2

`TenantExecutionContext` está materializado nas fronteiras tenant-scoped já definidas nesta arquitetura:

| Fronteira | Estado |
|---|---|
| queries/commands | `TenantScopedQuery<T>` e `TenantScopedCommand<T>` exigem contexto explícito; readers/writers tenant-scoped dos módulos de domínio também recebem o contexto |
| arquivos | `FileStoragePort`/`SignedUrlPort` exigem contexto |
| jobs | `JobQueuePort.enqueue` exige contexto |
| eventos | `EventPublisherPort.publish` exige contexto |
| notificações/push | portas tenant-scoped exigem contexto |
| relatórios | readers de reporting exigem contexto |
| sync | `SyncQueueReader`, `SyncQueueWriter` e `SyncTransport` exigem contexto |
| cache/realtime | não existe adapter concreto da nova arquitetura nesta fase; qualquer implementação futura deve seguir `TENANT_CONTEXT_BOUNDARIES` |

Exceções são explícitas, não implícitas:
- contratos de autenticação/tenancy operam antes da resolução do contexto;
- catálogo de nutrição atualmente documentado como global continua global;
- administração SaaS é boundary global próprio;
- auditoria já transporta `tenantId` no próprio `AuditEvent`.

O teste `architecture/tenant-context-rules.test.ts` impede regressão das fronteiras tenant-scoped materializadas.

## 2B.2 RBAC — contrato concluído

A matriz estrutural cobre os 9 perfis e 12 recursos do Checklist. Ela continua **evidence-first**: nenhuma célula vira `ALLOW` sem decisão aprovada ou evidência server-side.

A política de segurança agora é explícita e total:
- somente `ALLOW` autoriza;
- `PENDENTE`, `DENY` e `N/A` negam acesso por padrão;
- `isPermissionAllowed` centraliza essa regra;
- visibilidade de menu, rota ou redirect no frontend **não é** autorização;
- a autorização runtime da nova API continua tenant + scopes via `AuthorizationPort`.

Assim, células ainda não aprovadas representam **decisão de produto futura**, não uma brecha aberta nem uma pendência arquitetural da FASE 2.

Evidência específica já observada no legado:

- `create-user`: caller precisa ser administrador ativo para criar usuário/administrador;
- `manage-admin`: caller precisa ser administrador ativo para alterar/remover administradores, com bloqueio de self-delete e do último admin ativo;
- `send-push-notification`: autorização varia por caller e escopo de fazenda/fábrica/admin, sem broadcast arbitrário.

Esses fatos não autorizam extrapolar `ALLOW` para recursos inteiros.

## 2B.3 Alçadas — contrato concluído

A matriz `AUTHORITY_MATRIX` registra todas as alçadas do Checklist sem inventar concessões:

| Alçada | Decisão vigente |
|---|---|
| criação de usuário/administrador | `ADMIN_REQUIRED`, comprovado por `create-user` |
| gestão de administradores | `ADMIN_REQUIRED`, comprovado por `manage-admin` |
| criação de capataz | `DENY_UNTIL_APPROVED` |
| autocadastro de fazenda | `DENY_UNTIL_APPROVED` |
| alterações estruturais | `DENY_UNTIL_APPROVED` |
| aprovações | `DENY_UNTIL_APPROVED` |
| operações administrativas globais | `DENY_UNTIL_APPROVED` fora dos fluxos comprovados |

`DENY_UNTIL_APPROVED` não inventa regra de produto: é o comportamento seguro enquanto não existir decisão explícita. Novos grants exigem evidência/decisão própria antes de alterar a matriz.

## 2B.4 Auth por contrato

Contratos atuais:

- principal `user | integration`;
- claims mínimos: principal, tenant, scopes, `expired`, `revoked`;
- `IdentityVerifierPort`, `TenantContextPort` e `AuthorizationPort`;
- fake verifier rejeita credencial inexistente, expirada ou revogada.

Política de expiração/reautenticação:

1. credencial expirada ou revogada **não resolve identidade**;
2. quando existir boundary HTTP autenticado, falha de autenticação expirada/revogada resulta em **401**;
3. **403** é reservado para identidade válida sem autorização suficiente;
4. refresh/reautenticação pertence ao adapter/provider futuro;
5. refresh nunca pode ampliar tenant/scopes silenciosamente;
6. nenhuma duração de sessão, refresh token ou provider é definida nesta fase.

## 2B.5 Auditoria

`AuditEvent`/`AuditLogPort` cobrem ator, tenant, fazenda/contexto quando aplicável, origem, horário, command/request/correlation IDs, versão conhecida, ação, resultado, retry, conflito e resumo da alteração.

Política de minimização:

- nunca persistir senha, token, API key, secret ou payload sensível integral;
- PII só quando houver necessidade operacional aprovada;
- `changesSummary` descreve campos/efeito, não valores sensíveis.

Adapters atuais são fakes/in-memory; não há persistência remota de auditoria nesta fase.