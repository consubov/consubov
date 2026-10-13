# CONSUBOV - Checklist Mestre de Execucao

## Codespace apos FF - 2026-10-13

- [x] FF local de b9ecba3d ate f9611b48, sem alterar main. PRD GPS reaplicado (5 linhas de planejamento), stashes mantidos.
- [ ] Codigo GPS/Conferencia, browser QA e homologacao fisica ainda pendentes; este lote e so documental.

## Sincronizacao e handoff - 2026-10-13

- [x] Branches historicas removidas; somente `main` e `work/fase5-6-7-pwa-local` existem no GitHub. Um PR aberto: #43 (draft), sem merge.
- [x] Publicado runbook de pull local e continuidade segura: `docs/68-sincronizacao-local-e-agentes.md`; README e AGENTS alinhados a PWA/IndexedDB.
- [ ] Codespace ainda nao confirmado sincronizado: ultimo snapshot mostrava 1 PRD local modificado e 52 commits atras. Preservar alteracao antes de fast-forward.
- [ ] QA integral das fases, homologacao e merge PR #43 seguem pendentes; documentacao nao altera gates.

## Estado consolidado em 2026-10-13

Branch ativa: `work/fase5-6-7-pwa-local`. PR #43 draft. Este painel consolida a reconciliacao Git; nao altera escopo, criterios de aceite ou resultados das fases.

## Planejamento integral preservado - leitura obrigatoria

- Snapshot completo imediatamente anterior: [checklist preservado](docs/archive/CHECKLIST_antes_reconciliacao_ramos_2026-10-13.md), mesmo blob `564b90abd1fa36150f8b31be586124a8543cc7f5`. Contem todos os itens, vinculos, resultados e o planejamento da FASE 11 existentes antes desta consolidacao.
- Criterios originais completos: [arquivo integral de 2026-10-09](docs/archive/CONSUBOV_CHECKLIST_MESTRE_antes_auditoria_2026-10-09.md). Ler o capitulo da fase antes de implementar.
- PRD unico: `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`.
- Handoff: `CONSUBOV_HANDOFF_CONTINUIDADE.md`; Notion ao vivo: `3ec8e0bd-0f4d-816d-9bb5-d807e8e2cdc9`.

## Git - reconciliacao autorizada

- [x] Historicos `quality/fase5-web-ready-20261005`, `feature/phase6-app-shell` e `main` incorporados como pais do merge `41a1f9f1a3728a3f4cf393c6520587bd45cab3a0`: 50 commits anteriores preservados, sem reescrita.
- [x] Resolucao seguindo PWA/IndexedDB, mantendo o codigo funcional de `b9ecba3d`; experimentos nativos ficam somente no historico. Backend, rotas e layouts ja incorporados nao foram substituidos por versoes antigas.
- [x] Recuperada a documentacao da direcao PWA e incorporada a regra para novos ZIPs, sem remover arquivos ja versionados.
- [x] Exclusao efetiva das branches historicas `quality/fase5-web-ready-20261005` e `feature/phase6-app-shell`; GitHub reconsultado: apenas `main` e a branch ativa permanecem, com 1 PR aberto (#43, draft). Commits historicos preservados na branch ativa.
- [ ] Sincronizacao segura do Codespace quando Browser-MTS voltar; preservar PRD local e demais alteracoes existentes.
- [ ] Aceite e merge do PR #43 na `main`. Esta reconciliacao nao executa esse merge nem libera producao.

## Estado das fases - sem alteracao de aceite

| Fase | Estado | Pendencia principal |
| --- | --- | --- |
| 0-4 | Fechamento historico | Nao revalidadas integralmente nesta tarefa Git |
| 5 | QA integral pendente | Desempenho, coverage/seguranca e aceite conforme criterios originais |
| 6 | Componentes PWA e fixtures presentes | Upgrade do legado real, capabilities/GPS, gate integral e homologacao no piloto |
| 7 | Fila/adapters locais presentes | Migracao retomavel, identidade autorizada, sync push/pull, ordem causal, anexos e caos |
| 8 | Preparacao local | Schema/migracao/backup apenas local; remoto exige autorizacao propria |
| 9 | Preparacao local, producao nao aprovada | Piloto, restauracao, rollback, operacao e autorizacao de release |
| 10 | Pos-producao, fora do trabalho ativo | Reavaliar apos estabilizacao |
| 11 | Planejamento documental | Perfis/hierarquia/curriculo/ranking; sem codigo, migracoes ou permissoes aprovadas |

FASE 11: [PRD existente](docs/67-fase11-perfis-auditoria-prd.md). Sua numeracao nao cria gate automatico para trabalho independente, mas contratos, privacidade e conflitos precisam ser resolvidos antes de implementar.

## Regras de continuidade

PWA React/Vite e IndexedDB continuam vigentes. Preservar origem/manifest, consentimento de update, seis bases legadas, UUIDs e idempotencia. Nenhum resultado de fixture aprova automaticamente migracao real, isolamento backend ou uma fase inteira.

Executar testes locais relevantes sem depender do GitHub Actions. Nao apresentar contagens antigas como reexecucao atual. Pendencia fisica nao impede desenvolvimento independente; testes automatizaveis de dados, tenant e seguranca nao sao dispensados. Sem banco remoto, deploy, rotacao de secrets ou alteracao de producao nesta tarefa.

Relatorio: [reconciliacao Git e limites](docs/qa/git-branch-reconciliation-2026-10-13.md). O historico detalhado continua nos snapshots preservados; nenhum item foi marcado como concluido apenas porque seus commits foram integrados.
