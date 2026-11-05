# Arquitetura Técnica Canônica da Nova Plataforma CONSUBOV (Isolada & Local-First)

**Milestone**: FASE 08 (F23-NEXT-08)  
**Status**: HOMOLOGADO LOCALMENTE / PRODUÇÃO ESTRITAMENTE NO-GO  
**Data/Hora**: 2026-11-05  
**Autor**: Squad de Engenharia e Arquitetura CONSUBOV  
**Worktree**: `next-platform/` na branch `feat/platform/f23-isolated-next-platform`  
**Baseline Canônico**: SHA `16b93499` (Branch `main` intocada, 11 stashes preservados)

---

## 1. Visão Geral e Filosofia Arquitetural

A incubação isolada da nova plataforma CONSUBOV foi projetada para superar as limitações críticas da arquitetura legada (acesso direto do navegador via PostgREST/Supabase, falta de suporte offgrid robusto, concorrência cega via Last-Write-Wins e acoplamento entre governança SaaS e operação agropecuária).

A nova arquitetura alicerça-se sobre **três pilares inegociáveis**:
1. **Local-First por Padrão (Offline-First Real)**: Toda operação em campo (leitura de cocho, pesagem, fornecimento de salga, contagem de rebanho, anexo de fotos) é gravada primeiramente no banco local particionado (`IndexedDB`), com confirmação imediata ao usuário na UI, sem depender de latência ou disponibilidade de sinal 3G/4G/satélite.
2. **Barreira Central API-Only com Schemas Zod**: O cliente web/PWA é considerado zona de confiança zero (*untrusted client*). Nenhum componente do frontend possui SDK de banco ou credenciais de serviço. Toda mutação é encapsulada em um `AtomicCommandEnvelope` transmitido via HTTP REST para a API Bun/TypeScript (`/api/v1/commands`), onde passa por validação estrita de allowlist, RBAC por perfil, schemas Zod de domínio, deduplicação no ledger `atomic_command_log` e controle de concorrência otimista (`base_version`).
3. **Monólito Modular com Autoupdate Quiescente e Rollback 404**: Aplicações separadas para a fazenda (`CONSUBOV Fazendas` - PWA instalável com carregamento dinâmico de módulos) e para o backoffice corporativo (`ADM CONSUBOV` - aplicação web independente de governança SaaS). Atualizações do Service Worker baixam silenciosamente em background e só assumem o controle sob **quiescência operacional** comprovada (6 travas), com suporte a cache de 2 gerações (vN e vN-1) e fallback transparente em caso de chunk 404.

---

## 2. Diagrama de Blocos da Arquitetura

```
+---------------------------------------------------------------------------------------------------+
|                                  TOPOLOGIA DA NOVA PLATFORMA                                      |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ DISPOSITIVO DO USUÁRIO / PWA CLIENT-SIDE ]                                                     |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                  SHELL CONSUBOV FAZENDAS                                    |  |
|  |  +--------------------------+  +--------------------------+  +---------------------------+  |  |
|  |  |   Autenticação Local     |  |   Seletor Anti-First-    |  |   Motor de Tradução i18n  |  |  |
|  |  |   & Sessão JWT (Auth)    |  |   Match (Multi-Tenant)   |  |   Simétrico (pt-BR/en-US) |  |  |
|  |  +--------------------------+  +--------------------------+  +---------------------------+  |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  |  |                       Carregamento Dinâmico de Módulos (SafeImport)                   |  |  |
|  |  |  +-------------------+  +-------------------+  +-----------------+  +---------------+ |  |  |
|  |  |  |  Módulo GERENTE   |  |  Módulo CAPATAZ   |  | Módulo ESCRITÓRIO| | Módulo FÁBRICA| |  |  |
|  |  |  |  (GMD, Metas,     |  |  (100% Offgrid,   |  | (Compras, Notas,|  | (Batidas,     | |  |  |
|  |  |  |   Analítico)      |  |   Cocho, Fotos)   |  |  Lotes, Contab) |  |  Fórmulas)    | |  |  |
|  |  |  +-------------------+  +-------------------+  +-----------------+  +---------------+ |  |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  |  |              IndexedDB Particionado: ${tenant_id}:${user_id}:${fazenda_id}:${profile} |  |  |
|  |  |  - Snapshots Locais (Pastos, Lotes, Cochos, Fórmulas)                                 |  |  |
|  |  |  - Fotos Compactadas (<300KB) com Hash SHA-256 Dissociado                             |  |  |
|  |  |  - Outbox Append-Only com Eleição de Líder (Web Locks) & Circuit Breaker              |  |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  |  |                         Service Worker & QuiescenceRegistry                           |  |  |
|  |  |  - Cache 2 Gerações (vN e vN-1) | Rollback Automático 404 | 6 Travas de Quiescência    |  |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                |                                                  |
|                   Envelope Atômico Zod         | HTTPS /api/v1/commands                           |
|                   (AtomicCommandEnvelope)     v (Bearer Token JWT Sintético)                      |
|                                                                                                   |
|  [ BARREIRA DE API BUN / TYPESCRIPT (@consubov/platform-api) ]                                    |
|  +---------------------------------------------------------------------------------------------+  |
|  |  1. Filtro CORS & Método HTTP POST                                                          |  |
|  |  2. Allowlist Fechada de Comandos (isAllowedCommand)                                        |  |
|  |  3. Autenticação Bearer & Anti-Spoofing de Claims (tenant_id e profile_id)                  |  |
|  |  4. Validação Estrutural Zod do Envelope (atomicCommandEnvelopeSchema)                      |  |
|  |  5. Validação Declarativa RBAC (isProfileAuthorizedForCommand)                              |  |
|  |  6. Validação Zod do Payload Específico de Domínio                                          |  |
|  |  7. Motor de Deduplicação Idempotente no Ledger (tenant_id::idempotency_key)                |  |
|  |  8. Controle de Concorrência Otimista (OCC base_version conflict HTTP 409)                   |  |
|  |  9. Avanço Atômico de Versão e Emissão de ACK Único com Timestamp do Servidor               |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                |                                                  |
|  [ ADM CONSUBOV GLOBAL (apps/admin-global) ]   |  [ LEDGER AUDITÁVEL & ARMAZENAMENTO CENTRAL ]     |
|  +-----------------------------------------+   |  +--------------------------------------------+  |
|  |  - Backoffice SaaS Totalmente Separado  |---|  |  - public.atomic_command_log               |  |
|  |  - Gestão de Tenants, Planos e Licenças |      |  - Histórico Append-Only Imutável          |  |
|  |  - Auditoria Forense em Tempo Real      |      |  - Projeções de Agregados por Versão       |  |
|  +-----------------------------------------+      +--------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Contratos de Dados e Envelope Atômico

Todas as mutações de estado na plataforma utilizam obrigatoriamente o contrato tipado `AtomicCommandEnvelope<TPayload>`.

### 3.1 Definição do Envelope (`packages/contracts/src/validation/envelope.schema.ts`)

```typescript
export interface AtomicCommandEnvelope<TPayload = unknown> {
  command_id: string;               // UUID v4 único da mutação
  idempotency_key: string;          // Chave única de deduplicação (min 16 chars)
  correlation_id: string;           // Identificador de rastreamento de sessão
  command_type: AllowedCommandType; // Comando registrado na allowlist fechada
  aggregate_type: string;           // Entidade de domínio (pasto, lote, cocho, tenant)
  aggregate_id: string;             // Identificador único da entidade
  base_version: number;             // Versão conhecida pelo cliente (controle OCC)
  user_id: string;                  // Usuário originador
  tenant_id: string;                // Tenant contratante
  fazenda_id: string;               // Propriedade vinculada
  retiro_id?: string | null;        // Unidade produtiva opcional
  profile_id: UserProfileId;        // Perfil operacional (gerente, capataz, etc.)
  product_id: ProductId;            // Identificador de produto ('consubov')
  device_id: string;                // Identificador do hardware local
  schema_version: number;           // Versão do contrato do payload (ex: 1)
  payload: TPayload;                // Dados de negócio validados por schema Zod
  attachment_refs: AttachmentRef[]; // Anexos binários dissociados (fotos)
  occurred_at_local: string;        // Timestamp ISO 8601 da ocorrência em campo
  status: 'PENDENTE' | 'ENVIANDO' | 'SINCRONIZADO' | 'CONFLITO' | 'ERRO_FATAL';
  attempts: number;                 // Contagem de retries locais
  last_attempt_at?: string | null;  // Data da última tentativa de envio
  error_message?: string | null;    // Mensagem descritiva em caso de falha
}
```

---

## 4. Particionamento e Isolamento de Armazenamento Local

Para garantir a segregação absoluta entre diferentes fazendas, usuários e perfis compartilhando o mesmo aparelho físico (tablet ou smartphone de campo), o armazenamento local utiliza chaves compostas canônicas:

```
Partição Fazendas:  ${tenant_id}:${user_id}:${fazenda_id}:${profile_id}
Partição ADM SaaS:  admin:${module_name}
```

### Propriedades de Confinamento:
- Consultas do IndexedDB no perfil Capataz executadas para a Fazenda Norte jamais retornam registros ou comandos da Fazenda Sul.
- A troca de contexto exige descarte de memória volátil e abertura de namespace isolado.
- Os anexos binários de imagens são persistidos com chave dissociada `local-blob-${attachment_id}`, mantendo os metadados textuais da outbox leves e rápidos para iteração.

---

## 5. Resiliência Local-First e Protocolo de Sincronização

### 5.1 Eleição de Líder Cross-Tab (`navigator.locks`)
Quando múltiplas abas da aplicação estão abertas simultaneamente no mesmo navegador:
- Apenas uma aba assume a liderança de sincronização da partição (`startLeaderElection`), prevenindo concorrência na drenagem da outbox.
- Se a aba líder for fechada, as demais disputam e uma nova aba promotora assume a sincronização imediatamente sem interrupção.
- A comunicação reativa entre abas ocorre via `BroadcastChannel` para notificar alterações na contagem de itens pendentes na fila.

### 5.2 Circuit Breaker de Rede
- A classe `SyncCircuitBreaker` monitora o canal HTTP com a API.
- Ao primeiro erro de conexão (HTTP 502/503/504 ou `NetworkError`), o circuito transita para o estado `OPEN` por um período de cooldown (padrão 15 segundos).
- Isso impede tempestades de requisições inúteis (*request storms*) enquanto o operador estiver em áreas de sombra de sinal.

### 5.3 Resolução Especializada de Conflitos sem Last-Write-Wins (Anti-LWW)
Diferente de abordagens ingênuas que sobrescrevem o registro mais antigo com o mais recente:
- **Leituras de Cocho / Observações de Campo**: Aplica **Merge Aditivo** (`ADDITIVE_MERGE`). As observações concorrentes de múltiplos capatazes no mesmo pasto são intercaladas cronologicamente no histórico sem perda de dados.
- **Movimentações Físicas de Animais e Ajustes de Estoque**: Conflitos de versão (`base_version !== server_version`) geram HTTP 409 e são retidos para revisão explícita do operador (`OCC_CONFLICT_REVIEW`), impedindo inconsistências de rebanho.

---

## 6. Autoupdate Silencioso e Resiliência contra Tela Branca (WSOD)

O ciclo de atualização automática foi concebido para nunca interromper o trabalho do operador em campo:

```
[ Download em Background pelo SW ] ──> [ Armazenamento em Cache vN ]
                                                   │
                                                   ▼
                                       [ QuiescenceRegistry ]
                                 (Verifica 6 Travas Operacionais)
                                                   │
               ┌───────────────────────────────────┴───────────────────────────────────┐
               ▼                                                                       ▼
   [ Travas Ativas (false) ]                                               [ Quiescente (true) ]
   Retém atualização em silêncio                                          Envia SKIP_WAITING
   Aguarda encerramento de tarefas                                         Ativação transparente
```

### 6.1 As 6 Travas de Quiescência Mandatórias
1. `FORM_DIRTY`: Formulário em edição com dados não-salvos.
2. `CAMERA_ACTIVE`: Câmera aberta capturando foto de cocho.
3. `WEIGHING_ACTIVE`: Balança ou pesagem de lote em andamento.
4. `OUTBOX_SYNCING`: Fila local transmitindo dados ativamente para a API.
5. `QR_SCANNING`: Scanner de QR code de pasto ativo.
6. `LOCAL_DB_TRANSACTION`: Transação atômica em gravação no IndexedDB.

### 6.2 Cache de Duas Gerações e Rollback 404
- O Service Worker mantém precache das gerações **vN** e **vN-1**.
- Se o carregador dinâmico (`SafeDynamicImport`) interceptar erro HTTP 404 ao buscar chunks da nova versão (comum em servidores sob deploy assíncrono), o `RollbackManager` rebaixa a aplicação para a versão vN-1 e renderiza o componente estável sem produzir Tela Branca (*White Screen of Death*).

---

## 7. Internacionalização Bilíngue Nativa (pt-BR e en-US)

Em estrita consonância com a diretriz do usuário humano, 100% das interfaces do sistema (`Shell`, `Gerente`, `Capataz`, `Escritório`, `Fábrica`, `ADM CONSUBOV` e `@consubov/ui`) operam com suporte bilíngue integral.
- Centralizado no `APP_DICTIONARY` de `@consubov/contracts`.
- Cobertura de mais de 100 chaves semânticas estruturadas por namespace (`app.*`, `shell.*`, `auth.*`, `capataz.*`, `gerente.*`, `escritorio.*`, `fabrica.*`, `admin.*`, `update.*`).
- Certificado pelo `AST Literal Guard` que audita a AST TypeScript de todos os arquivos `.tsx` do monorepo, comprovando **zero strings literais soltas** no JSX.
