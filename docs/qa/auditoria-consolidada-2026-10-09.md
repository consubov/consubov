# CONSUBOV — auditoria consolidada de correções e evidências

**Data:** 2026-10-09. **Track:** auditoria de qualidade. **Base:** `8d23d8b513580720f57cb53c646c801c850f02eb`. **Correções de código:** `473a8752c303bad0e95d8224b87289dbc57a323a`. **Branch:** `work/fase5-6-7-pwa-local`; PR #43 draft.

## Resultado e limite

**111 testes Node selecionados passaram, 0 falharam.** Foram acrescentadas 19 regressões, primeiro observadas falhando na base anterior e depois passando com as correções. Isso NÃO aprova o aplicativo completo nem fecha as FASES 5, 6 ou 7.

A auditoria confrontou o roadmap, o checklist do Notion, branches/PR e arquivos selecionados de PWA, fila, testes e ferramentas de QA. Não houve clone/instalação completa do monorepo. FASES 0–4 permanecem com sua evidência histórica, não com nova homologação nesta execução.

## Falhas reproduzidas e corrigidas

| Área | Defeito observado antes da correção | Verificação |
| --- | --- | --- |
| Build PWA | JSON `null`, HTML/SW vazio e versão presente somente em comentário podiam produzir aprovação | 5 regressões novas; 11 testes da suíte de integridade do build PASS |
| Lighthouse | Orçamento literal `null` ou `false` podia desativar silenciosamente a validação | 2 regressões novas; 8 testes do verificador PASS |
| Matriz QA | Alterações de arquivos ou HEAD durante os comandos eram atribuídas à revisão inicial como se fossem a mesma fonte | 2 regressões novas; 5 testes da matriz PASS |
| Pré-produção local | Evidência nula e relatório antigo de checkout limpo podiam aprovar fonte alterada; não havia prova de estabilidade | 4 regressões novas; 12 testes do gate PASS |
| Atualização PWA | Operação crítica iniciada durante `await` podia ser interrompida por ativação/refresh; consentimento expirado precisava ser respeitado | 3 regressões novas; 13 testes de registro SW PASS |
| Fila offline | Conferência somente de nomes de índices aceitava schema sem unicidade correta; objeto editado após enqueue alterava o que seria persistido | 3 regressões novas; 17 testes da fila PASS |

Os demais testes selecionados de SW, build injection, banco local, política de comandos, coordenador, inventário, integridade de coverage e lint também passaram. Foram 14 arquivos de teste, totalizando 111 casos, sem skips ou testes cancelados.

## Ambiente e origem das dependências

- Linux temporário de auditoria, Node 22.16.0, TypeScript 5.8.3.
- `fake-indexeddb` verdadeiro 6.2.5, extraído seletivamente de `sweet-sync-forge.zip` fornecido pelo responsável. O pacote já era dependência declarada do Web; nenhum novo pacote foi adicionado ao projeto.
- Não foi utilizado o simulador improvisado descrito nos blocos históricos. Os 14 cenários anteriores da fila passaram com o pacote verdadeiro; após três regressões novas, a suíte passou 17/17.
- A extração não incluiu `.env`, credenciais, configuração Git privada ou dados de usuários. Não foi feita instalação global nem alteração do computador do responsável.
- O checkout usado para testes é seletivo. Seu commit local de bancada não é o SHA remoto; a base remota e os hashes dos arquivos são identificados separadamente.

## Comandos efetivamente executados

```bash
node --test apps/web/tests/atomic-command-queue.test.cjs
node --test apps/web/tests/*.test.cjs scripts/tests/*.test.cjs
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM apps/web/src/platform/adapters/IndexedDbAtomicCommandQueue.ts apps/web/src/platform/offline/commandPolicy.ts apps/web/src/platform/offline/localSyncRound.ts
node --check scripts/qa/run-matrix.mjs
node --check scripts/qa/check-preprod-local-gates.mjs
node --check scripts/qa/check-pwa-build.mjs
node --check scripts/check-web-lighthouse-budget.mjs
git diff --check
```

Resultado final dos testes: `tests 111`, `pass 111`, `fail 0`, `cancelled 0`, `skipped 0`, exit code 0. Typecheck restrito aos módulos indicados: exit 0. Parse TypeScript de `swRegistration.ts`: zero erros de parsing. Taskfile YAML: válido, 18 tarefas. Parsing não substitui typecheck completo nem teste em navegador.

## Comandos tentados e não concluídos

- `bun run check`: exit 127, Bun ausente. Não declarar build/Vitest/API/Web aprovados.
- Chromium com servidor HTTP local: `ERR_BLOCKED_BY_ADMINISTRATOR`. Não foram executados os cenários Playwright de instalação, migração e duas abas neste ambiente.
- O dispositivo remoto do responsável estava offline. Nenhum teste foi executado no VS Code dele.
- Não foram executados Lighthouse/Axe reais, scanners integrais, banco PostgreSQL, migrations, dispositivos físicos, deploy ou CI hospedado.

## Git e documentação

Na base auditada, a branch de trabalho estava 48 commits à frente e 5 atrás da `main`, com base comum `4b91cb13`. A `main` em `161cf184` contém `6944de9`, que introduz Capacitor/SQLite. Isso não foi incorporado à branch PWA nem removido da `main` nesta auditoria. A conciliação exige revisão seletiva; não usar merge automático para importar uma direção superada.

O checklist integral foi preservado pelo mesmo blob em `docs/archive/`, enquanto a raiz passa a exibir o estado atual. Kit temporário/logs gerados saem da árvore ativa; conteúdo e histórico continuam recuperáveis. Nenhuma branch foi apagada ou teve histórico reescrito. Os commits desta auditoria usam `[skip ci]`; não houve chamada de execução/rerun de GitHub Actions.

## Aceite ainda pendente

FASE 5: runtime completo e seus gates. FASE 6: upgrade da PWA legada real em Chromium/WebKit e zero perda. FASE 7: migração, integração autenticada, sync/caos e anexos. FASES 8/9: preparo local apenas, piloto físico e autorização externa separados. **PRODUCTION READY: NÃO.**
