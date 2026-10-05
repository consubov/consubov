# Arquitetura

## Estrutura atual

O Consubov está organizado como monorepositório com dois workspaces executáveis e sem packages compartilhados.

```text
consubov/
├── apps/
│   ├── web/        # aplicação React/Vite existente
│   └── api/        # API Bun local, stateless e sem persistência
├── supabase/       # artefatos existentes; sem execução remota nesta fase
├── docs/
├── instructions/
├── package.json
├── bun.lock
└── turbo.json
```

Não existe `packages/` atualmente. Configurações específicas permanecem com o app que as utiliza, e um package só deve nascer quando houver reutilização real por mais de um workspace.

A migração progressiva de acesso a dados do web está pausada. O web continua com o comportamento e as integrações existentes; a API não está conectada ao Supabase/PostgreSQL.

## Convenção de camadas dos módulos

Módulos reais da API vivem em:

```text
apps/api/src/modules/<module>/
├── domain/          # entidades, VOs, regras puras, erros, contratos necessários
├── application/     # casos de uso e orquestração (só quando existirem reais)
├── interfaces/http/ # parsing, validação HTTP, adaptação, mapeamento de erros
├── platform/        # infraestrutura interna concreta (clock, IDs, logging)
├── integrations/    # adapters de providers externos comprovados
└── index.ts
```

### Inventário Central e Superfícies (FASE 2A.1)

O roteamento e inventário central de rotas são gerenciados via `apps/api/src/routes.ts`, dividindo o acesso em superfícies semânticas (`product`, `sync`, `public`, `admin`). Casos de uso do `application/domain` são reutilizados diretamente através das camadas, sem duplicar regras de negócio entre diferentes superfícies da API.

Regras:

- criar diretório somente quando existir código real daquela camada; sem árvores vazias.
- `interfaces/http → application → domain`; `platform`/`integrations` implementam portas e são conectados por fora.
- o domínio nunca conhece adapters concretos, Supabase, Web, UI ou storage externo.

Aplicação real atual: `apps/api/src/modules/identity-tenancy/domain/` contém os contratos e regras puras de identidade, escopo e autorização tenant-first. `application/`, `interfaces/`, `platform/` e `integrations/` ainda não existem nesse módulo porque não há código real para eles.

A proteção dessa regra é automatizada em `apps/api/src/architecture/layer-rules.ts` + `layer-rules.test.ts`: o teste falha se algum arquivo de `domain` importar `interfaces`, `platform`, Supabase, Web, React/Vite ou referenciar `localStorage`/`indexedDB`, e se `application` importar `interfaces/http`. O segmento `integrations` só é permitido no próprio módulo `integrations`, que tem esse nome no ADR; continua proibido para qualquer outro domínio.

## Módulos da API (FASE 2.1)

Os 15 módulos do ADR-0003 existem como diretórios com contrato real. Nenhum diretório foi criado sem código, e nenhum se conecta a banco, provider ou storage remoto.

| Módulo | Responsabilidade materializada | Dono de identificadores |
| --- | --- | --- |
| `identity-tenancy` | contexto autenticado, principal `user`/`integration`, escopo namespaced, autorização tenant-first, porta de verificação de credencial | `TenantId`, `PrincipalId`, `PermissionScope` |
| `farms` | registro de fazenda e leitura; a fazenda **não** é o tenant | `FarmId` |
| `pastures` | pasto e retiro, categoria válida, precedência de intervalo e auditoria, ordenação, cabeças do retiro, decisão de transferência entre pastos | `RetiroId`, `PastoId` |
| `nutrition` | produto, categoria por peso (dois dialetos preservados), classificação de consumo, índices, custo por lote, fórmulas de sistema | `ProdutoId` |
| `inventory` | saldo materializado por bucket de período, sinal de movimentação, consumo médio diário, transferência de estoque, crédito de matéria-prima | `TransferenciaEstoqueId` |
| `visits` | status e reabertura de visita, lotação e precedência de área, scores, Penn State puro, zona de numeração de fotos, assinantes | `VisitaId`, `AssinanteId` |
| `feed-mill` | matéria-prima, fórmula, batida, tolerância e divergência, eficiência, divergência de recebimento, QR de fábrica | `FabricaId`, `FormulaId`, `MateriaPrimaId`, `BatidaId` |
| `livestock` | rastreabilidade de abates, mortalidades e movimentações entre pastos, com decisão pura de baixa | — |
| `weighing` | kg sempre persistido, arroba de carcaça e de rótulo, leitura de balança, médias, dia-calendário de São Paulo, GMD, fechamento | `PesagemId`, `LoteId`, `AnimalId`, `LeituraBalancaoId` |
| `reporting` | metadados de relatório de despesas, referência de documento, contratos de agregado e status recebido pronto | — |
| `notifications` | conteúdo e destinatário da notificação, segmentação de avisos por módulo, resposta de entrega | `NotificationId` |
| `files` | escopo de arquivo por usuário ou compartilhado, referência de arquivo, portas de armazenamento e de URL assinada | — |
| `sync` | contratos de mutação, fila, resultado e visão dos motivos pendentes, sem motor | — |
| `saas-admin` | bearer, e-mail, senha mínima, UUID, decisão de exclusão de administrador, intenção de criação de usuário, perfis | `GlobalAdminId`, `AuthUserId` |
| `integrations` | contrato de envio por escopo e de chamador, normalização de payload, rate limit, estimativa de rota, cadastro demo, porta de análise vazia | — |

Fronteiras que valem registro:

- `reporting` não classifica indicador: recebe agregados prontos. A classificação por índice de consumo é de `nutrition`.
- `integrations` concentra a autorização de envio já endurecida na FASE 1, incluindo negação por padrão e limite por identidade. `notifications` é o contrato de conteúdo e destinatário, sem regra de autorização.
- `inventory` não tem porta de escrita: concorrência e idempotência do banco continuam onde estão.
- `sync` não implementa motor; a responsabilidade executada hoje está no web.
- A fazenda não é o tenant. `farms` não carrega `TenantId` porque o mapeamento entre tenant e fazenda não tem prova no legado.
- Regra duplicada foi removida: `reporting` tinha uma cópia própria de `statusPorIndiceDeConsumo`, igual à de `nutrition`. A classificação por índice ficou só em `nutrition`, com `consumoStatusUnificado` (`apps/api/src/modules/nutrition/domain/consumo.ts:195`), e `reporting` passou a receber o status já classificado.

Fora do runtime materializado nesta etapa permanecem: motor de sincronização, motor offline definitivo, filas remotas, provider externo de feature flags, event bus concreto, persistência remota, provider de identidade novo, armazenamento remoto novo e CRUD novo. Ports já existentes podem continuar como contratos; não se cria infraestrutura concreta sem consumidor real.

Com os 15 módulos, existem duas camadas de apoio além de `domain`: `adapters/` e `infrastructure/`, que contêm **apenas dublês em memória para teste** (`Fake*`) e nenhuma implementação real de provider. O guard trata `adapters` e `infrastructure` como camadas que um `domain` não pode importar.

`apps/api/src/modules/observability/` e `apps/api/src/shared/` já existiam na árvore por trabalho anterior. Seus ports de fila, event bus e feature flag permanecem contratos de extensão sem provider remoto/concreto. Na FASE 3, `FeatureFlagPort` pode ser citado para prever configuração futura por tenant, mas isso **não** autoriza criar plataforma externa de flags, painel administrativo ou comportamento privilegiado sem consumidor real.

## Arquitetura futura

A direção aprovada é evoluir o backend como **monólito modular**. A árvore abaixo representa possibilidades futuras, não diretórios que devam ser criados antecipadamente.

```text
consubov/
├── apps/
│   ├── web/
│   └── api/
├── packages/              # somente packages com múltiplos consumidores reais
│   ├── domain/
│   ├── database/
│   ├── auth/
│   ├── contracts/
│   ├── integrations/
│   ├── observability/
│   └── ui/
├── supabase/
├── docs/
└── instructions/
```

### Organização futura do monólito modular

O backend é uma única aplicação implantável, porém dividido por domínios com fronteiras explícitas.

```text
apps/api/
├── auth/
├── tenants/
├── fazendas/
├── retiros/
├── pastos/
├── pecuarista/
├── pesagens/
├── estoque/
├── nutricao/
├── fabrica/
├── visitas/
└── integrations/
```

## Fluxo futuro desejado

```text
Web / Mobile / Sistemas externos
              │
              ▼
             API
              │
      ┌───────┼─────────┐
      ▼       ▼         ▼
   Domain    Auth   Integrations
      │
      ▼
   Database
      │
      ▼
 Supabase / PostgreSQL
```

## Identificadores e Tempo (FASE 2.5)

O sistema adota uma política rigorosa de desacoplamento de tempo e identificação para suportar operação offline-first e integridade multi-tenant. Veja [docs/18-identificadores-tempo.md](18-identificadores-tempo.md) para detalhes.

- **IDs Estáveis**: Entidades e comandos recebem UUIDs gerados no cliente (offline) ou via `IdGeneratorPort` (online). IDs são opacos e não mudam em retries.
- **Autoridade de Tempo**: Timestamps autoritativos são gerados pelo servidor (`created_at_server`). O tempo do dispositivo (`occurred_at_local`) é informativo e não serve para ordenação crítica.
- **Timezone**: Datas e instantes são transportados em ISO 8601 UTC. O timezone é uma configuração de tenant para relatórios e períodos civis.

## Escalabilidade

A arquitetura deve permitir:

- API stateless;
- múltiplas instâncias da API;
- processamento assíncrono para tarefas pesadas;
- isolamento por tenant;
- contratos de API versionados;
- filas e workers quando necessário;
- observabilidade;
- extração futura de módulos para serviços independentes sem reescrever o domínio.

## Extensibilidade e Integrações

O Consubov suporta extensibilidade através de dois mecanismos principais:

### ApiConsumer como Principal Separado
- Integrações externas autenticam-se como `ApiConsumer` principals, distintos de usuários finais
- Isolamento de tenant estrito: cada consumer acessa apenas dados do seu tenant
- Autorização por escopos granulares (`recurso:acao`)
- Credenciais dedicadas com revocação e expiração configuráveis

### Abordagem Baseada em Adapters
- Integrações com sistemas externos são implementadas como adapters
- Adapters ficam em `modules/<dominio>/integrations/` ou `packages/integrations/` quando reutilizados
- SDKs de providers externos devem permanecer dentro dos adapters (não vazar para domínio/application)
- Adapters implementam portas definidas no domínio (ex: `NotificationSenderPort`, `EventPublisherPort`)
- Nenhuma lógica de negócio nos adapters - apenas tradução de dados e chamadas de rede
- Todos os adapters seguem contrato base com campos obrigatórios: owner, purpose, auth, rate_limit, timeout, circuit_breaker

Essas abordagens garantem que integrações externas não acoplem o domínio principal e mantenham os limites arquiteturais estabelecidos.

## Regra de dependência

A UI não deve concentrar regra de negócio.

Fluxo preferencial:

```text
Component
  ↓
Hook / Controller
  ↓
Use case / Service
  ↓
Repository
  ↓
Database
```

Dependências devem apontar para dentro do domínio, evitando acoplamento entre módulos.
