# Auditoria independente de governança, qualidade e PWA — 2026-10-08

**Escopo auditado:** PR #43 (`work/fase5-6-7-pwa-local`) versus `main`, documentação/Checklist Mestre do Notion, scripts de gate local, PWA Service Worker e provas de QA versionadas anteriormente.

**Método:** inspeção estática de arquivos reais via GitHub e confronto de evidências com o Checklist. **Nenhum GitHub Actions/CI foi executado nem consumido.** O ambiente de auditoria não disponibiliza Bun, clone do projeto ou acesso a rede para instalar dependências; **nenhum teste local foi executado nesta auditoria**. Ausência de execução significa **NÃO VALIDADO**, jamais aprovado.

## Descobertas confirmadas

| Item | Evidência observada | Conclusão |
| --- | --- | --- |
| Git | PR #43 substitui #37; branches antigas `quality/fase5-web-ready-20261005` e `feature/phase6-app-shell` permanecem como refs congeladas; Dependabot #38–42 encerrados | Governança parcial; não excluir refs sem preservar auditoria/consentimento |
| FASE 5 | `scripts/run-phase5-local.sh` executa check, lint, coverage, E2E, axe, Lighthouse e smoke; anteriormente não executava `bun audit --audit-level=high` | **CORRIGIDO no script**, mas gate ainda precisa ser executado |
| FASE 5 | Script coleta scores Lighthouse, porém não impõe thresholds de aceite para LCP/CLS/TBT ou categorias | **PENDENTE:** definir thresholds fundamentados e falhar gate ao descumpri-los |
| FASE 5 | Evidência histórica reportou E2E 14/18, axe não integrado e high advisory enquanto intitulava gate "APROVADO" | **QA: NÃO APROVADO** por evidência insuficiente/contraditória; não reutilizar relatório como aceite |
| FASE 6 | PWA `apps/web/public/sw.js` agora inclui instalação com assets críticos, retenção de geração anterior e fallback; existem testes `apps/web/tests/sw-integrity.test.cjs` e `sw-registration-integrity.test.cjs` | Implementação e testes presentes; resultado de execução **NÃO VALIDADO** |
| FASE 6 | Não existe no PR #43 harness browser real que inicialize legacy SW + IndexedDB com pendências, faça upgrade no mesmo origin e compare filas/blobs pós-upgrade | **P0 ABERTO: zero-loss update não comprovado** |
| FASE 7 | Na branch auditada não há migration engine e fila canônica comprovadamente implementadas e testadas | **FASE 7 ABERTA**; fase seguinte não desbloqueada |
| FASE 8 | Checklist externo pode declarar avanço; dependências e gates anteriores continuam sem aceite reprodutível nesta auditoria | **BLOQUEADA**: nenhuma conexão remota/migration/deploy |

## Regras de aceite para continuidade

1. Executar **localmente** `bun install --frozen-lockfile && bun run quality:phase5:local` no checkout exato da branch; preservar exit codes/logs, e nunca mascarar falhas.
2. Medir os thresholds Lighthouse em cenário real e aplicar verificação automatizada reproduzível. Axe deve ter baseline de contraste e acessibilidade conforme PRD. Vulnerabilidade high/critical deve ser corrigida ou receber exceção de segurança formal com evidência, antes de aprovar.
3. Criar harness E2E PWA legacy → next no mesmo origin, com snapshots de IndexedDB/localStorage, fila, fotos, interrupção, rollback e comparação estrutural/binária. Teste de presença de heading não substitui verificação de preservação.
4. Implementar/validar FASE 7 com migração idempotente/retomável, isolamento user/tenant, attachments, Command Queue, testes de caos/retry/concorrência. Nenhuma regra de retenção, schema de dados do legado ou duração de sessão deve ser inventada.
5. Só marcar itens `[x]` no Checklist após testes e evidências do HEAD auditado; sincronizar Notion, repositório e Handoff. Os relatórios anteriores conflitantes não constituem aceite.

## Alterações desta auditoria

- Adicionado `bun audit --audit-level=high` ao início do gate da FASE 5, para impedir aprovação silenciosa caso existam high/critical não tratados.
- Este relatório registra bloqueios sem declarar execução de testes.

## Fora do escopo/proibido

Não usar GitHub Actions, não fundir PR, não aprovar QA, não alterar produção, Supabase/PostgreSQL remoto, migrations remotas, secrets, Vercel nem limpeza de dados offline.

**Status final desta auditoria: QA PENDENTE/REPROVADO PARA FECHAMENTO.** O trabalho de implementação pode continuar na branch ativa, com validação local antes de qualquer merge.

## Evidência adicional — execução Node isolada

Em ambiente temporário isolado, copiados `apps/web/public/sw.js` e `apps/web/tests/sw-integrity.test.cjs` da revisão inspecionada; executado `node --test apps/web/tests/sw-integrity.test.cjs` com Node 22. Resultado: **7 testes passaram, 0 falharam** (instalação atômica de JS/CSS, rollback ao falhar asset, duas gerações, navegação offline, SKIP_WAITING explícito, notificação sem navegação forçada, rejeição de URL externa). Esta execução não contempla bundle React, browser real, migração IndexedDB, E2E nem os gates completos e não aprova a FASE 6.
