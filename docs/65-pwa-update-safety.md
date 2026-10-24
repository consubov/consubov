# PWA — atualização segura e operações em andamento

**Atualização:** 2026-10-09, auditoria consolidada. **QA integral PWA:** pendente.

O botão manual de atualização não apaga CacheStorage nem desregistra o worker instalado. O banner usa a mesma rotina de ativação segura mesmo quando apenas `version.json` diverge. Encontrar uma versão publicada não prova que seus arquivos já foram baixados e validados.

A auditoria adicionou a proteção no momento do efeito: uma operação crítica pode começar durante `getRegistration()` ou `update()`. Por isso, antes de `SKIP_WAITING` e do refresh manual, o código consulta novamente `hasCriticalOperations()`. A ação aguarda o encerramento da operação. Se o consentimento de atualização expirar antes disso, o callback tardio não ativa o worker.

Foram executados **13/13 testes Node do registro de SW**, incluindo três regressões novas inicialmente falhando: operação iniciada durante verificação assíncrona, operação iniciada durante busca do registro e consentimento expirado antes do término do trabalho. Esses testes usam mocks controlados; não são homologação de browser.

As fixtures Playwright existentes abrangem nomes das seis bases legadas, comandos pendentes, fotos Blob/ArrayBuffer, PDF e backup local, mas são sintéticas. Ainda é necessário rodar Chromium/WebKit e testar o build legado realmente utilizado, na mesma origem, com dados fictícios representativos. Esta auditoria não executou esse teste porque Chromium local foi bloqueado por política.

Critérios de release permanecem: mesma instalação/identidade PWA, nenhuma perda ou duplicação offline, download e ativação seguros, quota, reabertura, recuperação/rollback e piloto físico Android/iPhone antes de expor a nova versão a clientes. Não apagar bases, caches ou pendências para fazer o teste passar.


## 24/10/2026 — preparo seguro do release in-place (PR #60, sem deploy)

**Origem inicial pretendida:** `https://consubov.com.br`, idêntica à instalação antiga, mantendo `manifest.id/start_url/scope = "/"` e o Service Worker de escopo raiz. Não publicar o build do site `dist-site` nessa origem enquanto houver PWA legada instalada.

- `bun run --cwd apps/web build:legacy-upgrade` gera o **App completo** em `apps/web/dist` com `VITE_SURFACE_MODE=app` forçado. Não altera configuração do domínio nem faz deploy.
- `bun run --cwd apps/web check:legacy-upgrade-build` rejeita artefatos sem manifesto/SW/version.json, identidade PWA alterada, ou pacote sem marcador de `legacy-inplace`. Não equivale a homologação física.
- O `UpdateBanner` passou a ser oferecido também nas rotas internas da instalação **Consubov** (não nas superfícies Relatto/SyncVet, não em aba comum). O Service Worker já adia a ativação em operações críticas e exige ativação comprovada antes do reload.
- A mudança posterior para `app.consubov.com.br` é uma **segunda fase de transição entre origens**: não sincroniza automaticamente IndexedDB, CacheStorage, sessões nem transfere o ícone. A origem antiga deverá continuar servindo compatibilidade e coleta/reconciliação até ACKs verificáveis e dispositivos homologados. **Nunca converter `consubov.com.br` em site-only ou redirecioná-lo automaticamente antes disso.**
- O novo `releaseChannel` em `version.json` é metadado de artefato/QA, **não** autorização para atualização de dados/usuários.
- A versão semântica continuará em `1.155.0` até aprovação dos gates de v2; nenhum código/credencial/login offline foi alterado nesta frente.

**PENDENTE / NO-GO:** provar em SHA integrado update real legado→candidato na mesma origem, preservar as seis IndexedDB/Blobs/filas, testar Android/iPhone físicos e rollback; reconciliar PRs #60–#63 e Security Scan. Não criar operação remota nem afirmar que o app antigo já foi substituído.
