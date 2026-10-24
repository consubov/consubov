# QA — CONSUBOV v2 substitui a instalação legada sem reinstalação

**Fase:** 6.3A / 21. **Origem alvo inicial:** `https://consubov.com.br`. **Estado:** PREPARADO, SEM DEPLOY, SEM GO de release.

## Escopo de implementação no PR #60
- Reutilizar o build do App/SW da Web no mesmo origin `consubov.com.br`: `bun run --cwd apps/web build:legacy-upgrade`.
- Rejeitar automaticamente build site-only e alteração de identidade por `bun run --cwd apps/web check:legacy-upgrade-build` + `node scripts/qa/check-pwa-build.mjs`.
- Expor `UpdateBanner` nas rotas internas do App CONSUBOV instalado, preservando as superfícies públicas/Relatto/SyncVet.
- Manter `id=/`, `scope=/`, `start_url=/`, SW e filas/Blob/IndexedDB existentes; não trocar URL do App automaticamente.

## Fora do escopo
- Merge, Vercel produção, mudança DNS, migração Supabase remota, habilitação RLS, desinstalação, exclusão de caches/bancos, site Consubov, Relatto e login offline (registrado como trabalho futuro).
- Alteração prematura de `APP_VERSION` para 2.0.0; ocorrerá apenas na release integrada aprovada.

## QA / verificação exigida antes de publicar
- [ ] `bun install --frozen-lockfile` no SHA exato (Bun 1.4.0).
- [ ] `bun run check`: TypeScript, build e testes Web/API, sem regressões.
- [ ] `bun run --cwd apps/web build:legacy-upgrade && bun run --cwd apps/web check:legacy-upgrade-build && node scripts/qa/check-pwa-build.mjs`.
- [ ] `bun run --cwd apps/web test:e2e` e fixture PWA Chromium/WebKit (`bash scripts/qa/run-pwa-fixture.sh`), seis bases e anexos sintéticos.
- [ ] Instalação física legada no iOS e Android, origem real: botão Atualizar, mesma instalação/ícone, identidade PWA, reabertura offline, lançamentos/fotos/filas sem perda, login/tenants isolados, rollback. Cliente offline por longo período deve continuar podendo abrir origem antiga.
- [ ] SHA integrado com PRs #60–#63, Security Scan HIGH zerado, decisões da FASE 21, snapshots/backup/rollback comprovados.
- [ ] **Não** trocar `consubov.com.br` para site institucional até terminar a migração/ACK de todos os usuários; usar `app.consubov.com.br` apenas para novos usuários enquanto antigo ainda é necessário.

## Risco e recuperação
Uma publicação do artefato `dist-site` na origem antiga ou um redirecionamento imediato a `app.consubov.com.br` poderia privar usuários antigos de dados IndexedDB/filas. Reversão deve manter a geração anterior de SW/asset em mesma origem e preservar novas escritas. Não restaurar snapshot antigo do servidor sem reconciliar registros.
