# @consubov/module-release

O runtime de release do laboratório usa gerações imutáveis verificadas e ponteiros duráveis no worker do shell. `generation.ts` descreve o handle fixado consumido pelo carregador; as classes históricas `ReleaseManager`/`RollbackManager` em memória continuam disponíveis para compatibilidade, mas não representam os ponteiros duráveis do aplicativo.

## Módulos

- O seletor `/modules/<id>/current/module.json` aponta para o manifesto imutável `/modules/<id>/releases/<sha256>/module.json`. A geração é SHA-256 dos bytes desse manifesto.
- O worker verifica manifesto, compatibilidade, lista completa, tamanho, SHA-256 e SRI dos arquivos antes de publicar um candidato. Cada download usa cache separado; a geração instalada não é sobrescrita.
- `provisionModuleArtifact` devolve `PinnedModuleGeneration`: identidade, geração, digest, cacheName exato, resourceBase, manifesto e estado de saúde. O documento isolado lê somente esse cache e verifica novamente todos os bytes antes de executar.
- `MARK_MODULE_HEALTHY` promove apenas o candidato correspondente à geração e cache esperados. O shell deve enviar a confirmação somente após handshake/saúde e revalidar a sessão e o contexto atuais antes desse efeito.
- `ROLLBACK_MODULE` e a recuperação de cache corrompido selecionam somente a geração saudável anterior explícita. Não há busca de N-1 por ordem lexical nem fallback de rede sem verificação.
- Falhas `runtime`/`handshake` entram em quarentena durável por digest, limitada às 16 gerações rejeitadas mais recentes. `integrity`/`compatibility` não bloqueiam uma nova tentativa verificada; corrupção de cache pode ser reparada por download íntegro.
- O adaptador legado aceita os manifests e ponteiros v1 conhecidos, verifica seus bytes e preserva seus caches. Declarações explícitas incompatíveis continuam rejeitadas.

## Shell

O publisher injeta `SHELL_RELEASE` somente no artefato gerado. O install valida HTML, manifesto e todos os arquivos em um cache de geração separado. Instalar o candidato não modifica os caches da geração atual ou anterior.

A ativação de uma geração nova exige consentimento explícito, identidade e integridade revalidadas, compatibilidade com os módulos instalados e uma única janela do aplicativo aberta. Outra janela da mesma origem bloqueia com `OTHER_CLIENTS_OPEN`. O coordenador do shell também deve manter a barreira de operações críticas do módulo durante a verificação e o efeito final.

`ACTIVATE_WITH_CONSENT` exige `clientDeadline` futuro, limitado a 30 segundos. O worker revalida esse prazo após as esperas e antes de promover o ponteiro; prazo expirado bloqueia com `ACTIVATION_LEASE_EXPIRED`. O shell deve revalidar sua barreira novamente antes de recarregar a interface.

O navegador pode ativar um worker automaticamente quando todos os clientes anteriores fecham. Por isso a geração de assets ativa é um ponteiro durável separado: esse ciclo automático conserva o shell anterior sem consentimento. O coordenador consulta `VERIFY_WAITING_WORKER` também no worker ativo; `pending` distingue um candidato real da versão já instalada.

## Retenção e limites

Nenhum release acessa ou apaga IndexedDB, dados operacionais, comandos, fotos ou credenciais. Os ponteiros mantêm N/N-1 explícitos. Todos os caches completos verificados são conservados enquanto não existir coleta segura com contabilização das gerações fixadas por outras janelas; apenas staging incompleto não publicado é apagado.

Essa política pode aumentar o uso de armazenamento após várias versões. Quota/eviction continuam limites reais do navegador. Falha de staging preserva a geração saudável disponível; não se promete retenção ilimitada. Cada módulo aceita até 16 arquivos e 32 MiB; o manifesto do shell aceita até 200 arquivos e 32 MiB no total. Recursos de rede têm deadline de 30 segundos.

Os testes de worker exercitam o código real com portas herméticas; `test/run-worker-generations-in-browsers.ts` valida CacheStorage, worker, iframe opaco e IndexedDbLocalData reais em Chromium/WebKit, usando fixtures e servidor efêmero próprios. Esses testes não substituem QA independente do aplicativo integrado nem homologação de produção.
