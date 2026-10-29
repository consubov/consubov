# F12 — GMD: confirmação de gravação e isolamento da interface

**Estado:** PR draft para revisão; **não é aprovação de produção**.

## Problema comprovado

A tela de configuração GMD ignorava erros nas leituras de `fazendas`, `retiros` e `gmd_config`, considerava `UPDATE`/`DELETE` com zero linhas um sucesso e exibia mensagem de sucesso antes de reler os dados. Duas respostas concorrentes podiam sobrescrever o contexto da fazenda. A gravação multipartes continua sem transação de banco.

## Escopo desta alteração

- Proteger leituras por fazenda (erro, falta de linhas, duplicatas, retiros ausentes e respostas antigas).
- Bloquear edição enquanto não há dados confirmados; oferecer nova tentativa segura.
- Impedir dois envios simultâneos; validar valores, períodos e identificação do gerente na execução do comando.
- Exigir `RETURNING id`, quantidade e IDs exatos de cada `INSERT`/`UPDATE`/`DELETE`, com filtro redundante de `fazenda_id`.
- Confirmar o estado persistido após a gravação, incluindo regras adicionais ou obsoletas, antes de exibir sucesso.
- Não exibir mensagens brutas do SQL ao usuário. Erros após o início de alterações podem representar **gravação parcial** e são informados claramente.

## Fora do escopo e ações proibidas

- **Não** modificar tabelas, policies, grants, migrations, funções, agendamentos ou dados do Supabase remoto.
- **Não** alterar módulos do agente local L32, Ciclos/PR #67, fábrica, SyncVet, estoque, PWA/sync, autenticação compartilhada ou páginas de outros módulos.
- **Não** criar branch paga Supabase, disparar workflows manualmente, executar deploy, merge, rotação de secrets ou ligação da arquitetura nova ao legado.

## QA e critérios de aceite

| Gate | Critério | Evidência neste PR |
| --- | --- | --- |
| Unitário | rejeita zero rows, IDs errados, duplicatas, outro tenant, valor/mês inválido | Testes de `gmdGuards.test.ts`; 18 casos exercitados em harness Node local |
| Sintaxe | TSX e helper sem erros de parsing | TypeScript `transpileModule` sem diagnósticos |
| Tipo parcial | código com stubs de bibliotecas externas | `tsc --strict` local; **não substitui tipo real do monorepo** |
| Tipo/lint/build real | rodar na versão de GitHub por SHA, com dependências do projeto | **NÃO EXECUTADO** neste ambiente |
| RLS/REST/JWT real | admin, gerente principal/associado, capataz, escritório, pesador, anon/UID nulo/falso; SELECT e DML | **NÃO EXECUTADO** |
| Transação | falha intermediária sem persistência parcial, concorrência entre dispositivos | **FALHA/pendente no design existente** |
| PWA/offline | troca de usuário/fazenda, erro de rede/retry, reconexão | **NÃO EXECUTADO** |

Todos os resultados de teste devem ser identificados com o SHA do commit; **não** marcar F12 como GO por testes simulados. Executar os gates reais com `task doctor`, `task setup` e as tarefas definidas no `Taskfile.yml` atual, sem inventar scripts.

## Riscos residuais e próximos requisitos de backend

- `public.gmd_config` ainda tem RLS OFF, `authenticated` tem CRUD e não há constraint `UNIQUE NULLS NOT DISTINCT(fazenda_id,retiro_id,categoria)` ou FK que garanta coerência retiro/fazenda. Existem candidatos SQL **não aplicados** no Cérebro.
- `public.rodar_motor_gmd()` ainda concede `EXECUTE` a `PUBLIC`/`anon`/`authenticated`. O cron `motor-gmd-diario` roda como `postgres`. Restrição depende de inventário dos consumidores e QA isolado.
- O salvamento da tela é sequência de requisições sem atomicidade. Antes da liberação, definir e testar comando de backend atômico/idempotente, com autorização multi-tenant e controle de concorrência.
- Regras ligadas a retiro desativado são bloqueadas na interface para evitar remoção implícita; validar contrato para histórico antes de aprovar.

## Git, reversão e relatório esperado

- Alterar somente `GerenteGmdPage.tsx`, helpers/testes GMD e esta documentação em branch exclusiva e **PR draft**. Não editar arquivos de outros owners.
- Sem merge/deploy até QA real independente e aprovação do Checklist Mestre.
- Reversão do frontend: reverter **somente** o commit desta branch/PR; não usar reset forçado; não há rollback de banco por não ter havido mudança remota.
- Relatório do executor/revisor: branch, SHA base/HEAD, arquivos alterados, resultado dos testes por gate (PASS/FAIL/NÃO EXECUTADO), riscos, evidência de revisão/rollback, atualização de Cérebro e Notion e autorização final antes de merge.
