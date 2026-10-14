# Plano de Rollback e Contingência Operacional CONSUBOV: PWA, Service Worker e Schema PostgreSQL

**Versão:** 1.0.0  
**Data:** 2026-10-14  
**Status:** Vigente (Fase 9 — Preparação de Pré-Produção e Homologação Local)  
**Ambiente:** Estritamente Local / Dry-Run (Zero Conexões Remotas sem Autorização)  
**Módulos Abrangidos:** Service Worker (`apps/web/public/sw.js`), CacheStorage bi-geracional, IndexedDB Legado (6 bases) e vNext, Migrations PostgreSQL UP/DOWN (`supabase/migrations/`).

---

## 1. Princípios e Diretrizes Fundamentais

Este documento define a governança técnica e os procedimentos executáveis para situações de contingência operacional e reversão de versão (rollback) nos componentes do cliente (PWA / Service Worker) e do servidor (PostgreSQL / Migrações Relacionais).

### Diretrizes Centrais:
1. **Mandato de Tolerância Zero à Perda de Dados (`Zero Data Loss Mandate`)**: O usuário em campo (capataz, gerente, consultor) não pode perder registros de pesagem, lançamentos de cocho ou fotos capturadas offline sob nenhuma hipótese de falha de software, erro de build ou operação de rollback.
2. **Não-Destrutividade Absoluta no Cliente**:
   - É estritamente **PROIBIDO** o uso de `indexedDB.deleteDatabase()` ou `localStorage.clear()` como mecanismo de recuperação ou limpeza de versão.
   - É estritamente **PROIBIDO** purgar caches cegamente sem manter a geração estável anterior.
3. **Simetria e Idempotência DDL**: Toda migração de banco de dados (`UP`) deve ter seu arquivo equivalente de reversão (`DOWN`) rigorosamente testado, com garantias matemáticas de idempotência (`isIdempotent = true`), reversibilidade limpa sem resíduos (`isReversible = true`) e determinismo de reaplicação (`isDeterministic = true`).
4. **Preservação de URNs Determinísticas**: Em qualquer cenário de repetição ou contingência, mutações devem reutilizar suas chaves determinísticas canônicas (`urn:consubov:<subdomínio>:<tipo>:<id>`) para evitar duplicações de registros no banco.
5. **Proteção Ativa de Campo**: Nenhuma reversão ou substituição de shell pode ser executada enquanto houver operações críticas em andamento no dispositivo (`hasCriticalOperations() === true`).

---

## 2. Procedimento de Rollback da PWA e Service Worker (N -> N-1)

### 2.1. Arquitetura de Retenção Bi-Geracional de Cache
O Service Worker do CONSUBOV (`apps/web/public/sw.js`) adota uma política de retenção bi-geracional estrita no evento `activate`:

```javascript
// apps/web/public/sw.js
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const generations = [...new Set(keys.map(knownGeneration).filter(Boolean))];
    const previous = generations.filter((value) => value !== CACHE_VERSION).at(-1);
    const retained = new Set([CACHE_VERSION, previous].filter(Boolean));
    await Promise.all(keys.filter((name) => {
      const generation = knownGeneration(name);
      return generation !== null && !retained.has(generation);
    }).map((name) => caches.delete(name)));
    await self.clients.claim();
    await notifyClientsAboutActivatedVersion();
  })());
});
```

#### Propriedades de Segurança:
- O CacheStorage retém **duas gerações simultâneas**: a versão ativa `N` (`consubov-shell-v-N` e `consubov-v-N`) e a versão imediatamente anterior `N-1` (`consubov-shell-v-(N-1)` e `consubov-v-(N-1)`).
- Chunks e assets da versão N-1 permanecem armazenados localmente no dispositivo.
- **Isolamento de Armazenamento**: O ciclo de vida do Service Worker opera exclusivamente sobre a API `caches`. Ele **não toca** no `indexedDB` nem no `localStorage`.

### 2.2. Procedimento Passo a Passo de Rollback do PWA

```text
[Incidente Detectado no Build N]
               │
               ▼
   [1. Avaliação Crítica]
   - Consulta hasCriticalOperations()
   - Aguarda término de pesagem/lançamento
               │
               ▼
   [2. Servidor Estático / Host]
   - Repõe artefatos do build N-1 no diretório /dist
   - Atualiza version.json apontando para versão N-1
               │
               ▼
   [3. Detecção Passiva pelo Cliente]
   - sw.js detecta atualização disponível (N-1)
   - Precache atômico do shell N-1 ativa cache retido
               │
               ▼
   [4. Consentimento Explícito]
   - Exibe UpdateBanner: "Atualização disponível"
   - Operador clica em "Atualizar agora"
               │
               ▼
   [5. Ativação Não-Destrutiva]
   - Despacha SKIP_WAITING
   - clients.claim() assume controle
   - Recarrega interface apontando para Shell N-1
               │
               ▼
   [6. Verificação de Integridade]
   - 6 bases legadas intactas
   - Fila atômica consubov-vnext-command-queue intacta
```

#### Detalhamento das Etapas de Rollback PWA:

1. **Etapa 1: Confirmação de Falha e Decisão de Reversão**
   - Identificação de falha grave na versão N (ex: erro de JavaScript que impede submissão de formulário ou quebra layout de campo).
   - O comando operacional autoriza o retorno para o build N-1.

2. **Etapa 2: Verificação de Operações Críticas no Cliente**
   - O método `hasCriticalOperations()` do frontend consulta se há pesagem ativa (`ma_pesagem_ativa`), lote em fechamento ou gravação de cocho em andamento.
   - Se houver operação ativa, o sistema posterga a ativação até a conclusão ou salvamento seguro no IndexedDB.

3. **Etapa 3: Substituição de Artefatos no Host Local / Distribuição**
   - Restaurar os binários compilados da versão N-1 no diretório de distribuição web:
     ```bash
     # Procedimento de reposição local
     cp -r dist-backup/v-N-1/* apps/web/dist/
     ```
   - O arquivo `apps/web/dist/version.json` deve refletir o timestamp/hash da versão N-1.

4. **Etapa 4: Detecção e Ativação do Shell Retido**
   - Ao conectar-se ou atualizar a página, o navegador consulta `/sw.js` e detecta a alteração.
   - Como os assets do shell N-1 já se encontram no CacheStorage retido (`retained`), a validação de integridade é imediata, sem necessidade de downloads volumosos.
   - Em caso de falha de download de algum asset secundário, a rotina `precacheAppShell()` adota política *fail-closed*: aborta a instalação e mantém o shell atual funcional sem corromper o cache.

5. **Etapa 5: Consentimento e Troca do Shell**
   - O componente `UpdateBanner` é renderizado para o usuário com a opção **"Atualizar agora"**.
   - Ao receber o clique do operador, envia `{ type: 'SKIP_WAITING' }` ao Service Worker.
   - O Service Worker assume o controle dos clientes (`self.clients.claim()`) e emite a notificação `CONSUBOV_SW_ACTIVATED`.
   - A página realiza a recarga coordenada, servindo o shell da versão N-1 a partir do `pinnedShellNavigation`.

6. **Etapa 6: Auditoria Pós-Rollback dos Dados Locais**
   - Verificar que os bancos IndexedDB permanecem com 100% dos seus registros:
     - `consubov-capataz` (lançamentos, pesagens, observações)
     - `consubov-session` (tokens e dados offline)
     - `consubov-consultor-offline` (fotos e avaliações)
     - `mais-arrobas-offline` e `mais-arrobas-sync` (tabelas e leituras de balança)
     - `consubov-fotos-salga` (blobs de fotos)
     - `consubov-vnext-local` e `consubov-vnext-command-queue` (fila atômica vNext)
     - `localStorage` (`pending_backup`, `pending_backup_at`, `ma-offline-mode`)

---

## 3. Procedimento de Rollback de Schema de Banco de Dados (PostgreSQL DOWN)

No servidor PostgreSQL, qualquer modificação de estrutura ou migração que apresente incompatibilidade, contenção de locks ou erro funcional deve ser revertida através de script **DOWN idempotente**.

### 3.1. Requisitos para Scripts de Rollback DOWN
1. **Localização Obrigatória:** Todo arquivo `supabase/migrations/<timestamp>_<nome>.sql` deve possuir seu contraposto estrito em `supabase/migrations/down/<timestamp>_<nome>.down.sql`.
2. **Idempotência Incondicional:** Cláusulas defensivas `DROP ... IF EXISTS` em todas as instruções de destruição.
3. **Ordem Reversa de Execução:** Destruição na ordem inversa da criação para respeitar a integridade referencial:
   - 1º: Remover Policies de RLS (`DROP POLICY IF EXISTS`).
   - 2º: Desabilitar ou remover Triggers (`DROP TRIGGER IF EXISTS`).
   - 3º: Remover Índices Secundários e de Performance (`DROP INDEX IF EXISTS`).
   - 4º: Remover Constraints e Tabelas (`DROP TABLE IF EXISTS ... CASCADE`).
4. **Zero Resíduo no Catálogo:** O estado do banco após a execução do script DOWN deve ser rigorosamente idêntico ao estado imediatamente anterior à aplicação do script UP.

### 3.2. Exemplo Canônico: Rollback da Fase 8 (`public.atomic_command_log`)
Script: `supabase/migrations/down/20261014000000_phase8_unified_relational_contracts.down.sql`

```sql
-- Reversible Rollback: 20261014000000_phase8_unified_relational_contracts.down.sql
-- FASE 8: PostgreSQL Local Dry-Run & Unified Relational Contracts (Rollback)

-- 1. Remoção das Policies de Segurança RLS
DROP POLICY IF EXISTS "user_access_atomic_command_log" ON public.atomic_command_log;
DROP POLICY IF EXISTS "tenant_isolation_atomic_command_log" ON public.atomic_command_log;

-- 2. Remoção dos Índices de Performance e Unicidade
DROP INDEX IF EXISTS public.idx_atomic_commands_kind;
DROP INDEX IF EXISTS public.idx_atomic_commands_user;
DROP INDEX IF EXISTS public.idx_atomic_commands_tenant_status;
DROP INDEX IF EXISTS public.uq_atomic_commands_tenant_command;
DROP INDEX IF EXISTS public.uq_atomic_commands_tenant_idempotency;

-- 3. Remoção da Tabela com Limpeza de Dependências em Cascata
DROP TABLE IF EXISTS public.atomic_command_log CASCADE;
```

### 3.3. Procedimento Operacional de Execução do Rollback de Banco

#### Etapa 1: Congelamento Temporário de Ingestão de Fila
- Notificar os clientes ativos ou simular circuito aberto local para impedir o envio de novas mutações durante a execução do DDL.
- No frontend, o `LocalQueueDrainer` com `circuitBreakerOnFailure = true` retém os comandos em `pending` no IndexedDB do cliente.

#### Etapa 2: Validação Criptográfica em Dry-Run Local
Antes de aplicar qualquer reversão em banco real ou simulado, executar o verificador de idempotência:
```bash
# Executa o ciclo completo UP -> UP -> DOWN -> UP e compara hashes de schema
node -e '
  import("./scripts/qa/migration-idempotency-runner.mjs").then(m => {
    const res = m.runMigrationIdempotencyFiles(
      "supabase/migrations/20261014000000_phase8_unified_relational_contracts.sql",
      "supabase/migrations/down/20261014000000_phase8_unified_relational_contracts.down.sql"
    );
    console.log("Resultado da Verificação:", res.passed ? "PASS" : "FAIL");
    if (!res.passed) {
      console.error(res.integrityErrors);
      process.exit(1);
    }
  });
'
```
*Critério de Aceite:* `res.passed === true` comprovando que `hash(State 3) === hash(State 0)`.

#### Etapa 3: Aplicação do Script DOWN
No banco de dados local isolado:
```bash
psql "$LOCAL_DATABASE_URL" -f supabase/migrations/down/20261014000000_phase8_unified_relational_contracts.down.sql
```

#### Etapa 4: Validação do Catálogo Pós-Rollback
- Inspecionar se `public.atomic_command_log` deixou de existir.
- Confirmar que as tabelas de negócio pré-existentes (`lancamentos`, `pesagens`, `visitas_tecnicas`) continuam intactas com seus dados preservados.

---

## 4. Matriz de Decisão de Contingência Operacional

Esta matriz estabelece os critérios objetivos para tomada de decisão diante de incidentes em ambiente de pré-produção ou operação de campo.

| Nível / Incidente | Sintoma / Diagnóstico | Ação Primária Imediata | Mecanismo de Proteção | Critério de Rollback / Abort |
| :--- | :--- | :--- | :--- | :--- |
| **Nível 1 (P1)**<br>Instabilidade Temporária de Rede | Timeout HTTP, erro 504, erro `NetworkError: Failed to fetch`. | Manter comandos na fila local do IndexedDB. | **Circuit-Breaker Disparado** (`stoppedOnError = true`). Interrompe o lote, emite `status: "error"`. | **Não fazer rollback.** Aguardar recuperação do link ou reconexão em Wi-Fi de sede. |
| **Nível 2 (P2)**<br>Lost ACK em Conexão Flutuante | O comando foi aplicado no servidor, mas a confirmação HTTP foi perdida pelo cliente. | O cliente agenda retry com a **mesma `idempotencyKey`**. | **Idempotência no Servidor** (`uq_atomic_commands_tenant_idempotency`). Servidor devolve ACK sem duplicar registro. | **Não fazer rollback.** A idempotência resolve a consistência automaticamente. |
| **Nível 3 (P3)**<br>Falha de Download de Chunk no Precache | Erro 404/5xx ao baixar novo chunk JS de rota durante update do PWA. | A instalação do novo Service Worker falha propositalmente (*fail-closed*). | **Descarte de Geração Parcial** (`caches.delete(CACHE_NAME)`). O shell antigo N permanece ativo sem interrupção. | **Não fazer rollback manual.** O próprio navegador aborta a atualização e mantém a versão funcional. |
| **Nível 4 (P4)**<br>Regressão de Interface ou Erro Crítico no Build N | Tela branca, exception em renderização React ou bloqueio de botões pós-update. | Publicar versão N-1 no host e aguardar consentimento do usuário. | **Retenção Bi-Geracional** (`consubov-shell-v-(N-1)`). O shell anterior é ativado sem perda de dados no IndexedDB. | **Executar Rollback PWA para N-1.** Seguir Procedimento da Seção 2. |
| **Nível 5 (P5)**<br>Erro de Dependência / Chave Estrangeira Órfã (23503) | Mutação filha chega ao servidor antes da mutação pai (ex: foto de pasto sem `visita_pastos`). | Manter comando filho em `pending` com diferimento gracioso via `isDependencyError`. | **Ordenação Topológica FIFO** (`SYNC_TABLE_PRIORITY`). O comando pai é processado primeiro; retry posterior do filho tem sucesso. | **Não fazer rollback.** Não consumir tentativas de retry indevidamente. |
| **Nível 6 (P6)**<br>Incompatibilidade Estrutural de Schema Relacional | Erro DDL em migração no servidor ou deadlock relacional. | Congelar drenagem de sincronização e executar script DOWN idempotente. | **Isolamento de Fila Local**: Comandos permanecem salvos no IndexedDB dos clientes até normalização do schema. | **Executar Rollback de Schema (DOWN)** no banco. Seguir Procedimento da Seção 3. |
| **Nível 7 (P7)**<br>Isolamento Físico Extremo sem Conexão Prolongada | Operador sem sinal celular por semanas em retiro remoto e risco de dano ao aparelho. | Acionar botão "Exportar Backup de Emergência" no aplicativo. | **Espelho Redundante em LocalStorage** (`backup:pending_backup`) e exportação JSON para envio via WhatsApp/pendrive. | **Procedimento de Contingência Manual**. Importação assistida do arquivo JSON no destino. |

---

## 5. Garantias de Preservação e Rastreabilidade Criptográfica

Para assegurar conformidade com os princípios de auditoria e continuidade:

1. **Imutabilidade de URNs Canônicas**:
   - Cada entidade possui identificador único determinístico composto:
     `urn:consubov:<subdomínio>:<tipo>:<id>`
   - Exemplo: `urn:consubov:capataz:lancamento:550e8400-e29b-41d4-a716-446655440000`
   - Mesmo após rollbacks de PWA ou re-execuções de scripts DOWN/UP, a URN não sofre alteração, prevenindo duplicações em re-ingestão.
2. **Preservação Integral de Blobs / Fotografias**:
   - Imagens de cochos, pastos e auditoria são armazenadas como instâncias puras de `Blob` ou `ArrayBuffer` no IndexedDB (`consubov-fotos-salga` e `consubov-consultor-offline`).
   - Procedimentos de rollback de PWA nunca tocam nas stores de fotos.
   - O mecanismo defensivo de `backupMirror.ts` substitui fotos por `[stripped]` exclusivamente no espelho secundário do `localStorage` quando ultrapassa 4,5 MB, garantindo que o IndexedDB preserve as fotos originais em alta resolução.
3. **Auditoria e Logs Sanitizados**:
   - É proibido registrar em logs de rollback detalhes confidenciais de usuários, senhas ou tokens de sessão.
   - Os relatórios de reversão devem conter apenas: Timestamp ISO, Versão Origem, Versão Destino, Hash SHA-256 de Catálogo, Quantidade de Comandos Pendentes e Status do Gate.

---
**Fim do Plano de Rollback e Contingência Operacional CONSUBOV.**
