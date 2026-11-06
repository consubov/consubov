# Evidência T01 — módulo independente JS + Rust/Wasm

Execução local em 05/11/2026 no workspace `next-platform`; árvore compartilhada e dirty, sem comandos Git, sem remoto, deploy ou alteração de fonte de produção. Esta evidência é um ensaio focado, não aceite de SHA limpo ou homologação de produção.

| Gate | Resultado observado |
| --- | --- |
| Chromium leitura/escrita | PASS — 21 verificações semânticas, 20 mensagens JSON em paridade Python/runtime, 3 pedidos com Blob aceitos pelo schema runtime |
| Chromium somente leitura | PASS — 16 verificações, 16 mensagens JSON, 1 pedido Blob válido recusado pelo host por capability |
| WebKit leitura/escrita | PASS — 21 verificações, 20 mensagens JSON, 3 pedidos Blob |
| WebKit somente leitura | PASS — 16 verificações, 16 mensagens JSON, 1 pedido Blob recusado pelo host por capability |
| `bun run typecheck` | PASS |
| `bunx tsc --project qa/fixtures/protocol-v1-rust/tsconfig.json --pretty false` | PASS — inclui explicitamente o runner em `packages/local-data/test`, que o typecheck raiz não inclui |
| `bun test qa/suites/q1-public-transport.test.ts` | PASS — 3 testes, 306 asserts, nenhum teste alterado |

Total do ensaio portátil: 74 verificações semânticas; 72 mensagens JSON confrontadas com o schema público por Python independente e com o schema runtime; 8 pedidos binários efetivos. A geração verificada do artefato nesta execução foi `bca5923938d695cb24f1ccf640015a86a7507132d14f368fa63ea60752991579`. O runner recompila Rust e republica a fixture no próximo ensaio; não consome um binário antigo em `.module-artifacts`.

O host é o `ModuleFrame` de produção, usando `QuiescentLocalData` e `IndexedDbLocalData`, sem replicar sua validação ou despacho. O artefato é selecionado pelo publisher genérico, baixado/verificado pelo service worker real e transformado pelo construtor de documento opaco real. `host.ts` apenas monta o componente, coleta traces/resultados e expira a sessão de teste para provocar a negativa real de autorização.

Cobertura positiva: hello/init/ready, oito métodos RPC, armazenamento de snapshot + outbox + Blob, referência compartilhada, igualdade dos bytes relidos, schema 1/2 aceitos por Rust e schema 3 rejeitado. As consultas vazias retornam `null`/lista vazia conforme seus métodos. A seleção da capability vem do host.

Cobertura negativa: capability de escrita ausente → `FORBIDDEN`, sem snapshot/outbox; nonce/módulo estrangeiros e contexto extra/método inválido → `INVALID_MESSAGE`; protocolo 2 → `UNSUPPORTED_PROTOCOL`; sessão expirada → `UNAUTHORIZED`; tenant estrangeiro e base de agregado obsoleta → `MODULE_FAILURE`. Após a base obsoleta, snapshot e outbox originais são relidos e preservados.

Limites explícitos: Rust é validador de versões, não runtime integral do módulo; listOperationIssues e cursor são exercitados em estado vazio, sem povoar conflitos/pull; não há tentativa de comprovar DTO HTTP, sync, UI funcional do perfil, quiescência/ativação N/N-1, quota/evicção, reinício offline do browser ou aparelho real nesta fixture. A suite pública existente cobre também shapes HTTP em seu próprio escopo. Os ensaios T05/T07 continuam independentes. Nenhum perfil, fase completa ou produção foi aprovado por este relatório.
