# Dependency & Code Security Scanning Policy

Este arquivo é a fonte de verdade da política de segurança automatizada do pipeline.
Duas workflows rodam em `pull_request` para `main`, em `push` para `main` e por
`workflow_dispatch`:

- `.github/workflows/ci.yml` — build, typecheck (`bun run check`) e smoke HTTP da API.
- `.github/workflows/security-code.yml` — TruffleHog, ESLint security e
  dependency vulnerability scan.

## Política de severidade (dependency audit)

- Vulnerabilidades com severidade **high** ou **critical** quebram o gate
  (o job `dependency-vulnerability-scan` falha e o merge fica bloqueado).
- O scan usa `bun audit --audit-level=high` (verificado na versão Bun 1.3.12;
  `bun audit` existe e aceita `--audit-level`, `--json` e `--ignore=<CVE>`).
- Dependabot (`ecosystem: bun` e `github-actions`) abre PRs semanais/mensais para
  manter as versões atualizadas e o scan verde.
- CVEs aceitos temporariamente devem ser documentados inline no workflow via
  `--ignore=<CVE-id>` com justificativa, e revisados a cada ciclo de dependabot.

## Política de severidade (código)

- TruffleHog roda com `--only-verified --fail`: qualquer segredo verificado
  commitado quebra o gate.
- API: ESLint executa a configuração completa do workspace com `--max-warnings=0`.
- Web: enquanto `apps/web/**` estiver congelado, o SAST executa somente as regras
  `eslint-plugin-security` aprovadas via CLI e ignora o lint geral legado. Isso
  não usa `continue-on-error` e não mascara finding de segurança.
- O débito de lint geral do Web permanece registrado separadamente e não deve ser
  declarado resolvido até haver autorização específica para tocar o frontend.

### Edge Functions
- A suíte de `supabase/functions` deve rodar no CI com `bunx vitest@3.2.4 run`, versão compatível com o Vite atual do monorepo.
- Nenhum teste de Edge pode acessar Supabase remoto ou executar operação destrutiva real.
