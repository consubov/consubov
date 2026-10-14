# Matriz de Origem-Destino: IndexedDB Legado & FASE 7 para PostgreSQL Relacional

**Versão:** 1.0.0  
**Data:** 2026-10-14  
**Escopo:** FASE 8 — PostgreSQL Local Dry-Run & Contratos  
**Ambiente:** Estritamente Local / Dry-Run (Zero Conexões Remotas)  
**Status:** Validado e Auditado  

---

## 1. Visão Geral e Princípios Arquiteturais

A sincronização de dados do CONSUBOV opera sob o paradigma **Offline-First com Autoridade Centralizada no Servidor**. No dispositivo cliente (PWA Web/Mobile), os dados transitam por filas locais atômicas (`IndexedDbAtomicCommandQueue`) coordenadas por `localSyncRound` e `LocalQueueDrainer` (FASE 7). No servidor (PostgreSQL/Supabase), as mutações são recebidas como comandos idempotentes, validadas relacionalmente, gravadas no log atômico e projetadas nas tabelas de negócio do schema `public`.

### Princípios Fundamentais:
1. **Idempotência Estrita no Servidor**: Toda mutação possui uma chave única `idempotency_key` (`urn:consubov:<subdomínio>:<tipo>:<id>`). Reenvios decorrentes de retries de rede com o mesmo token geram ACK imediato sem duplicar efeitos colaterais.
2. **Isolamento de Tenancy via RLS**: O tenant representa a organização contratante (`tenant_id: UUID`). Nenhuma linha é inserida ou consultada sem verificação da política de isolamento `USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)`.
3. **Integridade Referencial Forte**: Mutações em tabelas dependentes (níveis 1, 2 e 3) respeitam a ordem topológica de dependência de chaves estrangeiras. Deleções e limpezas utilizam `ON DELETE CASCADE` estritamente nas relações de propriedade pai-filho (ex: fotos de lançamentos).
4. **Preservação de Blobs e Mídia**: Registros fotográficos e anexos binários preservam seus caminhos, metadados de captura (`tirada_em`) e referências canônicas de armazenamento.
5. **Zero Conexão Remota em Desenvolvimento**: Todas as definições DDL e contratos são validados em dry-run local com catálogo de schema em memória e fixtures anonimizadas.

---

## 2. Envelope de Comando Unificado (`LocalCommand` → `atomic_command_log`)

O envelope canônico gerado pela FASE 7 (`apps/web/src/platform/offline/commandPolicy.ts`) é mapeado diretamente para a tabela canônica `public.atomic_command_log`:

| Campo TypeScript (`LocalCommand`) | Coluna PostgreSQL (`atomic_command_log`) | Tipo PostgreSQL | Nulável | Descrição / Restrição |
| :--- | :--- | :--- | :---: | :--- |
| `commandId` | `command_id` | `UUID` | NÃO | Identificador único da intenção do comando. |
| `idempotencyKey` | `idempotency_key` | `TEXT` | NÃO | Token de idempotência URN único por tenant. |
| `tenantId` | `tenant_id` | `UUID` | NÃO | Identificador da organização proprietária do dado. |
| `userId` | `user_id` | `UUID` | NÃO | Identificador do usuário que disparou o comando. |
| `deviceId` | `device_id` | `TEXT` | NÃO | Identificador do dispositivo/navegador emissor. |
| `kind` | `kind` | `TEXT` | NÃO | Identificador do tipo de mutação/agregado. |
| `createdAt` | `created_at` | `TIMESTAMPTZ` | NÃO | Carimbo de data/hora da criação no cliente (`now()`). |
| `payload` | `payload` | `JSONB` | NÃO | Conteúdo estruturado da mutação de negócio. |
| `status` | `status` | `TEXT` | NÃO | `pending`, `inflight`, `acked`, `conflict`, `applied`. |
| `attemptCount` | `attempt_count` | `INTEGER` | NÃO | Contagem de tentativas de envio (`DEFAULT 0`). |
| *(servidor)* | `id` | `UUID` | NÃO | PK auto-gerada (`DEFAULT gen_random_uuid()`). |
| *(servidor)* | `acknowledged_at` | `TIMESTAMPTZ` | SIM | Momento em que o servidor confirmou o recebimento. |
| *(servidor)* | `server_applied_at` | `TIMESTAMPTZ` | SIM | Momento em que a projeção relacional foi concluída. |
| *(servidor)* | `error_detail` | `TEXT` | SIM | Detalhe textual de erro ou motivo de rejeição. |
| *(servidor)* | `conflict_resolution`| `JSONB` | SIM | Registro da resolução determinística de conflito. |

### Restrições e Índices da Fila:
- **PK**: `id` (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`)
- **Unique 1**: `CONSTRAINT uq_atomic_commands_tenant_idempotency UNIQUE (tenant_id, idempotency_key)`
- **Unique 2**: `CONSTRAINT uq_atomic_commands_tenant_command UNIQUE (tenant_id, command_id)`
- **Índice 1**: `idx_atomic_commands_tenant_status` em `(tenant_id, status, created_at DESC)`
- **Índice 2**: `idx_atomic_commands_user` em `(user_id, created_at DESC)`
- **Índice 3**: `idx_atomic_commands_kind` em `(tenant_id, kind)`

---

## 3. Matriz Exaustiva das 6 Bases Legadas do IndexedDB

A FASE 7 lê de forma somente-leitura 6 bancos IndexedDB e o `localStorage`, classificando registros pendentes em comandos e registros confirmados em referências KV locais. A tabela abaixo documenta o destino relacional definitivo de cada store:

### 3.1. Base: `consubov-capataz`

| Store Legada | Critério / Status | Tipo de Destino | Destino Relacional / Chave | PK / Identificador | Principais Colunas Mapeadas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `lancamentos` | `status == "pendente"` | Comando `capataz_lancamento` | `public.lancamentos` | `id: UUID` | `fazenda_id`, `retiro_id`, `pasto_id`, `ciclo_id`, `num_animais`, `num_sacos`, `cocho_cheio`, `origem`, `dias_no_pasto`, `foto_cocho_url` |
| `lancamentos` | `status != "pendente"` | Referência Local KV | `capataz:lancamento:{id}` | `id` | Cache local sincronizado de lançamentos aprovados/processados |
| `observacoesOffline` | `status == "pendente"` | Comando `capataz_obs` | `public.observacoes` | `id: UUID` | `fazenda_id`, `retiro_id`, `pasto_id`, `descricao`, `foto_url`, `resolvido`, `criado_em`, `capataz_nome` |
| `observacoesOffline` | `status != "pendente"` | Referência Local KV | `capataz:obs:{id}` | `id` | Cache local de ocorrências de campo já sincronizadas |
| `pesagensPendentes` | `status == "pendente"` | Comando `capataz_pesagem` | `public.pesagens` | `id: UUID` | `evento_id`, `lote_id`, `total_pesado`, `pesos: JSONB`, `quantidade_animais`, `media_calculada`, `data_pesagem` |
| `pesagensPendentes` | `status != "pendente"` | Referência Local KV | `capataz:pesagem:{id}` | `id` | Histórico local de pesagens já registradas no servidor |
| `syncQueue` | Toda entrada | Comando `capataz_syncqueue` | `public.atomic_command_log` | `id: UUID` | Comandos legados em fila de espera para sincronização retroativa |
| `pastos` | Todos | Referência Local KV | `capataz:ref:pasto:{id}` | `id` | Projeção somente-leitura da tabela `public.pastos` |
| `retiro` | Todos | Referência Local KV | `capataz:ref:retiro:{id}` | `id` | Projeção somente-leitura da tabela `public.retiros` |
| `ciclos` | Todos | Referência Local KV | `capataz:ref:ciclo:{id}` | `id` | Projeção somente-leitura da tabela `public.ciclos_fase` |
| `produtoAtivo` | Todos | Referência Local KV | `capataz:ref:produto:{id}` | `id` | Projeção somente-leitura da tabela `public.produtos` |
| `fazendaCache` | Todos | Referência Local KV | `capataz:ref:fazenda:{id}` | `id` | Projeção somente-leitura da tabela `public.fazendas` |
| `config` | Todos | Referência Local KV | `capataz:config:{key}` | `key` | Preferências do operador do capataz no dispositivo |
| `syncErrors` | Todos | Referência Local KV | `capataz:sync_errors:{id}` | `id` | Log local de erros de sincronização para depuração |
| `lastPdfs` | Todos | Referência Local KV | `capataz:pdf:{id}` | `id` | Metadados e arquivos temporários de relatórios impressos |

### 3.2. Base: `consubov-session`

| Store Legada | Tipo de Dado | Destino Relacional / Chave | Finalidade Arquitetural |
| :--- | :--- | :--- | :--- |
| `auth_session` | Token / Sessão | `session:auth_current` | Sessão ativa local com tokens de acesso e refresh mantidos no storage isolado |
| `offline_data` | Metadados Sessão | `session:offline_reference` | Permissões, perfis (`gerente`, `capataz`, `consultor`) e atributos de offline |

### 3.3. Base: `consubov-consultor-offline`

| Store Legada | Critério / Status | Tipo de Destino | Destino Relacional / Chave | PK / Identificador | Principais Colunas Mapeadas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `foto_queue` | Pendente de envio | Comando `consultor_foto` | `public.visita_fotos` / `public.visita_topico_fotos` | `localId: UUID` | `visita_pasto_id`, `visita_curral_id`, `visita_topico_id`, `url`, `storage_path`, `tamanho_bytes`, `tirada_em` |
| `text_mutations` | Pendente de envio | Comando `consultor_mutation` | Tabelas de Visita Técnica | `id: UUID` | Ver seção 4 (Topologia de Visita Técnica e Dependências) |
| `snapshots` | Dados de visita | Referência Local KV | `consultor:snapshot:{visitaId}` | `visitaId` | Cópia local de segurança da visita em andamento |

### 3.4. Base: `mais-arrobas-offline`

| Store Legada | Tipo de Dado | Destino Relacional / Chave | Finalidade Arquitetural |
| :--- | :--- | :--- | :--- |
| `tables` | Tabelas de balança | `mais_arrobas:table:{key}` | Configurações, raças, calibragens e tabelas de conversão offline |

### 3.5. Base: `mais-arrobas-sync`

| Store Legada | Critério / Status | Tipo de Destino | Destino Relacional / Chave | PK / Identificador | Principais Colunas Mapeadas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `queue` | Pendente de envio | Comando `mais_arrobas_queue` | Balancão Pecuarista | `id: UUID` | `public.leituras_balancao_pecuarista`, `public.pesos_animais_pecuarista`, `public.pesagens_lote_pecuarista` |
| `acknowledged-inserts`| Confirmados | Referência Local KV | `mais_arrobas:ack_insert:{key}` | `key` | Deduplicação local de leituras de balança já confirmadas |

### 3.6. Base: `consubov-fotos-salga`

| Store Legada | Critério / Status | Tipo de Destino | Destino Relacional / Chave | PK / Identificador | Principais Colunas Mapeadas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `fotos` | Pendente de envio | Comando `salga_foto` | `public.fotos_salga` | `id: UUID` | `lancamento_id`, `fazenda_id`, `pasto_id`, `caminho`, `tipo`, `tamanho_bytes`, `tirada_em` |
| `feitos` | Confirmados | Referência Local KV | `salga:foto_feita:{lancId}` | `lancId` | Controle local de cochos fotografados na rodada de conferência |

### 3.7. `localStorage` Legado

| Chave Legada | Destino Local KV | Finalidade |
| :--- | :--- | :--- |
| `pending_backup` | `backup:pending_backup` | Backup binário local de contingência |
| `pending_backup_at` | `backup:pending_backup_at` | Carimbo de data/hora do último snapshot de contingência |
| `ma-offline-mode` | `mais_arrobas:offline_state` | Estado de alternância online/offline da pesagem de gado |

---

## 4. Topologia Relacional de Visitas Técnicas (Dependência e FKs)

Para os comandos do tipo `consultor_mutation` e `consultor_foto`, a inserção server-side deve obedecer rigorosamente à hierarquia topológica documentada em `apps/api/src/modules/sync/domain/queue.ts`:

```text
[Nível 0] public.visitas_tecnicas
   │
   ├─► [Nível 1] public.visita_pastos       (FK: visita_id -> visitas_tecnicas.id)
   ├─► [Nível 1] public.visita_currais      (FK: visita_id -> visitas_tecnicas.id)
   └─► [Nível 1] public.visita_topicos      (FK: visita_id -> visitas_tecnicas.id)
          │
          ├─► [Nível 2] public.avaliacoes_score            (FK: visita_pasto_id / visita_curral_id)
          ├─► [Nível 2] public.avaliacoes_fabrica_quesito   (FK: visita_topico_id)
          │
          ├─► [Nível 3] public.visita_fotos                (FK: visita_pasto_id / visita_curral_id)
          └─► [Nível 3] public.visita_topico_fotos         (FK: visita_topico_id)
```

### Regra de Processamento Server-side:
- **Tratamento de FK Órfã (Erro 23503 / `isDependencyError`)**: Quando uma mutação filha chegar antes do registro pai (ex: foto de pasto antes do registro de `visita_pastos`), o comando permanece em status `pending` e registra diferimento sem esgotar as tentativas de retry.
- O registro pai é criado primeiro e subsequentemente seus filhos são processados em ordem FIFO.

---

## 5. Hierarquia Operacional e de Tenancy da Fazenda

Conforme comprovado em `docs/04-tenant-hierarchy.md` e `docs/10-auth-tenancy-contracts.md`:

```text
Tenant Organization (tenant_id: UUID)
   │
   └── Fazenda (fazendas.id: UUID)
          │
          └── Retiro (retiros.fazenda_id -> fazendas.id)
                 │
                 └── Pasto (pastos.retiro_id -> retiros.id, pastos.fazenda_id -> fazendas.id)
```

- Cada comando `LocalCommand` carrega `tenantId` e `userId`.
- Na tabela de auditoria `atomic_command_log`, o `tenant_id` é chave de partição lógica para todos os índices e políticas de segurança.
- As tabelas de negócio do Capataz (`lancamentos`, `pesagens`, `observacoes`, `fotos_salga`) relacionam-se com a fazenda através de suas respectivas FKs (`fazenda_id`, `retiro_id`, `pasto_id`).

---

## 6. Políticas de Row Level Security (RLS)

Todas as tabelas de destino relacional possuem Row Level Security ativado (`ENABLE ROW LEVEL SECURITY`). O modelo de autorização do CONSUBOV exige isolamento estrito por tenant antes de qualquer avaliação de permissão por escopo:

```sql
-- Isolamento de tenant na fila atômica
CREATE POLICY "tenant_isolation_atomic_command_log" ON public.atomic_command_log
  FOR ALL
  TO authenticated
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

### Garantias de RLS Testadas no Dry-Run:
1. **Zero Vazamento Multi-Tenant**: Tentativas de leitura com `app.current_tenant_id = Tenant A` não retornam nenhuma linha pertencente ao `Tenant B`.
2. **Rejeição de Injeção Trans-Tenant**: Tentativas de inserir um comando com `tenant_id = Tenant B` em uma sessão autenticada com `app.current_tenant_id = Tenant A` disparam violação imediata de política `WITH CHECK`.

---

## 7. Rastreabilidade com Contratos TypeScript

A correspondência de tipos entre o TypeScript e o DDL PostgreSQL é garantida estaticamente:

| Entidade / Módulo | Arquivo de Contrato TypeScript | Tabela PostgreSQL Correspondente |
| :--- | :--- | :--- |
| Comando Atômico | `apps/web/src/platform/offline/commandPolicy.ts` | `public.atomic_command_log` |
| Tipos Supabase | `apps/web/src/integrations/supabase/types.ts` | `public.lancamentos`, `public.pesagens`, `public.observacoes`, `public.fotos_salga`, `public.leituras_balancao_pecuarista`, `public.visitas_tecnicas` |
| Contratos de Sincronização | `apps/api/src/modules/sync/domain/contracts.ts` | Estrutura de mutações, status de retries e payloads de reconciliação |
| Ordem de Fila / FKs | `apps/api/src/modules/sync/domain/queue.ts` | Prioridade de dependência de tabelas (`SYNC_TABLE_PRIORITY`) |
| Tenancy & Identidade | `apps/api/src/modules/identity-tenancy/domain/identity.ts` | `TenantId`, `PrincipalId`, `PermissionScope` |

---
**Fim da Matriz Origem-Destino (FASE 8).**
