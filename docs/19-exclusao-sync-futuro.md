# Política de Exclusão e Sincronização Futura (FASE 2.6)

## 1. Objetivo e Diretrizes

Este documento estabelece as diretrizes e a política de exclusão para dados sincronizáveis do sistema CONSUBOV.
A finalidade desta política é garantir a consistência de dados entre clientes offline (Mobile/PWA/Consultor) e o servidor/banco central, prevenindo problemas clássicos de sincronização distribuída, como a ressurreição de dados (*phantom records*), inconsistência de relacionamentos pai-filho e perda indevida de trilhas de auditoria.

## 2. Classificação das Entidades

As entidades do ecossistema CONSUBOV são classificadas de acordo com seu modelo de sincronização e mutabilidade:

### Classe A — Sincronizável e Mutável
Entidades de campo que sofrem edições e exclusões locais offline e precisam ser sincronizadas bidirecionalmente ou via fila idempotente.
* **Entidades:** [PENDENTE] — lista concreta a confirmar por evidência (PRD/código).
* **Regra de Exclusão:** [PENDENTE] — tendência: sem hard delete enquanto houver clientes offline; Exclusão Lógica (`deleted_at`) ou Tombstone.

### Classe B — Sincronizável Append-Only / Eventos
Registros imutáveis por natureza, gerados como série temporal ou log de eventos operacionais.
* **Entidades:** [PENDENTE] — lista concreta a confirmar por evidência (PRD/código).
* **Regra de Exclusão:** [PENDENTE] — tendência: exclusão proibida; eventos corrigidos geram evento compensatório.

### Classe C — Somente Servidor (Server-Only)
Dados e configurações gerenciados exclusivamente no servidor/admin via painel Web online.
* **Entidades:** [PENDENTE] — lista concreta a confirmar por evidência (PRD/código).
* **Regra de Exclusão:** [PENDENTE] — tendência: exclusão controlada por regras de domínio administrativas.

### Classe D — Cache / Projeções Descartáveis
Dados armazenados localmente apenas para desempenho e suporte visual offline, sem status de fonte da verdade.
* **Entidades:** [PENDENTE] — lista concreta a confirmar por evidência (PRD/código).
* **Regra de Exclusão:** [PENDENTE] — tendência: hard delete permitido localmente.

### Classe E — PENDENTE
Entidades sob levantamento em PRDs futuros ou com regras de negócio ainda não consolidadas.

---

## 3. Política de Exclusão (Hard Delete vs. Tombstone)

### 3.1 Regras Fundamentais
1. **Entidades Sincronizáveis (Classes A e B)**: Nunca devem ser submetidas a *Hard Delete* (exclusão física) na base principal quando houver clientes offline ativos. A exclusão física faz com que clientes offline ignorantes da deleção continuem reenviando atualizações para o ID apagado, gerando ressurreição do registro.
2. **Exclusão Lógica / Tombstone**: Uma exclusão é representada por um marcador estático contendo:
   - ID estável e invariável da entidade.
   - Identificador do Tenant (isolamento mantido).
   - Timestamp autoritativo gerado no servidor (`deleted_at_server`).
   - Identificador da mutação/comando original (`command_id`), quando aplicável.
3. **Casos Permitidos para Hard Delete**:
   - Dados de Cache/Projeções locais (Classe D).
   - Cancelamento local de inserções ainda **não confirmadas** no servidor (operações onde a inclusão e exclusão ocorrem no cliente antes de qualquer sincronização).

---

## 4. Contrato Conceitual do Tombstone e Retenção

### 4.1 Estrutura Mínima do Tombstone (Contrato Futuro)
```typescript
export type SyncTombstone = {
  entityId: string;
  entityType: string;
  tenantId: string;
  deletedAtServer: string; // ISO 8601 Timestamp UTC
  versionCursor?: string;
  commandId?: string;
};
```

### 4.2 Política de Retenção e Expurgo de Tombstones
- **Retenção do Tombstone**: Um Tombstone deve permanecer disponível na base do servidor até que **todos** os dispositivos/clientes offline do tenant tenham avançado seu cursor/checkpoint de sincronização para além da data `deletedAtServer`.
- **Janela Tempal Concreta**: Marcar como `[PENDENTE]`. A janela em dias/meses será estabelecida somente após a definição do SLA oficial de operação offline contínua do cliente (ex.: 30, 60 ou 90 dias).

### 4.3 Retenção mínima antes de existir checkpoint canônico

A retenção mínima é **condicional, não numérica**:

- sem checkpoint/cursor server-side canônico e confiável, **expurgo automático é proibido**;
- com checkpoint confiável, o tombstone só pode ser expurgado quando todos os clientes/dispositivos offline conhecidos tiverem avançado além dele;
- portanto, enquanto essa evidência não existir, a retenção é efetivamente sem limite temporal automático.

Nenhuma janela de 30/60/90 dias é inferida. Se o produto futuramente exigir expurgo por tempo, isso depende de SLA offline explícito e nova decisão.

---

## 5. Resolução de Conflitos e Processamento Idempotente

1. **Delete x Update Concorrentes**: [PENDENTE] — sem decisão aprovada comprovada. Tendência de design: o Tombstone/Delete possuiria precedência sobre *updates* tardios (*Delete Wins*), impedindo ressurreição da entidade.
2. **Idempotência no Retry**: Reenviar um comando de exclusão (`delete`) para um registro que já não existe ou já foi marcado como apagado deve retornar sucesso e confirmação (operação neutra e idempotente).
3. **Regra de Negócio Específica (Estoque, Transferências, Pesagens)**: [PENDENTE] — sem decisão aprovada comprovada. Tendência: não utilizar LWW genérico; exclusões/estornos exigiriam validação de saldo e lançamentos de ajuste.

---

## 6. Compatibilidade com a Fila Offline Existente

A arquitetura descrita preserva rigorosamente as seguintes garantias já validadas e testadas no app Web/Consultor:
- **Cancelamento de Inserção Local Não Confirmada**: Quando um registro é criado offline e posteriormente excluído offline antes de ser enviado ao servidor, a mutação de exclusão cancela a mutação de inserção e apaga o item da fila local.
- **Idempotência por UUID**: Reenvios e retries mantêm os mesmos UUIDs, evitando duplicação.
- **Ordem de Dependência na Fila**: Deleções são ordenadas para serem enviadas após criações/atualizações pendentes do mesmo lote (`mutationRank`), garantindo coerência de execução.
- **Isolamento de Tenant**: Mutações e exclusões permanecem restritas ao escopo do tenant ativo.