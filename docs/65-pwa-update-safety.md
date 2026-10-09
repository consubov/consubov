# PWA — atualização segura e operações em andamento

**Atualização:** 2026-10-09, auditoria consolidada. **QA integral PWA:** pendente.

O botão manual de atualização não apaga CacheStorage nem desregistra o worker instalado. O banner usa a mesma rotina de ativação segura mesmo quando apenas `version.json` diverge. Encontrar uma versão publicada não prova que seus arquivos já foram baixados e validados.

A auditoria adicionou a proteção no momento do efeito: uma operação crítica pode começar durante `getRegistration()` ou `update()`. Por isso, antes de `SKIP_WAITING` e do refresh manual, o código consulta novamente `hasCriticalOperations()`. A ação aguarda o encerramento da operação. Se o consentimento de atualização expirar antes disso, o callback tardio não ativa o worker.

Foram executados **13/13 testes Node do registro de SW**, incluindo três regressões novas inicialmente falhando: operação iniciada durante verificação assíncrona, operação iniciada durante busca do registro e consentimento expirado antes do término do trabalho. Esses testes usam mocks controlados; não são homologação de browser.

As fixtures Playwright existentes abrangem nomes das seis bases legadas, comandos pendentes, fotos Blob/ArrayBuffer, PDF e backup local, mas são sintéticas. Ainda é necessário rodar Chromium/WebKit e testar o build legado realmente utilizado, na mesma origem, com dados fictícios representativos. Esta auditoria não executou esse teste porque Chromium local foi bloqueado por política.

Critérios de release permanecem: mesma instalação/identidade PWA, nenhuma perda ou duplicação offline, download e ativação seguros, quota, reabertura, recuperação/rollback e piloto físico Android/iPhone antes de expor a nova versão a clientes. Não apagar bases, caches ou pendências para fazer o teste passar.
