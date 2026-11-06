# F23 T06 — controles locais reais do ADM

Resultado: **PASS_LOCAL_CONTROLS_ONLY**, sem aceite de fase ou produção. Execução final UTC `2026-11-06T00:35:04.848Z` (05/11 local), checkout `next-platform`, HEAD inicial/final `25a4d8ad2ad4fae7c3a4f77e4912394801c81154`, árvore dirty. `sourceUnchanged: true`: manifestos SHA-256 inicial/final dos oito diretórios de produção e dos três arquivos do harness foram iguais. O commit sozinho não identifica a revisão dirty testada; consultar os inventários completos e metadados Git no resultado.

Comando executado: `bun run qa/scripts/t06-admin-pwa-e2e.ts`.

Evidência local: `.qa/runs/t06-admin-2026-11-06T00-35-04.848Z-19864/` contém `result.json`, `output.log`, `artifact-inventory.json`, `chromium-adm-safe-shell.png` e `webkit-adm-safe-shell.png`. Artefatos e perfis exclusivos desta execução: `.qa/tmp/adm-19864-0098a/`. Não houve alteração do servidor 5187, de dist ativo, deploy, serviço remoto ou Git mutation. Os aliases Windows dos perfis persistentes foram liberados após fechar os browsers.

## Evidência executada

| Controle | Resultado e alcance |
| --- | --- |
| Serviço administrativo | 9 testes, 69 assertions, zero falhas, usando `createRouter`, `InMemoryLedger` e `LabGrantRegistry` reais do simulador local. Um comando real de Capataz foi COMMITTED antes dos testes de limpeza de auditoria. Não foram fabricados ACKs. |
| Negativas do serviço | Perfil não administrativo, vínculo adulterado, grant revogado, token assinado sem grant, HTTP 401/403 após sessão estabelecida, API indisponível limpando auditoria previamente não vazia, resposta concluída após logout, expiração e bloqueio de novas requisições durante freeze. |
| TypeScript | `bun run typecheck` passou, stdout/stderr preservados. |
| Build candidato | N, N+1 e N+2 independentes; 29 módulos no grafo real cada; zero marcadores exatos de credenciais, segredo, MFA fictício ou papéis privilegiados; zero grafo legado proibido. Leitura de todos os arquivos emitidos, incluindo snapshots, JSON e eventuais sourcemaps; SHA-256/bytes de cada recurso do release conferidos. |
| Controle positivo da exclusão | Build lab explícito em outro diretório: 76 módulos no grafo final e 16 ocorrências dos marcadores proibidos no candidato. Esse build é simulação e não artefato publicável. |
| Manifest e ícones | Manifest standalone/scope e PNGs 192/512 verificados por bytes e dimensões. Chromium CDP retornou manifest sem erros e `installabilityErrors: []`. |
| Chromium e WebKit reais | Perfis persistentes novos; ADM e Fazendas em origens loopback distintas no mesmo contexto de cada engine. Ambos passaram instalação/controle do worker ADM, sessão persistida forjada ignorada, perfil não administrativo bloqueado, login API + seleção explícita de vínculo + auditoria autorizada, perda de acesso por 403 e reload offline sem privilégios. |
| Atualização | Ambos passaram N → N+1 pela ação visível "Instalar atualização". Fechar todos os clientes ADM e deixar o browser ativar o worker não promoveu o ponteiro durável sem consentimento. Consentimento adulterado/expirado e segunda janela ADM bloquearam promoção. Pacote N permaneceu byte a byte no cache após N+1. N+2 com recurso 404 e depois bytes corrompidos foi rejeitado, mantendo N+1 funcional offline. |
| Isolamento | Inventários reais de CacheStorage (bytes/hashes), IndexedDB (registros), localStorage e registrations de Fazendas iguais antes/depois; ADM não buscou recursos de outra origem. Zero resposta `/api/` em caches ADM e zero banco IndexedDB ADM. |
| Invariância dos artefatos Fazendas | Uma preparação isolada anterior à janela ADM produziu shell e quatro módulos reais. Todos os 19 arquivos shell e 16 arquivos dos módulos mantiveram hashes iguais durante builds candidato/lab, instalação e updates ADM. O build ADM não invocou build Fazendas. Fontes das seis árvores também constam nos manifestos inicial/final. |
| Headers do servidor QA | CSP com `frame-ancestors 'none'`, nosniff, referrer-policy e permissions-policy conferidos na resposta HTTP real. API same-origin usa o router local e `no-store`. Sem alegação de HSTS em HTTP loopback ou proteção XSS completa. |

## Controle da baseline Fazendas

O harness abriu a shell real, autenticou Capataz pela API real do simulador, selecionou o contexto e aguardou o formulário e o worker ativo. Depois congelou somente a API do servidor QA dedicado de Fazendas com HTTP 503 e aguardou cinco inventários consecutivos estáveis antes de medir. Isso evita atribuir ao ADM alterações legítimas do cursor de sincronização da própria Fazendas; interceptação Playwright isoladamente não intercepta todos os fetches originados em service worker. Além dos dados reais provisionados, foram gravados sentinelas próprios em CacheStorage/IndexedDB/localStorage. Nada foi gravado em produção.

## Tentativas anteriores preservadas

- `t06-admin-2026-11-06T00-29-02.879Z-20160`: ABORTED durante preparação, após o executor principal renovar o hold das fontes. Não contém aceite.
- `t06-admin-2026-11-06T00-32-58.939Z-21476`: FAIL do harness quando o evaluate de WebKit coincidiu com o reload esperado da atualização. Chromium passou. O harness passou a aguardar a navegação disparada pelo clique e tolerar somente a destruição transitória do execution context no polling.
- `t06-admin-2026-11-06T00-33-56.716Z-18840`: FAIL da baseline não controlada de Fazendas: mudou somente o cursor pull pelo sync próprio. Chromium passou. O controle da API dedicada e a drenagem dos writes acima foram adicionados antes da execução final.

Nenhuma dessas tentativas foi reclassificada retroativamente como aprovação. A execução final reconstruiu os artefatos a partir das fontes congeladas e registrou sua própria revisão.

## Não executado / limites

Instalação física pelo sistema operacional e Add to Home Screen em aparelho: **NAO_EXECUTADO**. Manifest, worker controlado, CDP e reload offline não substituem esse aceite. API, grants e ledger são o simulador local process-local; não há evidência de backend persistente, MFA real, CRUD administrativo, licença assinada ou permissões offline. O candidato oferece somente o acesso real contratado pelo router atual e consulta de auditoria; nenhuma equivalência entre administrador e super_admin foi afirmada. T07 independente e homologação real permanecem pendentes.
