# CONSUBOV — Continuidade operacional consolidada

**Atualização:** 2026-10-09. **Repositório:** `mmatteuus/consubov`. **Branch:** `work/fase5-6-7-pwa-local`. **PR #43:** draft, sem merge/deploy.

## 1. Leia isto primeiro

Este é o ponto de entrada atual. Ler também as Instruções-Mestre do Projeto, `AGENTS.md`, `CONSUBOV_CHECKLIST_MESTRE.md`, a página mestre do Notion e o PRD ativo antes de executar código. O estado de QA atual está no checklist consolidado; relatórios históricos, simuladores e ledgers de tarefas não são aprovação de fase.

O PRD detalhado continua em `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`. Todos os critérios anteriores foram preservados, sem alterações, em `docs/archive/CONSUBOV_CHECKLIST_MESTRE_antes_auditoria_2026-10-09.md`. Antes de alterar uma fase, consultar seu capítulo completo; a consolidação não reduz seu escopo.

## 2. O que foi efetivamente feito nesta auditoria

Base inspecionada: `8d23d8b513580720f57cb53c646c801c850f02eb`. Commit das correções de código: `473a8752c303bad0e95d8224b87289dbc57a323a`.

1. Validadores de PWA/Lighthouse/pré-produção agora rejeitam dados nulos ou inválidos, arquivos vazios e comprovação falsa de versão.
2. A matriz QA verifica o estado da fonte depois de cada comando. Alteração de arquivo ou HEAD durante a execução invalida o agregado; o gate de pré-produção consulta o checkout real, sem substituir SHA por variável de teste.
3. A PWA verifica operação crítica no momento de ativar o worker ou recarregar, inclusive quando a operação começa durante uma espera assíncrona. Consentimento expirado não dispara ativação tardia.
4. A fila exige índices IndexedDB com estrutura/unicidade corretas e captura o conteúdo aceito antes de abrir o banco assincronamente. Edições posteriores no objeto não mudam o comando salvo.
5. Os testes existentes de coverage e lint entram também no comando `qa:regressions`.
6. O checklist virou um painel atual; seu conteúdo completo anterior foi preservado em arquivo histórico. O kit antigo e os logs gerados saíram da árvore operacional. Há apenas um Taskfile operacional na raiz.

**Resultado executado:** 111 testes Node selecionados PASS, 0 FAIL, incluindo 19 novas regressões observadas primeiro falhando. A suíte da fila passou 17/17 com o **pacote verdadeiro fake-indexeddb 6.2.5**, não com simulador artesanal. TypeScript estrito do adapter/política/coordenador passou.

**Limite importante:** a execução foi em cópia seletiva dos arquivos, não em clone completo com Bun. Node 22.16.0 e TypeScript 5.8.3; dependências foram extraídas seletivamente do ZIP fornecido, sem usar dados pessoais, `.env` ou credenciais. Não foi feita instalação congelada do monorepo.

## 3. Estado por fase

- FASES 0–4: fechamento/implementação histórica; não foram revalidadas integralmente neste bloco.
- FASE 5: QA LOCAL PENDENTE. Restam runtime completo, E2E, Axe/Lighthouse medidos, coverage/scans e relatório do HEAD.
- FASE 6: PWA LOCAL READY PENDENTE. Proteções existem, mas falta executar e aprovar a atualização da PWA legada real em Chromium/WebKit sem perda offline.
- FASE 7: OFFLINE LOCAL READY PENDENTE. Fila e fundamentos testados; migração, integração autenticada, sync e caos completos ainda não concluídos.
- FASES 8/9: somente preparação e ensaios locais. Nenhuma conexão remota, migration remota, publicação ou piloto foi realizada.

`bun run check` foi tentado e não executou por ausência de Bun neste ambiente. A tentativa Chromium em localhost retornou `ERR_BLOCKED_BY_ADMINISTRATOR`. O dispositivo remoto do responsável estava offline; nenhum comando foi executado no VS Code dele. Não desativar políticas de segurança para contornar essas restrições.

## 4. Conflito de branches que não deve ser repetido

A branch ativa diverge da `main`. A `main` auditada está em `161cf184`; seus cinco commits exclusivos incluem `6944de9`, que volta a introduzir Capacitor/SQLite, contrariando PWA-first. A auditoria não incorporou esse material, não alterou a `main` nem reescreveu o histórico.

Não executar `git pull` com merge automático, reset, rebase destrutivo, force push ou merge de PR sem revisão/autorização. Ler `git status`, `git log` e as diferenças antes de sincronizar. Preservar alterações locais de outros executores. As branches antigas `quality/fase5-web-ready-20261005` e `feature/phase6-app-shell` continuam congeladas.

## 5. Ordem executável no VS Code — QA local

Verificar ferramentas já instaladas; não reinstalar Go Task e extensões que funcionam. O guia operacional é `docs/qa/QA-LOCAL-VSCODE-GO-TASK.md`. Instalar somente dependências locais faltantes, sem tocar em produção. Usar o Bun exigido pelo repositório e seu lockfile; não trocar versões arbitrariamente.

```powershell
git status --short --branch
git rev-parse HEAD
task doctor
task setup
task qa:regressions
task qa:offline:core
task qa:pwa:build-preflight
task qa:pwa:upgrade-fixture
task qa:offline:browser
task qa:matrix
```

O teste direto equivalente das regressões selecionadas é:

```bash
node --test apps/web/tests/*.test.cjs scripts/tests/*.test.cjs
```

A matriz continua as tarefas independentes para coletar todos os resultados, mas retorna FAIL se algum gate falhar ou se o código mudar durante o teste. Artefatos ficam em `.qa/`; não publicar `.env`, tokens, fotos reais ou dados de clientes. Novos relatórios exigem `sourceUnchanged: true`, `finalCommit` igual a `commit`, checkout limpo e execução não simulada para a revisão pré-produção.

## 6. Próximas entregas — escopo, testes e aceite

### A. Fechar o runtime da FASE 5

Executar `task qa:phase5`; corrigir erros reais de build, tipagem, E2E, API/Edge, lint, coverage, acessibilidade e scanners. Medir o Lighthouse real antes de definir/aprovar limites. Não transformar `PENDING_LOCAL_BASELINE` em aprovação por conveniência. Aceite: todos os gates exigidos no capítulo 5 do checklist original, logs por SHA e revisão de QA.

### B. Validar a atualização PWA da FASE 6

Os testes sintéticos de SW e as fixtures de seis bases existem; não recriá-los. Executá-los em Chromium/WebKit e completar o teste usando o build legado realmente utilizado, em origem local igual, com dados fictícios representativos. Comparar filas, IDs, Blobs/ArrayBuffer, backups e versões antes/depois. Testar falha de download, quota, reabertura, rollback, consentimento e trabalho em andamento. Aceite: `quality:phase6:local` completo, não apenas teste de heading ou SW simulado.

### C. Concluir integração e migração da FASE 7

Reutilizar `IndexedDbAtomicCommandQueue` e `localSyncRound`. Integrar somente sob sessão/tenant verificados. Implementar migração versionada e retomável das seis bases com origem preservada, checkpoints, reconciliação, repetição idempotente e testes de interrupção. Não inferir proprietário ausente. Validar ordem causal, concorrência, ACK antigo, transporte fake, queda/retorno da rede, anexos e conflitos sem LWW genérico. Aceite: `quality:phase7:local` completo, relatório e revisão. Não ativar migração sobre dados de clientes só porque o adapter isolado passou.

### D. Preparar FASES 8/9 sem operações externas

Preparar schemas/migrations e backup/restore em banco local isolado com fixtures; documentar comparação origem/destino, rollback, observabilidade, piloto Android/iOS e conectividade rural. Os testes físicos não bloqueiam trabalho independente, mas são obrigatórios antes da liberação a usuários. O gate local de evidências não autoriza deploy.

## 7. Fora do escopo e ações proibidas

Capacitor/nativo, banco remoto Supabase/PostgreSQL, Vercel, migrations remotas, deploy, secrets, dados reais, limpeza de bases legadas, exclusão de pendências, afrouxamento de tenancy/RBAC e reescrita do Git. Não inventar regras de negócio, retenção, TTL de filas ou decisões de conflito. Não declarar QA de fase pelo número de testes isolados.

## 8. Documentação e relatório final exigidos

No mesmo bloco de implementação, atualizar o checklist atual do repositório, sua contraparte no Notion, o relatório de QA relevante e este handoff. Não acrescentar mais um roadmap independente na raiz.

Entregar: branch/SHA e dirty; versões de ferramentas; comandos, exit codes e logs sanitizados; bugs reproduzidos e correções; QA local por fase; itens físicos pendentes; riscos P0; arquivos/commits; confirmação de nenhuma ação externa não autorizada. Se um comando não puder executar, registrar causa concreta e continuar apenas atividades independentes seguras.

**Handoff das Fontes do Projeto: atualizar com este arquivo após a sincronização.** A aplicação ainda não está autorizada para substituir a versão usada em campo.


## Estabilidade do Codespace - 2026-10-10

Tmux 3.3a instalado no Codespace; sessao consubov-control criada e testada sem cliente anexado. Configuracao local .vscode/settings.json: remote.autoForwardPorts=false; portas existentes nao foram tornadas publicas.

Executado task qa:offline:browser em janela tmux destacada; ao sair da tela do VS Code, abrir /login local e voltar, a execucao foi recuperada sem reiniciar: 10/10 PASS em Chromium/WebKit, exit=0, 39.5s. Evidencia: .qa/runs/20261010T031211Z-offline-browser-e0c19265c5fb-27778/result.json e .qa/offline-browser-detached.log. HEAD e0c19265; checkout com alteracoes locais preexistentes, nao equivale a QA de commit limpo.

Ultima E2E completa existente: 60 PASS / 42 FAIL, exit=1; nao reexecutada nesta etapa. Nenhuma fase aprovada. Logs do navegador mostraram extension host remoto sem resposta e latencia alta; causa exata por extensao ainda nao isolada. Opera sem conexao autorizada e Desktop Commander offline.

Retomada: tmux ls e tmux attach -t consubov-control. Antes de reenviar comando apos timeout, conferir processos, logs e exit code. Nao duplicar suites nem sobrescrever relatorios. Tmux nao sobrevive a parada/recriacao da VM; nao mudar timeout/billing ou desligar seguranca. Sem CI hospedado, banco remoto, push, merge ou deploy.

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
