# Ports e Adapters Fundamentais (FASE 2.3)

Esta documentação registra a fundação de contratos de infraestrutura da arquitetura hexagonal implementados na Fase 2.3 do projeto. O objetivo é manter os módulos internos completamente agnósticos a provedores de nuvem, banco de dados ou serviços externos.

## Princípios de Design
1. **Pequenos e Específicos:** Contratos definidos pela necessidade da aplicação, não baseados na API do provedor.
2. **Provider-agnostic:** Nenhum `port` deve conhecer ou referenciar Supabase, S3, Datadog ou qualquer SDK externo.
3. **Pertencimento:** A interface (port) pertence ao módulo que a consome (ex: o repositório do domínio de Farm pertence ao módulo Farm). Contratos transversais pertencem a `apps/api/src/shared/ports`.
4. **Dependência Interna:** Contratos devem importar apenas tipos internos do domínio/aplicação.
5. **Tenancy explícita:** quando a operação for tenant-scoped, a fronteira deve carregar contexto de tenant de forma explícita. Ausência de `tenantId` não significa acesso global.

## 1. Segurança e Tenancy (`apps/api/src/modules/identity-tenancy/domain/`)

- **IdentityVerifierPort**: Avalia as credenciais para retornar a identidade já autenticada (`VerifiedIdentity`). Independente do modelo JWT ou API Key.
- **TenantContextPort**: Resolve o contexto aplicacional do *tenant* a partir da identidade confirmada, retornando o `AuthenticatedRequestContext`. Não acoplado a regras definitivas de membership.
- **AuthorizationPort**: Contrato que recebe o contexto autenticado e a exigência de acesso, retornando uma decisão de autorização baseada no comportamento atual tenant-first e scopes.
- **TenantExecutionContext**: contrato comum para operações tenant-scoped, contendo `tenantId`, `principalId`, `requestId` e `correlationId`.

*Adaptadores Atuais:* FakeTenantContextAdapter, FakeAuthorizationAdapter (para testes unitários).

> **Estado pré-FASE 3:** o contrato comum de execução existe, mas sua materialização em todas as fronteiras ainda é incremental. Não marcar arquivos/jobs/eventos/relatórios/sync como tenant-safe apenas pela existência do tipo; verificar a assinatura real de cada port e seu consumidor.

## 2. Observabilidade (`apps/api/src/modules/observability/domain/`)

- **AuditLogPort**: Contrato para registrar ações sensíveis de domínio. Não define schema relacional. Exige o `tenantId`, `actor`, e a exclusão de informações sensíveis (PII, tokens).
- **TelemetryPort**: Contrato mínimo para eventos, logs estruturados e registro de erros.

*Adaptadores Atuais:* FakeAuditLogAdapter, FakeTelemetryAdapter (em-memória).

## 3. Armazenamento e Integrações Externas

- **FileStoragePort (`apps/api/src/modules/files/domain/ports.ts`)**: abstrai armazenamento de arquivos (salvar, remover e obter referência), sem dependência de S3 ou Storage do Supabase.
  - *Estado atual:* materializado com `TenantExecutionContext` em todas as assinaturas.
  - *Adaptadores Atuais:* FakeFileStorageAdapter.
- **NotificationPort (`apps/api/src/modules/notifications/domain/ports.ts`)**: responsável pelo disparo de alertas/comunicações para o usuário, independentemente de canal (Push, E-mail, SMS).
  - *Adaptadores Atuais:* FakeNotificationAdapter.

## 4. Persistência de Domínio (`apps/api/src/modules/farms/domain/`)

- Em vez de um repositório CRUD genérico e sem semântica para toda aplicação, cada módulo de negócio que precisa persistir dados define sua própria interface específica.
- **Exemplo Real:** `FarmRepository` no módulo Farms (`apps/api/src/modules/farms/domain/ports.ts`). Contrato permite a recuperação, criação e deleção baseada estritamente nos tipos do próprio domínio.
  - *Adaptadores Atuais:* FakeFarmRepository (`apps/api/src/modules/farms/infrastructure/FakeFarmRepository.ts`).
  - *Gate remoto:* FASE 3.5 pode usar adapters de memória/fixture e persistência local controlada quando aprovada. Implementação contra PostgreSQL/Supabase remoto permanece bloqueada até a FASE 8 e autorização explícita.

## 5. Infraestrutura Compartilhada e Core (`apps/api/src/shared/ports/`)

Contratos transversais e frequentemente consumidos em diferentes pontos da aplicação:
- **ClockPort**: Obtenção de data atual.
  - *Adaptadores Atuais:* SystemClock (real), FakeClock (para manipulação em testes).
- **IdGeneratorPort**: Geração de identificadores da aplicação (IDs agnósticos).
  - *Adaptadores Atuais:* UUIDGenerator (baseado em crypto native), FakeIdGenerator.
- **EventPublisherPort**: Publicação de eventos internos da arquitetura, desacoplada de broker externo. O envelope de evento pode carregar tenant, mas a assinatura transversal atual ainda não recebe `TenantExecutionContext` como argumento obrigatório; aplicar contexto por evento/uso conforme 2B.1.
- **JobQueuePort**: Contrato base para registrar tarefas assíncronas com idempotency key e atraso. A assinatura atual ainda não materializa `TenantExecutionContext`; jobs tenant-scoped deverão recebê-lo explicitamente quando integrados.
- **FeatureFlagPort**: Verificação simples de alternância de fluxos (`isEnabled`). O contexto permite tenant opcional para suportar flags globais e por tenant; isso não autoriza tratar ausência de tenant como bypass de autorização.

## 6. Fronteiras ainda abertas antes da FASE 3

A fundação de ports/adapters está concluída, mas os itens abaixo não devem ser confundidos com implementação final:

- materialização de `TenantExecutionContext` em queries/commands e em arquivos, jobs, eventos, relatórios e sync;
- status adicionais de membership além de `ACTIVE`, que dependem de regra aprovada;
- matriz RBAC e alçadas ainda sem evidência canônica suficiente;
- adapters remotos de banco/storage/realtime, bloqueados para a fase própria.

Essas pendências são deliberadas: não inventar regra de negócio ou provider apenas para deixar o checklist verde.

## Proteção e CI
O arquivo `apps/api/src/architecture/layer-rules.test.ts` e a suíte de validação de arquitetura garantem ativamente que as pastas correspondentes a `domain` e `application` **não importam ou referenciam provedores externos** ou bibliotecas impuras (ex: `@supabase/*`, `react`, `aws-sdk`, `firebase`).
