# Runbook Operacional CONSUBOV: Operação Local, Pré-Produção, Observabilidade e Contingência

**Versão:** 1.0.0  
**Data:** 2026-10-14  
**Status:** Vigente (Fase 9 — Preparação de Pré-Produção e Homologação Local)  
**Ambiente:** Estritamente Local / Dry-Run (Zero Conexões Remotas sem Autorização)  
**Módulos Abrangidos:** PWA Web (`apps/web`), API Modular (`apps/api`), Fila Atômica IndexedDB (`LocalQueueDrainer`), Service Worker Bi-Geracional, Backup Local Redundante (`backupMirror`).

---

## 1. Identificação e Princípios Operacionais

Este runbook estabelece os procedimentos normativos e técnicos para operação, monitoramento, diagnóstico de incidentes e intervenção de emergência no ecossistema local do CONSUBOV. A arquitetura segue o modelo **Offline-First com Autoridade Centralizada no Servidor**, utilizando PWA React/Vite com persistência no IndexedDB e API modular com PostgreSQL.

### Princípios Inegociáveis:
1. **Mandato de Tolerância Zero à Perda de Dados (`Zero Data Loss Mandate`)**: Nenhuma ação de suporte, mitigação ou depuração pode executar `indexedDB.deleteDatabase`, `localStorage.clear` ou purgar filas pendentes sem aprovação formal e snapshot de contingência verificado.
2. **Preservação Bi-Geracional e Isolamento**: O ciclo de atualização e Service Worker deve reter a versão ativa (N) e a anterior (N-1), garantindo rollback instantâneo sem afetar as seis bases legadas ou as bases unificadas `consubov-vnext-local` e `consubov-vnext-command-queue`.
3. **Idempotência Criptográfica Estrita**: Toda mutação possui URN determinística única por tenant (`urn:consubov:<subdomínio>:<tipo>:<id>`). Retries decorrentes de instabilidade de sinal não podem duplicar saldos, pesagens ou lançamentos no backend.
4. **Proteção de Operações Críticas em Andamento**: Nenhuma rotina de manutenção, refresh ou atualização pode interromper pesagens, lançamentos de cocho ou captura de fotos (`hasCriticalOperations() === true`).
5. **Segurança e Conformidade LGPD**: Proibição terminante de trafegar ou exibir em logs, consoles, artefatos do Git ou relatórios quaisquer credenciais administrativas, segredos, senhas, PII (informações de identificação pessoal) ou binários de imagem brutos.

---

## 2. Preparação do Ambiente Local e Pré-Produção

### 2.1. Requisitos de Ferramental e Pré-Requisitos
O ambiente de execução e homologação local exige:
- **Node.js**: v20 LTS ou v22 LTS (com `node:test` e API Web Crypto disponível).
- **Bun**: v1.1+ (gerenciador de pacotes rápido e runtime para scripts da aplicação).
- **Go Task**: v3+ (executor oficial de tarefas do repositório através do `Taskfile.yml`).
- **Navegadores Playwright**: Chromium e WebKit instalados no diretório isolado `.qa/tools/playwright-browsers`.
- **Bash / Git Bash**: Ambiente POSIX para execução de scripts de validação (`scripts/qa/`).

### 2.2. Procedimento de Diagnóstico e Inicialização

#### Etapa 1: Diagnóstico de Ferramentas (Doctor)
Execute a partir da raiz do repositório:
```bash
task doctor
```
*Critério de Aceite:* Todas as ferramentas essenciais (Git, Node, Bun, Task) devem retornar status `OK`.

#### Etapa 2: Provisionamento de Dependências e Navegadores
Se o checkout for recente ou após atualizações de lockfile:
```bash
task setup
```
*Ação executada:* `bun install --frozen-lockfile` e instalação dos binários Chromium, WebKit e Firefox no cache local do projeto.

#### Etapa 3: Execução das Regressões Locais de Pré-Voo
Antes de qualquer atividade de teste ou pré-produção:
```bash
task qa:regressions
task qa:pwa:build-preflight
```
*Critério de Aceite:* 100% dos testes unitários e de contrato devem retornar status PASS com zero skips e zero falhas de hash no bundle do Service Worker.

#### Etapa 4: Inicialização dos Serviços em Modo Local / Dry-Run
Em terminais independentes:
```bash
# Terminal 1 - Frontend PWA Local
bun run --cwd apps/web dev

# Terminal 2 - API Modular Local
bun run --cwd apps/api dev
```
*Nota de Governança:* É expressamente proibido apontar variáveis de ambiente para instâncias de produção do Supabase ou Vercel. Todas as simulações utilizam fixtures e mocks isolados (`dry-run`).

---

## 3. Matriz de Observabilidade e Métricas Críticas

O monitoramento local baseia-se na inspeção de estados da fila atômica (`IndexedDbAtomicCommandQueue`), do coordenador de sincronização (`LocalQueueDrainer`), das cotas do navegador (`StorageManager`) e dos canais de coordenação inter-abas (`BroadcastChannel`).

### 3.1. Métricas da Fila de Sincronização (`consubov-vnext-command-queue`)

| Métrica | Fonte / Consulta | Limiar Normal | Limiar de Alerta | Ação Operacional Recomendada |
| :--- | :--- | :--- | :--- | :--- |
| `pending_commands` | `queue.listPending(owner)` | 0 a 50 comandos | > 200 comandos | Verificar conectividade do dispositivo; disparar drenagem manual via `LocalQueueDrainer`. |
| `inflight_commands` | Consulta por status `inflight` | 0 comandos (quando ocioso) | > 0 por mais de 60s | Comando travado em trânsito; executar rotina `recoverUnconfirmed`. |
| `conflict_commands` | Consulta por status `conflict` | 0 comandos | >= 1 comando | Inspecionar payload e motivo de rejeição; acionar protocolo de concorrência de domínio. |
| `max_attempt_count` | `Math.max(...cmds.map(c => c.attemptCount))` | 0 a 3 tentativas | >= 5 tentativas | Investigar falha sistemática no endpoint ou payload inválido; isolar comando problemático. |
| `sync_duration_ms` | `DrainSummary.durationMs` | < 1500 ms por lote | > 10.000 ms | Latência alta ou timeout de transporte; verificar contenção de I/O no IndexedDB. |

### 3.2. Métricas de Armazenamento e Quotas do Navegador

| Recurso | Método de Coleta | Limiar Seguro | Limiar Crítico | Comportamento do Sistema |
| :--- | :--- | :--- | :--- | :--- |
| **IndexedDB Quota** | `navigator.storage.estimate()` | Uso < 60% da cota | Uso > 80% da cota | Notificar usuário no banner; solicitar persistência durável via `navigator.storage.persist()`. |
| **LocalStorage Mirror** | `JSON.stringify(payload).length` em `backupMirror.ts` | < 3.500.000 bytes (~3,5 MB) | > 4.500.000 bytes (~4,5 MB) | Ativação automática de `trimmed = true`: fotos base64 são marcadas como `[stripped]` no mirror para não estourar a cota de 5 MB do navegador (os binários originais permanecem íntegros no IndexedDB). |

### 3.3. Eventos de Coordenação (`BroadcastChannel("consubov-vnext-sync")`)
As abas do aplicativo trocam mensagens assíncronas para manter o estado da interface unificado:
- `SYNC_STATUS_CHANGED`: Informa status (`idle` | `syncing` | `error`) e quantidade de pendências (`pendingCount`).
- `COMMAND_ACKED`: Confirmação positiva recebida do servidor; remove o comando da fila pendente.
- `COMMAND_CONFLICT`: Rejeição semântica com regra de negócio violada; exige intervenção ou reconciliação.

---

## 4. Detecção de Anomalias e Operação do Circuit-Breaker

A resiliência da PWA sob condições adversas de campo (conectividade intermitente em fazendas, torres celulares 2G/3G instáveis) depende da atuação correta do **Circuit-Breaker** integrado ao `LocalQueueDrainer`.

### 4.1. Funcionamento do Circuit-Breaker (`LocalQueueDrainer.ts`)
O processador de lotes opera com a opção `circuitBreakerOnFailure = true` (padrão):

```text
[Início do Lote (até 50 cmds)]
         │
         ▼
[syncOneLocalCommand] ──► Falha transitória (NetworkError / Lost ACK / Timeout / 5xx)
         │
         ▼
[Circuit-Breaker Disparado!]
  1. Marca status do comando como "pending" (retry seguro).
  2. Define stoppedOnError = true.
  3. Interrompe IMEDIATAMENTE a iteração do lote restante.
  4. Emite Broadcast: SYNC_STATUS_CHANGED { status: "error", pendingCount }.
  5. Retorna DrainSummary com contadores precisos.
```

### 4.2. Tipos de Anomalias e Diagnóstico Diferencial

#### Caso A: Falha Transitória de Rede (Network Offline)
- **Sintoma:** Exceção `NetworkError: Failed to fetch (simulated offline)` ou `status 504 Gateway Timeout`.
- **Diagnóstico:** O dispositivo perdeu sinal ou o servidor local foi paralisado.
- **Comportamento Automático:** O circuito abre (`stoppedOnError = true`). Os comandos subsequentes não são disparados, evitando sobrecarga inútil da bateria do aparelho e tempestade de requisições falhas.
- **Recuperação:** A sincronização é retomada automaticamente quando o evento `window.addEventListener('online')` for disparado ou sob solicitação explícita do usuário.

#### Caso B: ACK Perdido no Transporte (Lost ACK)
- **Sintoma:** O comando foi recebido e persistido no servidor, mas a resposta HTTP foi perdida por queda de conexão antes de chegar ao cliente (`NetworkError: Connection reset while waiting for HTTP ACK`).
- **Diagnóstico:** A tentativa seguinte enviará o mesmo comando com a mesma `idempotencyKey`.
- **Comportamento do Servidor:** O servidor detecta a chave no `atomic_command_log` (ou tabela de destino), não reexecuta os efeitos colaterais e devolve o ACK imediato com os dados da primeira aplicação.
- **Comportamento do Cliente:** O comando é marcado como `acked` e retirado da fila pendente sem duplicação de saldo ou animal.

#### Caso C: Erro de Chave Estrangeira Órfã / Dependência (PostgreSQL 23503)
- **Sintoma:** O servidor recusa a inserção porque a entidade pai ainda não foi processada (ex: uma foto de avaliação tenta referenciar um `visita_pasto_id` que ainda está em trânsito).
- **Diagnóstico:** Detectado via `isDependencyError(error)`.
- **Ação:** O comando pai deve ser sincronizado primeiro. O comando filho permanece em status `pending` e registra diferimento gracioso sem consumir retries.

#### Caso D: Conflito de Negócio Não-Retentável (HTTP 409 Conflict)
- **Sintoma:** O servidor rejeita a mutação por violação semântica intransponível (ex: tentativa de fechar mês já encerrado por outro operador, ou animal já baixado).
- **Ação:** O comando é transitado para `status: "conflict"` no IndexedDB local. Ele NÃO deve ser retentado em loop. O operador deve consultar a tela de conciliações para decidir descarte ou fusão manual.

---

## 5. Rotinas de Backup e Snapshot de Contingência Local

Para salvaguardar os lançamentos de campo mesmo diante de incidentes extremos (pane de software, corrupção acidental de IndexedDB ou necessidade de troca de aparelho antes da sincronização), o CONSUBOV implementa três camadas de proteção de dados.

### 5.1. Espelhamento Redundante no LocalStorage (`backupMirror.ts`)
A função `backupPendingToLocalStorage()` coleta periodicamente todos os dados pendentes de lançamento, pesagem, observações e encerramento de mês:
- **Chave de Payload:** `localStorage.getItem("pending_backup")`
- **Chave de Timestamp:** `localStorage.getItem("pending_backup_at")`
- **Tamanho Limite:** 4,5 MB (com stripping defensivo de fotos em caso de risco de quota).
- **Rotina Automática:** Ativada na inicialização via `startPeriodicBackup(userInfo, 30 * 60 * 1000)` (intervalo de 30 minutos) e logo após a gravação de qualquer novo registro de campo.

### 5.2. Procedimento de Exportação de Emergência (Exportação JSON)
Se o operador estiver em retiro isolado sem qualquer perspectiva de restabelecimento de sinal e precisar garantir o envio dos dados:
1. No menu do Capataz / Diagnóstico da PWA, acionar o botão **"Exportar Backup de Emergência"** (invoca `downloadPendingBackup()`).
2. O navegador gera e faz download de um arquivo padronizado:
   ```text
   consubov_backup_<NomeDoCapataz>_YYYY-MM-DDTHH-mm-ss.json
   ```
3. O operador pode enviar esse arquivo via mensageria (WhatsApp, quando houver sinal pontual em sede) ou salvar em pendrive.
4. O arquivo contém a estrutura completa `PendingBackup` com arrays tipados e metadados de autenticação do operador.

### 5.3. Ensaio Local de Reconciliação e Restauração de Fixtures
Para comprovar que um snapshot de contingência pode ser restaurado sem perda de registros nem corrupção de hashes:
```bash
# Executa o ensaio de integridade formal
task qa:preprod:rehearsal

# Reconciliação entre duas fixtures JSON
node scripts/qa/local-snapshot-rehearsal.mjs reconcile .qa/source.json .qa/target.json

# Restauração verificada para um novo arquivo destino isolado
node scripts/qa/local-snapshot-rehearsal.mjs restore .qa/source.json .qa/new-restored.json
```
*Regras de Validação do Ensaio:*
- O destino não pode existir previamente (evita sobrescrita acidental).
- O payload deve conter `format: "consubov-local-fixture-v1"` e `fixture: true`.
- Todos os registros são comparados por SHA-256 deep-sorted do payload e tuplas `[tenantId, entity, id]`.

---

## 6. Procedimentos de Intervenção Operacional (Passo a Passo)

### 6.1. Procedimento P-01: Intervenção em Falha Crítica de Conectividade Rural Prolongada

**Cenário:** O capataz está operando há 5 dias em área sem sinal celular. A fila acumula dezenas de lançamentos de cocho e pesagens. Há temor de esgotamento de quota ou perda de dados.

1. **Verificação de Quota e Persistência:**
   - Abrir o console de desenvolvimento ou tela de status do aplicativo.
   - Executar no console:
     ```javascript
     navigator.storage.persisted().then(p => console.log('Armazenamento Persistente:', p));
     navigator.storage.estimate().then(e => console.log(`Uso: ${(e.usage/1024/1024).toFixed(2)} MB de ${(e.quota/1024/1024).toFixed(2)} MB`));
     ```
   - Se `persisted === false`, solicitar ativação com `navigator.storage.persist()`.
2. **Geração de Snapshot Redundante Preventivo:**
   - Invocar no console ou clicar em exportar backup:
     ```javascript
     window.localStorage.getItem('pending_backup_at');
     ```
   - Confirmar que a chave `pending_backup` possui tamanho condizente com a quantidade de lançamentos.
3. **Instrução ao Operador de Campo:**
   - O operador deve continuar os lançamentos normalmente. O IndexedDB suporta centenas de megabytes.
   - Proibir expressamente o operador de "limpar cache do navegador" ou "desinstalar o PWA".
   - Ao retornar à sede da fazenda com rede Wi-Fi, conectar o aparelho à alimentação elétrica e abrir o CONSUBOV.
   - Acompanhar o indicador de status transitar de `syncing` para `idle` com `pendingCount = 0`.

---

### 6.2. Procedimento P-02: Intervenção em Invalidação ou Corrupção de Sessão de Usuário

**Cenário:** O token de acesso do operador expirou ou a chave da sessão foi corrompida. Ao abrir a aplicação, a tela redireciona para login, mas existem comandos pendentes na fila local atrelados ao `tenantId` e `userId` daquele operador.

**AVISO DE INTEGRIDADE: NUNCA LIMPAR O INDEXEDDB OU BANCO DE DADOS LOCAL!**

1. **Preservação dos Registros Pendentes:**
   - Os comandos em `IndexedDbAtomicCommandQueue` estão vinculados a tuplas `[tenantId, userId, commandId]`.
   - Limpar o banco destruiria o trabalho de campo não sincronizado.
2. **Diagnóstico da Sessão:**
   - Inspecionar a base `consubov-session` e chave `session:auth_current`.
3. **Fluxo de Re-Autenticação Segura:**
   - O operador deve efetuar login com o **mesmo e-mail e credenciais** que criaram os lançamentos offline.
   - O frontend renova os tokens e preserva intacta a base de comandos e bases legadas.
4. **Verificação de Casamento de Identidade:**
   - Após o login, validar que o novo `user.id` e `tenant_id` conferem com os comandos pendentes:
     ```javascript
     // Verificação via console de suporte
     const owner = { tenantId: authUser.tenant_id, userId: authUser.id };
     // Disparar sincronização sob a nova sessão válida
     ```
   - Se o operador logar acidentalmente com outra conta (outro usuário ou outra fazenda), o sistema **recusa** a drenagem de comandos de terceiros (`command owner mismatch`), mantendo os registros isolados e protegidos até que o usuário correto se reconecte.

---

### 6.3. Procedimento P-03: Resolução de Concorrência Multi-Abas e Travamento de Web Locks

**Cenário:** O operador abriu o CONSUBOV em múltiplas abas no mesmo navegador. Uma das abas travou ou foi suspensa pelo sistema operacional móvel enquanto mantinha o lock de sincronização, impedindo a drenagem das demais abas.

1. **Mecanismo de Lock:**
   - A drenagem utiliza Web Locks API (`navigator.locks.request`) com o nome `consubov:sync-leader:<tenantId>:<userId>` e opção `{ ifAvailable: true }`.
2. **Sintoma:**
   - O log informa que a sincronização não foi iniciada nesta aba porque o lock está ocupado por outro contexto (`executed: false`).
3. **Resolução Passo a Passo:**
   - **Ação 1:** Fechar todas as abas duplicadas da PWA no navegador, mantendo apenas uma aba ativa.
   - **Ação 2:** Se o navegador retiver o lock em aba em segundo plano, forçar recarga suave da aba principal (`Ctrl + F5` ou `Puxar para atualizar`). O teardown da página descarta o `AbortController` e libera o lock no kernel do navegador.
   - **Ação 3:** A aba remanescente adquire o lock de líder e emite `SYNC_STATUS_CHANGED` via `BroadcastChannel`, retomando a drenagem normal.

---

### 6.4. Procedimento P-04: Recuperação de Comandos Travados em Status `inflight`

**Cenário:** Uma aba iniciou o envio de um lote de comandos, transitou-os para status `inflight`, mas o navegador sofreu um crash ou fechamento abrupto antes de receber a resposta HTTP ou registrar o erro.

1. **Sintoma:**
   - Comandos com `status: "inflight"` há muito tempo, que não voltam sozinhos para `pending` nem avançam para `acked`.
2. **Regra de Recuperação (`recoverUnconfirmed`):**
   - O sistema proíbe resolução LWW ou alteração cega.
   - A rotina `recoverUnconfirmed(owner, { commandId, attemptCount })` exige a confirmação explícita de que nenhum processo está drenando a fila no momento.
3. **Execução da Recuperação:**
   - Garantir que a fila está ociosa (nenhum líder ativo).
   - O sistema transita os comandos `inflight` de volta para `pending` usando a função pura `retryAfterUncertainDelivery(command, owner)`.
   - O `attemptCount` é mantido.
   - Na próxima drenagem, o comando é reenviado com a **mesma `idempotencyKey`**.
   - Se o servidor já havia processado a requisição anterior, responderá com ACK imediato; se não havia recebido, processará normalmente pela primeira vez.

---

## 7. Checklist Operacional Diário de Pré-Produção

- [ ] **Check 1: Integridade Git & Branch:**
  - `git status --short --branch` comprova permanência na branch `work/fase5-6-7-pwa-local` (PR #43 draft).
- [ ] **Check 2: Preservação das 6 Bases Legadas:**
  - Nenhuma rotina de limpeza tocou em `consubov-capataz`, `consubov-session`, `consubov-consultor-offline`, `mais-arrobas-offline`, `mais-arrobas-sync`, `consubov-fotos-salga` ou `localStorage`.
- [ ] **Check 3: Status dos Gates Locais:**
  - Execução bem-sucedida de `task qa:phase5`, `task qa:phase6`, `task qa:phase7` e `task qa:phase8`.
- [ ] **Check 4: Ausência de Vazamento de Segredos:**
  - Execução de `task qa:security` com zero segredos ou credenciais expostas.
- [ ] **Check 5: Ensaios de Reconciliação:**
  - `task qa:preprod:rehearsal` aprovado com 26/26 testes verdes.

---
**Fim do Runbook Operacional CONSUBOV.**
