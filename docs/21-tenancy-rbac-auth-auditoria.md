# Tenancy, RBAC e Auditoria

## 2. Modelagem de Tenancy

### 2B.5 Audit Contract and Minimization Policy

The `AuditEvent` contract defined in `apps/api/src/modules/observability/domain/audit-contract.ts` centralizes audit logging across the system. It captures identifiers such as `audit_id`, `actorId`, `tenantId`, optional `farmId`, device origin, timestamps, command and request correlation identifiers, versioning, the performed `action`, and a `result` enum (`success`, `denied`, `failed`, `conflict`). Flags for `retry` and optional `conflictRef` are included, alongside a `changesSummary` that describes persisted changes without containing the actual payload.

**Strict minimization policy**: The audit log must never store passwords, tokens, API keys, personal emails, CPF numbers, or any other Personally Identifiable Information (PII). Implementations should only record metadata and a concise summary of what changed, never the raw values. A regex scan can be used in tests to ensure compliance.

---

## 2. Modelagem de Tenancy

### 2.1 Estrutura de Contratos (Domínio)

Os contratos de tenancy estão definidos em `apps/api/src/modules/identity-tenancy/domain/tenant-model.ts`.

#### 2B.1 Contratos de Entidade

**Tenant**
- `id`: TenantId (Identificador único e imutável)
- `name`: Nome legível do tenant
- `slug`: Identificador único em URL
- `createdAt` / `updatedAt`: Timestamps de ciclo de vida

**Membership**
Representa a relação entre um Principal (Usuário/Integração) e um Tenant.
- `id`: Identificador da relação
- `tenantId`: Referência ao Tenant
- `principalId`: Referência ao Principal
- `status`: Estado da membresia (`MembershipStatus`)
- `role`: Papel atribuído dentro do tenant
- `createdAt` / `updatedAt`: Timestamps de ciclo de vida

**ActiveTenant**
Contrato composto utilizado para resolver o contexto de acesso atual, unindo a entidade Tenant e a Membesia ativa do principal.

#### Estados de Membesia (MembershipStatus)
O enum real em `apps/api/src/modules/identity-tenancy/domain/tenant-model.ts` contém apenas:
- `ACTIVE`: Acesso total conforme role.

Estados `PENDING`, `SUSPENDED` e `INVITED` **não existem no código** → [PENDENTE] decisão futura.

## 2B.2 Matriz RBAC (Roles-Based Access Control)

A matriz de permissões define a relação entre Perfis de Usuário e Recursos do Sistema. Os valores abaixo refletem literalmente o código; **nenhuma célula é uma decisão aprovada comprovada** (ver 2C para o mapa de evidência).

- **Localização**: `apps/api/src/modules/identity-tenancy/domain/rbac-matrix.ts`
- **Estados**:
  - `ALLOW`: Acesso explicitamente permitido.
  - `DENY`: Acesso explicitamente negado.
  - `PENDENTE`: Permissão aguardando definição de regra de negócio.
  - `N/A`: Recurso não aplicável ao perfil.

| Perfil \\ Recurso | Usuários | Fazendas | Retiros | Pastos | Prod/Dietas | Operações | Relatórios | Estoque | Visitas | Fábrica | Pesagens | SaaS Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Admin | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Gerente | PEND | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | DENY |
| Capataz | DENY | ALLOW | ALLOW | ALLOW | PEND | ALLOW | ALLOW | PEND | ALLOW | DENY | ALLOW | DENY |
| Escritório | PEND | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | PEND | ALLOW | DENY |
| Op. Fábrica | DENY | N/A | N/A | N/A | ALLOW | ALLOW | ALLOW | ALLOW | DENY | ALLOW | ALLOW | DENY |
| Consultor | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | DENY |
| Pesador | DENY | N/A | N/A | N/A | N/A | ALLOW | ALLOW | N/A | DENY | N/A | ALLOW | DENY |
| Pecuarista | PEND | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | DENY |
| SyncVet | DENY | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | DENY | ALLOW | DENY |

## 2C. Mapa de Evidência — Matriz RBAC (Bloco H)

Auditoria somente-leitura de `apps/api/src/modules/identity-tenancy/domain/rbac-matrix.ts`.

### Evidência disponível
- `apps/api/src/modules/identity-tenancy/domain/rbac-matrix.test.ts` — testa apenas **estrutura**: matriz completa (9 perfis × 12 recursos), `checkPermission` retornando exatamente o valor da matriz, e valores válidos no conjunto `ALLOW | DENY | PENDENTE | N/A`. Ou seja, o teste só **auto-referencia** a matriz.
- Nenhum consumidor de runtime importa `rbac-matrix.ts` / `checkPermission` / `RBAC_MATRIX` fora de `domain/index.ts` (re-export) e do próprio teste. A matriz **não** está integrada ao runtime.

### Conclusão por perfil/recurso
| Perfil \ Recurso | Estado da evidência |
| :--- | :--- |
| Todos os `ALLOW`/`DENY` da tabela 2B.2 | [PENDENTE] — sem teste comportamental ou PRD aprovado que comprove a decisão; a matriz apenas se auto-referencia. |
| Células `PENDENTE`/`N/A` da tabela 2B.2 | [PENDENTE] — mesmas condições; só existem literalmente na matriz. |
| `checkPermission(profile, resource)` | Comprovado por teste: retorna o valor literal da matriz. |
| Completude 9×12 e valores válidos | Comprovado por teste estrutural. |

> Regra aplicada: nenhuma decisão de permissão (`ALLOW`/`DENY`) é afirmada como aprovada sem evidência externa; todas as células concretas permanecem [PENDENTE] até que um teste comportamental ou PRD as comprove. A matriz não foi integrada ao runtime.

