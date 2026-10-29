# CONSUBOV Fazendas 2.0.0 — QA de build PWA e prevenção de downgrade (2026-10-29)

**Aplicação:** `consubov-fazendas-app`, versão mínima aprovada **2.0.0**. A versão legada `1.155.0` nunca deve substituir o release em produção. O site institucional não usa SemVer.

## Falha reproduzida e correção
Na branch de login, o plugin `inject-sw-build-timestamp` em `apps/web/vite.config.ts` retornava silenciosamente quando `dist/sw.js` não existia, deixando o build terminar sem `dist/version.json`; também não exigia o marcador `__BUILD_TIMESTAMP__`. A ausência desses arquivos favorece o cenário de manifesto/assets e atualização offline incompleta.

O plugin agora rejeita ambos os casos, além de manter os controles já existentes de JavaScript de saída e precache. O plugin `consubov-fazendas-release-floor` continua rejeitando APP_VERSION menor que 2.0.0, versões pré-release e formato inválido. Nenhum `public/sw.js`, identidade de manifesto, IndexedDB ou cache real foi alterado.

## Evidências
- Código na branch `fix/consubov-fazendas-app/p0-browser-login-20261029`, commits `c8722d81872141cc301fdcf3a0c16f0c00229fc5` e `dd0bf48f9d5920892e408f8bedff8816406a4b35`.
- Teste versionado `apps/web/src/test/viteBuildGuard.test.ts` exercita 8 casos com árvores temporárias de `dist/`: 2.0.0 aceita; 1.155.0 e pré-release negadas; SW/JS/precache/timestamp ausentes negados; `version.json` e SW versionado gerados no caso válido.
- **Executado no ambiente isolado:** teste Node de execução dos plugins reais **8/8 PASS**; as mesmas 8 definições versionadas foram exercitadas com um adaptador Node (8/8 PASS). O adaptador **não é Vitest**, logo não declarar suíte Vitest aprovada.
- **Não executados no ambiente completo:** `bun`, `node_modules` do repositório, `bun run typecheck`, `bun run build`, Vitest autêntico e Playwright E2E. Container atual não resolve GitHub/npm; não confundir QA isolado com release homologado.

## Gate de publicação / critérios de aceite
1. Em checkout completo autorizado com Bun/Chromium, executar de `apps/web`: `bun run typecheck`, `bun run build`, `bunx vitest run src/test/viteBuildGuard.test.ts src/lib/publishedUpdate.test.ts src/test/swUpdateConsent.test.ts`, `bunx playwright test --config playwright.browser-login.config.ts`.
2. Confirmar no artefato gerado `dist/sw.js` com timestamp substituído, `dist/version.json` com `appVersion: 2.0.0`, manifesto/JS/CSS HTTP 200, sem downgrade do cliente.
3. Validar `/login` em navegador normal e standalone, sessão e isolamento por tenant, offline e SW upgrade com filas/fotos/IndexedDB intactos.
4. Conferir HEAD de produção e conflitos da PR #80 (agente responsável). **Não efetuar merge na `main` legada ou deploy antes do QA e reconciliação.**

**Rollback:** manter o deployment aprovado 2.0.0; alterações deste documento estão somente na branch. Nenhuma alteração de Supabase, Vercel, Git main, dados do usuário ou produção foi executada.

**Status:** implementação e QA dos hooks locais PASS; release global **NO-GO** por QA dependente de checkout/CI e conflitos de reconciliação.
