# INC-011 — Gate CI para update do PWA

Implementado em PR #79, sem deploy, migration, alteração de dados ou configuração do Vercel.

**Comportamentos cobertos**
- SemVer do CONSUBOV 2.0 não pode regredir para 1.155.0.
- Build do Service Worker deve coincidir com `version.json`; HTML e precache precisam apontar para arquivos JS/CSS existentes.
- Rotas Vercel LIVE `/manifest.json -> /manifest-consubov-v2.json` e `/baixar -> /instalar-consubov-v2.html`: os arquivos de destino devem existir no artefato.
- Testes Vitest conferem versão atual/antiga, metadados inválidos, SW de outra origem e deduplicação de aviso por build.
- Playwright Chromium executa `pwa-fixtures/upgrade.spec.ts` em **perfil persistente isolado**, com Service Worker real, consentimento e preservação de IndexedDB, fila offline, fotos e Blob após atualizar. Não usa sessão de cliente nem banco remoto.

**Executar no clone**
```bash
bun install --frozen-lockfile
cd apps/web
bunx vitest run src/lib/publishedUpdate.test.ts src/lib/publishedUpdateRegression.test.ts src/lib/pwaStaticRouteTargets.test.ts
cd ../..
bun run --cwd apps/web build
node scripts/ci/pwa-release-gate.mjs apps/web/dist
cd apps/web
bunx playwright install chromium
bunx playwright test pwa-fixtures/upgrade.spec.ts --config=playwright.pwa.config.ts --project=pwa-chromium
```

**Após um deploy autorizado**, validar no host configurado com os rewrites de produção:
```bash
node scripts/ci/pwa-release-gate.mjs apps/web/dist --smoke-url=https://app.consubov.com.br --check-host-rewrites
```
Esta chamada HTTP apenas lê as rotas e valida o manifesto V2 e os JS/CSS atuais. O comando não é executado automaticamente em cada deploy.

**Estado do gate**: CI só é considerado PASS após checks e E2E do SHA final no GitHub. **Configuração Vercel/branch protection para exigir esse status antes da publicação ainda não foi alterada**; portanto o gate não bloqueia, por si só, um deploy automático. QA com dispositivo real e outros usuários permanece pendente. NUNCA limpar IndexedDB, cache ou filas como solução. Reconciliar PR #77 e GOV-001 antes de merge.
