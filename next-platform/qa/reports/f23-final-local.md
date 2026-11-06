# F23 — relatório final local

## 1. STATUS

**PRONTO_PARA_QA_INDEPENDENTE**. Implementação T00–T06 e execução local T07 entregues; F23 não homologada. QA independente A_FAZER_LOCAL; hardware NAO_EXECUTADO; produção NO_GO. Data local 05/11/2026, recibos finais em 06/11 UTC.

## 2. GIT

Repositório canônico D:/MATEUS/Documentos/GitHub/consubov preservado. Worktree exclusiva C:/Users/MATEUS/.codex/worktrees/a3ec/consubov; branch detached, owner Codex a3ec e agentes com arquivos delimitados. HEAD/base inicial e final: `25a4d8ad2ad4fae7c3a4f77e4912394801c81154`; árvore dirty antes/depois. Não existe commit limpo representando esta entrega. Nenhuma branch/PR/commit/push/tag/merge/deploy criado.

Fingerprint de execução testado: `5509ebdaf67e0fe9c88bd911d112aa05a142fca55f43d87a971ce32b7ff110c9`.
Fingerprint da entrega após anotação exclusiva do checklist: `977697ed9c66ec38aec8d20e31d825543a4dc3e560cd0dd5ee5f1cb90cca4955`.
Essa diferença não é ocultada como sourceUnchanged: [prova documental](../../.qa/runs/f23-fixture-recheck-DwXDba/post-qa-documentation.json) e [manifesto de entrega](../../.qa/runs/f23-fixture-recheck-DwXDba/delivery-source-manifest.json). Todo runtime, teste, compilador, configuração e lock permaneceu idêntico. [Estado Git e lista completa de arquivos alterados](../../.qa/runs/f23-fixture-recheck-DwXDba/delivery-git.json); todos em next-platform/**. Checkout canônico, refs e stashes preservados.

## 3. ENTREGAS

Shell mínimo com carregamento seletivo de artefatos imutáveis dos quatro perfis, manifests, caches e N/N-1. Módulos em iframe opaco, RPC MessageChannel autenticado por origem/source/nonce/contexto/capacidade; sem token, SQL ou ACK no módulo. Contrato público versionado JSON Schema/OpenAPI com fixture independente JS/Rust-Wasm.

IndexedDB real transacional por conta/tenant/fazenda/perfil: snapshot, outbox, foto/ACK/cursor, migração e CAS. API local autorizada aplica validação, OCC, idempotência e pull; scheduler silencioso conserva retries imutáveis e não expõe fila/conectividade. ADM candidato possui origem/build/identidade/worker/cache/sessão próprios e consulta administrativa autorizada; SPA de laboratório explicitamente separada e não publicável.

Arquitetura, reprodução e rollback: [runbook](../../docs/f23-runtime-local.md), [configurações e comandos](../../frontend/configs/README.md), [checklist](../../frontend/checklists/F23-IMPLEMENTACAO-2026-11-05.md). Diretórios frontend exigidos entregues; inspirações N/A por ausência de rebranding.

## 4. PROVAS

[Recibo autoritativo](../../.qa/runs/f23-fixture-recheck-DwXDba/result.json) e [log](../../.qa/runs/f23-fixture-recheck-DwXDba/output.log): PASS_LOCAL_CURRENT_WITH_REUSED_UNCHANGED_SCOPE. Todos os 21 gates únicos cobertos; 20 PASS reutilizados por comparação estrita de arquivos/logs/artefatos e 1 Shared reexecutado neste recibo. Q8/runtime/worker foram efetivamente reexecutados em KGlkwh; RPC em P7RUTp. Reutilização é explicitamente identificada, sem alegar nova execução desses gates.

Shared: Capataz primeiro, Gerente de outra conta depois, sem preload de outros perfis; bancos distintos, crossContamination=false, cache Capataz byte a byte preservado e ambos relogam offline em Chromium/WebKit. Tráfego e inventários completos: [Shared real](../../.qa/runs/t03-shared-2026-11-06T01-26-03.674Z-20896-1a221530-0574-4cb1-b184-f05841311b76.json). Chromium observou 2 GETs tardios de metadados do Capataz já instalado; não houve novo payload/recompilação ou alteração do cache. WebKit não observou esses GETs. Não alegar literalmente zero requests de metadados.

Quatro perfis × duas engines: 8 reaberturas frias/login local, snapshots/outbox iguais e mutações renderizadas. Fotos com bytes/hash reais, perda de ACK, retry idempotente e sync silencioso: 2/2. CAS concorrente por iframes e recuperação autorizada INVALID_CURSOR: 2/2, com snapshots/comandos preservados. API é simulador local, não banco central persistente.

## 5. INDEPENDENCIA

Inventário por arquivo: [.qa/runs/f23-final-WqkvBC/artifact-inventory.json](../../.qa/runs/f23-final-WqkvBC/artifact-inventory.json). Hashes abaixo agregam pares ordenados caminho/hash por alvo, não são hash de um único bundle. [Definição e valores](../../.qa/runs/f23-fixture-recheck-DwXDba/six-target-delivery-hashes.json).

| Alvo | Arquivos | SHA256 agregado |
| --- | ---: | --- |
| shell | 19 | `1f26e86869b46cd178a1e10c2b1d5719f4670af9ec2c31a6800ee4dc0034b60f` |
| capataz | 4 | `c2d44382581ae1c133089cf48e2435dea360282fb59830b358e751b1dda3e1ee` |
| gerente | 4 | `74ef0d408b4cb8214ddf02f4563c993c0f34ace961a36c136041b1d8edf096bd` |
| escritorio | 4 | `e5e21b47add8140b68fd5806a2400d7a9aee8ac1fa08a347af1e012b438639fe` |
| fabrica | 4 | `9f7f29ca01e378183787e28d10fea3dc36cfc227d35da71ba84c3c94294b7cc5` |
| ADM | 17 | `8730484963560fe4da5733749d2adacdaa2e26fa32e5f60adf3b9f7c5e4b9cd5` |

Todos os seis alvos preservados na revalidação final. Publisher demonstrou Capataz alterado sem alterar os demais perfis e shell; loader sem imports privados dos perfis. Atualização seletiva, formulário sujo, fotos/comandos, cold reopen e rollback N-1 passaram em ambas engines. Incompatibilidade/ausência de bridge impede ativação; clientes v1 já saudáveis continuam funcionais sem conceder saúde a candidatos novos. Locks nativos entre workers preservam ponteiros diante de estágios concorrentes. Shell exige consentimento válido e ativação confirmada; cold start não concede consentimento.

## 6. SEGURANCA

Negativas sintéticas de tenant, role, contexto, token, adulteração, cursor, ACK, quota e revogação executadas. Auth offline PBKDF2/AES-GCM e HMAC de dispositivo não extraível, prazo local finito 24 h; provisionamento somente após API/vínculo e seed/assets completos. Token/sessão administrativa em memória; 401/403/expiração suspendem acesso e preservam trabalho local.

Scan exato de marcadores secretos dos seis artefatos publicáveis passou; build lab positivo continha marcadores esperados e foi excluído do candidato. [Scan](../../.qa/runs/f23-final-WqkvBC/secret-scan.json). Isso não certifica ausência universal de segredo. CSP/sandbox e isolamento lógico local não equivalem a proteção contra comprometimento do SO/XSS; DB operacional não cifrado e revogação desconhecida offline continuam limites. Auditoria remota de advisories/dependências NAO_EXECUTADO. SEO privado N/A: não há objetivo de indexação pública.

## 7. QA

Windows; Bun 1.4.2, Node v24.19.0, Go Task 3.54.0; Chromium e WebKit reais Playwright. Comandos exatos, ambiente de processo, exitCode, duração e SHA256 dos logs estão em cada job do recibo; runners: run-f23-final-local.ts e recheck-f23-final-fixtures.ts, execução explícita --execute-frozen. Typecheck/build e suites existentes efetivamente exercitados. task doctor canônico PASS; setup/gates legados não executados por escreverem fora do laboratório. Docker/act opcionais não usados.

| Gate | Resultado local |
| --- | --- |
| Q8 | 457 PASS, 0 FAIL |
| Runtime nativo | 103 PASS, 549 assertions |
| Worker direto | 16 PASS (sobrepõe suite combinada; não somar) |
| IndexedDB real | 30 Chromium + 30 WebKit |
| Stores/Views reais | 28 + 28 |
| Auth-storage | 7 + 7 |
| Worker browser | 20 + 20 |
| Contrato alternativo | 74 verificações, 72 casos JSON independentes, 8 Blobs |
| Compatibilidade v1 instalada | 10 casos reais, RPC além de 16,5 s |
| ADM isolado | 2 engines PASS_LOCAL_CONTROLS_ONLY; serviço 9/69 |
| Auditoria dispositivos | 24 combinações; 168 scans Axe 4.13, 0 violações |
| Independente / aparelho físico / AT | NAO_EXECUTADO |

ADM autoritativo atual: [.qa/runs/t06-admin-2026-11-06T00-59-00.027Z-23544/result.json](../../.qa/runs/t06-admin-2026-11-06T00-59-00.027Z-23544/result.json), substitui referência anterior do relatório T06. Exceção de escopo: somente fixture anti-first-match de unidade mudou fora do harness/runtime ADM; prova exata no recibo final.

[Auditoria dispositivos e métricas](t07-device-audit-2026-11-05.md): desktop 1366×900, mobile 390×844, tablet 820×1180 × 4 perfis × 2 engines. Incompletos de iframe resolvidos por auditoria direta; contraste fora da viewport resolvido por scroll real, 0 incomplete no recheck. Seis checkboxes QR de 12/13 px dentro de labels clicáveis mantêm flag geométrica para avaliação manual/física. Não declarar certificação WCAG.

Métricas observadas sem SLA/throttle: login→saudável Chromium 932–960 ms/WebKit 1938–2501 ms; 120 trocas de aba 71–141/126–226 ms. Shell transferido 417245–418443/448077–449275 bytes. transferSize=0 de dataURL não comprova download zero.

Falhas iniciais WqkvBC, KGlkwh e P7RUTp preservadas. Seis arquivos de teste/runner corrigidos, sem alteração do runtime congelado; o rechecker exige igualdade de todos os demais arquivos, inventários e hashes de logs e não reutiliza FAIL. Revisão técnica dos recibos não substitui QA independente.

## 8. PARIDADE

[Inventário detalhado por jornada](../../frontend/audit/F23-PARIDADE-E-SEGURANCA-2026-11-05.md). Consultas e mutações locais delimitadas foram testadas; paridade integral permanece PARCIAL. Capataz: trato/foto duráveis, QR óptico ainda simulado. Gerente: meta GMD local, sem motor nutricional ou consolidação central presumida. Escritório: nota manual durável, compra/partição parciais; partição não comprova conservação do rebanho; relatório apenas solicitado, sem geração de PDF. Fábrica: fórmula local durável, estoque/calibração manuais sem equipamento. Não se inventaram regras centrais para completar essas lacunas.

## 9. PENDENCIAS

QA independente do owner reservado; instalação física/OS, câmera/scanner/balança e tecnologias assistivas. Ensaio específico de banco operacional inteiro ausente/corrompido e recuperação permanece pendente; corrupção de anexos/schema/cursor não substitui esse cenário completo. Persistência central/PostgreSQL, auth/MFA/licenciamento reais, integração entre perfis e resolução de conflitos por domínio dependem de contrato/autorização futura. API atual perde dados ao reiniciar o processo. Crescimento dos caches completos sem GC e quotas do browser requerem política futura; ausência de Web Locks nativo bloqueia instalação/atualização segura. ADM falha fechado para ativo corrompido, sem rollback automático desse caso. Nenhuma pendência é marcada como aceita.

## 10. ROLLBACK/HANDOFF

Rollback local de módulo/shell usa geração saudável N-1 verificada e consentimento/quiescência conforme runbook; não apagar IndexedDB, filas, fotos ou caches completos manualmente. Falha de candidato conserva versão anterior. Reversão de código deve selecionar alterações F23 por diff/revisão, preservando arquivos concorrentes; não usar reset destrutivo. Não há publicação a reverter.

CEREBRO atualizado e recibos encaminhados à fila local, status A_FAZER_LOCAL com owner reservado preservado. Texto para o coordenador: “F23 laboratório a3ec pronto para QA independente; HEAD/base 25a4d8ad2ad4fae7c3a4f77e4912394801c81154, dirty=true, fingerprint testado 5509ebdaf67e0fe9c88bd911d112aa05a142fca55f43d87a971ce32b7ff110c9; 21 gates locais cobertos com reutilização comprovada, hardware/independente pendentes, produção NO_GO. Sincronizar CONSUBOV_HANDOFF_CONTINUIDADE.md, Checklist Mestre e Notion após revisão dos recibos; não marcar F23 homologada.” Esses arquivos da raiz e Notion foram preservados. Nenhum remoto de produto, banco ou produção foi modificado.
