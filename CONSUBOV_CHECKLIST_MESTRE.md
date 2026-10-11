# CONSUBOV — Checklist Mestre de Execução

> **Revisão consolidada:** 2026-10-11. **Branch ativa:** `work/fase5-6-7-pwa-local`. **PR:** #43, draft. **QA integral das FASES 5–7: PENDENTE.**

## 1. Fonte de verdade e preservação do planejamento

Este arquivo é o painel atual. Nenhum requisito detalhado foi excluído ou dispensado pela consolidação dos registros históricos.

- Critérios integrais, numeração e escopo original: `docs/archive/CONSUBOV_CHECKLIST_MESTRE_antes_auditoria_2026-10-09.md`, cópia exata do blob `1250edb3d0a9f7d3de342a5705275d6c0dc94025` do commit `8d23d8b5`.
- Ordem de execução/PRD: `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`.
- Continuidade: `CONSUBOV_HANDOFF_CONTINUIDADE.md` e `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`.
- Histórico e rodada atual de QA: `docs/qa/auditoria-consolidada-2026-10-09.md`.
- Evidência sanitizada desta rodada: `docs/qa/evidence/2026-10-11-selected-local.json`.
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

## 5. Pendências prioritárias por fase

### FASE 5 — itens 5.1 a 5.11 do planejamento original
- [ ] Sincronizar o checkout com segurança e executar `task qa:phase5:contracts` e a suite Playwright completa. A rodada histórica de 60 PASS / 42 FAIL não foi substituída por uma nova execução E2E integral.
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

- Branch única de trabalho: `work/fase5-6-7-pwa-local`; PR #43 draft. Não criar outra sequência paralela de PRDs ou branches.
- `quality/fase5-web-ready-20261005` e `feature/phase6-app-shell` permanecem históricas/congeladas.
- Na auditoria anterior, `main` em `161cf184` tinha cinco commits exclusivos, incluindo `6944de9` (Capacitor/SQLite). Não importar automaticamente; conferir novamente antes de integração seletiva autorizada.
- Não usar reset destrutivo, force push, squash compartilhado, exclusão de branches ou merge automático para esconder divergência.
- O Codespace foi conferido limpo em `0aedb592` na rodada anterior. **A sincronização local dos commits novos não foi confirmada**: Browser-MTS voltou a retornar timeout de comandos, e Desktop Commander estava offline. Conferir HEAD, alterações locais e processos antes de qualquer fast-forward.
- Na bancada desta rodada não há Bun/Go Task; Chromium negou loopback com `ERR_BLOCKED_BY_ADMINISTRATOR`. Foram usados conectores GitHub e execução Node isolada, sem desativar políticas.
- Ferramentas instaladas anteriormente no Codespace não devem ser reinstaladas por rotina. `tmux` reduz perda de execução quando a aba desconecta, mas não sobrevive à parada da VM. Não duplicar suites/portas nem publicar portas por conveniência.
- Próxima tarefa: validar os contratos E2E corrigidos e concluir os gates executáveis da FASE 5; avançar tarefas independentes sem dispensar riscos materiais. Usar `CONSUBOV_HANDOFF_CONTINUIDADE.md` para retomar.

As publicações desta rodada foram feitas na branch autorizada com `[skip ci]`. Nenhum GitHub Actions hospedado, merge na `main`, deploy, banco remoto ou dado real foi utilizado.
