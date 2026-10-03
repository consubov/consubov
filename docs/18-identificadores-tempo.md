# Identificadores e Tempo (FASE 2.5)

## 1. IDs estáveis e opacos

### 1.1 Convenção geral
- IDs são **opacos**: não carregam semântica do provider/banco
- Não dependem de serial/row_id específico
- Não prefixam com nome de tabela/provider sem necessidade
- São gerados no cliente para entidades/comandos offline
- Usam `crypto.randomUUID()` ou `IdGeneratorPort` para geração
- IDs são **estáveis**: não mudam em retry ou reenvio

### 1.2 Tipos de ID
| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| **Entity ID** | Identifica entidade de domínio | `animal-123`, `fazenda-abc` |
| **Command ID** | Identifica comando/requisição | `cmd-123e4567-e89b-12d3-a456-426614174000` |
| **Request ID** | Identifica requisição HTTP | `req-123e4567-e89b-12d3-a456-426614174000` |
| **Correlation ID** | Identifica fluxo de processamento | `corr-123e4567-e89b-12d3-a456-426614174000` |
| **Event ID** | Identifica eventos futuros | `event-123e4567-e89b-12d3-a456-426614174000` |

### 1.3 Geração
- **Offline**: Use `crypto.randomUUID()` diretamente
- **Online**: Use `IdGeneratorPort` (ex: `UUIDGenerator`) para geração controlada
- **Fake para testes**: `FakeIdGenerator` com sequência controlada

### 1.4 Exemplos de geração
```ts
// Offline (cliente)
const commandId = crypto.randomUUID();
const entityId = crypto.randomUUID();

// Online (via port)
const commandId = await idGenerator.generate();
const entityId = await idGenerator.generate();
```

## 2. Timestamp e Tempo

### 2.1 Campos de tempo conceituais
| Campo | Descrição | Autoridade | Uso |
|-------|-----------|------------|-----|
| `occurred_at_local` | Horário observado no dispositivo | **Dispositivo** | Para exibição, não para ordenação crítica |
| `received_at_server` | Quando o servidor recebeu o evento | **Servidor** | Para auditoria, não para ordenação |
| `created_at_server` | Quando o registro foi criado no servidor | **Servidor** | Para histórico |
| `updated_at_server` | Quando o registro foi atualizado no servidor | **Servidor** | Para histórico |

### 2.2 Convenção de timestamps
- **Autoritatividade**: timestamps autoritativos vêm do servidor
- **Formato**: ISO 8601 (`2023-10-02T15:30:45.123Z`)
- **UTC**: instantes são sempre em UTC
- **Local**: datas civis sem horário mantêm conceito separado
- **Offset**: dados que representam instantes devem ter offset quando local

### 2.3 Exemplo
```ts
// Local (cliente)
const occurredAtLocal = new Date().toISOString(); // "2023-10-02T15:30:45.123Z"

// Servidor (autoritativo)
const createdAtServer = new Date().toISOString(); // "2023-10-02T15:30:45.123Z"
```

## 3. Timezone

### 3.1 Contrato de timezone concluído

O timezone de relatórios é uma configuração **explícita do tenant**, representada por `Tenant.reportTimeZone: TenantReportTimeZone | null`.

Regras:
- o valor configurado deve ser um timezone IANA válido;
- `null` significa "ainda não configurado", nunca "usar o timezone do browser";
- não existe fallback silencioso de negócio;
- relatórios/períodos civis que dependam de timezone devem resolver a configuração explicitamente antes do cálculo;
- `requireTenantReportTimeZone` falha quando a configuração não existe, em vez de inventar um valor.

O contrato está em `apps/api/src/modules/identity-tenancy/domain/report-timezone.ts` e possui testes próprios.

### 3.2 Evidência do legado preservada

O Web atual continua com semânticas diferentes e **não foi alterado** nesta fase:

- `apps/web/src/lib/gmdConfigurado.ts` usa `America/Sao_Paulo` em um fluxo específico;
- `apps/web/src/hooks/usePainelPeriodo.tsx` usa o timezone local do browser/dispositivo;
- `apps/web/src/pages/RelatorioSalgaPage.tsx` calcula limites civis locais antes de convertê-los para UTC;
- `apps/web/src/pages/ConsultorDespesasPage.tsx` trabalha com janelas civis via `date-fns`;
- `useAbatesData` e `useMortalidadesData` usam campos civis `mes`/`ano`.

Esses comportamentos continuam sendo compatibilidade do legado. A nova arquitetura não os transforma em timezone canônico por inferência.

### 3.3 Gate para fases seguintes

A FASE 2 considera o contrato concluído porque:
- instantes autoritativos permanecem UTC;
- datas civis continuam separadas de instantes;
- timezone de relatório é propriedade explícita do tenant;
- ausência de configuração é um estado explícito e seguro;
- a escolha do valor de cada tenant ocorre na configuração/migração correspondente, sem default arbitrário nesta fase.

## 4. Convenções de API

### 4.1 Timestamps
- **Autoritativos**: sempre em ISO 8601 UTC
- **Sem fuso**: datas civis sem horário mantêm conceito separado
- **Offset**: quando representar instante, use offset explícito

### 4.2 IDs
- **Consistente**: todos os IDs são strings opacas
- **Max length**: 128 caracteres (definido em `identity.ts`)
- **Formato**: UUID v4 (quando gerado com `crypto.randomUUID()`)

### 4.2 Erros
- **Envelope estável**: todos os erros incluem `requestId` no corpo
- **Sem stack traces**: stack traces não são expostos ao cliente

## 5. Padrões de uso

### 5.1 Offline-first
- UUIDs são gerados no cliente antes do primeiro sync
- Operações são idempotentes (upsert com `onConflict: "id"`)
- Fila local garante ordem de processamento

### 5.3 Ordenação crítica
- **Não depender só de timestamp local** para ordenação crítica
- **Usar cursor/sequência/autoridade server-side** para ordenação crítica
- **Preservar command ID** para idempotência

### 5.3 Testes
- Use `FakeClock` para controle de tempo em testes
- Use `FakeIdGenerator` para geração determinística de IDs
- Parse/format sem depender do timezone da máquina
- Preserve timestamp com offset corretamente