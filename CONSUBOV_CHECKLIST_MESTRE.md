# CONSUBOV — Checklist Mestre de Execução

> **Revisão consolidada:** 2026-10-12. **Branch ativa:** `work/fase5-6-7-pwa-local`. **PR:** #43, draft. **QA integral das FASES 5–7: PENDENTE.**

## 1. Fonte de verdade e preservação do planejamento

Este arquivo é o painel atual. Nenhum requisito detalhado foi excluído ou dispensado pela consolidação dos registros históricos.

- Critérios integrais, numeração e escopo original: `docs/archive/CONSUBOV_CHECKLIST_MESTRE_antes_auditoria_2026-10-09.md`, cópia exata do blob `1250edb3d0a9f7d3de342a5705275d6c0dc94025` do commit `8d23d8b5`.
- Ordem de execução/PRD: `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`.
- Continuidade: `CONSUBOV_HANDOFF_CONTINUIDADE.md` e `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`.
- Histórico e rodada atual de QA: `docs/qa/auditoria-consolidada-2026-10-09.md`.
- Evidência sanitizada desta rodada: `docs/qa/evidence/2026-10-11-selected-local.json`.
- FASE 11 futura: docs/67-fase11-perfis-auditoria-prd.md (auditoria/PRD/handoff; nenhuma mudança de código).
- Checklist externo: página mestre do Notion `3ec8e0bd-0f4d-816d-9bb5-d807e8e2cdc9` e páginas de cada fase.

Antes de executar uma fase, ler também seu capítulo completo no checklist arquivado e o PRD ativo. Relatórios antigos, instalação de ferramentas, código escrito, testes isolados e homologação física são estados diferentes; um não aprova automaticamente o outro.

## 2. Decisões vigentes

- [x] PWA sobre React/Vite é a direção mobile; IndexedDB é a persistência local. Capacitor/SQLite/nativo não fazem parte da implementação ativa.
- [x] Preservar mesma origem, identidade PWA e dados offline ao substituir a versão antiga; atualização por ação explícita e ativação confirmada do Service Worker.
- [x] QA local com Go Task/VS Code, sem depender de GitHub Actions hospedado. Docker/act é opcional, não um bloqueio para testes executáveis diretamente.
- [x] Priorizar entrega incremental para testes, registrando pendências não críticas sem bloquear trabalho independente. Isso não significa dispensar riscos materiais de dados ou autorização.
- [x] Não dispensar testes automatizáveis de autorização, tenancy, idempotência, perda de dados, migração, filas e anexos.
- [x] Homologação física pode aguardar o piloto sem impedir implementação independente; continua obrigatória antes da substituição da PWA dos clientes.
- [x] Banco remoto, migrations remotas, Vercel, deploy, secrets, merge e liberação de produção exigem autorização própria. Commit/push na branch de trabalho foram autorizados; não equivalem a essas ações.

## 3. Publicações e evidências já existentes — não duplicar

| Revisão | Entrega comprovada |
| --- | --- |
| `473a8752` / `e0c19265` | Auditoria anterior de validadores, atualização PWA, fila e governança; detalhes e limites no relatório histórico. 111 testes Node selecionados e 17 testes da fila com fake-indexeddb real pertencem àquela rodada. |
| `fb4f80d0` | Preparação do Codespace sem publicação automática. |
| `17ed1b45`, `dde8aec3`, `0aedb592` | As **11 alterações pendentes já foram revisadas e publicadas**: recuperação de fazendas, testes PWA/consentimento/perfil persistente, checklist/handoff/QA e gitignore. |
| `48e01b42f6a22d121623449c103480da6a0cadca` | Correção dos contratos E2E para rotas/controles reais, fixtures isoladas, espera do redirect e respeito à configuração de cada projeto Playwright. Nenhuma rota de produto inventada. |
| `68147e76b35a3846f37adc1a7a0b98b8bf70a6ef` | Snapshot do valor antes da abertura assíncrona do adapter key/value, validação de schema e fechamento de conexão tardia. Bases legadas intocadas. |

- [x] Manter 25 cenários no arquivo E2E da FASE 5, corrigindo rotas inexistentes e verificações incompatíveis com o produto. Não remover testes por conveniência nem afirmar cobertura transacional por teste de superfície.
- [x] Reproduzir quatro falhas de contratos E2E e uma falha do helper de fixtures; corrigir e reexecutar seus testes Node.
- [x] Reproduzir seis falhas no adapter key/value antes da correção. Suite nova: 8/8 PASS; suite anterior: 7/7 PASS.
- [x] Execução final na bancada seletiva: **25/25 testes Node PASS**, zero falhas, skips e cancelados; TypeScript estrito dos arquivos alterados PASS.
- [x] Conferir os bytes selecionados por hashes Git contra a revisão remota e comprovar que permaneceram iguais durante a execução final.
- [x] Playwright descobriu **75 casos em três projetos** no arquivo auditado. **Zero caso de navegador foi executado nesta rodada**; descoberta não é aprovação.
- [x] Taskfile YAML válido, 20 tarefas; novo `qa:phase5:contracts`, suites adicionadas a `qa:regressions` e `qa:offline:core`.

**Evidência browser histórica de 2026-10-10:** 16/16 testes de fixture PWA em Chromium/WebKit, exit 0, `.qa/runs/20261010T212419Z-pwa-upgrade-fixture-17ed1b45bbd3-6644/result.json`, checkout dirty. Não representa execução da revisão nova nem o build legado real. Os 10 testes Vitest selecionados e typecheck Web daquela rodada também são históricos.

## Evidencia mais recente - 2026-10-12 (UTC)

- [x] E2E integral **102/102 PASS** no SHA limpo `a9288e0394db`; a evidencia de 60/102 e historica.
- [x] PWA fixture **16/16**, regressao Node **130/130**, offline core **47/47** PASS no SHA base limpo, conforme registros locais/Notion; fixture sintetica nao homologa o legado real.
- [x] Resolver dependencia indevida de Chrome de sistema no Axe; reutilizar Playwright instalado e registrar erros/violacoes sem falso PASS.
- [x] Corrigir acessibilidade publica; **9/9** cenarios desktop/tablet/mobile PASS no candidato pre-commit. Runner: **5/5** contratos e **2/2** testes Chromium real PASS.
- [x] Check fresco API **539/539**, Web **136/136**, Edge **122/122** e SAST API PASS no candidato. Lint/typecheck PASS, 13 warnings visiveis.
- [x] Medir Lighthouse local; execucao desbloqueada, desempenho exige melhoria/revisao. Nao transformar a medicao diagnostica em aprovacao.
- [ ] Revalidacao final por SHA e QA integral. `PENDING_LOCAL_BASELINE` continua bloqueando aceite, mas nao impede Edge/HTTP nem desenvolvimento independente.

Detalhes, limites e logs: `docs/qa/phase5-local-report.md`. FASES 5-7 permanecem com aceite integral pendente.

## 4. Estado por fase

| Fase | Estado atual | Aceite ainda necessário |
| --- | --- | --- |
| 0–4 | Fechamento/implementação histórica; não revalidados integralmente nesta rodada | Preservar evidências anteriores e testar regressões dos fluxos existentes |
| 5 — qualidade Web | **QA LOCAL PENDENTE**; contratos dos testes corrigidos | Runtime completo, E2E obrigatório, acessibilidade, Lighthouse medido, coverage, lint, build e segurança |
| 6 — PWA | Componentes e fixture existentes; **PWA LOCAL READY PENDENTE** | Upgrade do build legado real, Chromium/WebKit, capacidades, preservação offline e interrupções |
| 7 — offline | Fila e fundamentos; adapter key/value reforçado; **OFFLINE LOCAL READY PENDENTE** | Migração retomável, integração autenticada, push/pull, conflitos, caos, anexos e rollback |
| 8 — banco/staging/migração | Somente preparação local autorizada | Dry-run local; autorização específica antes de qualquer remoto |
| 9 — produção/operação | Somente preparação local; **PRODUCTION READY NÃO** | QA aplicável, piloto físico, backup/restore, rollback e autorização de release |
| 10 — pós-produção | Fora do trabalho ativo | Reavaliar após produção estabilizada |
| 11 — perfis, hierarquia e currículo | **PLANEJADA; NÃO IMPLEMENTADA** | Auditoria documental registrada; implementação futura independente por compatibilidade e aceite específicos |

## 5. Pendências prioritárias por fase

### FASE 5 — itens 5.1 a 5.11 do planejamento original
- [x] Checkout base sincronizado e E2E integral 102/102 PASS em a9288e0394db; substituir contagens historicas pela evidencia atual. Revalidar o candidato final.
- [ ] Corrigir falhas reais de produto ou teste conforme causa comprovada; cobrir logout/tablet, uploads/fotos, permissões e tenant mismatch. Título visível não comprova escrita/transação.
- [ ] Medir Lighthouse e justificar limites por evidência; manter `PENDING_LOCAL_BASELINE` até medição/aprovação real.
- [ ] Revalidar Web/API/Edge, acessibilidade, coverage/ratchet, lint, typecheck/build, bundle, segredos e dependências.
- [ ] Emitir relatório por revisão, revisar evidências e só então marcar `WEB READY LOCAL`.

### FASE 6 — itens 6.1 a 6.7
- [ ] Executar `task qa:pwa:build-preflight`, `task qa:pwa:upgrade-fixture` e `task qa:offline:browser` na revisão atual.
- [ ] Validar troca da **versão legada realmente usada** para a nova: mesma origem, botão de atualização, interrupção, cache, quota, rollback e seis bases/filas/Blobs.
- [ ] Validar capabilities Web, permissões negadas, navegação instalada, atualização/retomada e Chromium/WebKit; não prometer suporte universal.
- [ ] Implementar o gate completo `quality:phase6:local`; não retornar PASS apenas por fixtures isoladas.

### FASE 7 — itens 7.1 a 7.9
- [ ] Integrar fila ao novo fluxo somente com sessão/tenant verificados; manter o legado intacto.
- [ ] Construir migração versionada, idempotente e retomável das seis bases; preservar origem, IDs, anexos, backups e comandos sem ACK.
- [ ] Não atribuir tenant/user desconhecido por suposição; isolar dados até reconciliação autorizada.
- [ ] Implementar/testar push/pull local com transporte fake, cursor, ACK, reenvio, ordem causal e conflitos sem LWW genérico.
- [ ] Rodar caos, concorrência, queda/reabertura, quota e IndexedDB real de navegador; implementar `quality:phase7:local` completo.

### FASES 8 e 9
- [ ] Preparar/testar schema, migrations, backup/restore e rollback apenas em banco local isolado com fixtures.
- [ ] Preparar piloto Android/iOS, conectividade rural, atualização instalada e runbooks; não alterar produção sem autorização.
- [ ] Executar `qa:preprod:local-gates` somente com evidência integral e estável da mesma revisão. PASS desse verificador não autoriza deploy.

## 6. Ramos, ambiente e continuidade

**Estado atual:** Codespace voltou a executar; base local/remota a9288e0394db confirmada. Relatos de timeout/ausencia de Bun abaixo pertencem a auditorias anteriores, nao ao bloqueio atual. Playwright/Axe/Lighthouse executam localmente. Ler o relatorio atual antes de reinstalar ferramentas.

- Branch única de trabalho: `work/fase5-6-7-pwa-local`; PR #43 draft. Não criar outra sequência paralela de PRDs ou branches.
- `quality/fase5-web-ready-20261005` e `feature/phase6-app-shell` permanecem históricas/congeladas.
- Na auditoria anterior, `main` em `161cf184` tinha cinco commits exclusivos, incluindo `6944de9` (Capacitor/SQLite). Não importar automaticamente; conferir novamente antes de integração seletiva autorizada.
- Não usar reset destrutivo, force push, squash compartilhado, exclusão de branches ou merge automático para esconder divergência.
- O Codespace foi conferido limpo em `0aedb592` na rodada anterior. **A sincronização local dos commits novos não foi confirmada**: Browser-MTS voltou a retornar timeout de comandos, e Desktop Commander estava offline. Conferir HEAD, alterações locais e processos antes de qualquer fast-forward.
- Na bancada desta rodada não há Bun/Go Task; Chromium negou loopback com `ERR_BLOCKED_BY_ADMINISTRATOR`. Foram usados conectores GitHub e execução Node isolada, sem desativar políticas.
- Ferramentas instaladas anteriormente no Codespace não devem ser reinstaladas por rotina. `tmux` reduz perda de execução quando a aba desconecta, mas não sobrevive à parada da VM. Não duplicar suites/portas nem publicar portas por conveniência.
- Próxima tarefa: validar os contratos E2E corrigidos e concluir os gates executáveis da FASE 5; avançar tarefas independentes sem dispensar riscos materiais. Usar `CONSUBOV_HANDOFF_CONTINUIDADE.md` para retomar.

As publicações desta rodada foram feitas na branch autorizada com `[skip ci]`. Nenhum GitHub Actions hospedado, merge na `main`, deploy, banco remoto ou dado real foi utilizado.

## Rodada local: PDF e salga
Base f47d9b92. E2E inicial: 96/102 PASS. Corrigido seletor de formulario de salga; Chromium completo valida bytes PDF; corrigida sobreposicao real entre dois botoes de fechar o PDF. Regressao Dialog: RED 1/2, GREEN 2/2. Reexecucao dos seis cenarios: 6/6 PASS.
Build/typecheck frescos: PASS; API 539/539 e Web 134/134, cache Turbo desativado. Dependency audit: 0 high/critical; 24 avisos inferiores continuam registrados. Logs .qa/round-20261011/. Fases integrais permanecem pendentes. Sem CI hospedado ou deploy.


## Retomada verificada - 2026-10-12 13h UTC

Lote de acessibilidade anterior revisado e reexecutado antes da publicacao. Nova correcao: o gate recusa backend remoto, credenciais na URL e caminhos/query antes de instalar ou executar ferramentas. Regressao observada RED (6 falhas/7), depois GREEN 7/7, sem contato com os destinos de teste.

Verificacao do candidato em a9288e03, dirty=true e fonte estavel durante a rodada: Node 142/142; runner Chromium 2/2; acessibilidade publica Playwright 9/9 sem retries; check completo, build/tipagem e Web 136/136 PASS, sem cache Turbo. Exit agregado 0: .qa/retomada-20261012/verification.exit. Registros .qa/runs/20261012T131820Z-regressions-a9288e0394db-6554/result.json, .qa/runs/20261012T131853Z-public-a11y-revalidated-a9288e0394db-8132/result.json e .qa/runs/20261012T131941Z-check-a9288e0394db-9097/result.json.

Revisao estatica feita pelo mesmo executor, sem revisor independente. O oramento Lighthouse permanece PENDING_LOCAL_BASELINE; nao ha aceite integral das fases. Trabalho local independente de PWA/offline continua; nenhum banco remoto, dado real, CI hospedado, merge ou deploy. Atualizar evidencias apos sincronizar o commit.


## Correcao independente de offline e revalidacao - 2026-10-12

**FASE 5:** a suite completa passou 111/111 em desktop/tablet/mobile, sem retries, no commit limpo 10230f043d6f45291248a266d1d4f4b1554bba3a. Duracao 8.8min; .qa/runs/20261012T132551Z-e2e-published-10230f043d6f-12558/result.json, exit 0. As 42 falhas historicas nao representam essa revisao. Check anterior foi reexecutado sem cache Turbo: API 539/539, Web 136/136, build e tipagem PASS. Isso ainda nao aprova o gate Lighthouse, mantido PENDING_LOCAL_BASELINE.

**FASE 7, implementacao entregue:** o inventario readonly agora tolera getters bloqueados de IndexedDB/localStorage, distingue armazenamento indisponivel de backup ausente, conserva o resultado dos outros bancos quando uma abertura falha e informa autoIncrement, keyPath e restricoes reais de cada indice. Nao consulta registros, nao escreve, nao infere tenant e nao migra dados.

Regressao reproduzida inicialmente em bancada isolada com fake-indexeddb 6.2.5 verdadeiro: 5 falhas/6; depois 11/11 PASS. Reexecutado no Codespace: inventario 11/11; suite PWA ampliada 22/22 em Chromium/WebKit (inclui 6 cenarios novos de inventario e os 16 existentes de fila/update); regressao Node 148/148; Web 136/136, tipagem e lint:changed exit 0. O lint registra 14 avisos de analise estatica, nao ocultados; nao equivalem a zero avisos.

Evidencias do candidato, base 10230f04 e dirty=true: .qa/runs/20261012T133442Z-offline-inventory-10230f043d6f-23501/result.json; .qa/runs/20261012T133444Z-pwa-upgrade-fixture-10230f043d6f-23569/result.json; .qa/runs/20261012T133558Z-regressions-10230f043d6f-26381/result.json; .qa/retomada-20261012/offline-verification.log e .exit=0. A fonte so foi alterada depois que a E2E anterior terminou.

**Limites:** no inventario, status=ok significa enumeracao concluida; nao certifica migracao. Antes de migrar, exigir contexto autorizado e avaliar error por banco, versoes, stores faltantes e localStorageStatus. localStorageStatus=unavailable nunca autoriza tratar backups como inexistentes. Fixture sintetica nao homologa o build legado de producao nem conclui as FASES 6/7.

Trabalho local independente segue permitido: integrar identidade validada e migracao retomavel preservando origens; concluir ensaio do build legado e desempenho sem afrouxar gates. Nenhuma base de cliente foi alterada. Sem CI hospedado, merge, deploy, banco remoto ou novo roadmap. Revisao pelo proprio executor, sem alegar revisor independente.

## 7. FASE 11 — Perfis, Hierarquia e Evolução Profissional (PLANEJADA)

**Posição:** fase seguinte à FASE 10 no roadmap; **não está bloqueada automaticamente** até a conclusão de todas as fases anteriores. Pode ser descoberta/planejada independentemente; implementação futura exige resolver apenas dependências e conflitos reais, sem interferir nas FASES 5–9. **Status:** planejamento/auditoria documental realizada, nenhuma implementação, migration ou teste desta fase executado.

**Documento técnico/PRD/handoff detalhado:** docs/67-fase11-perfis-auditoria-prd.md (fonte de escopo, arquivos exatos, critérios, testes e rollback).

### 11.0 Auditoria e fonte de verdade
- [x] Auditar no código papéis, perfis, cadastros, vínculos, login, ranking existente, PDFs e pontos de exclusão; registrar fatos vs pendências.
- [ ] Revalidar revisão viva de Git/Notion/Codespace e arquivos compartilhados antes de qualquer futuro PRD de execução.
- [ ] Confirmar fluxos realmente usados por perfil e mapeamento do legado em ambiente autorizado, sem inferir regras a partir da UI.

### 11.1 Proprietário
- [ ] Especificar perfil de proprietário da organização/tenant separado de administrador global.
- [ ] Permitir proprietário cadastrar/editar gerentes e fazendas autorizadas, gerenciando status e vínculos.
- [ ] Projetar múltiplas fazendas/gerentes, transferência de responsabilidade e continuidade de histórico.

### 11.2 Gerente e hierarquia
- [ ] Reutilizar GerentesPage, gerentes_fazendas e contexto do GerenteDashboard sem quebrar rotas.
- [ ] Projetar gerente cadastrar fazenda e capataz/equipe somente no próprio escopo; proibir subir a hierarquia.
- [ ] Definir matriz funcional ação/recurso/escopo e preservação de vínculo principal do legado.

### 11.3 Capataz e demais usuários
- [ ] Criar especificação de 'Meu Perfil' editável pelo capataz: nome, CPF, e-mail, telefone, foto e status; separar campos próprios dos validados por gerente.
- [ ] Preservar capatazes, capatazes_retiros, user_id, retiro_id e a PWA offline ao evoluir perfis.
- [ ] Expandir de forma coerente os perfis existentes: escritório, consultor, pesador, operadores e equipe, sem criar permissões não aprovadas.

### 11.4 Fazenda/retiro/fotos
- [ ] Evoluir perfis editáveis de fazenda e retiro, com fotos, contatos/responsáveis conforme requisito validado.
- [ ] Preservar fazenda -> retiro -> pasto, rotas, mapas, QR, ciclos e relatórios.
- [ ] Definir uploads opcionais, ausência de foto e política de substituição/retomada.

### 11.5 Histórico/currículo
- [ ] Especificar vínculos temporais de pessoa, fazenda, retiro, papel, datas de entrada/saída e histórico verificável.
- [ ] Separar histórico comprovado de dados autodeclarados e eventos operacionais; preservar mudanças de fazenda.
- [ ] Definir visibilidade de histórico por papel/organização; nenhuma exibição de CPF no currículo público.

### 11.6 Ranking profissional
- [ ] Reutilizar scoreCapataz, scoreCapatazData, PremiacaoSemestral e ranking do gerente como baseline.
- [ ] Planejar atribuição de notas por pessoa + retiro + período usando identidade estável; não equiparar ranking de retiro a carreira do capataz.
- [ ] Aprovar fórmula/origem, comparabilidade, contexto, visualização e exportação; sem inventar métricas.

### 11.7 Google e PDF
- [ ] Planejar Google Login opcional, vinculado à identidade existente, preservando e-mail/senha, papéis e offline.
- [ ] Projetar exportação PDF de perfis, currículo/histórico e ranking sem expor dados além do permitido.

### 11.8 Compatibilidade e QA
- [ ] Projetar alterações incrementais/optativas e mapeamento do legado, sem migrations até autorização futura.
- [ ] Planejar inativar/remover vínculo sem exclusão física de cadastros/histórico nos novos fluxos.
- [ ] Definir regressões por perfil, multi-fazenda/tenant, mudança de usuário, Google, foto, PDF, PWA/offline e rollback.
- [ ] Realizar QA integral da fase na implementação futura e atualizar docs, OpenAPI, Notion e handoff com evidências.

**Fora desta fase:** remediação de segurança/RLS da plataforma, migrations ou acesso remoto, deploy, alteração de segredos, refatoração ampla. Permissões funcionais e testes de escopo integram aceite do recurso, **não constituem uma nova fase de segurança**.

**[PENDENTE]** regra detalhada de RBAC por hierarquia, dados legados sem autoria provada, política de visibilidade de ranking e currículo, métrica de eficiência individual e divulgação de CPF/fotos. Documentar decisões antes do código.
