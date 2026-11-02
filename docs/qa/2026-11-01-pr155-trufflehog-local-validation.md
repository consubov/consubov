# PR #155 — Atualização consistente do TruffleHog (2026-11-01)

## Escopo

A PR dependabot original muda o SHA da Action TruffleHog de `3.97.9` para `3.99.7` mas deixa o parâmetro `with.version` em `3.97.9`. Esta reconciliação atualiza o SHA fixado e o parâmetro de versão **juntos** em `.github/workflows/security-code.yml` (somente a etapa TruffleHog); não altera permissões, checkout com SHA, argumentos `--results=verified` ou outros jobs. A Action permanece **não executada** porque o projeto usa testes locais na VPS; o merge não deve disparar GitHub Actions.

## Fora do escopo e riscos

Nenhuma alteração no código do aplicativo, dependências Bun, banco, credenciais, infraestrutura, Vercel ou versão de publicação. Uma verificação local de YAML, versão e gates de segurança não comprova execução da Action no serviço GitHub; essa limitação deve constar no resultado. Preservar o pin integral (40 hex), sem migrar para tags soltas.

## Aceite e testes

1. Validar sintaxe YAML e vínculo entre SHA pinado, comentário e `with.version`.
2. Confirmar que apenas o passo do TruffleHog foi alterado e nenhum `uses: actions/checkout` perdeu o SHA pinado.
3. Rodar CI **100% local** na VPS em clone isolado: install frozen, API/Web, regressões, PWA, offline, contratos, segurança local, F23, bundle, auditoria HIGH, lint e Chromium E2E com dados fictícios.
4. Conferir blobs Git do candidato antes e depois do merge, árvore limpa, sem GitHub Actions, deploy, segredos ou acesso ao Supabase remoto.

## Registro

Relatar PASS/FAIL reais no Checklist Mestre e no cérebro Obsidian quando o conector voltar. Não transformar gate não executado em PASS.
