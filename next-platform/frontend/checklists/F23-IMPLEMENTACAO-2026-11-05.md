# F23 — checklist de implementação e evidência

Estado: PRONTO_PARA_QA_INDEPENDENTE (implementação e QA locais; homologação independente pendente). Base `25a4d8ad2ad4fae7c3a4f77e4912394801c81154`, worktree exclusiva `a3ec`, árvore dirty. Itens executados não equivalem a homologação de fase ou evidência de revisão final estável. Escopo de escrita restrito a `next-platform/**`; checklist mestre da raiz preservado conforme PRD específico.

## T00

- [x] Registrar clone, baseline, worktree, ownership e fronteiras: `frontend/handoff/F23-T00-PREFLIGHT-2026-11-05.md`.

## T01

- [x] Artefatos separados dos quatro módulos; loader runtime sem imports privados dos perfis.
- [x] Comparar hashes de dois builds do shell com override de fonte Capataz: `check-shell-independence.ts`, zero fontes de perfil carregadas, hashes iguais.
- [x] Validar mensagens negativas, nonce, contexto do shell e limites: suites Q1 runtime/serialization.
- [x] Publicar JSON Schema/OpenAPI e validar com implementação independente Python/jsonschema: `q1-public-transport.test.ts`.
- [x] Bootstrap + leitura IndexedDB por fixture Rust/Wasm em Chromium/WebKit: `run-portable-module.ts`.
- [x] Oito RPCs e Blob de módulo independente JS/Rust-Wasm pelo publisher/worker/ModuleFrame reais: 74 verificações Chromium/WebKit, 72 mensagens JSON Python/schema/runtime e 8 pedidos binários. `qa/fixtures/protocol-v1-rust/REPORT.md`, `.qa/portable-contract-result.json`; limites explícitos de cursor/conflitos vazios e ausência de ensaio HTTP.

## T02

- [x] Validar login/vínculo na API antes de conceder contexto/token; um perfil por conta.
- [x] Autenticação local cifrada, validade finita, adulteração/logout/expiração: serviço 7/7; browser 4/4 por engine.
- [x] Impedir nova credencial antes de assets completos e seed autorizado; seed dos quatro perfis 4/4 em testes API.
- [x] Dois usuários no mesmo navegador, downloads seletivos e isolamento: `.qa/runs/t03-shared-2026-11-05T22-58-04.034Z-16352-8923e027-f4f2-4928-ae20-9f718ca844d6.json`, 2/2. Evidência anterior à integração T05; repetir na matriz final.
- [x] Reabertura/login offline no build atual em Chromium/WebKit: matriz 8/8, `.qa/runs/t03-2026-11-05T22-49-47.325Z-17508.json`.
- [ ] Completar ensaio específico de banco operacional inteiro ausente/corrompido e recuperação. Corrupção de anexos, rollback/schema e recuperação de cursor foram testados; não equivalem a esse cenário completo.

## T03

- [x] IndexedDB real e migração, rollback/quota, anexos verificados e IDs append-only: 16/16 por engine.
- [x] CAS do estado completo, duas stores em agregados distintos, revisão legada e seed sem sobrescrita: 20/20 por engine.
- [x] Remover fila/status de envio visíveis no Escritório e confirmação de outbox no Capataz; testes administrativos/campo 23/23.
- [x] CAS via dois iframes reais e tradução de erro RPC: `.qa/runs/t03-rpc-stale-2026-11-05T22-59-05.678Z-16556.json`, 2/2. Evidência anterior à integração T05.
- [x] Matriz E2E dos quatro perfis com snapshots/comandos iguais e registros renderizados após reinício offline: 8/8 no relatório acima.
- [x] Congelar fontes e registrar SHA, dirty, sourceUnchanged, logs e resultados coerentes: recibo final DwXDba, fingerprint 5509ebdaf67e0fe9c88bd911d112aa05a142fca55f43d87a971ce32b7ff110c9.

## T04–T07

- [x] T04 implementação local: API autorizada, idempotência imutável, ACK/pull/anexos e scheduler silencioso. API 121/121; E2E Chromium/WebKit 2/2 `.qa/runs/t04-2026-11-05T23-33-14.353Z-22100.json`. Limites e ausência de homologação em `frontend/tasks/F23-T04-IMPLEMENTACAO.md`.
- [x] T05 implementação local: releases por módulo, N/N-1, rollback e incompatibilidade sem perda de dados; App 2/2 e worker 22 unitários + Chromium 20/20 + WebKit 20/20 após correção entre workers. `.qa/runs/t05-worker-generations-2026-11-06T00-32-32-528Z/`; aceitação independente permanece pendente.
- [x] T06 implementação local: ADM com identidade/origem/caches/sessão próprios, build padrão sem mocks e API administrativa de consulta. `.qa/runs/t06-admin-2026-11-06T00-35-04.848Z-19864/`: Chromium/WebKit PASS, fontes estáveis, HEAD/dirty registrados; serviço 9/9, 69 assertions. Instalação física e produção não aprovadas.
- [x] T07 execução local: portabilidade/cleanup Q8, matriz real desktop/mobile/tablet, segurança/a11y/performance, docs e envio à fila independente. Aceite independente não executado.

Nenhum deploy, push, PR, merge, banco remoto ou produção autorizado neste escopo.

## T05 publisher local (parcial)

- [x] Releases imutaveis por perfil, staging verificado, selector atomico, N-1 e guards de path/junction: 3/3 testes e 21 asserts em `q7-immutable-publisher.test.ts`.
- [x] Builds isolados reais: Capataz versionado sem alterar os tres outros perfis; dois shells identicos com alteracao somente Capataz; template SW alterado gera identidade distinta. `.qa/tmp/t05-artifacts-2026-11-05T23-44-38.900Z-14576/result.json` e `frontend/handoff/F23-T05-PUBLISHER-2026-11-05.md`.
- [x] Integração browser, ativação/rollback, incompatibilidade e typecheck revalidados na matriz final; runtime congelado e artefatos preservados, recibo DwXDba.

## T05 proteção e gerações (parcial)

- [x] Worker/cache: gerações fixadas, integridade, N/N-1, quarentena limitada, consentimento com prazo, bloqueio por outra janela e retenção de caches completos. `.qa/runs/t05-generations-final-20261106T000558Z/`: 18 testes/132 assertions; Chromium 18/18 e WebKit 18/18; arquivos próprios estáveis e árvore dirty declarada.
- [x] Bridge privado, formulário e lease: testes unitários 15/15 e fixture de formulário Chromium/WebKit `.qa/t05-quiescent-form-browser.json`. Camera chooser/compressão e RPC seguem locks de operação.
- [x] Host aguarda IDB real, auth e todo o ciclo de envio; testes auth/runner/adapter 30/30, 123 assertions. Coordenador/barreira 25/25, 103 assertions, incluindo ACK tardio, contexto alterado e ausência de consentimento implícito.
- [x] JSON Schema v1 público aditivo e rotas imutáveis: 5/5, 344 assertions. Clientes antigos continuam válidos no protocolo; ausência de bridge bloqueia ativação enquanto o módulo está aberto.
- [x] Corrigir regressão de disponibilidade de cliente v1 já instalado sem mensagem nova de saúde. Red Chromium/WebKit e green 10 casos reais em `.qa/runs/legacy-health-1793926574537-02414737/`: RPC antes/depois de 16,5 s, ponteiro saudável preservado, reabertura sem comunicação e ativação bloqueada sem bridge. Candidatos sem saúde e handshake ausente continuam falhando fechados.
- [x] App completo Chromium/WebKit: formulário sujo preservado, troca seletiva, rollback N-1, 2 comandos/foto duráveis, reabertura fria e login local. `.qa/runs/t05-app-2026-11-06T00-17-26.567Z-12404/`; runtimeSourceUnchanged=true, estabilidade global false por alteração concorrente de teste portátil registrada. Correção posterior de lock entre workers exige nova regressão final T07.
- [x] Registrar congelamento global, relatório por SHA e envio ao gate independente: qa/reports/f23-final-local.md e fila local no CEREBRO. Homologação independente permanece pendente.

## T07 infraestrutura e entrega (em execução)

- [x] Substituir paths/SHA/stash-count fixos por baseline observado da worktree e checkout canônico, incluindo untracked e hashes. Helper de segurança: 4/4, 18 assertions. Suites Q1/Q8 focadas: 49/49, 7761 assertions; sem limpeza de diretório alheio.
- [x] Runner Q8 usa processos sem shell, saídas próprias, veredictos derivados e gate local separado de browser/hardware/QA independente. Relatório puro: 7/7. Não lê recibo anterior como autoaprovação.
- [x] Inventário de paridade e segurança por jornada: `frontend/audit/F23-PARIDADE-E-SEGURANCA-2026-11-05.md`. QR simulado, integração física, relatório solicitado e demais limites declarados.
- [x] Arquitetura/runbook duráveis e diretórios frontend exigidos: `docs/f23-runtime-local.md`, `frontend/README.md`. Referências visuais N/A, sem rebranding.
- [x] Executar auditoria inicial real com Axe 4.13 em 24 combinações de engine/viewport/perfil; 24 funcionais/teclado/erros passaram e acessibilidade falhou, sem converter em aprovação. `.qa/runs/t07-devices-DRHuMH/`; correções de acessibilidade implementadas aguardam nova medição na matriz final.
- [x] Executar matriz final congelada: 21 gates completos (20 reutilizados com prova estrita, 1 novo no recibo final), 24 combinações/168 scans Axe sem violações; falhas anteriores preservadas.
- [x] Entregar recibo/scope/hash à fila local de QA no CEREBRO; owner reservado preservado, QA independente A_FAZER_LOCAL. Relatório: `qa/reports/f23-final-local.md`.

`task doctor` executado pelo Taskfile canônico passou (Bun 1.4.2, Go Task 3.54.0). `task setup`/gates legados não executados: seus efeitos/dependências ficam fora do escopo `next-platform/**`; não foram usados para aprovar este laboratório.

## Fechamento local T07 — 05/11/2026 (recibos UTC 06/11)

Recibo autoritativo: `.qa/runs/f23-fixture-recheck-DwXDba/result.json` + `output.log`; 21 gates, sourceUnchanged=true, HEAD/base igual e dirty=true. Q8 457/457; runtime 103/103; worker direto 16/16; IndexedDB 30/30 por engine. ADM atual: `.qa/runs/t06-admin-2026-11-06T00-59-00.027Z-23544/result.json`. Auditoria final: `qa/reports/t07-device-audit-2026-11-05.md`. Os recibos finais substituem as pendências de repetição dos registros históricos acima. Esta anotação documental posterior ao QA tem hash separado em `.qa/runs/f23-fixture-recheck-DwXDba/post-qa-documentation.json`; runtime e testes não mudaram.

- [ ] Aceite por QA independente no escopo final.
- [ ] Homologação física de instalação, câmera/scanner/equipamento e tecnologias assistivas.

Produção NO_GO. Nenhum remoto foi modificado. Coordenador deve sincronizar Checklist Mestre e Handoff Vivo após avaliar os recibos; arquivos da raiz e Notion não foram editados.
