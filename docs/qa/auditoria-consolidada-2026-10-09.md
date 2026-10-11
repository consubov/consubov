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


## Rodada incremental - 2026-10-11

Este bloco atualiza o estado operacional sem substituir a evidencia historica acima. Base remota: `0aedb592087bfce060b1ebb688a36cffa6a303e6`. Publicacoes: `48e01b42f6a22d121623449c103480da6a0cadca` (contratos E2E) e `68147e76b35a3846f37adc1a7a0b98b8bf70a6ef` (persistencia local). Os arquivos selecionados testados foram comparados por hash Git com a segunda revisao; o SHA da bancada isolada nao foi apresentado como SHA remoto.

### Correcao dos testes sem inventar funcionalidades

Os E2E antigos visitavam `/capataz/fazendas`, `/capataz/retiros`, `/capataz/pastos`, `/gerente/nutricao`, `/admin/estoque` e `/admin/transferencias`, ausentes de `App.tsx`. Tambem supunham um textbox de produto onde existem seletores, um modal no dashboard sem botao correspondente e atributos de mapa/rolagem inexistentes. O helper adicional ignorava configuracao de viewport/baseURL do projeto; login nao esperava a transicao antes da navegacao seguinte.

O lote manteve 25 cenarios e corrigiu os contratos para os fluxos existentes: painel do capataz, transferencia entre retiros, QR por fazenda, abas de produtos, linha do lancamento manual, historicos, fabrica com vinculo valido, cadastro/cancelamento de produto, mapa ausente e download de bytes PDF ficticios. A negativa de tenant verifica o alerta e a ausencia dos dados recusados, sem segundo login.

As fixtures sao apenas HTTP interceptado dentro dos testes; nao sao backend, seed nem garantia de regras transacionais. Escritas nao modeladas retornam 405, filtros nao suportados de tabelas preenchidas falham explicitamente, e destinos externos HTTP/WebSocket sao bloqueados. Testes de Service Worker continuam separados, sem esse bloqueio de SW usado pela suite de UI mockada.

**Limites:** nao declarar aprovados envio de salga, transferencia de estoque/animais, upload real, geometria/zoom de mapa ou geracao real do relatorio a partir destes cenarios. O PDF verifica abertura/download binario de um arquivo sintetico. E2E corrigido no codigo nao significa E2E verde no navegador.

### Correcao do adapter key/value

O `IndexedDbLocalDatabase` mantinha a referencia do objeto recebido durante a espera assincrona de abertura; uma alteracao posterior do chamador podia mudar o que seria salvo. Agora `set` faz snapshot antes do primeiro await. Dados nao clonaveis falham antes de abrir o banco. A abertura recusa schema `kv` incompatível e fecha conexao que chega depois de rejeicao por bloqueio.

Esta correcao e no adapter key/value, diferente do adapter de Command Queue corrigido na rodada anterior. Nome/versao do banco novo e contrato publico foram preservados. Nenhuma migracao, limpeza ou mudanca nas seis bases legadas.

### Evidencias desta rodada

| Verificacao | Resultado e alcance |
| --- | --- |
| Adapter antes da correcao | 6 falhas e 2 aprovados na nova suite; causas reproduzidas |
| Contratos E2E antes da correcao | 4 falhas; rotas, configuracao de contexto, redirect e login duplicado |
| Helper de fixtures antes da correcao | 1 falha e 5 aprovados; tabela vazia com filtro nao modelado |
| Node final | 25 PASS, 0 FAIL, 0 SKIP, 0 cancelados; somente quatro arquivos de teste selecionados |
| TypeScript estrito | exit 0 nos arquivos alterados e dependencias de contrato, nao no monorepo inteiro |
| Playwright `--list` | 75 testes descobertos, 3 projetos, 1 arquivo; nenhum browser iniciado por este comando |
| Taskfile | YAML valido, 20 tarefas; `qa:phase5:contracts` adicionado e novas suites incluidas nas tarefas existentes |
| Revisao de diff | `git diff --check` exit 0; auto-revisao separada, nao revisao independente |

Ambiente: Linux isolado, Node 22.16.0, TypeScript 5.8.3, Playwright 1.58.2, pacote verdadeiro fake-indexeddb 6.2.5. Dependencias extraidas seletivamente do ZIP fornecido, sem `.env`, credenciais, dados pessoais ou configuracao Git privada. Sete testes antigos de adapter ainda usam factory simulada; os novos testes de persistencia usam o pacote verdadeiro, com doubles especificos apenas para abertura bloqueada e ausencia de abertura.

Comandos finais:

```bash
node --test apps/web/tests/*.test.cjs
node node_modules/typescript/bin/tsc --noEmit --strict --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --types node --skipLibCheck apps/web/src/platform/adapters/IndexedDbLocalDatabase.ts apps/web/e2e/phase5-web-ready.spec.ts
node node_modules/playwright/cli.js test --config=apps/web/playwright.config.ts --list
git diff --check
```

O glob do comando Node refere-se a bancada seletiva (25 testes), nao a todos os testes do repositorio. Manifesto sanitizado com comandos, exit codes, horarios, hashes e limites: `docs/qa/evidence/2026-10-11-selected-local.json`. Ele **nao e entrada de aprovacao de fase/pre-producao**. Logs completos sanitizados foram preservados no pacote de evidencias entregue nesta conversa; nao foram subidos logs volumosos ao Git.

### Impedimentos concretos, sem falsa aprovacao

Browser-MTS mostrou o Codespace, mas digitacao e clique retornaram timeout de WebSocket; os comandos de inspecao nao tiveram execucao confirmada. Desktop Commander estava offline. A bancada local nao tem Bun/Go Task; a tentativa Chromium em loopback foi recusada com `ERR_BLOCKED_BY_ADMINISTRATOR`. Essas limitacoes nao foram contornadas desativando seguranca. Por isso nao houve nova execucao de Vitest Web/API/Edge completo, E2E, Axe/Lighthouse ou scanners integrais.

Os 11 arquivos pendentes ja tinham sido publicados anteriormente nos commits `17ed1b45`, `dde8aec3` e `0aedb592`, confirmados no remoto. Nao foram recriados. Os novos commits sao incrementais na mesma branch, com `[skip ci]`, sem reescrita de historico, merge, deploy, banco remoto ou alteracao do ambiente de clientes.

**Estado final:** FASE 5 parcialmente corrigida, QA integral pendente; FASE 6 com evidencia browser historica apenas da fixture, sem novo aceite; FASE 7 com adapter reforcado, migracao e integracao ainda pendentes. Pendencias nao criticas podem ser priorizadas para depois, mas nenhum risco material de dados/autorizacao foi dispensado. A publicacao de codigo nao libera a substituicao da PWA em campo.
