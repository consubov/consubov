# Ports e Adapters Fundamentais (FASE 2.3)

Esta documentação registra a fundação de contratos de infraestrutura da arquitetura hexagonal implementados na Fase 2.3 do projeto. O objetivo é manter os módulos internos completamente agnósticos a provedores de nuvem, banco de dados ou serviços externos.

## Princípios de Design
1. **Pequenos e Específicos:** Contratos definidos pela necessidade da aplicação, não baseados na API do provedor.
2. **Provider-agnostic:** Nenhum `port` deve conhecer ou referenciar Supabase, S3, Datadog ou qualquer SDK externo.
3. **Pertencimento:** A interface (port) pertence ao módulo que a consome (ex: o repositório do domínio de Farm pertence ao módulo Farm). Contratos transversais pertencem a `apps/api/src/shared/ports`.
4. **Dependência Interna:** Contratos devem importar apenas tipos internos do domínio/aplicação.

## 1. Segurança e Tenancy (`apps/api/src/modules/security/domain/`)

- **IdentityVerifierPort**: Avalia as credenciais para retornar a identidade já autenticada (`VerifiedIdentity`). Independente do modelo JWT ou API Key.
- **TenantContextPort**: Resolve o contexto aplicacional do *tenant* a partir da identidade confirmada, retornando o `AuthenticatedRequestContext`. Não acoplado a regras definitivas de membership.
- **AuthorizationPort**: Contrato que recebe o contexto autenticado e a exigência de acesso, retornando uma decisão de autorização baseada no comportamento atual tenant-first e scopes.

*Adaptadores Atuais:* FakeTenantContextAdapter, FakeAuthorizationAdapter (para testes unitários).

## 2. Observabilidade (`apps/api/src/modules/observability/domain/`)

- **AuditLogPort**: Contrato para registrar ações sensíveis de domínio. Não define schema relacional. Exige o `tenantId`, `actor`, e a exclusão de informações sensíveis (PII, tokens).
- **TelemetryPort**: Contrato mínimo para eventos, logs estruturados e registro de erros.

*Adaptadores Atuais:* FakeAuditLogAdapter, FakeTelemetryAdapter (em-memória).

## 3. Armazenamento e Integrações Externas

- **FileStoragePort (`apps/api/src/modules/storage/domain/`)**: Contrato abstraindo o armazenamento de arquivos (salvar, remover, obter referência), obrigatoriamente exigindo contexto de tenant. Sem dependência ao S3 ou Storage do Supabase.
  - *Adaptadores Atuais:* FakeFileStorageAdapter.
- **NotificationPort (`apps/api/src/modules/notifications/domain/`)**: Responsável pelo disparo de alertas/comunicações para o usuário, independentemente de canal (Push, E-mail, SMS).
  - *Adaptadores Atuais:* FakeNotificationAdapter.

## 4. Persistência de Domínio (`apps/api/src/modules/farm/domain/repositories/`)

- Em vez de um repositório CRUD genérico e sem semântica para toda aplicação, cada módulo de negócio que precisa persistir dados define sua própria interface específica.
- **Exemplo Real:** `FarmRepository` no módulo Farm. Contrato permite a recuperação, criação e deleção baseada estritamente nos tipos do próprio domínio.
  - *Adaptadores Atuais:* FakeFarmRepository. As implementações concretas remotas (ex: via Postgres/Supabase) serão tratadas na Fase 3.5.

## 5. Infraestrutura Compartilhada e Core (`apps/api/src/shared/ports/`)

Contratos transversais e frequentemente consumidos em diferentes pontos da aplicação:
- **ClockPort**: Obtenção de data atual.
  - *Adaptadores Atuais:* SystemClock (real), FakeClock (para manipulação em testes).
- **IdGeneratorPort**: Geração de identificadores da aplicação (IDs agnósticos).
  - *Adaptadores Atuais:* UUIDGenerator (baseado em crypto native), FakeIdGenerator.
- **EventPublisherPort**: Publicação de eventos internos da arquitetura (assíncronos, em-memória, desacoplados). Nenhuma dependência a filas externas (Kafka, SQS) na definição de domínio.
- **JobQueuePort**: Contrato base para registrar tarefas que devem acontecer de forma paralela/assíncrona no background, permitindo informar idempotency key e atrasos.
- **FeatureFlagPort**: Verificação simples de alternância de fluxos (`isEnabled`), prevendo contexto e tenancy para o futuro.

## Proteção e CI
O arquivo `apps/api/src/architecture/layer-rules.test.ts` e a suite de validação de arquitetura garantem ativamente que as pastas correspondentes a `domain` e `application` **não importam ou referenciam provedores externos** ou bibliotecas impuras. (ex: `@supabase/*`, `react`, `aws-sdk`, `firebase`).
