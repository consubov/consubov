# Documentação e Especificação Técnica: FASE 10 (Pós-Produção, Módulos Congelados & Expansões)

**Documento:** `docs/75-fase10-pos-producao-modulos-expansoes.md`  
**Fase do Projeto:** FASE 10 — Pós-produção & Expansões  
**Data-base:** 2026-10-14  
**Status:** ESPECIFICAÇÃO TÉCNICA E CONTRATOS CANÔNICOS (DEV LOCAL READY)  
**Branch:** `work/fase5-6-7-pwa-local` (PR #43 draft)  

---

## 1. Visão Geral e Diretrizes Arquiteturais

A **FASE 10** abrange os seis blocos de pós-produção e expansão mapeados no checklist histórico do projeto CONSUBOV. Conforme definido na governança arquitetural, estes blocos não concorrem com o núcleo operacional de campo (pesagens, manejos, fotos e sincronização offline-first das Fases 5 a 9), mas estabelecem **contratos formais, ports e adapters desacoplados** para viabilizar a evolução segura do sistema sem reescritas destrutivas.

### Princípios Inegociáveis da Fase 10:
1. **Preservação Visual e Funcional do Frontend**: Nenhuma tela ou componente de UI existente é modificado visualmente.
2. **Ports & Adapters (Hexagonal Architecture)**: Serviços de terceiros (IA, ERPs, equipamentos de hardware) comunicam-se exclusivamente através de interfaces abstratas (`Ports`), garantindo substituibilidade total e teste local sem dependência de APIs externas ou hardware físico.
3. **Hermetismo e Zero Conexões Remotas**: Nenhum tráfego para APIs de nuvem externas (Lovable AI, gateways de terceiros, Supabase remoto) é emitido em testes locais ou gates de qualidade.
4. **Resiliência e Fallback Fail-Closed**: Toda integração externa ou com periféricos possui estratégia de fallback automático documentada e testada.

---

## 2. Detalhamento dos Seis Blocos Canônicos

### 10.1 SyncVet (Módulo Veterinário Especializado)
- **Escopo e Domínio:** Módulo veterinário abrangendo controle reprodutivo (IATF, protocolos de sincronização, sêmen, partos, toque e diagnóstico de gestação), medicamentos e controle de estoque veterinário, agenda clínica e roteirização/trajetos de visitas a fazendas.
- **Inventário de Rotas e Páginas (23 páginas em `apps/web/src/pages/`):**
  - Rotas principais: `/syncvet/dashboard`, `/syncvet/fazendas`, `/syncvet/protocolos`, `/syncvet/semen`, `/syncvet/medicamentos`, `/syncvet/partos`, `/syncvet/trajetos`, `/syncvet/auditoria`.
  - Layout isolado: `SyncVetLayout.tsx` com navegação especializada e manifest próprio `public/manifest-syncvet.json`.
- **Auditoria Transacional:** Implementada em `apps/web/src/lib/syncvetAuditoria.ts`, registrando ações por empresa (`empresa_id`), usuário e equipe com captura passiva de geolocalização e sem bloqueio do fluxo principal em caso de falha.
- **Edge Functions Associadas:** `supabase/functions/syncvet-calcular-trajeto` e `syncvet-delete-equipe`.
- **Estratégia de Transição:** O módulo opera como subsistema desacoplado da rotina diária do capataz rural, compartilhando o cadastro de fazendas e animais quando associados ao mesmo tenant.

### 10.2 Relatto (Consultoria Zootécnica & Relatórios Profissionais)
- **Escopo e Domínio:** Plataforma de relatórios técnicos de visita para consultores zootécnicos e agrônomos (rotina, confinamento e fábrica de ração).
- **Componentes Centrais:**
  - Landing e apresentação: `RelattoLandingPage.tsx` e `RelattoDemoModal.tsx`.
  - Motores de geração de PDF local: `visitaPdf.ts`, `confinamentoPdf.ts` e `despesasPdf.ts`.
  - Manifest dedicado: `public/manifest-relatto.json`.
- **Integração de Dados:** Mapeamento de visitas técnicas estruturado em hierarquia de 4 níveis (`visitas_tecnicas` -> `pastos/currais` -> `avaliacoes` -> `fotos`).
- **Garantia de Privacidade:** Fotos e relatórios operam com geração de PDF puramente client-side via bibliotecas vetorizadas locais (`@react-pdf/renderer` e `jspdf`), sem expor dados a servidores de renderização externos.

### 10.3 Campanhas (Comunicação e Avisos a Pecuaristas)
- **Escopo e Domínio:** Módulo de comunicados gerenciais, alertas sanitários (vacinação de aftosa/brucelose), campanhas de pesagem e comunicados corporativos.
- **Diretrizes de Privacidade e LGPD:**
  - Comunicação estritamente baseada em consentimento explícito (opt-in registrado por pecuarista/produtor).
  - Isolamento rigoroso por organização/tenant contratante (`tenant_id`).
- **Desacoplamento de Provedor:** Todo envio de mensagens (Push, SMS, e-mail) deve transitar por adaptadores abstratos, com testes baseados em `InMemoryNotificationGateway` sem disparos reais.

### 10.4 Inteligência Artificial (IA) & Desacoplamento da Lovable AI
- **Diagnóstico da Implementação Atual:**
  - A Edge Function `supabase/functions/analisar-retiro/index.ts` utilizava acoplamento direto com o gateway Lovable AI (`LOVABLE_API_KEY`), representando um risco de vendor lock-in e quebra de hermetismo local.
- **Solução Arquitetural — `AIProviderPort`:**
  - Criação do port abstrato `AIProviderPort` em `apps/web/src/platform/contracts/aiProvider.ts`.
  - Criação de adaptadores intercambiáveis:
    1. `LocalMockAIProvider`: Provedor simulado in-memory para testes locais determinísticos, CI e modo offline/dry-run.
    2. `StandardHttpAIProvider`: Provedor HTTP compatível com qualquer modelo OpenAI/Claude/Gemini/Lovable via configuração segura de ambiente.
- **Governança e Proteção de Custos:**
  - Teto de contexto rígido: máximo de 8.000 caracteres no payload serializado (`MAX_CONTEXTO_CHARS`).
  - Higienização de PII: remoção preventiva de CPFs, telefones e nomes de funcionários antes do envio para modelos generativos.
  - Rate-limit local e fallback fail-closed (se a IA falhar ou estiver sem internet/chave, o sistema exibe resumo estático baseado em estatísticas descritivas sem travar o usuário).

### 10.5 Integrações Empresariais (ERPs, Fiscal e Webhooks)
- **Escopo e Domínio:** Exportação e importação de dados zootécnicos e contábeis com sistemas de gestão corporativa (ERP Totvs Agro, Senior, Sankhya, SAP) e órgãos fiscais/sanitários (GTA - Guia de Trânsito Animal).
- **Contratos Canônicos — `EnterpriseExportPort`:**
  - Criação de interfaces em `apps/web/src/platform/contracts/enterpriseExport.ts`.
  - Formatos canônicos padronizados: JSON estruturado com assinatura criptográfica SHA-256 e CSV tabular delimitado por ponto-e-vírgula (`pt-BR`).
  - Webhooks com chave de idempotência (`idempotency_key`) para notificações push seguras entre sistemas.

### 10.6 Dispositivos e Equipamentos (Balanças & Bastões RFID)
- **Escopo e Domínio:** Integração com balanças bovinas eletrônicas (Tru-Test, Coimma, Beckhauser, Datamars) e leitores de brinco eletrônico RFID/bastões via protocolos seriais e Bluetooth.
- **Princípio de Não-Intrusão:**
  - Presença de Web API (`navigator.bluetooth`, `navigator.serial`) NÃO implica hardware físico conectado nem homologação de campo.
  - Digitação manual no teclado/touch continua sempre como primeiro cidadão e fallback obrigatório ininterrupto.
- **Contratos Canônicos — `ScaleDevicePort`:**
  - Criação de interfaces em `apps/web/src/platform/contracts/scaleDevice.ts`.
  - Parsing determinístico de strings brutas seriais (filtros ASCII, extração de pesos estáveis em kg, rejeição de leituras espúrias ou oscilações de pesagem com animais em movimento).

---

## 3. Matriz de Verificação da Fase 10

| Bloco | Item / Capacidade | Teste de Verificação | Critério de Aceite |
| :--- | :--- | :--- | :--- |
| **10.1** | SyncVet: Auditoria e Trajetos | `phase10-syncvet-domain.test.mjs` | Registro não-bloqueante, cache de equipe e GPS passivo |
| **10.2** | Relatto: Contratos & PDF | `phase10-contracts-integrity.test.mjs` | Tipagem e estrutura de visitas zootécnicas |
| **10.3** | Campanhas: Consentimento LGPD | `phase10-contracts-integrity.test.mjs` | Tenant boundary, opt-in obrigatório e isolamento |
| **10.4** | IA: `AIProviderPort` & Fallback | `phase10-ai-provider.test.mjs` | Teto de 8.000 chars, zero HTTP externo e mock determinístico |
| **10.5** | ERPs & Webhooks: Exportações | `phase10-contracts-integrity.test.mjs` | Schemas CSV/JSON, SHA-256 digest e idempotência |
| **10.6** | Balanças & RFID: `ScaleDevicePort` | `phase10-scale-device.test.mjs` | Parsing Tru-Test/Coimma, fallback manual e 0 travas |

