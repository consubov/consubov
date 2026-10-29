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

## 29/10/2026 — revisão dos checks após a correção TS2345

- No commit `1158153ec60ec219a7b3a521635b318ca0aa39cb`, o CI real passou typecheck API/Web, build e testes: **47 arquivos e 231 testes Web passaram**; a job `build-and-test` falhou depois em `lint:changed` por **3 usos de `any` e 1 aviso de cleanup do `useEffect` nesta tela** (job `123423733816`).
- Esta revisão tipa `gmd_config` usando diretamente o cliente Supabase gerado, restringe os campos de update/insert da GMD e retira o acesso direto ao contador ref do cleanup do efeito. **Não muda RLS nem corrige a gravação multipartes sem transação.**
- SAST do commit anterior: 19 warnings no módulo de arquitetura da API, fora desta frente (job `123423734352`). Audit: três HIGH em DOMPurify, Vite/launch-editor e Zod (job `123423734543`), dependências sob PRs #61/#63. **Não foram ocultados/ignorados**.
- **Estado desta nova alteração:** aguardando checks no SHA gerado pela publicação. Não liberar o PR #68 para merge ou deploy até QA global aprovado e backend protegido.

## 29/10/2026 — QA adicional de componente React (CI do novo SHA pendente)

- Adicionados testes reais de componente em `apps/web/src/test/pages/GerenteGmdPage.test.tsx` para três cenários: erro 42501 da leitura `gmd_config` bloqueia edição e não revela detalhe SQL; retry somente libera edição após read válido; `UPDATE` sem linhas não gera toast de sucesso.
- Usados mocks locais do Supabase/role e React Testing Library, **sem backend remoto nem credenciais**. O arquivo passou no parse TSX local (TypeScript 5.8.3); o teste Vitest completo ainda depende do CI disparado pela alteração.
- Gates anteriores do commit `0b70319660c090243da651525df4a5f2643db5e7`: build-and-test, SAST e Secret Scanning PASS, Dependency Scan FAIL por três vulnerabilidades altas sob PRs #61/#63. Não reutilizar os resultados para aprovar o novo SHA.
- F12 permanece NO-GO: RLS de `gmd_config` OFF, ausência de UNIQUE e gravação não transacional; PR ainda DRAFT.
