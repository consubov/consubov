# CONSUBOV — Checklist Mestre de Execução

> **Revisão consolidada:** 2026-10-09. **Branch ativa:** `work/fase5-6-7-pwa-local`. **PR:** #43, draft. **QA integral das FASES 5–7: PENDENTE.**

## 1. Fonte de verdade e preservação do planejamento

Este arquivo é o painel de estado atual, sem a sequência de resumos contraditórios que se acumulou na raiz. **Nenhum requisito detalhado foi excluído ou dispensado.**

- Critérios integrais, numeração e escopo original: `docs/archive/CONSUBOV_CHECKLIST_MESTRE_antes_auditoria_2026-10-09.md`, cópia exata do blob `1250edb3d0a9f7d3de342a5705275d6c0dc94025` do commit `8d23d8b5`.
- Ordem de execução/PRD: `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`.
- Estado para continuidade: `CONSUBOV_HANDOFF_CONTINUIDADE.md`.
- Evidência desta auditoria: `docs/qa/auditoria-consolidada-2026-10-09.md`.
- Checklist externo: página mestre do Notion `3ec8e0bd-0f4d-816d-9bb5-d807e8e2cdc9` e páginas de cada fase.

Antes de executar uma fase, ler também seu capítulo completo no checklist arquivado e o PRD ativo. O arquivo histórico preserva requisitos, mas suas declarações de QA e contagens antigas não aprovam a revisão atual. Instalação de ferramentas, código escrito, simulação e teste físico são estados diferentes.

## 2. Decisões vigentes

- [x] PWA sobre React/Vite é a direção mobile; IndexedDB é a persistência local. Capacitor/SQLite/nativo não fazem parte da implementação ativa.
- [x] Preservar mesma origem, identidade PWA e dados offline na troca da versão antiga pela nova; atualização por ação explícita e ativação confirmada do Service Worker.
- [x] Executar QA local com Go Task/VS Code. Não depender de GitHub Actions hospedado.
- [x] Testes físicos podem aguardar o piloto sem bloquear desenvolvimento independente; são obrigatórios antes de liberar a nova versão a clientes.
- [x] Não dispensar testes automatizáveis de autorização, tenancy, idempotência, perda de dados, migração, filas e anexos.
- [x] Banco remoto, migrations remotas, Vercel, deploy, secrets, merge e publicação exigem autorização própria. A auditoria não os executou.

## 3. Auditoria atual — correções verificadas

A base examinada foi `8d23d8b513580720f57cb53c646c801c850f02eb`. As correções de código estão no commit `473a8752c303bad0e95d8224b87289dbc57a323a`.

- [x] Reproduzir e corrigir aceitação indevida de JSON `null`/`false`, HTML vazio, SW vazio e versão presente apenas em comentário nos verificadores locais.
- [x] Detectar mudança de arquivos/HEAD durante a matriz de testes; um resultado de uma revisão não pode aprovar outra.
- [x] Conferir o checkout real no gate de pré-produção; rejeitar relatório antigo, árvore modificada, evidência nula ou sem prova de estabilidade da fonte.
- [x] Revalidar operação crítica imediatamente antes de `SKIP_WAITING` ou refresh. Consentimento expirado não pode ativar worker depois.
- [x] Validar estrutura real dos índices IndexedDB e sua unicidade, não apenas os nomes dos índices.
- [x] Capturar o comando com `structuredClone` antes da abertura assíncrona do banco, preservando o conteúdo aceito para enfileiramento.
- [x] Executar 111 testes Node selecionados, incluindo 19 regressões novas que falhavam antes das correções: **111 PASS / 0 FAIL**.
- [x] Executar a suíte da fila com o pacote verdadeiro `fake-indexeddb` 6.2.5: **17/17 PASS**, não com simulador improvisado.
- [x] Typecheck estrito do adapter de fila/política/coordenador e verificações de sintaxe dos verificadores alterados: PASS.
- [x] Incluir no `qa:regressions` os testes já existentes de integridade de coverage e lint que não estavam na lista.
- [x] Retirar kit temporário/logs gerados da árvore ativa, preservar material histórico e manter um único Taskfile operacional na raiz.

**Limites da evidência:** execução em cópia seletiva dos arquivos do repositório, com Node 22.16.0, TypeScript 5.8.3 e dependências extraídas seletivamente do ZIP fornecido. Não foi feito `bun install --frozen-lockfile`, build integral, teste completo da API/Web, medição Lighthouse/Axe ou homologação física. `bun run check` foi tentado e bloqueado por ausência de Bun; Chromium local retornou `ERR_BLOCKED_BY_ADMINISTRATOR`.

## 4. Estado por fase — sem encerramento fictício

| Fase | Estado atual | Critério para avançar o aceite |
| --- | --- | --- |
| 0 — governança | Documentação consolidada neste bloco; decisões históricas preservadas | Conferir fontes atuais e atribuições antes de novas alterações |
| 1 — segurança | Fechamento histórico; não reexecutado integralmente aqui | Revalidar auth, isolamento, segredos e scans no checkout completo |
| 2 / 2A / 2B — arquitetura, API e contratos | Escopo contratual histórico, sem nova homologação neste bloco | Contratos e testes de fronteiras atuais verdes; não confundir contrato com persistência real |
| 3 / 4 — fundação e funcionalidades Web | Implementação histórica; não revalidada integralmente | Regressão de todos os fluxos existentes no runtime completo |
| 5 — qualidade Web | **QA LOCAL PENDENTE** | `quality:phase5:local`, E2E, Axe, Lighthouse medido, coverage, lint, build e segurança verdes |
| 6 — PWA | Componentes e proteções reforçados; **PWA LOCAL READY PENDENTE** | Chromium/WebKit, atualização da PWA legada real e preservação de dados comprovadas |
| 7 — offline | Fila transacional e fundamentos testados; **OFFLINE LOCAL READY PENDENTE** | Integração autenticada, migration engine, sync, caos, filas/anexos e rollback |
| 8 — banco/staging/migração | Somente preparação local autorizada | Dry-run local e autorização explícita antes de qualquer remoto |
| 9 — produção/operação | Somente preparação local; **PRODUCTION READY NÃO** | QA local integral, piloto físico, backup/restore, rollback e autorização de release |
| 10 — pós-produção | Fora do trabalho ativo | Reavaliar somente depois da produção estabilizada |

## 5. Pendências prioritárias por fase

### FASE 5 — itens 5.1 a 5.11 do planejamento original
- [ ] Rodar `task doctor`, `task setup` e `task qa:phase5` no checkout completo, preservando SHA e logs.
- [ ] Corrigir E2E completos, inclusive logout/tablet, uploads/fotos, permissões e tenant mismatch; não aceitar somente um título visível como fluxo comprovado.
- [ ] Medir Lighthouse real e aprovar seus limites por evidência; manter `PENDING_LOCAL_BASELINE` até isso acontecer.
- [ ] Revalidar API/Edge, acessibilidade, coverage/ratchet, lint, build, bundle, segredos e dependências.
- [ ] Emitir relatório atual por SHA e obter revisão antes de marcar `WEB READY LOCAL`.

### FASE 6 — itens 6.1 a 6.7
- [ ] Executar `task qa:pwa:build-preflight`, `task qa:pwa:upgrade-fixture` e `task qa:offline:browser` em ambiente local permitido.
- [ ] Validar troca da **versão legada realmente usada** para a nova, mesma origem, botão de atualização, interrupção, cache, quota, rollback e todas as seis bases/filas/Blobs.
- [ ] Validar capabilities Web, permissões negadas, navegação instalada, atualização em segundo plano e Chromium/WebKit; nenhuma promessa de suporte universal.
- [ ] Implementar o gate completo `quality:phase6:local`, sem retornar PASS só por fixtures isoladas.

### FASE 7 — itens 7.1 a 7.9
- [ ] Integrar a fila ao novo fluxo somente com identidade de sessão e tenant verificadas; manter o legado intacto.
- [ ] Construir migração versionada, idempotente e retomável das seis bases; preservar origem, IDs, anexos, backups e comandos não confirmados.
- [ ] Não atribuir tenant/user desconhecido por suposição; manter dados isolados até reconciliação autorizada.
- [ ] Implementar/testar sync push/pull local com transporte fake, cursor, ACK, reenvios, ordem causal e conflitos sem LWW genérico.
- [ ] Rodar caos, concorrência, queda/reabertura, quota e testes de banco de navegador; implementar `quality:phase7:local` completo.

### FASES 8 e 9
- [ ] Preparar e testar schema, migrations, backup/restore e rollback apenas em banco local isolado com fixtures.
- [ ] Preparar piloto Android/iOS, conectividade rural, atualização instalada e runbooks; não executar produção sem autorização.
- [ ] Executar `qa:preprod:local-gates` apenas com relatório real de matriz íntegra e mesma revisão; PASS desse verificador não autoriza deploy.

## 6. Ramos e integração — conflito registrado

- Branch de trabalho única: `work/fase5-6-7-pwa-local`; PR #43 continua draft.
- `quality/fase5-web-ready-20261005` e `feature/phase6-app-shell` são referências históricas congeladas; não receberam alterações nem foram apagadas.
- A `main` auditada (`161cf184`) tem cinco commits posteriores à base comum `4b91cb13`. Entre eles, `6944de9` introduz novamente Capacitor/SQLite. Isso diverge da direção PWA-first.
- **Não importar esses commits automaticamente.** A auditoria preservou a `main` e os históricos. A conciliação deve separar alterações compatíveis da implementação nativa superada, com revisão e testes antes de merge autorizado.
- Não usar reset destrutivo, force push, squash de trabalho compartilhado ou exclusão de branches como forma de esconder divergência.

## 7. Próximo trabalho livre

Concluir os gates de runtime das FASES 5/6 e a integração/migração da FASE 7. A recomendação histórica de reiniciar a FASE 0.1 não é mais o próximo passo. Preparação local independente das FASES 8/9 pode continuar sem esperar aparelhos físicos; não pode dispensar os testes de dados e segurança.


## Estabilidade local - 2026-10-10
- [x] Tmux 3.3a instalado; sessao consubov-control preserva execucao independente da aba. remote.autoForwardPorts=false configurado localmente; sem alterar timeout ou expor portas.
- [x] task qa:offline:browser: 10/10 Chromium/WebKit PASS, exit=0, 39.5s; recuperado apos sair e voltar ao VS Code. Evidencia .qa/runs/20261010T031211Z-offline-browser-e0c19265c5fb-27778/result.json (dirty=true, HEAD e0c19265).
- [ ] Diagnosticar extensao/latencia responsavel pela instabilidade; tmux nao garante rede nem sobrevive a parada da VM.
- [ ] Corrigir as 42 falhas da ultima E2E (60 pass), integrar/migrar o legado e executar gates integrais. Nenhuma fase aprovada por estes 10 testes.

Handoff e guia QA local atualizados; Notion sincronizado. Sem push, merge, CI hospedado, banco remoto ou deploy.

## Retomada 2026-10-10 - validacao parcial
HEAD fb4f80d0 (dirty): regressions 112/112 PASS; qa:check exit 0 com 134 testes Web (API em cache); fixture PWA 16/16 Chromium/WebKit PASS; lint selecionado 0 erros, 2 avisos. Logs em .qa/review/.
Push de fb4f80d0 confirmado. Novo commit de fazendas bloqueado pelo assinador Codespaces: 403 Author is invalid. GPG mantido; dois arquivos de fazendas preparados, demais alteracoes preservadas. Fases 5-7 NAO aprovadas; E2E geral, migracao integrada, acessibilidade e performance pendentes. Nenhum CI hospedado, merge ou deploy.


## Publicacao incremental revisada - 2026-10-10
- Correcao de fazendas publicada: 17ed1b45 (falha de carregamento, 403 sem dados rejeitados e retry).
- Testes PWA publicados: dde8aec3 (perfil persistente isolado, ESM e consentimento explicito).
- Evidencia nova: 10/10 testes Vitest selecionados PASS e typecheck Web exit=0; .qa/review-current/targeted.log.
- Fixture PWA: 16/16 Chromium/WebKit PASS, 1.2m, exit=0; .qa/runs/20261010T212419Z-pwa-upgrade-fixture-17ed1b45bbd3-6644/result.json. Fonte permaneceu inalterada durante a rodada, checkout tinha alteracoes pendentes.
- Assinador do Codespace retornou 403 Author is invalid. Publicacao pela API GitHub autenticada, commits sem assinatura; GPG e protecoes do repositorio nao foram desativados. Fast-forward local validou igualdade do indice/tree; nenhum reset ou force push.
- Decisao do responsavel: priorizar entrega incremental para testes, levando pendencias nao criticas ao backlog. Isto nao dispensa seguranca, isolamento ou preservacao offline e nao equivale a aprovar fases inteiras.
- FASE 5: corrigir E2E incompatibilidades reais e concluir gates essenciais. FASE 6: fixture aprovada, falta ensaio do build legado real. FASE 7: fila testada, migracao/integracao ainda pendentes.
- Sem GitHub Actions hospedado, merge na main, deploy, banco remoto ou dados reais.
