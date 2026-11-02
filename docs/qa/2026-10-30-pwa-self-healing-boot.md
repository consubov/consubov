# CONSUBOV Fazendas — auto-recuperação de shell PWA (30/10/2026)

## Base, escopo e ownership

- APP_ID: `consubov-fazendas-app`, versão de produto **2.0.0**.
- Base: commit em produção `3c66c4bb39a37581ad0eebc5b7181978959aadb7`.
- Incidente: `/assets/index-CWof2W_g.js` HTTP 404 no worker antigo, apesar da correção do matcher no worker publicado.
- Mudança apenas na inicialização e recuperação da PWA web: `index.html`, `vite.config.ts`, `src/main.tsx`, novo script inline e QA Node. **Não** altera Supabase, RLS, banco, ID/scope PWA, manifests, service worker atual, auth, filas ou arquivos de outros owners.
- PRs PWA #79 e F12 permanecem sob owners existentes. Não mesclar versões antigas da `main`.

## Comportamento novo (somente falha concreta)

- O build incorpora diretamente no HTML um micro-recuperador **inline**, antes do bundle principal. Nenhum arquivo JavaScript adicional precisa ser baixado para iniciar a recuperação.
- Quando a entrada Vite ou um chunk essencial falha, ou quando o boot não termina, o app verifica `/version.json` com `no-store`, compara a versão do produto (não permite downgrade) e o timestamp do build, registra `/sw.js?v=<versão>` da mesma origem e aguarda o worker completar a instalação de seu shell/precaches.
- Somente com worker `waiting` **do build publicado** e sem operações críticas é emitido `SKIP_WAITING`. A recarga única acontece apenas após o `controllerchange` comprovar que o worker novo controla a página. Novas operações durante a renovação de autenticação também adiam a recarga.
- Em offline/erro do servidor, exibe mensagem simples de conexão e tenta novamente em segundo plano ao reconectar ou com intervalo limitado. Não apaga Cache Storage/IndexedDB/localStorage, salgas, fotos ou filas. O capataz pode preservar o estado offline já instalado.
- Um marcador `sessionStorage` limita a **uma recarga automática por build publicado**, evitando tela piscando/reloads infinitos. Sem acesso a sessionStorage, não força reload. Versões inválidas, regressivas, SW de outra origem, instalação incompleta ou controle não confirmado nunca causam reload.
- O caminho habitual de atualização do app continua respeitando a decisão do usuário; a exceção automática é apenas para o shell efetivamente **quebrado** ou chunk crítico falhando fora de operações.

## Limite importante

Um dispositivo que está executando HTML **anterior** a esta mudança, com JS de entrada faltando e **sem recuperador inline**, não tem como receber código de recuperação enquanto o SW antigo ainda controla sua página. Nesses casos, a atualização automática do SW pelo navegador em próxima navegação/reativação pode recuperar o app, mas não há garantia. Não afirmar que todos os clientes legados foram recuperados sem E2E. Para eliminá-los de forma estrutural, adotar retenção dos bundles antigos por uma janela de transição e gate HTTP de cada geração (frente de release PWA/PR79).

## Evidências locais

- `node --test apps/web/scripts/qa/check-pwa-boot-repair.mjs apps/web/scripts/qa/check-pwa-build-injection.mjs`: **18/18 PASS** em fixtures Node/VM, incluindo falha da entrada, offline→online, anti-loop, auth, operação crítica, downgrade, wrong-origin, timeout de SW, preservação do armazenamento e injeção real do plugin com `dist` sintético.
- Revisão TS/TSX, `git apply --check` contra arquivos exatos do SHA-base e QA completo do monorepo: registrar separadamente. Fixtures NÃO equivalem a teste E2E com dispositivo físico.

## Gate de QA antes de produção

1. Executar no commit real: typecheck, lint, build Vite, script de QA e CI existente; `dist/index.html` deve conter o bootstrap inline com o mesmo timestamp de `dist/version.json`/`dist/sw.js`.
2. HTTP 200 para `/app`, `/index.html`, JS/CSS do HTML, `/sw.js`, `/version.json`, `/manifest.json` no preview; MIME correto.
3. E2E Chromium Android em perfil persistente com **duas gerações diferentes**: SW N-1 controlando HTML N-1, script removido no servidor, recuperar somente após instalação do SW N e confirmação de `controllerchange` sem abrir DevTools; sem apagar IDB, fotos e filas.
4. Testar app no offline/instável, fechamento e reabertura, upgrade em operação crítica e com sessão renovando, dois dispositivos/duas contas, iOS PWA standalone e Android Chrome.
5. Se qualquer QA falhar, **não promover**; manter deploy atual. Rollback para deploy atual anterior `dpl_4miCsh4fYDgFx2WanwuFhth7rF2K` mediante autorização.

## Fora do escopo / proibido

Nenhum cache purge indiscriminado, `unregister()` em produção, limpeza de IndexedDB, migrações remotas, alterações de RLS/permissões, logout compulsório, `skipWaiting()` em atualização rotineira, reenvio automático de salgas/fotos ou edição dos contratos de PWA/PR79.

## Relatório final esperado

SHA exato, nomes dos arquivos alterados, resultados de testes no próprio SHA, assets e logs HTTP do deploy, evidência N-1→N em Android/iOS, operação crítica protegida, confirmação de usuários e rollback verificado. Atualizar Obsidian, Notion e Handoff das Fontes ao passar QA.
