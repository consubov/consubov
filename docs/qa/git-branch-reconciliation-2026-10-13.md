# Reconciliacao Git - 2026-10-13

## Escopo e autorizacao

Pedido: migrar os commits dos outros ramos, corrigir conflitos segundo o planejamento e limpar branches. Destino: `work/fase5-6-7-pwa-local`, no repositorio privado `mmatteuus/consubov`. Nao inclui atualizar `main`, deploy, banco, dados de clientes ou mudanca de arquitetura.

O merge `41a1f9f1a3728a3f4cf393c6520587bd45cab3a0` preserva todos os pais:

| Origem | SHA preservado |
| --- | --- |
| Branch de trabalho | b9ecba3d1b7fed02a21cfc01e340b8b8e0ac4c2c |
| main | 161cf184cbf6f36018dd497d42787883bb2cf850 |
| quality/fase5-web-ready-20261005 | d314db58a2c3d455974bc53a4847f2b875da8f01 |
| feature/phase6-app-shell | dc41ceab49f3624eb63defea1859db7d58d3568b |

Comparacao GitHub de `b9ecba3d` ao merge: 51 commits a frente, zero atras, diff vazio. Portanto 50 commits preexistentes passam a ser alcancaveis, alem do proprio merge. Nao somar 40+42: os dois ramos antigos compartilham historico.

## Resolucao dos conflitos - nao e merge cego

- Quality: backend completo tem a mesma arvore `d31e8f7b151edd4c2409c9e4b64465239e7724d3` na origem e no destino. Rotas/layouts, gitattributes e workflow ja estavam incorporados. Mantidas as evolucoes posteriores de E2E, runner Axe, coverage/lint, update PWA, IndexedDB e recuperacao; nao regredir aos testes/validadores antigos.
- Feature: Web/API compartilham as bases da quality. O experimento `apps/mobile` e seus plugins nativos nao sao reintroduzidos. `docs/30-pwa-mobile-first.md`, ausente na branch ativa, e recuperado com a direcao PWA atual e seu original integral em arquivo. Checklists e decisoes nativas antigas permanecem recuperaveis nos commits originais.
- Main: os commits `d3740ee4`, `e0c1358f` e `6944de9a` descrevem/implementam o caminho Capacitor/SQLite congelado. Sao preservados na ancestralidade, sem ligar adapters nativos nem restaurar os scripts dessa trilha. As extensoes/tasks de `89ad7288` ja estao contempladas no conjunto atual. De `161cf184`, incorporar `*.zip`, mantendo todos os ignores adicionais e arquivos ja rastreados.
- O `scripts/phase5-gates.sh` historico nao foi ativado: sua funcao `run` imprime o codigo de erro, mas termina em echo, e o script nao propaga o agregado FAIL. Permanecem Go Task e os runners atuais que registram falhas; nenhum gate e afrouxado para facilitar integracao.

A integracao e de historico com resolucao seletiva: nao significa que todo experimento ou estado intermediario virou funcionalidade ativa. Todos os commits originais sao preservados. Nenhum arquivo funcional e removido da branch ativa.

## Verificacao proporcional e limites

Verificacoes locais executadas: **10/10 PASS**, exit 0. A regra ZIP foi exercitada primeiro contra o ignore anterior: 2 falhas esperadas; depois, nenhuma falha. Os demais cenarios verificam arquivos rastreados, paths sensiveis, VS Code, fontes da aplicacao, escopo e hashes dos snapshots. Nao sao testes da aplicacao.

Validacao local desta tarefa: hashes das fontes documentais, preservacao byte a byte dos arquivos arquivados e comportamento de `.gitignore` em repositorio temporario. Antes de publicar, conferir a arvore final e exigir identidade exata das areas funcionais com `b9ecba3d`:

- `apps`: `1de66c466c5d3e0590fcff69abe6c041d39f02af`;
- `scripts`: `b63930b2c0aaf238aada8d9dabfe0f61d20a9bfd`;
- `bun.lock`: `484fff05dc2d633fbfb4629343b65a68da4bcefd`;
- `package.json`: `4f34434b9a8c457441b7f51c147992ecf26ad9f3`;
- `Taskfile.yml`: `0dcb892285dae7626df8f0b1d97496fe6f376d85`;
- `.github`: `8b3a6154387e136b6b29df496d6f2422254104da`;
- `.devcontainer`: `d8bdcf5f07dfc2174a363546ec7ea926058aa984`;
- `.vscode`: `cb57ad1794fd5e99fb993335d1ba56660e9a17f2`;
- `supabase`: `e80620124fc37b64bc1bed4ef03480f21ac9faf6`;
- `instructions`: `b5805910978c7432d9fb1ef6a6844ffec971a424`.

API/Web/PWA/E2E completos NAO reexecutados nesta tarefa. Identidade de arvore comprova ausencia de mudanca de codigo, nao novo PASS de suite. Os resultados de `b9ecba3d` e rodadas anteriores continuam historicos. Revisao feita pelo proprio executor; nao existe aprovacao independente simulada. QA desta tarefa limita-se a integridade Git/documentacao, nao aos gates integrais do produto.

## Publicacao e limpeza

Publicar apenas por fast-forward com SHA esperado `b9ecba3d1b7fed02a21cfc01e340b8b8e0ac4c2c`, depois de conferir pais, diff, fontes e refs. Os objetos candidatos nao movem branches por si. Manter `[skip ci]`; nenhum runner remoto deve ser disparado manualmente.

Limpeza fisica das refs antigas: PENDENTE. Browser-MTS esta com `Session terminated`, Opera sem conexao e Desktop Commander sem dispositivo. Os conectores GitHub presentes permitem criar commits/atualizar refs, mas nao expuseram uma acao de exclusao de branch. Nao tentar contornar o contrato das ferramentas nem afirmar que houve exclusao.

Quando houver executor conectado, exigir antes de remover: remoto correto, origem com o SHA desta tabela, todos os commits ancestrais do destino publicado, ausencia de trabalho exclusivo e inexistencia de worktree em uso. Nao apagar main, branch ativa, worktrees, stashes ou alteracoes locais. Se uma origem avancar, interromper a exclusao e reconciliar os novos commits. Nao usar reset/force-push.

Codespace nao foi sincronizado. Preservar seu acrescimo local no PRD de capacidades/GPS; nao reaplicar automaticamente scripts antigos. PR #43 continua unico e draft ate o aceite pertinente. Nenhuma fase foi encerrada por esta operacao.
