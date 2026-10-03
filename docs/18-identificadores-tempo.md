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

### 3.1 Contrato de timezone
- **[PENDENTE]** Timezone padrão por tenant para relatórios: sem decisão aprovada; qualquer valor depende de PRD futuro.
- **Não inventar**: não criar timezone padrão de negócio sem evidência.
- **Explicitamente documentado**: timezone deve ser explicitamente definido quando houver decisão.

### 3.2 Exemplo
```ts
// [PENDENTE] Exemplo ilustrativo futuro; timezone canônico não decidido.
interface Tenant {
  id: TenantId;
  name: string;
  timezone: string; // ex.: IANA tz, apenas após decisão
}
```

### 3.3 Evidência do legado para relatórios e datas civis

O Web atual não usa uma política única de timezone. O levantamento pré-FASE 3 encontrou comportamentos distintos que devem ser preservados até existir decisão explícita:

- `apps/web/src/lib/gmdConfigurado.ts` calcula a data de referência com `Intl.DateTimeFormat(..., { timeZone: "America/Sao_Paulo" })`; este é um comportamento específico do GMD e **não prova** timezone canônico do tenant.
- `apps/web/src/hooks/usePainelPeriodo.tsx` inicializa `mes`/`ano` com `new Date().getMonth()/getFullYear()`, portanto usa o timezone local do browser/dispositivo.
- `apps/web/src/pages/RelatorioSalgaPage.tsx` cria início/fim de dia, semana e mês com `Date` local e converte os limites para UTC via `toISOString()` antes de consultar `created_at`.
- `apps/web/src/pages/ConsultorDespesasPage.tsx` usa `date-fns` sobre `new Date()` para janelas semanal/quinzenal/mensal e trata datas civis `yyyy-MM-dd` separadamente.
- `useAbatesData` e `useMortalidadesData` consultam colunas explícitas `mes`/`ano`, sem derivar o período de um timestamp no cliente.

Conclusão de evidência: existe mistura entre timezone fixo de domínio, timezone do dispositivo e períodos civis já materializados. Unificar isso agora mudaria comportamento de relatório e não deve ser feito antes da FASE 4 sem decisão e testes de regressão.

### 3.4 Gate antes da FASE 3

O contrato técnico está fechado sem escolher timezone de negócio: instantes são UTC e datas civis são separadas. A escolha do timezone padrão para relatórios por tenant continua uma decisão explícita do produto; não é seguro inferi-la do dispositivo, fazenda ou usuário.

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