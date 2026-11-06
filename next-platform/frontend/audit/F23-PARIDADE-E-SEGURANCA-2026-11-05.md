# F23 — inventário de jornadas, paridade e segurança

Data: 05/11/2026 (alguns recibos têm data UTC 06/11). Escopo: laboratório `next-platform/**`, worktree `a3ec`, baseline registrada `25a4d8ad2ad4fae7c3a4f77e4912394801c81154`, árvore dirty. Documento de revisão de código e evidências existentes, sem execução de novos testes, builds, servidores, Git mutations, serviços externos ou produção por este autor. **Não aprova a fase, QA independente ou produção.** O SHA base sozinho não identifica os bytes dirty testados.

## Como interpretar

- `IMPLEMENTADO_TESTADO`: comportamento delimitado por evidência executada; não significa paridade integral do produto.
- `PARCIAL`: código existe, mas o alcance funcional ou a prova da jornada completa é limitado.
- `PENDENTE`: recurso/prova ainda ausente.
- `BLOQUEADO`: exige decisão, contrato ou autorização fora deste laboratório.
- `NAO_EXECUTADO`: campo de execução, inclusive hardware físico; não converter em aprovação por emulação.

Todas as jornadas locais abaixo exigem provisionamento inicial online, módulo completo verificado e seed autorizado. O shell fornece `ModuleLocalDataAPI` via RPC; os stores não usam `Map` como banco operacional. Gravação confirmada depende da transação IndexedDB concluir. As projeções de `packages/domain-projection/src/` são compartilhadas com o simulador API, sem importar stores de browser. Isso demonstra coerência da regra implementada, não validade de regra de negócio ausente.

## Evidência e seu alcance

| ID | Evidência existente | O que comprova / limite |
| --- | --- | --- |
| E1 | `frontend/handoff/F23-T03-PROGRESS-2026-11-05.md`; `.qa/runs/t03-2026-11-05T23-33-04.347Z-10416.json`; `qa/scripts/t03-cold-offline-e2e.mjs` | 8/8, quatro perfis em Chromium/WebKit, fechamento/reabertura do processo e login sem rede, snapshots/outbox iguais e registro renderizado. Mutação por UI: trato, meta GMD, nota e fórmula, respectivamente. Não exercita todos os formulários por E2E. |
| E2 | `.qa/runs/t03-shared-2026-11-05T22-58-04.034Z-16352-8923e027-f4f2-4928-ae20-9f718ca844d6.json`; `.qa/runs/t03-rpc-stale-2026-11-05T22-59-05.678Z-16556.json` | 2/2 contas/download seletivo e 2/2 CAS por iframes reais. Anteriores à integração final T05. |
| E3 | `frontend/tasks/F23-T04-IMPLEMENTACAO.md`; `.qa/runs/t04-2026-11-05T23-33-14.353Z-22100.json` | 121 testes API na rodada registrada; browser 2/2 com foto/trato, perda de ACK, retry e segundo dispositivo. API é simulador em memória de processo. |
| E4 | `packages/domain-projection/test/projection-parity.test.ts`; testes de stores/Views referidos em E1 | Contratos unitários das mutações dos quatro perfis e equivalência de projeção. `LocalDataAPI` de unidade não prova IndexedDB ou hardware. E1 registra stores/Views reais 28/28 por engine e adaptador 16/16 por engine em rodadas distintas. |
| E5 | `qa/fixtures/protocol-v1-rust/REPORT.md`; `.qa/portable-contract-result.json` | 74 verificações Chromium/WebKit pelo publisher/worker/ModuleFrame, JS e Rust/Wasm independentes; oito RPCs, Blob e validação independente JSON. Sem ensaio HTTP de cliente externo; cursores/conflitos vazios têm alcance limitado. |
| E6 | `frontend/handoff/F23-T05-PUBLISHER-2026-11-05.md`; `.qa/runs/t05-app-2026-11-06T00-17-26.567Z-12404/`; `frontend/checklists/F23-IMPLEMENTACAO-2026-11-05.md` | App 2/2: formulário sujo, troca seletiva, rollback, comandos/foto e reinício. Rodada registrou runtime estável mas estabilidade global false por teste concorrente; não é matriz final estável. Regressão posterior do lock entre workers deve constar na matriz final. |
| E7 | `qa/reports/t06-admin-browser-2026-11-05.md`; `.qa/runs/t06-admin-2026-11-06T00-35-04.848Z-19864/` | ADM candidato 2 engines, autorização API/auditoria, negativas e update consentido; hashes antes/depois iguais, `sourceUnchanged: true`, dirty declarado. Serviço 9 testes/69 assertions. Instalação física e backend persistente não executados. |

Esses recibos são cumulativos de desenvolvimento. A matriz final deve repetir os gates necessários, identificar seus próprios artefatos, SHA inicial/final, dirty, inventários e `sourceUnchanged`. Este inventário não transforma resultados anteriores em teste da revisão final.

## Capataz

Fontes: `apps/fazenda/capataz/src/CapatazView.tsx`, `components/Capataz{Cocho,Qr,Contagem,Fotos,Historico}Tab.tsx`, `store/capatazStore.ts`, `packages/domain-projection/src/capataz.ts`.

| Jornada | Comportamento local / comando | Estado e limite |
| --- | --- | --- |
| Consultar pastos, lotes, produtos e histórico | Snapshot autorizado e registros locais hidratados; histórico exibe registros já persistidos. | `IMPLEMENTADO_TESTADO`, E1/E4; abrangência só dos dados baixados. |
| Registrar trato/leitura de cocho | `registrarLeituraCocho`, `capataz.cocho.registrar_escore`; atualiza projeção, snapshot e comando durável. | `IMPLEMENTADO_TESTADO`, UI/reabertura E1 e envio E3. Confirmação local não é ACK central. |
| Leitura de pasto/QR e justificativa manual | `registrarLeituraQrPasto`, `capataz.pasto.leitura_qr`; altura/condições/justificativa persistidas. | `PARCIAL`, projeção E4. `handleSimulateScan` copia `qr_code_esperado` e seleção já preenche o código; não há leitura óptica implementada. Scanner/câmera QR `PENDENTE`, hardware `NAO_EXECUTADO`. |
| Contagem, bezerros e mortalidade | `registrarContagemRebanho`, `capataz.animais.contagem`, registro local e comando. | `PARCIAL`, implementação/contrato E4; sem alegação de E2E frio individual deste formulário. |
| Anexar/ver foto por pasto | File input `accept=image/*`, `capture=environment`, compressão real e `anexarFotoCocho`; bytes/hash/referência persistidos; reconstrução Blob na hidratação. | `IMPLEMENTADO_TESTADO` para arquivo de teste e durabilidade/envio, E3/E6. Câmera física, permissões/chooser do SO e qualidade em aparelho `NAO_EXECUTADO`. |
| Tratar erro/conflito | Erro de gravação exposto, comandos preservados; DTO de problemas sem apresentar fila/status técnico. | `PARCIAL`: preservação E3; resolução de domínio por substituir/arquivar não implementada e não há LWW inventado. |

## Gerente

Fontes: `apps/fazenda/gerente/src/GerenteView.tsx`, `components/Gerente{Dashboard,Gmd,Lotes,Custos,CochoAudit}Tab.tsx`, `store/gerenteStore.ts`, `packages/domain-projection/src/gerente.ts`.

| Jornada | Comportamento local / comando | Estado e limite |
| --- | --- | --- |
| Dashboard, indicadores, lotes e custos | Renderiza snapshot/projeção local; refresh hidrata dados locais. | `IMPLEMENTADO_TESTADO`, E1/E4. Não comprova atualização ao vivo de informações ainda não recebidas. |
| Definir metas GMD | `definirMetas`, `gerente.metas.definir`; meta, abate/estratégia/consumo no lote e KPI de meta. | `IMPLEMENTADO_TESTADO`, UI e reinício E1, projeção E4. Não há cálculo completo de crescimento futuro. |
| Ajustar dieta/curva | `ajustarDieta`, `gerente.gmd.ajustar_curva`; altera consumo esperado do lote. | `PARCIAL`, E4; nome da ação não prova motor nutricional ou previsão de curva. |
| Transferir lote de pasto | `transferirPasto`, `gerente.lote.transferir_pasto`; troca pasto no lote. | `PARCIAL`, E4; nome do destino na projeção recebe seu ID, sem cadastro central novo. |
| Apropriar custos | `apropriarCustos`, `gerente.custos.apropriar`; substitui rateios calculando percentual dos itens. | `PARCIAL`, E4; não equivale a contabilidade central consolidada. |
| Auditar leitura de cocho | `aprovarLeituraCocho`, `gerente.leitura_cocho.aprovar`; aprovar/ajustar/rejeitar registro já disponível. | `PARCIAL`, E4; registros novos de outra conta/perfil dependem de contrato/projeção recebida. Não há prova de integração automática Capataz→Gerente. |

## Escritório

Fontes: `apps/fazenda/escritorio/src/EscritorioView.tsx`, `components/Escritorio{Dashboard,Notas,Compras,Lotes,Financeiro}Tab.tsx`, `store/escritorioStore.ts`, `packages/domain-projection/src/escritorio.ts`.

| Jornada | Comportamento local / comando | Estado e limite |
| --- | --- | --- |
| Dashboard e consultas | Notas, pedidos, lotes, fechamentos/KPIs da projeção local. | `IMPLEMENTADO_TESTADO` no escopo E1/E4; sem consulta fiscal/financeira externa. |
| Registrar entrada de nota | `registrarNotaFiscal`, `escritorio.notas.registrar_entrada`; formulário manual, itens e nota persistidos. | `IMPLEMENTADO_TESTADO`, UI/reinício E1 e projeção E4. Não há emissão/autorização NFe, SEFAZ, OCR ou importação fiscal comprovada. |
| Criar pedido de compra | `criarPedidoCompra`, `escritorio.compras.criar_pedido`; pedido local pendente. | `PARCIAL`, E4. Projeção incrementa KPI `comprasAprovadas` embora o pedido seja `pendente`; não interpretar como aprovação, comunicação a fornecedor ou entrega. |
| Cadastrar lote | `cadastrarLote`, `escritorio.lotes.cadastrar`; novo registro local e comando. | `PARCIAL`, E4; sem E2E frio individual declarado. |
| Particionar lote | `particionarLote`, `escritorio.lotes.particionar`; cria filhos com IDs derivados do comando. | `PARCIAL`, E4. Reducer adiciona filhos sem deduzir cabeças/remover origem; conservação de rebanho não implementada nesta regra. Requer decisão de domínio, não correção presumida pelo auditor. |
| Fechar custos por lote/período | `fecharCustoLote`, `escritorio.custos.fechar`; soma manual e registro de fechamento. | `PARCIAL`, E4; não equivale a fechamento contábil autorizado central. |
| Solicitar relatório financeiro | `emitirRelatorio`, `escritorio.relatorios.emitir`; registra comando. `reduceEscritorioRelatoriosEmitir` não gera saída. Feedback informa solicitação registrada. | `PARCIAL` para pedido; geração/download PDF/CSV/JSON `PENDENTE`. Não há endpoint de geração no router, arquivo emitido ou comprovante de relatório central. |

## Fábrica

Fontes: `apps/fazenda/fabrica/src/FabricaView.tsx`, `components/Fabrica{Dashboard,Formulas,Batidas,Silos,Calibracao}Tab.tsx`, `store/fabricaStore.ts`, `packages/domain-projection/src/fabrica.ts`.

| Jornada | Comportamento local / comando | Estado e limite |
| --- | --- | --- |
| Dashboard, fórmulas, batidas, silos e calibrações | Consulta snapshot/projeção persistida. | `IMPLEMENTADO_TESTADO`, E1/E4; estoque é projeção dos registros, não telemetria física. |
| Salvar fórmula nutricional | `salvarFormula`, `fabrica.formulas.salvar`; composição e validação de 100% no formulário. | `IMPLEMENTADO_TESTADO`, UI/reinício E1 e projeção E4; não é validação agronômica da formulação. |
| Iniciar/concluir batida | `iniciarBatida`/`concluirBatida`, `fabrica.batidas.iniciar`/`.concluir`; registros e efeitos de estoque definidos no reducer. | `PARCIAL`, E4; sem acionamento de misturador, balança ou ensaio físico. |
| Ajustar silo/estoque e receber matéria-prima | `ajustarEstoque`/`receberMateriaPrima`, `fabrica.estoque.ajustar`/`fabrica.materia_prima.receber`. | `PARCIAL`, E4; entrada manual local, sem integração de compra/nota/fornecedor comprovada. |
| Registrar calibração | `calibrarBalanca`, `fabrica.balanca.calibrar`; peso padrão/medido informados, desvio calculado e certificado digitado. | `PARCIAL`, E4. Não calibra equipamento fisicamente nem valida certificado INMETRO; balança e SO `NAO_EXECUTADO`. |

## O que exige comunicação ou contrato central

`api/src/router.ts` oferece health, login, commands, sync, attachments e admin/audit. Login inicial, escolha/validação de vínculo, seed inicial, renovação, recebimento de revogação e transferência de dados entre dispositivos precisam da API. ACK, pull incremental, upload/download e auditoria são implementados/testados **contra simulador local** (E3/E7). Offline conserva trabalho local; não permite conhecer revogação ainda não recebida.

`api/src/ledger/in-memory-ledger.ts` guarda comandos, idempotência, snapshots, anexos e cursores em `Map`; `api/src/auth/grants.ts` mantém grants laboratoriais. Reiniciar servidor perde esse estado. PostgreSQL persistente e recuperação central são `BLOQUEADO` por autorização futura; nenhuma conexão remota ou migration ocorreu neste trabalho. Projeções são por escopo/perfil; não presumir consolidação automática entre os quatro perfis. Regras adicionais e geração central de relatório são `PENDENTE`.

## Fronteiras de segurança observadas

| Controle | Estado / evidência e limite |
| --- | --- |
| Autoridade de identidade e vínculo | `IMPLEMENTADO_TESTADO` no laboratório: `packages/auth-client/src/service/provisioned-auth-service.ts`, handlers auth/middleware/grants, E1/E3. Browser não concede vínculo por selecionar perfil; um perfil por conta, contexto validado. |
| Credencial offline | AES-GCM, PBKDF2-SHA256 (310.000 iterações), salt/IV e HMAC de integridade com CryptoKey de dispositivo não extraível em IndexedDB; `storage/provisioned-auth-storage.ts` e `service/provisioned-auth-service.ts`. Testes de serviço 7/7 e browser 4/4 por engine registrados E1. Senha incorreta, adulteração, expiração e logout são recusados. Não há garantia de hardware seguro. |
| Prazo/revogação | Política de laboratório 24h, tolerância temporal explícita no código; renovação online e relógio local são limites. Revogação offline imediata, resistência a rollback de relógio/OS e política de produção `PENDENTE`; autorização temporal não equivale a licença off-grid assinada. |
| Dados operacionais em repouso | **Não cifrados** no adaptador operacional: snapshots/outbox/anexos legíveis à origem. Credencial cifrada não cifra esses dados. Partições por identidade/contexto e CAS são controles lógicos, não fronteira contra XSS, extensão, usuário do OS ou perfil de browser comprometido. Avaliação de ameaça e eventual cifragem operacional `PENDENTE`. |
| Módulo/shell | iframe opaco/sandbox e canal validado por nonce/contexto, RPC limitado; token permanece no host. Artefatos verificados antes de habilitar conta. E2/E5. Sandbox não torna armazenamento da mesma origem imune a código host malicioso. |
| ACK/anexos/idempotência | E3: grants/contexto/capability/DTO, OCC, identidade e conteúdo imutáveis, dependências de foto/hash verificadas; resposta tardia/logout e 401/403 tratados no host. Durabilidade central não demonstrada por ledger process-local. |
| Atualização | Consentimento explícito por candidato, integridade, quiescência e gerações N/N-1; E6/E7. Não converter cold start em consentimento ou descartar shell instalado. Correções posteriores exigem recibo final próprio. |
| CSP/headers | E7 confere resposta HTTP real do servidor QA (CSP, nosniff, referrer e permissions policy). Não é teste exaustivo de XSS nem comprovação de HTTPS/HSTS em produção; HTTP loopback é laboratório. |
| Dependências | `bun.lock` e manifests presentes; nenhuma consulta de advisories/audit de registry executada por este autor. Resultado de vulnerabilidades **NÃO VERIFICADO**, não “zero CVEs”. Gate final deve registrar ferramenta, lock efetivamente lido, retorno e limite da varredura. Não trocar dependências sem owner. |

Não foi estabelecida nova reprodução P0 de segurança nesta revisão estática delimitada. Isso não equivale à ausência de vulnerabilidades; limites acima e gates pendentes permanecem abertos.

## ADM separado e exclusão de simulação privilegiada

`apps/admin-global/src/main.tsx` importa `@admin-entry`; `vite.config.ts` seleciona `src/secure/AdminRuntime.tsx` em candidate/production/development. Somente `--mode lab` escolhe o entry legado explícito. O candidato usa `secure/admin-service.ts`: sessão online mantida em memória, grant administrativo conferido no servidor e consulta de auditoria. Sem mint JWT no browser, MFA fictício, restauração de privilégio do localStorage ou administração offline. Cache não guarda `/api/` e o teste não encontrou banco IndexedDB ADM (E7).

`TenantsView`, `GlobalUsersView`, `LicensesView`, modais de bloqueio/vínculo/licença e store legado existem na árvore de **simulação**, não demonstram CRUD central disponível no candidato. CRUD administrativo, MFA real, licença off-grid assinada, emissão/revogação persistente de licença e administração offline são `PENDENTE`/`BLOQUEADO` conforme contrato/autorização. Nunca apresentar UI de laboratório como serviço implementado.

E7 leu todos os arquivos emitidos de N/N+1/N+2, incluindo JSON/snapshots e eventuais sourcemaps, e registrou zero marcadores exatos proibidos no candidato e zero imports do grafo legado vedado. Controle positivo lab: 16 ocorrências, comprovando alcance da exclusão. Manifest/ícones/CDP, worker e atualização passaram nos dois engines; Add to Home Screen/instalação do SO em aparelho é `NAO_EXECUTADO`. Cache/storage/session/origem de Fazendas permaneceram iguais na janela controlada E7.

## Política para scan dos artefatos finais

O owner da matriz deve inventariar os **artefatos realmente construídos nesta execução**, caminhos + bytes + SHA-256; percorrer também arquivos sem extensão JS, JSON, HTML, snapshots, CSS e sourcemaps. Buscar valores exatos das fixtures de senha/identidade laboratorial, segredo de assinatura e símbolos privilegiados proibidos; derivar a lista de fontes de fixtures e da política já usada em `qa/scripts/t06-admin-pwa-e2e.ts`. Não registrar os valores no log: somente identificador do marcador, contagem e path. Erro de leitura ou ausência de artefato falha o scan.

No shell/módulos públicos, fixtures de credenciais/segredo de assinatura/MFA fictício não podem aparecer. No ADM candidato, também não pode entrar o grafo legado privilegiado; comparar o grafo do build além do texto. Testes e servidor lab são escopos permitidos de fixture, separados do output publicável. Buscar genericamente “password”, “fake”, “MFA” ou “admin” produz falsos positivos de formulários/contratos/dicionário e não substitui busca exata. Controle lab deve ser explicitamente isolado e jamais incluído no pacote candidato. O recibo final deverá apontar seus paths; este documento não inventa um scan futuro como concluído.

## Pendências para aceite

`PARCIAL`: inventário cobre as abas/handlers existentes dos quatro perfis, mas a prova fria por UI cobre quatro mutações representativas. Restantes ações têm contrato/projeção e evidência focada, não E2E individual completo. Desktop/mobile/tablet em emulação não equivalem a instalação, câmera, scanner ou balança física. Acessibilidade integral por leitor de tela/teclado, performance com orçamento medido em aparelho e homologação de usuários são `PENDENTE`/`NAO_EXECUTADO`; scanner de literais/i18n não substitui esses gates.

Pendentes de entrega final: matriz repetível com revisão estável e recibos coerentes, scan dos bundles finais/dependências, revisão independente e registro das limitações. T07 e produção continuam sem aceite. Este arquivo é congelado para a janela final de QA; resultados produzidos depois devem ficar nos recibos/relatório final do owner, sem reescrever retroativamente evidência anterior.
