# PR #133 — reconciliação técnica com `main` (30/10/2026)

## Escopo verificado
- Base `main`: `f80d0ae24e4578cae532cb4de3dd7401542160f7`; PR HEAD antes da reconciliação: `ea2d1c23316cbef243c552f6ae19b524e8169ea8`.
- PR abriu com 16 arquivos, mas várias correções já estavam na `main` (SW Vite hashed-assets, teste SW, GMD e atualização de dependências). Preservadas as versões aprovadas de `apps/web/package.json`, `package.json` e `bun.lock`; não reutilizar o lock antigo.
- Retido: testes E2E coerentes com a UI atual, teste de consentimento/stale metadata da PWA, tipagem validada do painel e da RPC GMD.
- Para corrigir dois erros TS2352 herdados da `main`, reutilizados os 2 hooks e validador/testes `requireConsumoRows` da PR #131 (identidade por fazenda + retiro autorizados, nulos fail-closed). Coordenação obrigatória: #131 continua sendo trabalho existente de outro owner; registrar deduplicação antes de mesclar.
- `useGerenteData.ts` e `GerenteDashboard.tsx` receberam as correções tipadas já testadas em `#134`, porém sem publicar release, alterar serviços remotos nem promover o ramo #134. Preservado `APP_VERSION=2.0.0`.
- Não transplantado `.github/workflows/hotfix-gmd-qa.yml` por apontar para um ramo de release diferente da PR #133; o gate da integração é `.github/workflows/ci.yml` da `main`.
- Prioridade dos conflitos: conservar os hotfixes da `main`, nenhum `force-push`, nenhuma remoção de IndexedDB/sync ou alteração de banco, credenciais ou deploy.

## Gates objetivos
- [ ] PR GitHub mergeable sem conflitos e sem checks vermelhos no HEAD exato.
- [ ] `bun install --frozen-lockfile`, `bun run check`, lint, coverage, bundle budget, scans e E2E do workflow `CI`: validar no SHA reconciliado.
- [ ] QA real de tenant/RBAC e PWA instalada/offline quando afetado: não presumir sucesso de CI sintético.
- [ ] Medir budget com base consistente. **Não** elevar, ignorar ou desabilitar o gate para forçar green.
- [ ] Revisão do dono de PR #131 e F12/#76 para conflitos de arquivos compartilhados.
- [ ] Somente após gates completos, considerar merge à `main`, com autorização separada do usuário. Sem deploy.

## Rollback
- O commit de resolução conserva os dois pais: HEAD original de #133 e `main` verificada. Revert localizado é preferível; nunca usar `reset --hard` ou `force push`.
