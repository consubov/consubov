# CONSUBOV — Correção restrita de dependências Web (24/10/2026)

## Objetivo
Preparar em branch isolada a remediação das vulnerabilidades identificadas no Security Scan #175, sem trocar o banco, a origem instalada do App, os contratos de API, a PWA em produção, nem alterar Relatto/SyncVet.

## Fonte / evidência
- CI Security #175 (run 40055667789): 3 alertas high: DOMPurify 3.4.1, Vite 6.4.3, Zod 3.25.76; SAST API com 19 warnings (caminhos de arquivos não literais).
- Advisory [DOMPurify GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr): corrigido em 3.4.17.
- Advisory [Vite GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm): linha 6 corrigida em 6.4.4.
- Advisory [Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5): corrigido em 4.6.6 (major), sem correção confirmada na linha 3.

## Escopo
- Em `apps/web/package.json`, elevar somente Vite 6.4.3 → mínimo 6.4.4, sem major.
- Em `package.json` root, adicionar overrides com faixas específicas para DOMPurify 3.4.17 e Vite 6.4.4, evitando alteração de outras linhas principais.
- Regenerar `bun.lock` com Bun 1.4.0 numa execução CI isolada e verificar `bun install --frozen-lockfile`, com diff auditável.
- Testar build, lint, 217+ casos Web, E2E e scan em branch/PR. Registrar SHA e logs. Não afirmar sucesso até prova.

## Fora do escopo / pendências
- **Zod:** atualização 3 → 4 é potencialmente incompatível com os schemas atuais; não instalar versão 4 sem inspeção de imports e testes de regressão. A vulnerabilidade permanecerá visível no audit até tratamento próprio.
- **API SAST:** 19 warnings devem ser investigados em separado, não desativar regras de segurança ou alterar API durante correção de dependências Web.
- A mudança de dependências em workspace compartilhado pode afetar outros módulos; não presumir isolamento absoluto só por não tocar no código de Relatto/SyncVet.
- Não modificar Supabase, RLS, Auth remoto, DNS, domínio, IndexedDB, Service Worker, plano de Vercel, produção ou usuários.
- Não misturar com PR #60 (PWA funcional, CI #264 aprovado), nem mesclar sem gate.

## Critérios de aceite
- [ ] `bun.lock` regenerado por Bun 1.4.0, sem edições artificiais de hash.
- [ ] O `bun audit --audit-level=high` não lista DOMPurify 3.4.1 nem Vite 6.4.3; Zod e SAST API permanecem reportados até remediação.
- [ ] `bun install --frozen-lockfile` PASS.
- [ ] Testes de build/TypeScript, Vitest, Playwright Chromium, Web e CI PASS em HEAD.
- [ ] Sem regressão de armazenamento/offline e autenticação, sem modificação real de tenant/DB.
- [ ] Relatório de risco, reversão por commit/revert e status PR/Notion/Obsidian atualizado.

## Regras Git e QA
Branch de trabalho: `fix/consubov-web-deps-20261024` a partir de `main`, independente do PR #60. O lockfile é compartilhado; PRs Dependabot #57–59 alteram dependências e podem conflitar. Revisar diff antes de qualquer merge e não sobrescrever alterações de outros agentes. Usar GitHub Actions padrão em repositório público (sem runner pago); um workflow temporário e limitado a esta branch gera o lockfile, devendo ser removido após uso. PR permanece draft até QA e riscos residuais triados.

## Relatório final esperado
Branch/SHA, lista de arquivos, vulnerabilidades corrigidas/não corrigidas, diff do lockfile, testes executados com comandos/resultado, impacto em workspaces e risco residual, link da execução, plano de reversão e sincronização de Checklist/Notion/Obsidian.
## Evidência da execução — 24/10/2026

- [x] [PR #61](https://github.com/consubov/consubov/pull/61) draft e isolado de PR #60.
- [x] Bun 1.4.0 na branch [workflow #3](https://github.com/consubov/consubov/actions/runs/40086393606): geração de lockfile e `bun install --frozen-lockfile` PASS.
- [x] [Security #176](https://github.com/consubov/consubov/actions/runs/40086393656): DOMPurify 3.4.17 e Vite 6.4.4 não aparecem mais no `bun audit`. Alertas high caíram de 3 para **1**.
- [ ] **Security continua reprovado**: `zod@3.25.76` permanece high e 19 warnings SAST API; necessidade de triagem separada.
- [ ] **CI final ainda não concluído** nesta revisão; atualizar por SHA e resultado real, sem usar evidência de outro commit.
- [ ] Workflow temporário de atualização do lockfile precisa ser retirado do PR antes de merge.
- [ ] Revisar impacto no lockfile compartilhado e possíveis conflitos com Dependabot #57-59.
