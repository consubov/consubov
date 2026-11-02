# INC-012 — Correção de dependências HIGH, sem deploy
Data: 2026-10-29. Escopo: PR #80, somente a branch de reconciliação.
Fatos do scan: DOMPurify 3.4.1 (GHSA-mrv2-3pqr-j5jr), Vite 6.4.3 (GHSA-587h-7wmj-h5pm), Zod 3.25.76 (GHSA-mrhx-c7xc-m3w5).
Patches oficiais mínimos: DOMPurify 3.4.17, Vite 6.4.4, Zod 4.6.6 (major: testar compatibilidade de React Hook Form/resolvers/validação de API).
Ações: atualizar manifests/overrides e regenerar bun.lock usando Bun 1.4.0 no GitHub Actions; `bun install --frozen-lockfile`, `bun audit --audit-level=high`, typecheck, build, Vitest, Playwright e lint devem ficar verdes.
Fora do escopo: suprimir alertas do audit, `eslint-disable` em massa, desligar gates, atualizar DB/Supabase, deploy ou promover main antiga.
Git: PR #80 permanece DRAFT/sem merge até que todos os gates estejam aprovados. O workflow auxiliar de regeneração de lock deve ser excluído após uso, sem alterar a configuração permanente do CI.
Risco/rollback: Zod major pode mudar tipos ou comportamento; não mesclar sem revisar falhas e preservar funções de validação.
