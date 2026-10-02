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
- ESLint roda com `--max-warnings=0`: warnings de segurança também quebram o gate.
