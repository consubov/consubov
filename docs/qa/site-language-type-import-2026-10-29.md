# Correção isolada do import de SiteLanguage — 29/10/2026

**Escopo:** resolver TS2307 da `main` em `apps/web/src/hooks/useTranslation.tsx`, trocando o import relativo inexistente `./siteLanguage` para o tipo já existente em `@/lib/siteLanguage`.

**Fora do escopo:** GMD/PR #68, módulo de site institucional, instalação PWA, pacotes/lockfile, Supabase, banco, mudanças de domínio.

**QA observado:** GitHub Actions `build-and-test` do PR #68, job `123461996873`, apresentou `TS2307 Cannot find module './siteLanguage'` no typecheck Web; verificação TypeScript 5.8.3 de resolução de módulos em estrutura equivalente: antigo caminho não encontrado; novo caminho `@/lib/siteLanguage` resolvido; TSX parse sem diagnósticos. A validação completa do monorepo neste branch depende do novo CI.

**Critérios de aceite:** `bun run typecheck` e `build-and-test` no SHA desta branch, sem warnings novos no `lint:changed`, sem alteração de UX, nenhum erro de resolução de módulos. Auditoria de dependências em outras frentes NÃO é suprida por este patch.

**Git / rollback:** branch exclusiva em PR DRAFT; não mesclar ou publicar sem QA e autorização. Reversão apenas do commit desta branch, sem hard reset/force push. Documentar e sincronizar no Obsidian/Notion após CI.