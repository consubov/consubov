# PR #116 — reconciliação de tipagem das leituras offline (01/11/2026)

## Contexto e decisão

A PR original #116 substituía `(supabase as any).from(table)` por `supabase.from(table)` e atribuía `keyof Database["public"]["Tables"]` a 16 tabelas do Mais Arrobas. Na `main` atual, essa chamada sobre a união de muitas tabelas gera `TS2589` (instanciação excessiva de tipos) e o retorno não satisfaz `Record<string, unknown>` (`TS2345`). A PR original também modificava `apps/web/package.json` e `bun.lock` fora do escopo da correção.

A reconciliação mantém uma lista imutável e checada contra as tabelas do esquema gerado usando `as const satisfies`. A consulta usa um **contrato local estreito de leitura**: `OfflineReadClient.from` aceita somente `OfflineTable`, a união das 16 tabelas permitidas, e expõe apenas `select("*").range(...)`, dados como registros e erro com mensagem. O cast explícito `as unknown as OfflineReadClient` é a fronteira documentada entre o tipo complexo do Supabase e essa visão limitada. É verificado pelo schema com `as const satisfies`, não cria `any` e desaparece em JavaScript, preservando exatamente a chamada de rede original. Outros usos de `any` fora da função não fazem parte desta PR.

## Dentro e fora do escopo

- **Dentro:** apenas `apps/web/src/lib/maOffline.ts` (leitura de páginas para preencher cache offline) e esta documentação de QA.
- **Fora:** alterar valores de tabelas, ordem de download, paginação (1000), respostas de erro, IndexedDB, fila offline, sincronização, autenticação/RLS, migrações, pacotes/lockfile, API, versão de app ou deploy.
- **Risco:** a função faz `select("*")` por nome de tabela; a revisão deve comprovar que cada chave aponta para o mesmo literal (16 de 16), que `range` usa o mesmo intervalo e que erros e dados são propagados como antes. Não usar banco real nos testes.

## Critérios e QA

1. Confirmar `git diff --check`; arquivos de código restritos à função de leitura offline; nenhuma modificação de dependências.
2. `bun install --frozen-lockfile --ignore-scripts` e `bun run --cwd apps/web typecheck` aprovados.
3. Validar as 16 tabelas offline contra os nomes do esquema gerado; o contrato `OfflineReadClient` deve aceitar somente essa união. Comprovar que a chamada de rede continua `.from(table).select("*").range(...)`.
4. Executar **CI 100% local** pelo VS Code da VPS: `bash scripts/qa/run-ci-vscode-local.sh`, incluindo API/Web, regressões, PWA, offline, contratos, segurança, F23, orçamento de bundle, auditoria HIGH, lint e Chromium E2E desktop/tablet/mobile. A aprovação exige `EXIT=0` no SHA e diff efetivamente integrados.
5. Usar apenas fixtures fictícias de Supabase no loopback para E2E. Não ligar nova arquitetura ao banco remoto, executar GitHub Actions, deploy, migration ou editar secrets.
6. Conferir hashes Git de todos os arquivos antes do merge e repetir typecheck + testes Web após o squash na main.

## Evidências

Os resultados por gate e recibos ficam em `.qa/runs/vscode-ci-local/<execução>/` no worktree de QA da VPS; o Checklist Mestre no Notion e o cérebro local devem registrar o resultado final. Esta nota documenta os gates exigidos, **não declara aprovação antes de executá-los**.
