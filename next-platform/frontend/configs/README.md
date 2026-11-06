# Configuração local reproduzível

Executar comandos da raiz `next-platform`, usando o Bun instalado e os scripts reais do `package.json`. Build de perfis: `bun run build:modules`; shell: `bun run --cwd apps/fazenda/shell build`. Para testes isolados, `CONSUBOV_MODULE_OUTPUT_ROOT` aponta para um diretório próprio sob `.qa/tmp`; `CONSUBOV_MODULE_VERSION` permite versionar apenas o perfil escolhido. Não apontar para checkout alheio.

ADM: `bun run --cwd apps/admin-global build` gera `dist-candidate`; `build:lab` gera `dist-lab`, com importação da simulação exclusivamente nesse modo. `CONSUBOV_ADM_ORIGIN` deve identificar a origem loopback própria (padrões candidato 5174, bancada 5175), e `CONSUBOV_ADM_VERSION` identifica a release. O publisher rejeita origem não local e outputs redirecionados. QA usa `vite build --outDir <diretório próprio>` para preservar artefatos existentes.

O servidor de QA `qa/scripts/serve-production-t03.ts` exporta uma factory com `shellRoot` e `moduleRoot`, além do executável local. Runners usam `T03_PORT`/`T04_PORT` para origens descartáveis. A API é `createRouter(new InMemoryLedger())`, com grants próprios por instância. Não configurar URLs, tokens, cookies ou bancos de produção.

No Windows, `qa/scripts/persistent-profile-path.mjs` reserva uma letra de drive livre somente para o perfil QA criado no workspace. Isso evita MAX_PATH do CacheStorage WebKit; fechar os browsers antes de liberar o alias e limpar o diretório canônico verificado. Não mover ou apagar perfis de usuário reais.

O `Taskfile.yml` canônico foi consultado e `doctor` passou. Seu `setup` e gates legados instalam/executam outra aplicação fora de `next-platform`; não foram usados para aprovar esta F23. Os browsers/dependências locais efetivamente usados foram exercitados pelas suites novas. Não inventar equivalência entre gate legado, contrato unitário e ensaio real deste laboratório.
