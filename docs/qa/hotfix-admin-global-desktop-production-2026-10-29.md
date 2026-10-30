# INC-007 — Admin global: dados zerados / fazendas em loop
Data 2026-10-29. Baseline Vercel **em produção verificado**: dpl_EV9ySX9fEpboSYiLs5kYoqNfg7Nz, Git 926fee4f8cbb809927575d9c677f21bcf8d6b14f (correções de PDF). Branch separado hotfix/admin-global-dashboard-prod-20261029 criado EXATAMENTE a partir desse commit, sem sobrescrever a PR PDF. Não promover sem gates.

## Evidência de base (read-only)
Vercel app.consubov.com.br: VITE_SUPABASE_URL=https://zptkqeiyvkqogrimbvna.supabase.co. SQL somente SELECT: 8 fazendas, 19 retiros, 489 pastos, 4 produtos, 51 ciclos, 1431 lançamentos, 4 fábricas. Quatro admin ativos, todos reconhecidos por is_admin(user_id); JWT autenticado simulado em transação READ ONLY retorna 8/19/489 para RLS em 1 admin. O navegador do usuário não foi reproduzido.

## Fix
Patches de apps/web/src/pages/AdminDashboard.tsx e FazendasPage.tsx + helpers/QA equivalentes ao HEAD verificado da PR #72, sem mudança de dados/SQL/Auth/roles, mantendo toda a correção de PDF já publicada. Adicionado deadline 12s, verificação Auth + vínculo admin, erro/RLS sem zeros falsos, retry e cleanup. Restauração dos dados no desktop depende de JWT/rede corretos, ainda não comprovada com sessão real.

## QA
Node22 10/10 testes de validação PASS; tsc strict helper PASS; TSX parse PASS. GitHub CI e preview Vercel específicos deste SHA e E2E real de admin AINDA PENDENTES. Nenhuma migração, secret, dados ou regra RLS modificados. Não usar um mero HTTP 200 público como prova de visibilidade autenticada. Notion/Obsidian e handoff precisam acompanhar. Rollback candidato: deployment dpl_EV9ySX9fEpboSYiLs5kYoqNfg7Nz (confirmar alias atual antes de promoção).
