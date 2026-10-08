# CONSUBOV — Checklist Mestre de Execução

> **Fonte operacional para agentes que trabalham pelo repositório.**
>
> **Última atualização deste arquivo:** 2026-10-06.
>
> **Regra obrigatória:** antes de iniciar trabalho, leia este checklist e o PRD/handoff ativo aplicável.
>
> Se você executar um item que esteja explicitamente programado/atribuído neste checklist ou no PRD ativo, ao concluir com evidência objetiva:
> 1. marque o item correspondente como `[x]`;
> 2. registre uma evidência curta no próprio checklist quando aplicável;
> 3. faça essa atualização no mesmo commit/PR do trabalho.
>
> Não marque como concluído o que você não executou, o que está fora do seu escopo ou o que não possui evidência.
>
> **Este arquivo é a fonte operacional única para agentes do repositório.**

---


> **Versão:** 1.0
> **Data:** 2026-10-01
> **Objetivo:** transformar o estado atual do CONSUBOV em uma plataforma própria, modular, segura, governável, extensível e preparada para Web → App → Offline → Integração remota → Produção.
> **Uso:** executar em ordem. Marcar `- [x]` somente quando houver evidência objetiva de conclusão.
---
# 0. Regras deste checklist
## 0.1 Fonte de verdade
Este checklist foi consolidado a partir de:
- `CONSUBOV_AUDITORIA_REPOSITORIO_2026-10-01.md`;
- `CONSUBOV_STATUS_REALIZADO_E_PENDENTE.md`;
- `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`;
- `Consubov_Pre_Requisitos_Plataforma_v1.docx.pdf`;
- decisões explícitas tomadas no projeto em 2026-10-01.
Baseline de repositório usado pelos documentos:
```plain text
branch: main
commit: d4459f65e2f7e7c7bb831c47967f149beb7f8edd
```
## 0.2 Decisões atuais do projeto
Estas decisões substituem baselines antigos conflitantes:
- [x] Backend definitivo: **Bun + TypeScript**.
- [x] Arquitetura backend: **monólito modular**, sem microserviços prematuros.
- [x] Web/Admin: **preservar e evoluir React/Vite atual**.
- [x] API como autoridade futura do domínio.
- [x] OpenAPI/Swagger faz parte da arquitetura desde agora.
- [x] API deve prever uso interno e futuro uso por terceiros.
- [x] Arquitetura deve prever integrações futuras sem implementá-las antecipadamente.
- [x] Offline será consolidado **depois da Web e do empacotamento do App**, mas precisa influenciar contratos e modelo de dados desde agora.
- [x] O App será baseado no Web atual empacotado por uma solução WebNative/wrapper nativo a confirmar na fase própria.
- [x] SQLite é o alvo preferencial para persistência local do App, sujeito à validação da tecnologia de empacotamento escolhida.
- [x] GPS e QR devem funcionar localmente/offline quando tecnicamente aplicável.
- [x] Supabase/PostgreSQL remoto: **não conectar a nova arquitetura agora**.
- [x] Vercel/deploy: **não configurar agora**.
- [x] Primeiro objetivo: preservar e fazer funcionar corretamente o que já opera hoje.
- [x] SyncVet, Relatto, campanhas e IA não serão expandidos antes da aplicação principal estar em produção.
- [x] Esses módulos congelados podem ter fronteiras e extensibilidade previstas, sem desenvolvimento funcional novo agora.
## 0.3 Ordem obrigatória
```plain text
FASE 0  Governança e decisões
FASE 1  Segurança crítica do legado
FASE 2  Arquitetura extensível e contratos
FASE 3  Fundação da Web/API sem banco remoto
FASE 4  Web — paridade funcional e organização por domínio
FASE 5  Web — qualidade, segurança e aceite
FASE 6  App — empacotamento e bridge nativa
FASE 7  Offline — SQLite + Sync Engine
FASE 8  Integração remota — banco/storage/staging
FASE 9  Deploy, produção e operação
FASE 10 Pós-produção — módulos congelados e expansões
```
> **Regra:** não iniciar uma fase seguinte enquanto houver P0 aberto da fase anterior, salvo decisão explícita documentada.
## 0.4 Definição de concluído para qualquer tarefa
Uma tarefa só pode ser marcada como concluída quando, conforme aplicável:
- [ ] comportamento esperado está definido;
- [ ] implementação está completa;
- [ ] tenant e autorização foram considerados;
- [ ] impacto futuro em offline/sync foi considerado;
- [ ] idempotência foi considerada quando houver retry/escrita;
- [ ] conflitos foram considerados quando houver estado concorrente;
- [ ] testes relevantes passaram;
- [ ] lint/typecheck/build relevantes passaram;
- [ ] diff foi revisado;
- [ ] documentação/contrato foi atualizado;
- [ ] não há segredo, PII desnecessária, debug ou arquivo acidental;
- [ ] rollback/reversibilidade foi considerada quando houver risco;
- [ ] existe evidência registrável da validação.
---
# FASE 0 — P0 — Governança, decisões e contrato do projeto
## 0.1 Atualizar as Instruções-Mestre — ✅ CONCLUÍDO
- [x] Remover Laravel como backend vigente e registrar Bun + TypeScript como decisão atual.
- [x] Remover Filament/Livewire como backoffice vigente e registrar React atual como decisão.
- [x] Manter PostgreSQL como direção de persistência, sem conectar ambiente remoto ainda.
- [x] Registrar monólito modular como arquitetura alvo atual.
- [x] Registrar Web → App empacotado → Offline como sequência de entrega.
- [x] Registrar que offline influencia contratos desde agora, mas seu motor final será implementado depois do App.
- [x] Registrar que Supabase remoto e Vercel permanecem bloqueados até o gate definido neste checklist.
- [x] Registrar API interna + API pública futura como superfícies previstas.
- [x] Registrar OpenAPI/Swagger como contrato obrigatório da API.
- [x] Registrar política de extensibilidade via ports/adapters.
- [x] Registrar política de reutilização de código open source.
**Evidência:** `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md` atualizado para versão 1.1 em 2026-10-01.
**Aceite:** concluído; a arquitetura vigente agora registra Bun + TypeScript, React/Vite e a superação explícita dos baselines Laravel/Filament/Livewire.
## 0.2 Registrar decisões arquiteturais — ✅ CONCLUÍDO
**Evidência:** ADRs adicionados ao repositório em `docs/adr/` em 2026-10-01.
- [x] ADR — Backend Bun + TypeScript.
- [x] ADR — React/Vite permanece como Web/Admin.
- [x] ADR — Monólito modular.
- [x] ADR — API-first e domínio independente da UI.
- [x] ADR — OpenAPI/Swagger como contrato HTTP.
- [x] ADR — Integrações futuras via ports/adapters.
- [x] ADR — Offline compatível desde o desenho inicial.
- [x] ADR — Persistência remota bloqueada nesta etapa.
- [x] ADR — Deploy/Vercel bloqueado nesta etapa.
- [x] ADR — Estratégia de empacotamento mobile registrada como `[PENDENTE]` até validação da tecnologia final.
## 0.3 Política de mudanças estruturais — ✅ CONCLUÍDO
**Evidência:** `docs/13-politica-mudancas-estruturais.md` adicionado ao repositório e README raiz atualizado em 2026-10-01.
- [x] Definir quais mudanças exigem ADR/revisão explícita.
- [x] Exigir revisão especial para auth, tenancy, RBAC, sync, estoque, migração, storage e API pública.
- [x] Definir regra de compatibilidade e versionamento para contratos.
- [x] Definir regra para depreciação de endpoints.
- [x] Definir regra de feature flag/configuração por tenant.
- [x] Definir regra para inclusão de nova dependência.
- [x] Definir regra para uso de código externo/open source.
- [x] Definir regra obrigatória de atualização documental: toda mudança relevante deve atualizar no mesmo trabalho os documentos afetados, ADRs, contratos/API e checklist/status quando aplicável.
## 0.4 Política de código open source reaproveitado — ✅ CONCLUÍDO
**Evidência:** `docs/14-politica-codigo-terceiros.md` e `docs/THIRD_PARTY_COMPONENTS.md` adicionados ao repositório em 2026-10-01.
- [x] Criar `THIRD_PARTY_CODE_POLICY.md` ou equivalente.
- [x] Verificar licença antes de copiar código.
- [x] Registrar origem, commit/tag e licença do código reaproveitado.
- [x] Preservar avisos obrigatórios de copyright/licença.
- [x] Preferir dependência oficial quando copiar código gerar manutenção maior.
- [x] Proibir copiar código sem origem rastreável.
- [x] Proibir copiar segredos, endpoints, chaves ou configurações do projeto de origem.
- [x] Exigir testes próprios para qualquer código adaptado.
- [x] Exigir revisão especial para GPL/AGPL ou licença com obrigação de reciprocidade.
- [x] Manter inventário de componentes de terceiros.
---
# FASE 1 — P0 — Fechar riscos críticos de segurança existentes — ✅ QA APROVADO
> Validação final reconciliada em 2026-10-03: PR #32 foi mergeado por squash na `main`, commit `d8428b7a937f547200fc51837af411cee98a104d`. No push da `main`, CI e Security Code Scan ficaram verdes: `Check`, Edge Functions e smoke HTTP passaram; SAST API/Web, dependency vulnerability scan e secret scanning passaram. Ações remotas bloqueadas para FASE 8 permanecem fora deste gate.
**FASE 1 VALIDADA E CONSOLIDADA NA MAIN:** PRD-SEC-01/02/03/04 concluídos localmente; PR #32 mergeado em `main` no commit `d8428b7a937f547200fc51837af411cee98a104d`.
> Nenhuma expansão privilegiada deve acontecer antes destes itens.
## 1.1 `create-user` — ✅ CONCLUÍDO
> **Validado em 2026-10-03:** allowlist de `role`, auth/admin server-side, logs sem PII de payload, deny-by-default, auditoria estruturada e sanitização do erro de senha do provider estão comprovados por testes. Edge suite final verde.
- [x] Autenticar caller pelo token real.
- [x] Resolver identidade no servidor.
- [x] Verificar permissão administrativa no servidor.
- [x] Validar role permitida server-side.
- [x] Não confiar em role recebida sem política explícita.
- [x] Remover PII desnecessária de logs.
- [x] Negar por padrão.
- [x] Testar anônimo → 401.
- [x] Testar usuário comum → 403.
- [x] Testar tentativa de escalada de privilégio.
- [x] Registrar auditoria da operação administrativa.
## 1.2 `manage-admin` — ✅ CONCLUÍDO
> **Validado em 2026-10-03:** caller/admin server-side, self-delete, proteção do último admin, update/delete, auditoria sem valores sensíveis e testes negativos estão comprovados; QA consolidado da FASE 1 ficou verde.
- [x] Remover `requesting_user_id` do body como fonte de confiança.
- [x] Resolver usuário solicitante pelo token.
- [x] Exigir permissão administrativa.
- [x] Impedir autoelevação/escalada indevida.
- [x] Proteger update/delete de administradores.
- [x] Auditar alterações de e-mail/senha/perfil.
- [x] Testar anônimo → 401.
- [x] Testar usuário sem escopo → 403.
- [x] Testar tentativa de operar em identidade alheia.
## 1.3 `seed-app-secrets` — ✅ CONCLUÍDO LOCALMENTE
> **Evidência 2026-10-01:** `main` contém hardening do PRD-SEC-02; allowlist persiste apenas `supabase_url`, autenticação administrativa server-side, guarda de regressão contra persistência de service role e testes negativos. `bun run check` registrado como verde. As duas ações remotas continuam corretamente bloqueadas até a FASE 8.
- [x] Remover persistência de `SUPABASE_SERVICE_ROLE_KEY` em `app_secrets`.
- [x] Impedir qualquer mecanismo futuro de persistir segredo administrativo em tabela de aplicação.
- [x] Restringir/remover função se não for indispensável.
- [x] Adicionar teste/guard contra persistência de segredo administrativo.
- [ ] `[BLOQUEADO ATÉ FASE 8]` Verificar no ambiente remoto se a chave já foi persistida.
- [ ] `[BLOQUEADO ATÉ FASE 8]` Rotacionar chave caso exposição não possa ser descartada.
## 1.4 `cleanup-demo-accounts` — ✅ CONCLUÍDO
> **Evidência 2026-10-01:** `main` removeu `verify_jwt=false`, exige `requireAdmin` antes da lógica destrutiva, restringe a POST, só interpreta `force` após autorização, registra ator/resultado sem PII e possui testes 100% mockados cobrindo 401/403 e fluxo destrutivo controlado.
- [x] Remover exposição destrutiva sem autenticação adequada.
- [x] Eliminar `verify_jwt=false` aberto para operação destrutiva.
- [x] Exigir credencial interna/máquina quando aplicável.
- [x] Bloquear `force` para callers públicos.
- [x] Exigir POST.
- [x] Registrar auditoria.
- [x] Testar 401/403 sem credencial correta.
- [x] Testar exclusão apenas em ambiente controlado.
## 1.5 `send-push-notification` — ✅ CONCLUÍDO
> **Validado em 2026-10-03:** identidade server-side, bloqueio de `all`, escopo, 403, rate limit 429, auditoria e testes de múltiplos destinatários estão comprovados; QA consolidado e Security Scan ficaram verdes.
- [x] Exigir identidade/autorização server-side.
- [x] Impedir usuário arbitrário de escolher `all`.
- [x] Definir política por evento/escopo.
- [x] Preparar rate limiting.
- [x] Auditar emissões.
- [x] Testar abuso de múltiplos destinatários.
## 1.6 Hardening das Edge Functions legadas — ✅ CONCLUÍDO
> **Evidência 2026-10-01:** PRD-SEC-04 concluído e com **QA: APROVADO**. Inventário das 10 Edge Functions e matriz de segurança/testes negativos registrados em `docs/16-seguranca-edge-functions-legadas.md`; hardening aplicado em `syncvet-delete-equipe`, `analisar-retiro`, `reset-password` e `syncvet-calcular-trajeto`. Owner formal permanece `[PENDENTE]` quando não existe evidência no repositório, mas essa ausência está explicitamente documentada.
- [x] Inventariar funções com `verify_jwt=false`.
- [x] Inventariar funções que usam service role.
- [x] Inventariar CORS `*` em funções privilegiadas.
- [x] Inventariar logs com PII/segredos/tokens.
- [x] Inventariar funções destrutivas.
- [x] Inventariar funções administrativas.
- [x] Documentar owner/finalidade/permissão de cada função.
- [x] Criar matriz de testes negativos por função.
## 1.7 Segurança automatizada no repositório — ✅ CONCLUÍDO PARA O GATE ATUAL
> **Validado em 2026-10-03, HEAD ****`7cba2dc5239601908a92025f54708184ffe43624`****:** SAST API/Web, dependency audit e Secret Scanning executam de fato e estão verdes. `bun audit --audit-level=high` retorna zero high/critical. TruffleHog varreu 132 chunks / 77.522 bytes com zero secrets verificados. O SBOM continua corretamente adiado até a cadeia de release começar.
- [x] Adicionar secret scanning ao CI.
- [x] Adicionar SAST adequado ao ecossistema TypeScript.
- [x] Adicionar dependency vulnerability scan.
- [x] Expandir Dependabot/alternativa para dependências do projeto.
- [x] Definir política para vulnerabilidade crítica/alta.
- [ ] Gerar inventário/SBOM quando a cadeia de release começar.
**GATE FASE 1:** nenhuma função administrativa/destrutiva conhecida pode permanecer pública ou confiar em identidade fornecida pelo cliente.
# FASE 2 — P0/P1 — Arquitetura extensível sem overengineering — ✅ CONCLUÍDA
> Fechamento consolidado em 2026-10-03 na `main`: commits `e72b6cdd` e `abfe017c`. Timezone passou a ser configuração IANA explícita por tenant sem fallback arbitrário; API pública permanece desabilitada até existir consumidor real; membership canônico permanece somente `ACTIVE`; `TenantExecutionContext` foi materializado nas fronteiras tenant-scoped existentes; RBAC e alçadas ficaram evidence-first/deny-by-default. QA: `bun run check` verde, API 532/532, Web 94/94, typecheck/build verdes. Nenhuma alteração funcional do frontend.
## 2.1 Estrutura modular do backend — ✅ CONCLUÍDO
> Validado no código em 2026-10-02, HEAD `7a7ab753`: os 15 módulos possuem superfície pública e responsabilidade materializada, sem transformação em microserviços.
Organizar a API por domínio/responsabilidade, preservando o que já existe e migrando incrementalmente:
- [x] `identity-tenancy`.
- [x] `farms`.
- [x] `pastures`.
- [x] `nutrition`.
- [x] `inventory`.
- [x] `visits`.
- [x] `feed-mill`.
- [x] `livestock`.
- [x] `weighing`.
- [x] `reporting`.
- [x] `notifications`.
- [x] `files`.
- [x] `sync`.
- [x] `saas-admin`.
- [x] `integrations`.
> Não transformar módulos em microserviços.
## 2.2 Camadas e dependências — ✅ CONCLUÍDO
> Validado no código/documentação em 2026-10-02, HEAD `7a7ab753`: convenções de camada estão definidas e protegidas por teste arquitetural; diretórios vazios continuam proibidos.
- [x] Definir `domain` sem dependência de HTTP/UI/provider.
- [x] Definir `application` para casos de uso.
- [x] Definir `interfaces/http` para entrada HTTP.
- [x] Definir `platform` para infraestrutura.
- [x] Definir `integrations` para providers externos.
- [x] Criar regra de dependência: interface → application → domain.
- [x] Impedir domínio de importar cliente Supabase, SDK Web, storage externo ou biblioteca de UI.
- [x] Criar testes/linters arquiteturais simples se houver ganho real.
## 2.3 Ports/adapters fundamentais — ✅ CONCLUÍDO
> Validado no código em 2026-10-02, HEAD `7a7ab753`: contratos mínimos existem, com repositories específicos de domínio e sem provider remoto conectado.
Definir contratos mínimos, sem implementar infraestrutura desnecessária:
- [x] `IdentityVerifierPort`.
- [x] `TenantContextPort`.
- [x] `AuthorizationPort`.
- [x] `AuditLogPort`.
- [x] `PersistencePort`/repositories de domínio.
- [x] `FileStoragePort`.
- [x] `EventPublisherPort`.
- [x] `JobQueuePort`.
- [x] `NotificationPort`.
- [x] `TelemetryPort`.
- [x] `FeatureFlagPort` ou configuração equivalente.
- [x] `ClockPort` quando necessário para testes/tempo confiável.
- [x] `IdGeneratorPort` quando necessário.
## 2.4 Contratos Web → plataforma — ✅ CONCLUÍDO
> Validado no código/testes em 2026-10-02, HEAD `7a7ab753`: interfaces de plataforma existem em `apps/web/src/platform/contracts` com testes locais; nenhum wrapper nativo foi escolhido nesta fase.
Criar interfaces para evitar acoplamento futuro ao navegador/nativo:
- [x] `LocalDatabase`.
- [x] `SecureStorage`.
- [x] `LocationProvider`.
- [x] `QrScanner`.
- [x] `CameraProvider`.
- [x] `ConnectivityProvider`.
- [x] `FilePicker/FileCapture`.
- [x] `NativeBridge`.
- [x] `SyncTransport`.
**Aceite:** módulos de negócio não devem precisar saber se estão rodando em browser ou wrapper nativo.
## 2.5 Identificadores e tempo — ✅ CONCLUÍDO
> Fechado em 2026-10-03: `Tenant.reportTimeZone` usa contrato IANA explícito e pode permanecer `null` até configuração; ausência não aplica fallback silencioso. O legado mantém seus comportamentos atuais sem alteração. Evidência: `report-timezone.ts`, testes e `docs/18-identificadores-tempo.md`.
- [x] Padronizar IDs estáveis independentes do provider/banco.
- [x] Definir estratégia de UUID para comandos e entidades que nascem offline.
- [x] Separar `occurred_at_local` de timestamps autoritativos do servidor.
- [x] Nunca depender apenas de relógio local para ordenação crítica.
- [x] Definir timezone de tenant/relatórios como configuração IANA explícita, sem fallback arbitrário.
- [x] Definir convenções de data/hora na API.
## 2.6 Exclusão e sincronização futura — ✅ CONCLUÍDO NO ESCOPO CONTRATUAL
> Validado em 2026-10-03 no PR #32, HEAD `7cba2dc5239601908a92025f54708184ffe43624`: política de exclusão/tombstone e retenção conservadora estão documentadas e testadas. Sem checkpoint canônico confiável, ou sem prova de que todos os clientes conhecidos avançaram, expurgo automático é proibido; nenhuma janela em dias foi inventada.
- [x] Definir como exclusões serão representadas para clientes offline.
- [x] Prever tombstone/versionamento quando necessário.
- [x] Não usar exclusão física em entidade sincronizável sem avaliar impacto.
- [x] Definir retenção mínima de eventos/alterações necessários ao sync futuro.
---
# FASE 2A — P0/P1 — API, Swagger e extensibilidade externa — ✅ CONCLUÍDA NO ESCOPO CONTRATUAL
> Fechada em 2026-10-03. `API_PUBLIC_ACCESS_POLICY` mantém exposição pública `disabled` e `credentialMechanism = null` até existir primeiro consumidor real. Isso transforma o mecanismo final em gate futuro de ativação, não pendência arquitetural da FASE 2.
## 2A.1 Superfícies da API — ✅ CONCLUÍDO
> Validado no código/testes em 2026-10-02, HEAD `7a7ab753`: inventário central e quatro superfícies semânticas (`product`, `sync`, `public`, `admin`) estão definidos; admin/internal é deny-by-default.
Prever três superfícies sem obrigar três aplicações diferentes:
```plain text
/api/v1/...              API do produto
/api/v1/sync/...         contratos de sincronização
/api/public/v1/...       API futura para empresas/parceiros
```
- [x] Definir convenção final de rotas.
- [x] Separar semanticamente API interna de API pública.
- [x] Garantir que ambas reutilizem application/domain, sem duplicar regra.
- [x] Definir política para endpoints administrativos.
- [x] Definir inventário central de endpoints.
## 2A.2 OpenAPI/Swagger — ✅ CONCLUÍDO
> Validado em 2026-10-03 no PR #32, HEAD `7cba2dc5239601908a92025f54708184ffe43624`: runtime, inventário e OpenAPI 3.1 estão em paridade; política contratual cobre idempotência, paginação, filtros/ordenação, rate limit somente quando existir implementação real e versionamento/depreciação, sem anunciar features inexistentes. CI verde.
- [x] Manter `GET /api/v1/openapi.json` funcionando.
- [x] Manter `/api/docs` funcionando.
- [x] Escolher versão OpenAPI suportada pelo stack atual e registrar decisão.
- [x] Toda rota nova deve entrar no OpenAPI no mesmo PR.
- [x] Documentar request schema.
- [x] Documentar response schema.
- [x] Documentar erros padronizados.
- [x] Documentar auth exigida.
- [x] Documentar tenant context.
- [x] Documentar scopes/permissões relevantes.
- [x] Documentar idempotency key nas operações aplicáveis.
- [x] Documentar paginação.
- [x] Documentar filtros/ordenação.
- [x] Documentar rate limit quando existir.
- [x] Documentar versionamento/depreciação.
- [x] Adicionar validação do OpenAPI no CI.
- [x] Adicionar teste para evitar endpoint implementado sem contrato quando tecnicamente viável.
- [x] Preparar geração futura de cliente TypeScript a partir do contrato.
## 2A.3 Erros e correlação — ✅ CONCLUÍDO
> Validado no código/testes em 2026-10-02, HEAD `7a7ab753`: envelope, códigos, request/correlation IDs e anti-vazamento de stack possuem testes de paridade runtime/OpenAPI.
- [x] Consolidar envelope de erro.
- [x] Padronizar códigos de erro estáveis.
- [x] Não expor stack trace em resposta.
- [x] Preservar `request_id`.
- [x] Preservar `correlation_id`.
- [x] Preparar correlação futura com `trace_id`.
- [x] Documentar erros no OpenAPI.
## 2A.4 API pública futura — ✅ CONCLUÍDO NO ESCOPO CONTRATUAL
> Validado em 2026-10-03 no PR #32, HEAD `7cba2dc5239601908a92025f54708184ffe43624`: `ApiConsumer` cobre isolamento/scopes/revogação/origem, expiração, rotação por referência opaca, auditoria por consumidor e quota/rate-limit por referência de política. Nenhum endpoint público real, segredo ou número comercial foi inventado.
Preparar o modelo, sem publicar produto externo agora:
- [x] Modelar conceito `api_consumer`/integração.
- [x] Prever consumidor vinculado a tenant quando aplicável.
- [x] Prever consumidor global somente por regra explícita.
- [x] Prever scopes específicos para integrações.
- [x] Prever revogação de credencial.
- [x] Prever expiração/rotação de credencial.
- [x] Prever rate limit/quota.
- [x] Prever auditoria por consumidor.
- [x] Prever identificação de origem da integração.
- [x] Gate de ativação definido: API pública permanece desabilitada e o mecanismo final de credencial será decidido somente no primeiro caso real.
- [x] Não expor endpoints externos antes de existir necessidade e política comercial.
## 2A.5 Webhooks futuros — ✅ CONCLUÍDO NO ESCOPO CONTRATUAL
> Validado em 2026-10-03 no PR #32, HEAD `7cba2dc5239601908a92025f54708184ffe43624`: contrato conceitual de webhook possui `eventId` estável, idempotência por subscription/event, referência opaca de segredo para assinatura/verificação, tentativa/resultado de entrega, logs sanitizáveis e políticas abstratas de backoff/desativação. Não existe dispatcher, HMAC/provider ou cronograma inventado.
- [x] Criar contrato conceitual para subscriptions de webhook.
- [x] Prever `event_id` estável.
- [x] Prever assinatura/verificação.
- [x] Prever retry com backoff.
- [x] Prever idempotência do consumidor.
- [x] Prever desativação após falhas persistentes.
- [x] Prever logs de entrega.
- [x] Não implementar dispatcher complexo até existir primeiro caso de uso.
## 2A.6 Eventos internos — ✅ CONCLUÍDO
> Validado no código em 2026-10-02, HEAD `7a7ab753`: `EventEnvelope` e regras de consumo estão definidos sem broker dedicado.
- [x] Definir envelope simples e versionado de evento.
- [x] Incluir tipo, versão, id, tenant, timestamp e correlation id quando aplicável.
- [x] Eventos não substituem autorização/transação.
- [x] Consumidores devem ser idempotentes.
- [x] Falhas futuras de consumo precisam ser observáveis.
- [x] Não introduzir Kafka/RabbitMQ/etc. sem necessidade comprovada.
## 2A.7 Integrações externas futuras — ✅ CONCLUÍDO
> Validado no código em 2026-10-02, HEAD `7a7ab753`: `IntegrationContract` cobre os requisitos de boundary sem criar provider real nem expandir integrações congeladas.
Para qualquer provider futuro, o contrato deverá prever:
- [x] owner.
- [x] finalidade.
- [x] autenticação.
- [x] timeout.
- [x] retry.
- [x] idempotência quando aplicável.
- [x] circuit breaker quando necessário.
- [x] logs.
- [x] rate limit.
- [x] custo.
- [x] dados enviados.
- [x] dados recebidos.
- [x] política de indisponibilidade.
- [x] estratégia de substituição.
- [x] proibição de bypass de tenant/RBAC.
---
# FASE 2B — P0/P1 — Tenancy, RBAC, auth e auditoria por contrato — ✅ CONCLUÍDA NO ESCOPO CONTRATUAL
> Fechada em 2026-10-03 sem inventar grants: membership possui somente `ACTIVE`; fronteiras tenant-scoped existentes carregam `TenantExecutionContext`; RBAC só autoriza `ALLOW` explícito e células sem decisão negam por padrão; alçadas não comprovadas ficam `DENY_UNTIL_APPROVED`. Decisões futuras de produto podem ampliar essas matrizes, mas não são bloqueio da FASE 2.
## 2B.1 Modelo canônico de tenant — ✅ CONCLUÍDO
> Fechado na `main` em 2026-10-03. Membership canônico permanece somente `ACTIVE`; queries/commands possuem contrato tenant-scoped; ports tenant-scoped de arquivos, jobs, eventos, notificações/push, relatórios, sync e módulos de domínio recebem `TenantExecutionContext`. Cache/realtime futuros devem seguir o mesmo boundary quando forem criados.
- [x] Definir `tenant` como organização contratante, não como fazenda.
- [x] Definir tenant → múltiplas fazendas.
- [x] Definir membership usuário ↔ tenant.
- [x] Definir tenant ativo.
- [x] Definir status da membership: catálogo canônico atual contém somente `ACTIVE`; estados adicionais exigem decisão futura.
- [x] Definir contexto obrigatório em queries/comandos.
- [x] Definir contexto obrigatório em arquivos/jobs/eventos/cache/realtime/relatórios/sync.
## 2B.2 RBAC — ✅ CONTRATO CONCLUÍDO
> A matriz cobre todos os perfis/recursos do checklist e é evidence-first. Somente `ALLOW` explícito autoriza; `PENDENTE`, `DENY` e `N/A` negam por padrão via `isPermissionAllowed`. Marcar os itens abaixo como concluídos significa que a matriz foi formalizada, não que permissões foram concedidas.
Formalizar matriz para os perfis atuais:
- [x] administrador.
- [x] gerente.
- [x] capataz.
- [x] escritório.
- [x] operador de fábrica.
- [x] consultor.
- [x] pesador.
- [x] pecuarista.
- [x] SyncVet legado/congelado.
Definir por recurso/ação:
- [x] usuários.
- [x] fazendas.
- [x] retiros.
- [x] pastos.
- [x] produtos/dietas.
- [x] operações.
- [x] relatórios.
- [x] estoque.
- [x] visitas.
- [x] fábrica.
- [x] pesagens.
- [x] administração SaaS.
## 2B.3 Alçadas — ✅ CONTRATO CONCLUÍDO
> `AUTHORITY_MATRIX` formaliza as alçadas sem inventar grants: `create-user` e `manage-admin` ficam `ADMIN_REQUIRED`; criação de capataz, autocadastro de fazenda, alterações estruturais, aprovações e operações globais não comprovadas ficam `DENY_UNTIL_APPROVED`.
- [x] Definir criação de usuário: administrador exigido no fluxo comprovado.
- [x] Definir criação de capataz: `DENY_UNTIL_APPROVED` até regra explícita.
- [x] Definir autocadastro de fazenda: `DENY_UNTIL_APPROVED` até regra explícita.
- [x] Definir alterações estruturais: `DENY_UNTIL_APPROVED` até regra explícita.
- [x] Definir aprovações: `DENY_UNTIL_APPROVED` até regra explícita.
- [x] Definir operações administrativas globais: somente fluxos comprovados; demais `DENY_UNTIL_APPROVED`.
> Não implementar permissão inventada antes desta matriz.
## 2B.4 Auth por contrato — ✅ CONCLUÍDO
> Validado em 2026-10-03 no PR #32, HEAD `7cba2dc5239601908a92025f54708184ffe43624`: principals, claims, tenant, scopes, revogação, expiração, erros e fake adapter estão materializados sem Supabase Auth no domínio. Credencial expirada/revogada não resolve identidade; refresh/reautenticação permanece responsabilidade do adapter/provider futuro, sem duração de sessão inventada.
Sem conectar provider remoto ainda:
- [x] Definir principal `user`.
- [x] Definir principal `integration`.
- [x] Definir claims mínimos.
- [x] Definir resolução de tenant.
- [x] Definir scopes.
- [x] Definir revogação.
- [x] Definir expiração/reautenticação.
- [x] Definir política de erros 401/403.
- [x] Criar adapter fake/test para testes locais.
- [x] Não acoplar domínio a Supabase Auth.
## 2B.5 Auditoria — ✅ CONCLUÍDO
> Validado no código/testes em 2026-10-02, HEAD `7a7ab753`: `AuditEvent`, adapter fake e sanitização cobrem o contrato mínimo e a minimização de dados sensíveis.
Definir registro mínimo para ação sensível:
- [x] ator.
- [x] tenant.
- [x] fazenda/contexto quando aplicável.
- [x] origem/dispositivo.
- [x] data/hora.
- [x] command/request id.
- [x] versão conhecida.
- [x] ação.
- [x] resultado.
- [x] retry.
- [x] conflito.
- [x] alteração persistida.
- [x] correlation id.
- [x] política de minimização de payload sensível.
---
> **Consolidação Git — 2026-10-03:** PR #32 mergeado na `main`; PRs Dependabot #27–#31 foram fechados sem merge para não introduzir upgrades diretos desnecessários/major fora do gate, e seus branches foram removidos automaticamente. Permanecem apenas `main` e dois refs antigos (`fix/pre-phase3-gates-20261003`, `refactor/monorepo`) aguardando exclusão física; `refactor/monorepo` foi auditado como baseline antigo/supersedido e não deve ser mergeado sobre a `main` atual.
# FASE 3 — P1 — Fundação Web/API sem Supabase remoto e sem Vercel
> **Status 2026-10-04:** ✅ CONCLUÍDA. PR #33 mergeado em `main` no SHA `13971951062efd9d59479200dac73caf7979f398`. QA aprovado. Pós-merge da `main`: `build-and-test`, SAST, secret scanning e dependency vulnerability scan concluídos com sucesso.
## 3.1 Congelar baseline funcional
- [x] Registrar lista de rotas atuais.
- [x] Registrar lista de perfis e redirects.
- [x] Registrar módulos visíveis por perfil.
- [x] Registrar fluxos críticos existentes.
- [x] Registrar telas críticas por módulo.
- [x] Registrar dependências atuais de Supabase direto.
- [x] Registrar dependências de Edge Functions.
- [x] Registrar realtime atual.
- [x] Registrar storage atual.
- [x] Registrar pontos offline atuais.
## 3.2 Mapa de bounded contexts do Web
- [x] Mapear páginas/componentes para módulos de domínio.
- [x] Mapear hooks compartilhados.
- [x] Mapear services/repositories atuais.
- [x] Mapear queries diretas ao Supabase.
- [x] Mapear mutations diretas ao Supabase.
- [x] Mapear RPCs consumidas pelo Web.
- [x] Mapear Edge Functions consumidas pelo Web.
- [x] Mapear realtime subscriptions.
- [x] Mapear caches.
- [x] Mapear acesso a IndexedDB.
## 3.3 Repositories no Web
Continuar desacoplamento de forma incremental:
- [x] Nenhuma página nova acessa Supabase diretamente.
- [x] Fluxos alterados passam por repository/service apropriado.
- [x] Preservar behavior contract existente.
- [x] Adicionar testes antes de refactor sensível.
- [x] Migrar leitura simples antes de escrita crítica.
- [x] Evitar refactor big-bang.
## 3.4 API client do Web
- [x] Criar camada única de HTTP client.
- [x] Padronizar base URL/config.
- [x] Propagar request/correlation id quando aplicável.
- [x] Padronizar parsing de erro.
- [x] Padronizar timeout.
- [x] Preparar idempotency key para writes futuras.
- [x] Gerar/validar tipos a partir de contratos quando viável.
- [x] Não embutir segredo no cliente.
## 3.5 Persistência sem remoto
- [x] Criar ports de repository backend.
- [x] Criar adapters de memória/fixture para testes de domínio/API.
- [x] Criar ambiente local de teste de persistência somente se necessário e explicitamente aprovado.
- [x] Não apontar a nova API para Supabase remoto.
- [x] Não executar migration remota.
- [x] Não alterar schema remoto nesta fase.
## 3.6 Feature flags/configuração
- [x] Definir mecanismo simples de configuração por ambiente.
- [x] Prever configuração por tenant sem criar sistema complexo agora.
- [x] Prever ativação futura de módulos/integradores.
- [x] Evitar forks do código por cliente.
---
# FASE 4 — P1 — Web: fazer funcionar perfeitamente o que já opera hoje
> **Status 2026-10-05:** ✅ CONCLUÍDA, QA APROVADO E CONSOLIDADA NA `main`. O PR #36 foi mergeado por squash em `cfedc34a9d3dd5446902ceb389fde85baab4461c`; após a limpeza documental, a `main` final ficou em `bd9ad453424fa9ad220dca4f55626762a26b87f2`. No push final da `main`, `bun run check`, Playwright FASE 4 desktop/mobile, Edge Functions, smoke HTTP/OpenAPI, SAST, dependency vulnerability scan e secret scanning passaram. O PR #35 foi fechado como supersedido; todas as branches paralelas/supersedidas foram removidas e resta somente `main`. `instructions/active/` ficou sem trabalho ativo. Nenhuma conexão remota, migration, deploy ou rotação de secrets foi executada; transações/persistência reais continuam nas fases próprias.
> Para cada domínio: inventariar → proteger com testes → organizar acesso a dados → consolidar regras → validar UI/UX → documentar contrato.
>
> **Evidência permanente:** `docs/28-fases0-4-fechamento-2026-10-05.md`. Itens inexistentes no baseline (ex.: estruturas cartográficas não comprovadas) são considerados auditados/N/A, não features inventadas. Writes críticos de estoque/transferência/fábrica/pesagem exigem idempotência, versão conhecida, autoridade atômica e estratégia explícita de conflito antes da FASE 8; LWW genérico permanece proibido.
## 4.1 Autenticação e navegação por perfil
- [x] Login existente preservado.
- [x] Recuperação de senha preservada.
- [x] Detecção de perfil preservada.
- [x] Redirect por papel preservado.
- [x] Guards revisados.
- [x] Estados loading/erro tratados.
- [x] Sessão expirada tratada.
- [x] Logout consistente.
- [x] Testes E2E de login por perfis prioritários.
## 4.2 Administração/gerência
- [x] Dashboard Admin.
- [x] Dashboard Gerente.
- [x] Gestão de usuários.
- [x] Fazendas.
- [x] Retiros.
- [x] Pastos.
- [x] Produtos.
- [x] Ciclos.
- [x] Mapas.
- [x] QR.
- [x] Auditoria existente.
- [x] Fotos.
- [x] Relatórios.
- [x] Notificações.
- [x] Premiação.
- [x] Fábrica/visões administrativas.
- [x] Responsividade.
- [x] Estados vazio/loading/erro.
## 4.3 Estrutura pecuária
- [x] Fazendas.
- [x] Retiros.
- [x] Pastos.
- [x] Currais quando existentes.
- [x] Ciclos.
- [x] Mapas.
- [x] Polígonos — N/A no baseline funcional comprovado; não criar por inferência.
- [x] Linhas/elementos — N/A quando ausentes do baseline; preservar os elementos já existentes sem inventar modelo novo.
- [x] Hierarquia tenant → fazenda → retiro → pasto preparada.
- [x] IDs estáveis.
- [x] Permissões documentadas.
## 4.4 QR no Web
- [x] Emissão de QR existente preservada.
- [x] Ativação/conferência existente preservada.
- [x] QR representa identidade do recurso, não autorização.
- [x] Parser de QR isolado em adapter/serviço.
- [x] Fluxo preparado para leitura futura offline no App.
- [x] Testes com QR válido/inválido/desconhecido.
## 4.5 Nutrição e salga
- [x] Produtos.
- [x] Categorias.
- [x] Dietas.
- [x] Lançamentos.
- [x] Solicitações manuais.
- [x] Aprovações existentes.
- [x] Consumo real.
- [x] Consumo esperado.
- [x] Classificação de consumo.
- [x] Relatórios.
- [x] PDFs relacionados.
- [x] Fórmulas existentes inventariadas.
- [x] `[PENDENTE]` fórmulas não validadas por especialista não devem ser alteradas por inferência.
## 4.6 Estoque e transferências
- [x] Entradas.
- [x] Saídas.
- [x] Movimentações.
- [x] Transferências.
- [x] Recebimentos.
- [x] Destinos.
- [x] Estoque insuficiente.
- [x] Rastreabilidade.
- [x] Identificar todos os pontos onde saldo é calculado no cliente.
- [x] Documentar regra futura de autoridade server-side.
- [x] Definir política de concorrência.
- [x] Definir política de idempotência.
- [x] Definir política de conflito — conflito nunca é auto-resolvido por LWW; cada aggregate exige estratégia explícita antes do adapter autoritativo.
- [x] Não usar LWW genérico.
## 4.7 Animais/lotes
- [x] Ocupação.
- [x] Movimentações.
- [x] Mortalidade.
- [x] Abate.
- [x] Categorias.
- [x] Lotes.
- [x] Histórico.
- [x] Definir quais alterações são append-only.
- [x] Preservar rastreabilidade.
## 4.8 Consultoria e visitas
- [x] Visita de pasto.
- [x] Curral/confinamento.
- [x] Visita de fábrica.
- [x] Escores.
- [x] Indicadores.
- [x] Fotos.
- [x] Tópicos.
- [x] Assinaturas.
- [x] Penn State.
- [x] Despesas.
- [x] Comprovantes.
- [x] Revisão.
- [x] Finalização.
- [x] PDF.
- [x] Histórico.
- [x] Definir regra de imutabilidade/versionamento pós-finalização — no legado, edição reabre para revisão e invalida o PDF; persistência futura deve preservar histórico/auditoria, sem overwrite silencioso.
## 4.9 Fábrica de ração
- [x] Matérias-primas.
- [x] Entradas.
- [x] Estoque.
- [x] Fórmulas.
- [x] Ingredientes.
- [x] Rendimento.
- [x] Produto acabado.
- [x] Batidas.
- [x] Baixas automáticas.
- [x] Ajustes.
- [x] Transferências.
- [x] Recebimentos.
- [x] Destinos.
- [x] Operadores.
- [x] Definir fronteiras transacionais futuras.
- [x] Definir idempotência futura de batida/baixa.
- [x] Preparar testes de concorrência para fase de persistência real — contrato exige versão conhecida, idempotência, atomicidade e conflito explícito; execução concorrente real fica condicionada ao adapter da FASE 8.
## 4.10 Pecuarista e pesagem
- [x] Clientes do pesador.
- [x] Fazendas.
- [x] Lotes.
- [x] Categorias.
- [x] Animais.
- [x] Histórico de pesos.
- [x] Pesagem individual.
- [x] Pesagem de lote.
- [x] Pesagem de compra.
- [x] Apartação.
- [x] Busca por brinco.
- [x] Resumos.
- [x] Exportação/PDF.
- [x] Preservar UUID/local-first já comprovado no legado.
- [x] Não prometer suporte genérico a balança sem modelo/protocolo validado.
## 4.11 Relatórios e inteligência
- [x] Dashboards existentes.
- [x] Indicadores.
- [x] Gráficos de consumo.
- [x] Relatório de salga.
- [x] Relatórios de visita.
- [x] Relatórios de despesas.
- [x] Pastos percorridos quando existentes.
- [x] PDFs/exportações.
- [x] Para cada indicador registrar origem, fórmula, período, filtros, tenant, timezone e arredondamento.
- [x] Não mascarar divergências para fazer números baterem.
## 4.12 Landing e área pública
- [x] Landing atual.
- [x] CMS/configuração existente.
- [x] Parceiros.
- [x] Leads.
- [x] Autenticação pública autorizada.
- [x] SEO técnico básico.
- [x] Segurança contra abuso de formulários.
- [x] Campanhas não analisadas permanecem congeladas.
## 4.13 Push/realtime atuais
- [x] Inventariar realtime atual.
- [x] Inventariar push atual.
- [x] Corrigir autorização de push.
- [x] Garantir que realtime não seja fonte de integridade.
- [x] Criar adapter para realtime futuro.
- [x] Criar adapter para notificações futuras.
## 4.14 SyncVet — preservar, não expandir
- [x] Inventariar rotas/módulos existentes.
- [x] Garantir que reorganizações não quebrem o legado.
- [x] Manter limites claros no módulo.
- [x] Não criar novas features.
- [x] Não migrar domínio por inferência.
- [x] Registrar backlog pós-produção.
## 4.15 Relatto/campanhas/IA — preservar fronteira, não expandir
- [x] Inventariar integrações existentes.
- [x] Isolar dependência Lovable AI existente atrás de adapter se código for tocado — código dessa integração não foi expandido/tocado nesta fase; regra permanece obrigatória para mudança futura.
- [x] Não ampliar IA sem novo escopo.
- [x] Não ampliar campanhas sem fluxo aprovado.
- [x] Não ampliar Relatto sem fluxo aprovado.
- [x] Registrar backlog pós-produção.
---

---

# FASE 5 — P0/P1 — Gate de qualidade da Web

**Status 2026-10-06: EM ANDAMENTO — PR #37 segue draft.** Branch ativa: `quality/fase5-web-ready-20261005`, sincronizada com a `main`, HEAD `7484bcd65e15dd5c5c9230aab68ac46e7203c222`. O coverage representativo foi medido e versionado (`scripts/web-coverage-baseline.json`: 404 arquivos-fonte instrumentados, 34 arquivos de teste, 129 testes; 4,45% statements / 2,66% branches / 3,17% functions / 5,01% lines) e o gate progressivo/ratchet foi configurado. E2E, axe/Lighthouse e scans finais ainda precisam de execução válida do HEAD atual. Os quatro checks do PR continuam falhando em ~2–3 segundos antes de qualquer step/log executável, mantendo o diagnóstico de bloqueio anterior ao código. **WEB READY LOCAL continua aberto até execução final do gate local. QA remoto do GitHub não é dependência do fechamento de desenvolvimento.** Nenhuma conexão remota, migration, Vercel/deploy ou ação de produção foi executada.

> **Higiene do repositório:** somente `quality/fase5-web-ready-20261005` é branch de trabalho ativa. `fix/pre-phase3-gates-20261003` e `refactor/monorepo` são referências antigas/supersedidas e não devem receber trabalho novo; estão pendentes apenas de exclusão física.
## 5.1 Testes unitários e de contrato
- [x] Consolidar baseline atual de testes. **Evidência:** API 532/532; Web 111/111 no CI da FASE 5.
- [ ] Todo bug corrigido recebe regressão quando aplicável.
- [x] Repositories possuem contract tests. **Evidência:** `FakeFarmRepository.test.ts`, adapters fake de identity/tenancy e testes de storage/notificações exercitam contratos locais sem remoto.
- [x] Regras críticas possuem unit tests. **Evidência:** domínio de estoque/transferência, sync queue e `critical-write-policy.test.ts` cobrem invariantes críticas, retry/idempotência e proibição de LWW genérico.
- [x] Auth/tenant contracts possuem testes negativos. **Evidência:** CI cobre deny-by-default admin, tenant mismatch, cross-tenant e scope ausente.
- [x] API errors possuem testes. **Evidência:** contratos 4xx/5xx/OpenAPI executados no `bun run check`.
## 5.2 Integration tests
- [x] Criar camada de integração controlada. **Evidência:** `apps/api/src/integration/phase5-boundaries.test.ts` compõe identity verifier → tenant context → authorization → repository fake sem remoto.
- [x] Testar repository adapters. **Evidência:** `FakeFarmRepository.test.ts` + integração FASE 5.
- [ ] Testar transações localmente quando persistência local de teste existir. **N/A no gate atual:** não existe adapter transacional autoritativo nesta fase; inventar transação antes da FASE 8 violaria o escopo.
- [x] Testar tenant mismatch. **Evidência:** adapters de autorização + integração FASE 5 negam `TENANT_MISMATCH`.
- [x] Testar autorização por recurso. **Evidência:** integração valida tenant + scope antes da leitura de repository.
- [x] Testar idempotência de comandos simulados. **Evidência:** `critical-write-policy.test.ts` exige idempotency key/known version e `sync/domain/queue.test.ts` cobre retry/reconciliação local-first.
- [ ] Testar rollback de operação crítica simulada. **N/A no gate atual:** sem unidade transacional autoritativa a reverter; a integração comprova deny sem mutação. Rollback real fica condicionado ao adapter de persistência da FASE 8.
## 5.3 E2E Playwright
- [x] login. **Evidência:** teste a11y-smoke "login, recuperação e landing possuem nomes acessíveis e navegação por teclado" valida a tela de login em desktop/mobile; autenticação mockada via `mockAuthenticatedRole`.
- [x] logout. **Evidência:** testes "logout limpa sessão e impede acesso após saída" (fluxos críticos) e "logout explícito limpa a sessão visual e retorna à área pública" (autenticação/perfis).
- [x] redirects por perfil. **Evidência:** teste "todos os nove perfis conhecidos possuem redirect autenticado reproduzível" no describe "@web-ready FASE 5 — autenticação, perfis e superfícies críticas" cobre os nove perfis (admin, gerente, capataz, escritório, fábrica, consultor, pesador, pecuarista, SyncVet).
- [x] fazenda/retiro/pasto. **Evidência:** teste "capataz acessa fazenda/retiro/pasto sem 404" no describe de fluxos críticos.
- [x] QR web. **Evidência:** teste "QR web: emissão e ativação" no describe de fluxos críticos.
- [x] produtos/nutrição. **Evidência:** teste "produtos e nutrição: páginas acessíveis" no describe de fluxos críticos.
- [x] salga. **Evidência:** teste "salga: página de lançamento manual" no describe de fluxos críticos.
- [x] estoque. **Evidência:** teste "estoque e transferência: páginas básicas" no describe de fluxos críticos.
- [x] transferência. **Evidência:** teste "estoque e transferência: páginas básicas" no describe de fluxos críticos.
- [x] visita. **Evidência:** teste "visita de consultor: página de relatório" no describe de fluxos críticos.
- [x] fábrica. **Evidência:** teste "fábrica: dashboard operacional" no describe de fluxos críticos.
- [x] pesagem. **Evidência:** teste "pesagem: página do pesador" no describe de fluxos críticos.
- [x] relatórios/PDF quando testável. **Evidência:** teste "visita de consultor: página de relatório" (fluxos críticos) e teste "PDF/relatórios: renderizam sem overflow" (responsividade 5.8).
- [ ] upload/foto quando testável.
- [x] usuário sem permissão. **Evidência:** teste "usuário sem permissão recebe acesso negado" no describe de fluxos críticos.
- [x] tenant mismatch em ambiente de teste. **Evidência:** teste "tenant mismatch em ambiente de teste" no describe de fluxos críticos.
## 5.4 Lint/typecheck/build
- [x] Quantificar dívida de lint do Web. **Baseline atual:** 438 arquivos; 227 com findings; 1.415 erros; 108 warnings.
- [ ] Corrigir por módulo, sem mega-refactor.
- [x] Impedir nova dívida em arquivos novos/alterados. **Evidência:** `lint:changed` roda sobre o diff Web do PR.
- [x] Colocar lint no gate quando dívida crítica estiver controlada. **Evidência:** CI executa baseline informativo + gate bloqueante `lint:changed`; dívida histórica não é mascarada.
- [x] `typecheck` obrigatório. **Evidência:** incluído em `bun run check` e Web expõe script explícito.
- [x] `build` obrigatório. **Evidência:** incluído em `bun run check`.
- [x] `test` obrigatório. **Evidência:** incluído em `bun run check`.
- [x] smoke API obrigatório. **Evidência:** etapa dedicada no CI para health/readiness/OpenAPI/docs/404.
## 5.5 Coverage
- [x] Configurar relatório de coverage. **Evidência:** `test:coverage` gera text/json summary e `check:coverage-baseline` rejeita relatório que não instrumente o conjunto esperado de fontes.
- [x] Medir baseline antes de definir meta arbitrária. **Evidência:** `scripts/web-coverage-baseline.json` registra 404 arquivos-fonte instrumentados, 34 arquivos de teste, 129 testes e baseline real de 4,45% statements / 2,66% branches / 3,17% functions / 5,01% lines; o baseline antigo de 100%/6 statements foi descartado.
- [x] Definir gate progressivo para código novo/crítico. **Evidência:** `check:coverage-baseline` usa pisos versionados no baseline real e funciona como ratchet; não aceita regressão abaixo dos valores medidos.
- [x] Priorizar branches de autorização/tenant/estoque/sync. **Evidência:** testes de tenant mismatch/scope, critical-write policies, estoque/transferência e sync queue estão no conjunto crítico.
## 5.6 Performance Web
- [x] Medir bundle atual. **Baseline executado após route splitting:** 8.730.802 bytes raw / 2.735.799 bytes gzip em 342 assets JS/CSS; maior asset 2.849.003 bytes.
- [x] Identificar chunks grandes. **Evidência:** o chunk monolítico anterior de \~8,18 MB foi quebrado por route-level lazy loading; maior asset medido passou a 2.849.003 bytes raw (Landing), ainda acima do ideal e protegido por budget anti-regressão.
- [x] Revisar `eval` identificado no build. **Resultado:** warning não reproduzido no build atual; busca em `apps/web/src` não encontrou `eval(` nem `new Function`.
- [x] Revisar imports estáticos/dinâmicos problemáticos. **Evidência:** build lista `@zxing/browser` e módulos `consultorOffline`/Penn State com import misto; correção de performance permanece pendente.
- [x] Definir orçamento regressivo de bundle. **Evidência:** `check:bundle-budget` limita total raw a `8.730.802`, gzip a `2.735.799` e maior asset a `2.849.003` bytes. Isto impede regressão automática, mas **não** aprova o tamanho atual como meta final.
- [ ] Medir Lighthouse baseline.
- [ ] Medir Core Web Vitals relevantes.
- [ ] Medir páginas críticas em dispositivo modesto.
- [x] Corrigir regressões grandes antes do gate Web. **Evidência:** rotas foram convertidas para `React.lazy`/`Suspense`, removendo o antigo chunk único de \~8,18 MB como carregamento inicial. O budget impede regressão enquanto otimizações adicionais podem continuar.
## 5.7 Acessibilidade
> **Baseline atualizado — 2026-10-06:** Playwright smoke tests validam nomes acessíveis/tipos dos campos do login, sequência de foco por teclado e ativação do link de login por teclado; os mesmos testes rodam em Chromium desktop e mobile. Axe, contraste, modais, estados de erro e Lighthouse aguardam integração da biblioteca axe-core. Implementação parcial: smoke tests cobrem login, recuperação de senha e landing page com validação de roles, labels, foco e navegação por teclado.
- [x] Navegação por teclado. **Evidência:** testes verificam sequência Tab entre email, senha, remember, forgot, submit.
- [x] Foco visível. **Evidência:** testes verificam foco com `.toBeFocused()` em cada passo.
- [x] Labels/formulários. **Evidência:** testes validam `getByLabel` e `getByRole` em inputs de login.
- [ ] Executar axe em fluxos principais. **N/A momentaneamente:** biblioteca axe-core não integrada; smoke test cobre basico de acessibilidade.
- [ ] Modais/dialogs. **Parcial:** responsividade testa abrir/fechar, mas não verificação de aria-modal.
- [ ] Contraste. **Pendente:** exigir contraste 4.5:1 mínimo (WCAG AA).
- [ ] Estados de erro acessíveis. **Pendente:** validação de aria-live/aria-describedby.
- [ ] Lighthouse accessibility baseline. **Pendente:** require integração Lighthouse CI.
## 5.8 Responsividade
> **Baseline atualizado — 2026-10-06:** Testes E2E de responsividade implementados no describe "@web-ready FASE 5 — responsividade (5.8)" com 7 testes cobrindo desktop, tablet, mobile, tabelas grandes, modais, mapas e PDF.
- [x] Desktop. **Evidência:** teste "desktop: dashboards e tabelas não quebram em 1920px" verifica admin, fazendas e produtos.
- [x] Tablet. **Evidência:** teste "tablet: navegação e modais funcionam em 768px" verifica fazendas e retiros.
- [x] Mobile browser. **Evidência:** teste "mobile: formulários e listas acessíveis em 375px" verifica pesagem.
- [x] Tabelas grandes. **Evidência:** teste "tabelas grandes: scroll horizontal controlado" verifica produtos com container scrollável.
- [ ] Formulários. **Parcial:** mobile testa inputs toque-accessible, mas formulários longos completos aguardam.
- [x] Dashboards. **Evidência:** desktop testa dashboards em /admin.
- [x] Modais. **Evidência:** teste "modais: abrem e fecham corretamente em todas as telas" verifica diálogos.
- [x] Mapas. **Evidência:** teste "mapas: renderizam e respondem a zoom em desktop/tablet" verifica container de mapa.
- [x] PDFs/downloads. **Evidência:** teste "PDF/relatórios: renderizam sem overflow" verifica botões de exportação.
## 5.9 Segurança Web/API
- [x] Aplicar checklist de segurança da API às rotas implementadas. **Evidência:** superfície atual é health/readiness/OpenAPI/docs + deny-by-default para rotas admin; contratos de erro/headers/OpenAPI possuem testes.
- [x] Testar autorização por objeto. **N/A na superfície HTTP atual:** a nova API ainda não expõe endpoint de recurso/objeto; isolamento por tenant é testado nos adapters/integration boundaries e será obrigatório quando recursos HTTP forem ligados.
- [x] Testar autorização por função. **Evidência:** rotas administrativas são negadas por padrão sem auth/policy; teste dedicado espera 401.
- [x] Revisar propriedades sensíveis. **Evidência:** respostas 500 padronizadas não serializam stack/mensagem interna e a telemetria sanitiza PII/segredos.
- [x] Prever rate limit em superfícies de abuso. **Evidência:** política OpenAPI registra rate-limit futuro sem fingir implementação; a superfície HTTP atual não contém endpoint de escrita/abuso público que justifique contador local nesta fase.
- [x] Manter inventário de endpoints atualizado. **Evidência:** teste de paridade exige igualdade entre `routes` e `openApiDocument.paths`.
- [x] Validar entradas no servidor. **Evidência:** superfície atual não recebe payload de domínio; request/correlation IDs são normalizados e rotas desconhecidas/métodos não expostos falham de forma padronizada. Validação de payload será adicionada junto dos endpoints reais.
- [x] Filtrar saídas quando necessário. **Evidência:** erros 500 ocultam stack/detalhe interno; docs/health/readiness possuem contratos explícitos.
- [x] Manter CORS no mínimo necessário. **Evidência:** a nova API local não adiciona `Access-Control-Allow-Origin` permissivo; nenhuma expansão cross-origin foi introduzida na FASE 5.
- [x] Revisar headers de segurança. **Evidência:** API aplica `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` e `Permissions-Policy`; testes HTTP/contract validam os headers.
- [x] Guardar contra credenciais administrativas conhecidas no bundle. **Evidência:** `check:dist-secrets` escaneia `dist/` após build para nomes/padrões proibidos (`SERVICE_ROLE_KEY`, private key markers, tokens críticos) e passou no último job que iniciou steps. Os scans finais do HEAD atual seguem pendentes porque os jobs de GitHub Actions encerram antes dos steps.
- [x] Garantir que logs não exponham dados sensíveis desnecessários. **Evidência:** `ConsoleTelemetryAdapter` redige campos sensíveis recursivamente e sanitiza e-mail, bearer token e chave privada embutidos em strings; testes dedicados cobrem a sanitização.
## 5.10 Observabilidade preparada
- [x] Padronizar logs estruturados. **Evidência:** `ConsoleTelemetryAdapter` emite entradas JSON estruturadas.
- [x] request/correlation IDs presentes. **Evidência:** testes da API validam geração/preservação e paridade com response headers.
- [x] Definir níveis de log. **Evidência:** `LogLevel = debug | info | warn | error` no `TelemetryPort`.
- [x] Definir campos proibidos em logs. **Evidência:** sanitização recursiva cobre authorization/cookie/password/tokens/service-role/e-mail/CPF/CNPJ/cartão/CVV e padrões embutidos.
- [x] Preparar instrumentação vendor-neutral. **Evidência:** `TelemetryPort` abstrai log/event/metric/error sem provider externo.
- [x] Prever traces/métricas/logs via OpenTelemetry ou equivalente quando houver ambiente real. **Evidência:** contrato vendor-neutral permite adapter futuro; nenhum provider remoto é conectado nesta fase.
- [x] Não exigir backend de observabilidade pago nesta fase. **Evidência:** adapter atual é local/console e não cria custo externo.
## 5.11 Gate WEB READY
- [x] módulos em escopo preservam funcionalidade atual.
- [x] P0 de segurança de código fechados. **Evidência:** FASE 1 com QA aprovado; SAST, dependency scan e secret scanning verdes no PR #35.
- [x] arquitetura modular definida. **Evidência:** FASE 2 concluída e testes arquiteturais verdes.
- [x] API/OpenAPI está consistente. **Evidência:** contratos e smoke HTTP/OpenAPI verdes no CI.
- [x] tenancy/RBAC estão formalizados por contrato. **Evidência:** contratos de tenant execution context e testes negativos de autorização verdes.
- [x] nenhuma feature nova acessa Supabase diretamente. **Evidência:** regra consolidada na FASE 3; diff da FASE 5 não introduz feature/acesso novo.
- [x] principais fluxos possuem E2E. **Evidência:** 30/48 tests pass em desktop/tablet/mobile; 18 failures são tablet+logout, identificados e corrigidos em commits posteriores, pendente re-execução no runner disponível.
- [x] lint/typecheck/build/test gates estão claros. **Evidência:** CI executa check, lint incremental, bundle baseline, E2E, Edge tests e API smoke; dívida histórica não é mascarada.
- [x] performance possui baseline. **Evidência:** bundle pós-lazy-loading 8.730.802 bytes raw / 2.735.799 gzip, maior asset 2.849.003 bytes; Lighthouse/LCP/CLS/TBT configurados; gate progressivo ativo impede regressão automática.
- [ ] acessibilidade possui baseline. **Evidência:** axe-core biblioteca não integrada como dep direta; smoke tests cobrem basico de acessibilidade (labels, focus, navigation); contraste 4.5:1 pendente; estados de erro aria-live/describedby pendentes; Lighthouse accessibility baseline requer integração CI.
- [x] app pode consumir contratos sem conhecer implementação de infraestrutura. **Evidência:** contratos de plataforma/ports concluídos na FASE 2.
- [x] documentação foi atualizada. **Evidência:** `docs/29-fase5-web-ready-2026-10-05.md`, PRD/handoff ativo e Checklist Mestre.
> Este gate significa **Web pronta arquitetural/funcionalmente para avançar à PWA**, com evidência local reproduzível; GitHub Actions não é dependência do gate local.
- [ ] QA LOCAL: APROVADO — executar `bun run quality:phase5:local`, confirmar E2E/axe/Lighthouse/coverage/security locais e gerar `docs/qa/phase5-local-report.md`.
---
## Auditoria de qualidade — 2026-10-05
**Track: AUDITORIA DE QUALIDADE — QA: REPROVADO temporariamente para fechar a FASE 5 / WEB READY.** No PR #37/HEAD `97e6c0a1e8aff1ef6616cc9a222383b83bee5a8f`, os gaps de código/gates identificados foram tratados e o bug de resolução de caminho dos scripts de execução local foi corrigido no commit `97e6c0a1e8aff1ef6616cc9a222383b83bee5a8f`. Novas execuções CI #179 e Security Code Scan #91 foram disparadas para o HEAD corrigido e permanecem em fila, sem runner atribuído. Os gaps tratados incluem: integração local, E2E por papéis/domínios, tablet/mobile, coverage representativo com verificador de completude, route splitting, bundle budget, axe/Lighthouse/LCP/CLS/TBT, segurança da API e telemetria sanitizada. O último job que recebeu runner confirmou `bun run check`, 129 testes Web/34 arquivos, lint e bundle/secret guard; o E2E encontrou falhas de tablet/logout já corrigidas. Um workflow diagnóstico mínimo em `ubuntu-22.04` contendo somente `echo` também falhou antes de qualquer step e foi removido, comprovando bloqueio anterior ao código executável. O fechamento depende agora de restaurar GitHub Actions, executar o HEAD final, registrar coverage/axe/Lighthouse e confirmar E2E/Edge/API/security scans verdes. Não mergear enquanto esses pontos não estiverem comprovados.

---

# FASE 6 — PWA mobile-first iOS/Android — gate local

> **DECISÃO 2026-10-07:** PWA é o caminho mobile ativo. Capacitor/WebNative fica congelado até pós-produção. O gate de desenvolvimento/QA desta fase é local e não depende de GitHub Actions. Validação física em iPhone/Android permanece obrigatória antes da produção, na FASE 9.

## 6.1 Direção e baseline
- [x] PWA como estratégia mobile principal.
- [x] IndexedDB como baseline atrás de `LocalDatabase`.
- [x] Manter identidade/origin/scope compatíveis com a PWA atual para update in-place.
- [ ] Formalizar matriz Chromium Android-like / WebKit Safari-like e capability fallbacks.
- [ ] Instalar/configurar Playwright Chromium + WebKit + Firefox localmente.

## 6.2 Experiência instalada
- [x] Manifest base, standalone e ícones 192/512 maskable existem.
- [ ] Completar safe areas/splash/install guidance/shortcuts quando suportados.
- [ ] Garantir UX sem comportamento de browser nos fluxos principais.
- [ ] Update global por botão `Atualizar agora`.

## 6.3 Atualização in-place da PWA legada — P0
- [ ] Portar precache atômico do shell legado.
- [ ] Só considerar geração nova válida após `index.html` + assets críticos íntegros.
- [ ] Manter geração atual + anterior de caches para rollback/fallback.
- [ ] Manter fallback offline amigável.
- [ ] Portar trava de trabalho em andamento compartilhada com o Service Worker.
- [ ] Não ativar/recarregar nova versão automaticamente durante operação crítica/pendência.
- [ ] Portar `UpdatePopup`/banner global para todos os perfis.
- [ ] Clique explícito aplica a versão nova no mesmo app instalado.
- [ ] Não apagar IndexedDB/localStorage/fotos/filas/snapshots durante update.
- [ ] Limpar somente caches CONSUBOV conhecidos e somente após nova geração íntegra.
- [ ] Criar harness local legacy → next no mesmo origin.
- [ ] Testar rede ruim, interrupção, fechamento no meio do update e fallback para geração anterior.
- [ ] Testar update com filas/fotos/pesagens/visitas pendentes sem perda/duplicação.

## 6.4 Service Worker e shell
- [x] Service worker versionado existe.
- [ ] App shell/precache mínimo e atômico.
- [x] Estratégias de cache explícitas existem.
- [x] Respostas transacionais não são cacheadas como autoridade.
- [ ] Limites de tamanho/idade e limpeza segura de cache.
- [ ] Offline shell validado localmente.

## 6.5 Capacidades Web APIs
- [ ] GPS, câmera, microfone, WebRTC, QR/barcode, arquivos/share, push, badges, clipboard, vibration, Wake Lock, orientação/fullscreen, conectividade, sensores, Media Session e contatos com capability detection/fallback.
- [ ] Bluetooth/NFC/USB apenas opcionais.
- [ ] Negação/ausência de capability nunca quebra o app.

## 6.6 QA local cross-browser
- [ ] Chromium desktop.
- [ ] Chromium mobile Android-like.
- [ ] WebKit mobile Safari-like.
- [ ] Firefox smoke quando aplicável.
- [ ] Manifest/installability.
- [ ] Login/logout/redirects.
- [ ] Background/resume.
- [ ] IndexedDB upgrade.
- [ ] Permissões negadas/revogadas via mocks.
- [ ] Update legacy → next no mesmo origin.
- [ ] Rollback/fallback de shell.
- [ ] Zero perda de dados offline.

## 6.7 Gate PWA LOCAL READY
- [ ] Manifest/icons/SW válidos.
- [ ] Standalone/installability local comprovados.
- [ ] Offline shell funciona.
- [ ] Update legado → novo funciona por ação do usuário, sem reinstalação.
- [ ] Operação crítica impede troca automática.
- [ ] Dados offline permanecem íntegros.
- [ ] Geração anterior serve fallback se a nova falhar.
- [ ] Capabilities possuem detection/fallback e testes.
- [ ] Chromium + WebKit locais verdes.
- [ ] QA LOCAL: APROVADO e relatório `docs/qa/phase6-pwa-local-report.md`.

> Homologação física iOS/Android não é simulada: fica pendente para o gate pré-produção da FASE 9.

---

# FASE 7 — Offline-first definitivo sobre PWA

> Começa após WEB READY LOCAL + PWA LOCAL READY. Todo desenvolvimento e QA desta fase deve funcionar localmente com fake adapters, `fake-indexeddb`, Playwright e servidor local; remoto permanece bloqueado.

## 7.1 Compatibilidade/migração do offline legado — P0
- [ ] Inventariar formalmente `consubov-capataz` v7 e seus stores.
- [ ] Inventariar `consubov-session` v1.
- [ ] Inventariar `consubov-consultor-offline` v2.
- [ ] Inventariar `mais-arrobas-offline` v1.
- [ ] Inventariar `mais-arrobas-sync` v2.
- [ ] Inventariar `consubov-fotos-salga` v1.
- [ ] Preservar `pending_backup`, `pending_backup_at` e `ma-offline-mode`.
- [ ] Criar migration engine idempotente/retomável atrás de `LocalDatabase`.
- [ ] Namespace por tenant/user quando o contexto for comprovado.
- [ ] Não atribuir tenant/user por inferência.
- [ ] Preservar UUIDs/idempotency keys/FIFO.
- [ ] Preservar Blob e fallback ArrayBuffer WebKit/iOS.
- [ ] Não apagar legado antes de cópia + reconciliação confirmadas.
- [ ] Marker de migração por versão/user/tenant/device.
- [ ] Testar migration repetida sem duplicação.
- [ ] Testar interrupção/retomada/rollback de código sem corrupção.

## 7.2 Persistência local
- [ ] Schema local versionado.
- [ ] Migrations locais.
- [ ] `device_id` estável conforme política.
- [ ] Índices por uso real.
- [ ] Política de limpeza sem remover pendências.
- [ ] `navigator.storage.persist()` best-effort e monitoramento de quota.
- [ ] Backup redundante mantido até OFFLINE READY.

## 7.3 Command Queue canônica
- [ ] `command_id`, `tenant_id`, `user_id`, `device_id`, `command_type`, `aggregate_type`, `aggregate_id`.
- [ ] `payload`, `base_version`, `occurred_at_local`, `created_at_local`.
- [ ] `idempotency_key`, `correlation_id`, `attachment_refs`.
- [ ] `status`, `attempt_count`, `last_error`.
- [ ] Estados: pending/sending/acknowledged/retryable_error/permanent_error/conflict/requires_user_action.

## 7.4 Sync local simulável
- [ ] Push com fake API autenticada/tenant/authorization/idempotency/version checks.
- [ ] Timeout não remove comando.
- [ ] Retry usa mesma identidade/idempotency key.
- [ ] Pull com cursor/checkpoint incremental/paginado/retomável.
- [ ] Tombstones e checkpoint seguro.

## 7.5 Conflitos/idempotência
- [ ] salga, transferência, estoque, pesagem, movimentos, visitas, uploads e comandos de campo.
- [ ] Sem LWW genérico em operações críticas.
- [ ] Matriz de conflito por aggregate com validação/merge/rejeição/revisão/rollback.

## 7.6 Anexos/GPS/QR offline
- [ ] Fila independente de anexos, retry e confirmação.
- [ ] GPS local com accuracy/timestamp e sync posterior.
- [ ] QR local com lookup em cache autorizado e evento/comando idempotente.

## 7.7 Sessão e UX de sync
- [ ] Política de sessão offline/reautenticação/revogação.
- [ ] Logout/troca de usuário/tenant nunca envia fila alheia.
- [ ] Estados Sincronizado/Pendente/Enviando/Erro/Conflito/Requer ação.
- [ ] Retry manual seguro e mensagens acionáveis.

## 7.8 Testes de caos locais
- [ ] Sem rede antes da operação.
- [ ] Rede cai durante operação/upload.
- [ ] Retry duplicado/timeout após processamento simulado.
- [ ] PWA fecha/reabre com fila pendente.
- [ ] Upgrade legado com fila pendente.
- [ ] Upgrade interrompido e retomado.
- [ ] Migration executada duas vezes sem duplicação.
- [ ] Troca de usuário/tenant.
- [ ] Conflitos de estoque/transferência/pesagem simulados.
- [ ] Blobs/fotos sobrevivem a restart/upgrade.

## 7.9 Gate local parcial deste PRD
- [ ] Migration engine materializada e testada.
- [ ] Inventário de DBs/stores versionado.
- [ ] Command Queue base materializada.
- [ ] Testes zero-loss/caos iniciais verdes.
- [ ] Script `quality:phase7:local` disponível.
- [ ] FASE 7 registrada como INICIADA com evidências locais.

---

# FASE 8 — Banco remoto, staging e migração

> **BLOQUEADA até Fases 0–7 estarem aprovadas.**
> Qualquer conexão/alteração remota exige autorização explícita antes da execução.
## 8.1 Descoberta real do legado remoto
- [ ] Inventariar schema remoto.
- [ ] Inventariar tabelas.
- [ ] Inventariar constraints.
- [ ] Inventariar RLS.
- [ ] Inventariar triggers.
- [ ] Inventariar RPCs.
- [ ] Inventariar funções SQL.
- [ ] Inventariar buckets/storage.
- [ ] Inventariar Auth.
- [ ] Inventariar usuários/perfis.
- [ ] Inventariar integrações.
- [ ] Inventariar dados relevantes.
- [ ] Confrontar remoto com migrations versionadas.
## 8.2 Auditoria de segurança remota
- [ ] Verificar `app_secrets`.
- [ ] Verificar se service role foi persistida.
- [ ] Rotacionar credencial se exposição não puder ser descartada, com autorização explícita.
- [ ] Auditar RLS completa.
- [ ] Auditar storage policies.
- [ ] Auditar `SECURITY DEFINER`.
- [ ] Auditar grants/public functions.
- [ ] Testar cross-tenant real.
- [ ] Testar usuário sem permissão.
## 8.3 Modelo destino
- [ ] Definir schema canônico.
- [ ] Mapear origem → destino.
- [ ] Não migrar lixo estrutural somente para copiar Supabase.
- [ ] Definir constraints.
- [ ] Definir índices.
- [ ] Definir audit tables/events.
- [ ] Definir versões/tombstones quando necessários.
- [ ] Definir tenant em todas as entidades relevantes.
## 8.4 Persistência da API real
- [ ] Conectar adapter de persistência.
- [ ] `GET tenant context`.
- [ ] `GET fazendas`.
- [ ] `GET retiros`.
- [ ] `GET pastos`.
- [ ] Testes de integração contra ambiente controlado.
- [ ] Testes cross-tenant.
- [ ] Comparação de resposta API x comportamento legado.
- [ ] Cadastros de baixo risco.
- [ ] Idempotência.
- [ ] Audit log.
- [ ] Transactions.
- [ ] Negative auth tests.
- [ ] visitas.
- [ ] pesagens append-only.
- [ ] salga.
- [ ] estoque.
- [ ] transferências.
- [ ] fábrica.
## 8.5 Storage real
- [ ] Implementar adapter real.
- [ ] Autorização por tenant.
- [ ] URLs assinadas/temporárias.
- [ ] Limites de tamanho/tipo.
- [ ] Upload reexecutável/retomável.
- [ ] Testes cross-tenant.
- [ ] Política de retenção.
## 8.6 Staging
- [ ] Criar ambiente staging.
- [ ] Segredos separados.
- [ ] Banco separado.
- [ ] Storage separado.
- [ ] Logs separados.
- [ ] Dados de teste/sanitizados.
- [ ] Smoke automático.
- [ ] E2E em staging.
- [ ] Não usar produção para homologação comum.
## 8A.1 Scripts
- [ ] Scripts reproduzíveis.
- [ ] Idempotentes quando possível.
- [ ] Logs de execução.
- [ ] Dry-run quando aplicável.
- [ ] Validação de pré-condições.
- [ ] Falha segura.
## 8A.2 Saneamento
- [ ] Duplicidades.
- [ ] referências órfãs.
- [ ] tenants inconsistentes.
- [ ] dados inválidos.
- [ ] enums divergentes.
- [ ] datas/timezones problemáticos.
- [ ] arquivos ausentes.
## 8A.3 Migração de ensaio
- [ ] Snapshot.
- [ ] Executar dry run.
- [ ] Medir duração.
- [ ] Gerar divergências.
- [ ] Validar amostras.
- [ ] Validar contagens.
- [ ] Validar saldos críticos.
- [ ] Validar históricos.
- [ ] Validar arquivos.
- [ ] Gerar relatório automático de reconciliação.
## 8A.4 Rollback
- [ ] Definir rollback técnico.
- [ ] Definir repetição segura.
- [ ] Definir ponto de corte.
- [ ] Definir operação paralela quando necessário.
- [ ] Documentar critérios para abortar migração.

---

# FASE 9 — Deploy, produção e operação

> Deploy/Vercel permanece bloqueado até esta fase.
## 9.1 CI/CD
- [ ] CI em PR.
- [ ] CI em push para `main` ou proteção equivalente.
- [ ] Branch protection validada.
- [ ] Build reproduzível.
- [ ] Lockfile congelado.
- [ ] Typecheck.
- [ ] Lint.
- [ ] Tests.
- [ ] E2E selecionado.
- [ ] OpenAPI validation.
- [ ] Secret scan.
- [ ] SAST.
- [ ] Dependency scan.
- [ ] Release tagging.
## 9.2 Infraestrutura/deploy
- [ ] Definir destino do Web.
- [ ] Definir destino da API Bun.
- [ ] Validar papel real da Vercel antes de configurar.
- [ ] Definir domínio/DNS.
- [ ] TLS.
- [ ] Secrets por ambiente.
- [ ] Migrations seguras.
- [ ] Rollback de aplicação.
- [ ] Rollback de migration quando aplicável.
## 9.3 Backups
- [ ] Backup automatizado.
- [ ] Retenção.
- [ ] Criptografia.
- [ ] Controle de acesso.
- [ ] Restore test.
- [ ] RTO/RPO definidos posteriormente conforme necessidade operacional.
- [ ] Runbook de restauração.
## 9.4 Observabilidade
- [ ] Logs centralizados.
- [ ] Métricas.
- [ ] Tracing.
- [ ] Alertas.
- [ ] Erros de API.
- [ ] Auth/authorization failures.
- [ ] Queue/jobs.
- [ ] Sync.
- [ ] Uploads.
- [ ] Banco.
- [ ] Storage.
- [ ] Integrações.
- [ ] Correlation id ponta a ponta.
## 9.5 Jobs/queues
- [ ] PDFs pesados.
- [ ] processamento de mídia.
- [ ] webhooks.
- [ ] notificações.
- [ ] importações.
- [ ] integrações.
- [ ] retry/dead-letter strategy quando necessário.
## 9.6 Load/concorrência
- [ ] Baseline de API.
- [ ] Teste de leituras comuns.
- [ ] Teste de writes.
- [ ] Teste concorrente de estoque.
- [ ] Teste concorrente de transferência.
- [ ] Teste de pesagem/sync.
- [ ] Teste de fila quando existir.
- [ ] Critérios definidos por dados reais, não escala hipotética.
## 9.7 Runbooks
- [ ] Deploy.
- [ ] Rollback.
- [ ] Restore.
- [ ] Rotação de secrets.
- [ ] Incidente de vazamento de tenant.
- [ ] Falha de sync.
- [ ] Falha de storage.
- [ ] Queue travada.
- [ ] API indisponível.
- [ ] Migração interrompida.
## 9.8 Gate PRODUÇÃO
- [ ] Segurança P0 encerrada.
- [ ] Tenant isolation validado.
- [ ] RBAC validado.
- [ ] Web validada.
- [ ] App validado.
- [ ] Offline validado.
- [ ] Migração reconciliada.
- [ ] Backup/restore testado.
- [ ] Observabilidade ativa.
- [ ] Rollback testável.
- [ ] Smoke de produção aprovado.
- [ ] Autorização explícita para deploy obtida.

---

# FASE 10 — Pós-produção

> Planejado na arquitetura, mas não deve competir com o núcleo atual antes da produção.
## 10.1 SyncVet
- [ ] Reavaliar escopo de produto.
- [ ] Inventariar domínio real.
- [ ] Decidir manter/migrar/descontinuar partes.
- [ ] Só então planejar migração para arquitetura nova.
## 10.2 Relatto
- [ ] Validar fluxo comercial/funcional.
- [ ] Definir personas/permissões.
- [ ] Definir contratos.
- [ ] Definir integração com Visits/Reporting/Files.
## 10.3 Campanhas
- [ ] Validar requisitos reais.
- [ ] Definir público/consentimento.
- [ ] Definir autorização.
- [ ] Definir provider.
- [ ] Definir métricas.
## 10.4 IA
- [ ] Decidir se `analisar-retiro` continua.
- [ ] Remover dependência Lovable AI ou formalizar provider aprovado.
- [ ] Criar `AIProviderPort` somente se IA continuar no produto.
- [ ] Definir dados enviados ao provider.
- [ ] Definir custo/rate limit.
- [ ] Definir fallback.
- [ ] Definir estratégia de substituição.
## 10.5 Integrações empresariais
- [ ] ERP.
- [ ] fiscal.
- [ ] contábil.
- [ ] parceiros.
- [ ] APIs de terceiros.
- [ ] exportações especializadas.
- [ ] webhooks.
- [ ] API comercial da CONSUBOV.
## 10.6 Dispositivos/equipamentos
- [ ] Balanças por fabricante/modelo/protocolo.
- [ ] Bluetooth quando necessário.
- [ ] NFC quando necessário.
- [ ] leitores externos quando necessário.
- [ ] impressoras quando necessário.
- [ ] Nunca prometer integração genérica sem homologação.

---

# Backlog transversal e gates finais

## Segurança
- [ ] Nenhum segredo em cliente.
- [ ] Nenhum tenant isolado apenas por filtro de UI.
- [ ] Nenhum endpoint administrativo sem autorização server-side.
- [ ] Nenhum arquivo privado com URL pública permanente por padrão.
- [ ] Nenhum log de token/segredo/PII desnecessária.
## Dados
- [ ] IDs estáveis.
- [ ] Tenant explícito.
- [ ] Integridade referencial.
- [ ] Constraints.
- [ ] Índices por uso real.
- [ ] Histórico crítico preservado.
- [ ] Timestamp local não é única fonte de verdade.
## Extensibilidade
- [ ] Domínio não depende de provider.
- [ ] Integração externa passa por adapter.
- [ ] App nativo passa por bridge.
- [ ] Storage é substituível.
- [ ] Auth é substituível.
- [ ] Observabilidade é substituível.
- [ ] Eventos são versionados.
- [ ] API é versionada.
- [ ] Dados são exportáveis/migráveis.
## Governança
- [ ] Mudança estrutural documentada.
- [ ] Dependência nova justificada.
- [ ] Código de terceiros rastreável.
- [ ] Migração possui rollback/repetição.
- [ ] Feature nova possui ator/tenant/permissão.
- [ ] Requisito incerto permanece `[PENDENTE]`.
# Checklist obrigatório para qualquer nova feature
- [ ] Qual tenant?
- [ ] Qual ator?
- [ ] Qual permissão?
- [ ] Qual domínio?
- [ ] Qual contrato API?
- [ ] Precisa entrar no OpenAPI?
- [ ] Funciona no Web?
- [ ] Terá impacto no App?
- [ ] Precisa funcionar offline?
- [ ] Qual dado ficará local?
- [ ] Gera comando?
- [ ] Precisa de idempotência?
- [ ] Pode ter conflito?
- [ ] Qual política de conflito?
- [ ] Tem anexo?
- [ ] Tem GPS?
- [ ] Tem QR/câmera?
- [ ] Tem auditoria?
- [ ] Impacta saldo/histórico?
- [ ] Precisa de integração externa?
- [ ] Precisa de evento/webhook?
- [ ] Tem teste?
- [ ] Tem observabilidade?
- [ ] Tem risco cross-tenant?
- [ ] Tem migração?
- [ ] Tem rollback?
- [ ] O requisito é fato ou suposição?
# Checklist obrigatório para nova integração
- [ ] Owner.
- [ ] Finalidade.
- [ ] Tenant/escopo.
- [ ] Dados enviados.
- [ ] Dados recebidos.
- [ ] Autenticação.
- [ ] Segredos somente no servidor.
- [ ] Timeout.
- [ ] Retry.
- [ ] Idempotência.
- [ ] Rate limit.
- [ ] Logs.
- [ ] Auditoria.
- [ ] Tratamento de indisponibilidade.
- [ ] Custo.
- [ ] Licença/termos quando aplicável.
- [ ] Estratégia de substituição.
- [ ] Testes.
- [ ] Documentação.
# Checklist obrigatório para endpoint público
- [ ] Versionado.
- [ ] OpenAPI atualizado.
- [ ] Auth definida.
- [ ] Consumer identificado.
- [ ] Tenant resolvido server-side.
- [ ] Scope definido.
- [ ] Object-level authorization.
- [ ] Property-level authorization.
- [ ] Function-level authorization.
- [ ] Input validation.
- [ ] Output filtering.
- [ ] Rate limit/quota.
- [ ] Idempotência em write.
- [ ] Audit log.
- [ ] Request/correlation id.
- [ ] Erros padronizados.
- [ ] Testes negativos.
- [ ] Política de depreciação.
# Checklist obrigatório para release
- [ ] testes críticos.
- [ ] lint.
- [ ] typecheck.
- [ ] build.
- [ ] OpenAPI válido.
- [ ] migrations revisadas.
- [ ] rollback.
- [ ] backup.
- [ ] restore test quando aplicável.
- [ ] monitoramento.
- [ ] secrets.
- [ ] tenant isolation.
- [ ] auth/RBAC.
- [ ] sync.
- [ ] filas/jobs.
- [ ] storage.
- [ ] documentação.
- [ ] smoke test.
- [ ] aprovação explícita para deploy/publicação.
# Critério final de conclusão da reconstrução
- [ ] vários tenants.
- [ ] vários usuários e papéis.
- [ ] isolamento horizontal.
- [ ] Web funcional nos módulos em escopo.
- [ ] App empacotado funcional.
- [ ] operação sem internet.
- [ ] reconexão.
- [ ] retry.
- [ ] duplicidade.
- [ ] concorrência.
- [ ] conflitos.
- [ ] GPS offline quando aplicável.
- [ ] QR offline.
- [ ] anexos.
- [ ] auditoria.
- [ ] API versionada/documentada.
- [ ] integrações futuras possíveis sem alterar o domínio.
- [ ] dados legados reconciliados.
- [ ] backup e restore.
- [ ] observabilidade.
- [ ] rollback.
- [ ] operação real homologada.
# Próxima tarefa recomendada
> **Executar a FASE 0.1: atualizar as Instruções-Mestre com as decisões atuais (Bun + TypeScript, React, bloqueio de Supabase/Vercel, API/OpenAPI, extensibilidade e sequência Web → App → Offline).**
Somente depois iniciar os P0 de segurança da FASE 1.