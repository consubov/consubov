# Fixture portátil de contrato v1

Este módulo de QA implementa o wire protocol em JavaScript independente e usa um validador de versões compilado de Rust para Wasm. `adapter.js` não importa React, TypeScript, contratos ou pacotes CONSUBOV. A parte Rust valida protocolo 1 e schemas locais 1/2; a implementação RPC permanece em JavaScript. Não se trata de uma implementação integral de negócio em Rust.

Executar da raiz `next-platform` (Bun, Rust com target `wasm32-unknown-unknown`, Playwright Chromium/WebKit, Python 3 com `jsonschema`):

```powershell
bun packages/local-data/test/run-portable-module.ts
bunx tsc --project qa/fixtures/protocol-v1-rust/tsconfig.json --pretty false
bun test qa/suites/q1-public-transport.test.ts
```

O runner compila Rust em um diretório exclusivo `.qa/tmp/portable-contract-<uuid>`, publica o artefato pelo `artifact-publisher` real e inicia um servidor QA em porta aleatória. O host de QA renderiza o `ModuleFrame` de produção sem alterações, com o service worker original, manifesto verificado, geração imutável, SHA-256/SRI e `createIsolatedModuleDocument`. A fixture usa a identidade Capataz apenas nessa origem isolada; não substitui seus artefatos operacionais. Não há dispatcher RPC copiado, mock de banco, import de negócio no módulo, Vite dev server ou mudança de shell.

Cada navegador executa uma sessão de leitura/escrita e uma somente leitura com perfis persistentes exclusivos. O helper `persistent-profile-path.mjs` mantém os caminhos WebKit curtos no Windows. Os browsers são fechados antes de liberar os aliases e remover somente o diretório do próprio ensaio. O resultado sanitizado fica em `.qa/portable-contract-result.json`.

O módulo executa os oito métodos públicos: `readSnapshot`, `listSnapshots`, `commitMutation`, `readAttachment`, `listPendingCommands`, `listOperationIssues`, `getCursor` e `getSchemaVersion`. Salva snapshot, comando e foto Blob reais no IndexedDB, relê os bytes, verifica referências compartilhadas por structured clone e rejeição de mutação obsoleta sem alterar snapshot/outbox. Exercita nonce e módulo estrangeiros, protocolo não suportado, contexto injetado, método inválido, capability de escrita ausente, tenant de comando estrangeiro e sessão expirada.

As mensagens JSON produzidas pela implementação independente são comparadas com o mesmo schema público v1 usando Python/Draft 2020-12, resolução offline de `$ref` e format checking, confrontados com a aceitação real Zod. Blob não é JSON: os pedidos binários são enviados pelo MessageChannel real e validados pelo schema runtime com `instanceof Blob`; o ensaio não declara validação binária por JSON Schema. A suite pública existente roda sem alterações.

Ver o resultado e os limites em [REPORT.md](REPORT.md). Esta fixture comprova interoperabilidade do protocolo local e carregamento do artefato alternativo; os fluxos completos dos quatro perfis, sync/DTOs remotos, homologação real e QA de revisão limpa continuam tendo seus próprios gates.
