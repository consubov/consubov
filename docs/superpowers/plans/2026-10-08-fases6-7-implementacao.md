# Implementação Fases 6 (App) e 7 (Offline) — Plano de Implementação

> **Para trabalhadores agenticos:** HABILIDADE SUBORDINADA OBRIGATÓRIA: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. As etapas usam sintaxe de caixa de seleção (`- [ ]`) para rastreamento.

**Objetivo:** Implementar o empacotamento nativo do CONSUBOV via Capacitor e habilitar persistência offline via SQLite com sincronização.

**Arquitetura:** O projeto adota uma abordagem de "Mobile-First" com Capacitor para expor APIs nativas (GPS/QR/Câmera/Storage) à SPA Vite/React, que permanecerá agnóstica à infraestrutura via adaptadores (`NativeBridge`). A persistência offline utiliza SQLite via plugin e uma Command Queue para sincronização idempotente com o backend.

**Stack Tecnológico:** Capacitor 7+, SQLite (via `@capacitor-community/sqlite`), React 18, Vite, Bun.

**Especificação:** [docs/superpowers/specs/2026-10-08-fases6-7-design.md](docs/superpowers/specs/2026-10-08-fases6-7-design.md)

## Global Constraints

- Backend deve manter-se em Bun + TypeScript.
- Arquitetura de monólito modular deve ser preservada.
- Offline não deve introduzir LWW (Last-Write-Wins) genérico; cada agregado exige estratégia explícita.
- Nenhuma dependência externa não validada deve ser incluída.
- Identificadores devem ser estáveis e independentes do provider.

## Review Focus

- Conflitos de escrita entre cliente offline e API (falha de concorrência): O sistema deve rejeitar mutações baseadas em versão obsoleta da entidade (`base_version`).
- Falha de conexão durante o sync (interrupção): A fila deve garantir a persistência do comando até o ACK do servidor (retry idempotente).
- Permissões de hardware negadas: O App deve degradar funcionalidade de forma graciosa sem quebrar a UI.
- Formato de dados no SQLite vs API: Inconsistência no schema local deve ser tratada por migração versionada.
- Idempotência: Comandos duplicados na fila não devem causar efeitos colaterais na API (ex: duas pesagens).

---

### Tarefa 1: Scaffolding do Capacitor (Fase 6)

**Arquivos:**
- Modificar: `apps/web/package.json`
- Criar: `apps/app/` (workspace mobile)
- Configurar: `capacitor.config.json`

**Interfaces:**
- Produz: Workspace mobile configurado apontando para a build do `@consubov/web`.

- [ ] **Passo 1: Instalar dependências do Capacitor**
- [ ] **Passo 2: Configurar projeto Capacitor**
- [ ] **Passo 3: Criar workspace mobile e ajustar build script**
- [ ] **Passo 4: Commit**

### Tarefa 2: Implementação da `NativeBridge` (Fase 6)

**Arquivos:**
- Criar: `apps/web/src/platform/capacitor/NativeBridge.ts`
- Modificar: `apps/web/src/platform/contracts/` (interfaces)

**Interfaces:**
- Consome: Contratos da Fase 2.
- Produz: Implementação concreta de `LocationProvider`, `QrScanner`, `SecureStorage`.

- [ ] **Passo 1: Implementar `LocationProvider` via Capacitor**
- [ ] **Passo 2: Implementar `QrScanner` via Capacitor**
- [ ] **Passo 3: Registrar adaptadores no DI container da aplicação**
- [ ] **Passo 4: Commit**

### Tarefa 3: Camada de Persistência SQLite (Fase 7)

**Arquivos:**
- Criar: `apps/web/src/lib/offline/sqliteDatabase.ts`
- Modificar: `apps/web/src/lib/offlineDb.ts` (adapter)

**Interfaces:**
- Produz: Implementação de `LocalDatabase` usando SQLite.

- [ ] **Passo 1: Configurar `@capacitor-community/sqlite`**
- [ ] **Passo 2: Definir schema SQL local para entidades críticas (ex: estoque/pesagens)**
- [ ] **Passo 3: Implementar métodos de escrita/leitura/migração**
- [ ] **Passo 4: Commit**

### Tarefa 4: Command Queue e Sincronização (Fase 7)

**Arquivos:**
- Criar: `apps/web/src/lib/offline/syncEngine.ts`
- Criar: `apps/web/src/lib/offline/commandQueue.ts`

**Interfaces:**
- Consome: `LocalDatabase`, `NativeBridge` (Connectivity).
- Produz: Motor de Sync que processa comandos pendentes.

- [ ] **Passo 1: Implementar schema da Command Queue no SQLite**
- [ ] **Passo 2: Implementar motor de processamento da fila (Push)**
- [ ] **Passo 3: Implementar lógica de Pull/Reconciliação**
- [ ] **Passo 4: Commit**
