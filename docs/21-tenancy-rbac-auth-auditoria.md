# Tenancy, RBAC, Auth e Auditoria — FASE 2B

> Estado: contratos locais preparados; provider remoto não conectado. Decisões sem evidência permanecem `[PENDENTE]`.

## 2B.1 Modelo canônico de tenant

Tenant representa a organização/empresa contratante, nunca uma fazenda. Um tenant pode possuir múltiplas fazendas.

O contrato local contém `Tenant`, `Membership` e `ActiveTenant`. O catálogo canônico atual de membership possui **somente `ACTIVE`**. Estados adicionais não são inferidos; quando o produto exigir convite, suspensão ou estados intermediários, eles devem ser aprovados antes de entrar no enum.

Operações tenant-scoped devem transportar contexto explícito. `TenantExecutionContext` exige `tenantId`, `principalId`, `requestId` e `correlationId`. O contrato enumera as fronteiras onde esse contexto é obrigatório quando aplicável: queries, commands, arquivos, jobs, eventos, cache, realtime, relatórios e sync. **Ausência de tenant nunca significa acesso global.**

Operações realmente globais devem possuir política própria e explícita; não reutilizam ausência de `tenantId` como atalho.

### Auditoria de materialização do contexto

O tipo canônico existe, mas a auditoria pré-FASE 3 mostrou que ele **ainda não está materializado em todas as assinaturas**. Isso não deve ser escondido por uma constante arquitetural:

| Fronteira | Evidência no código atual | Estado |
|---|---|---|
| queries/commands de domínio | diversos readers/writers recebem apenas IDs/filtros (`farms`, `pastures`, `inventory`, `visits`, `weighing`) | `[PENDENTE]` integração gradual |
| arquivos | `FileStoragePort`/`SignedUrlPort` materializados com `TenantExecutionContext` | `[CONCLUÍDO]` |
| jobs | `JobQueuePort.enqueue` materializado com `TenantExecutionContext` | `[CONCLUÍDO]` |
| eventos | `EventPublisherPort.publish` materializado com `TenantExecutionContext` | `[CONCLUÍDO]` |
| cache/config | não existe cache port canônico; `FeatureFlagContext.tenantId` é opcional para suportar flags globais | `[PENDENTE]` por uso |
| realtime | não existe port da nova API nesta fase | `[PENDENTE]` até primeiro uso |
| relatórios | `reporting/domain/ports.ts` materializado com `TenantExecutionContext` | `[CONCLUÍDO]` |
| sync | `SyncQueueReader/Writer` e `SyncTransport` não recebem contexto de tenant | `[PENDENTE]` para o motor futuro |

Conclusão: o contrato comum está pronto, mas o checklist de “contexto obrigatório em todas as fronteiras” **não pode ser marcado concluído ainda** sem alterar consumidores/adapters de forma incremental e executar a suíte completa. A FASE 3 não deve introduzir novos acessos tenant-scoped sem contexto explícito.

## 2B.2 RBAC

A matriz estrutural cobre os 9 perfis e 12 recursos do Checklist, mas não existe evidência aprovada suficiente para transformar a maior parte das células em regra canônica de backend. Por isso `RBAC_MATRIX` é evidence-first: todas as células permanecem `PENDENTE` até haver decisão aprovada ou evidência comportamental server-side para aquele par perfil/recurso.

Visibilidade de menu, rota ou redirect no frontend **não é** autorização de backend. A nova API continua autorizando por tenant + scopes por meio de `AuthorizationPort`.

Evidência específica já observada no legado:

- `create-user`: caller precisa ser administrador ativo para criar usuário/administrador;
- `manage-admin`: caller precisa ser administrador ativo para alterar/remover administradores, com bloqueio de self-delete e do último admin ativo;
- `send-push-notification`: autorização varia por caller e escopo de fazenda/fábrica/admin, sem broadcast arbitrário.

Esses fatos não autorizam extrapolar `ALLOW` para recursos inteiros.

## 2B.3 Alçadas

| Alçada | Evidência atual | Estado canônico |
|---|---|---|
| criação de usuário/administrador | `create-user` exige administrador ativo | comprovado apenas para o fluxo legado |
| gestão de administradores | `manage-admin` exige administrador ativo | comprovado apenas para o fluxo legado |
| criação de capataz | regra canônica não consolidada | `[PENDENTE]` |
| autocadastro de fazenda | sem regra canônica aprovada | `[PENDENTE]` |
| alterações estruturais | sem matriz server-side aprovada por ação | `[PENDENTE]` |
| aprovações | variam por fluxo legado | `[PENDENTE]` |
| operações administrativas globais | evidência parcial em `create-user`/`manage-admin` | `[PENDENTE]` para o SaaS novo |

Nenhuma alçada nova deve ser implementada por inferência.

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