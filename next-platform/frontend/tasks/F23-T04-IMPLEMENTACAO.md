# T04 — implementação local e limites

Estado: IMPLEMENTADO E TESTADO no laboratório; sem homologação independente. Baseline `25a4d8ad2ad4fae7c3a4f77e4912394801c81154`, árvore compartilhada dirty. O plano original abaixo foi superado pelo estado verificado neste registro.

## Estado implementado

- API verifica grants, contexto completo, capability e DTO de domínio. Ledger mantém projeções coerentes com os quatro perfis, OCC e resposta `CommandApiResponse` com ACK `COMMITTED`. Retry idêntico recebe o mesmo ACK; identidade/conteúdo alterados são recusados.
- Upload/download de anexos autenticados verificam escopo, hash, MIME e tamanho. O seed de outro dispositivo usa a projeção atual e seus anexos.
- Pull autorizado usa cursor opaco por partição. Projeção/anexos/cursor são persistidos atomicamente; comandos locais pendentes adiam pull. CAS preserva alterações concorrentes.
- `SilentSyncRunner` e transporte HTTP ficam no shell: singleflight, liderança entre abas, retries imutáveis, backoff/jitter, timeouts, cancelamento e verificação de sessão após awaits. 401/403 suspendem autorização e preservam dados/comandos.
- Problemas de operação são duráveis e expostos por DTO limitado, com feedback de negócio. A UI não mostra conectividade, fila ou andamento de envio.
- Fotos vêm de arquivo/câmera real, são comprimidas pelo navegador e persistidas com bytes/hash verificados; a UI não produz JPEG vazio como captura.

## Evidência executada

- API: 121 testes/2256 assertions na rodada T04; negativos de autorização/idempotência e projeção de domínio incluídos.
- Chromium/WebKit: `.qa/runs/t04-2026-11-05T23-33-14.353Z-22100.json`, 2/2. Registro de trato/foto offline; ACK real perdido uma vez; retry idêntico sem duplicação; segundo dispositivo lê projeção/foto atuais; reabertura offline preserva bytes. O relatório distingue falha injetada na rota Chromium da fronteira fetch WebKit.
- Regressão fria dos quatro perfis após T04: `.qa/runs/t03-2026-11-05T23-33-04.347Z-10416.json`, 8/8.
- Integração T05 acrescenta locks durante todo o ciclo HTTP/persistência, auth e IDB real. Testes focados de auth/runner/adapter: 30/30, 123 assertions; não substituem a matriz final congelada.

## Limites explícitos

O servidor local usa memória de processo para grants, ledger, cursores, idempotência e anexos. Reinício perde esse estado; persistência central é contrato futuro. Não houve conexão com banco remoto, deploy ou migração.

Conflitos preservam comandos e mostram feedback. Resolução por substituição/arquivamento transacional ainda precisa de contrato de domínio; botões antigos inseguros foram removidos. Renovação de token exige nova autenticação; não há revogação instantânea durante ausência de comunicação.

As rodadas pertencem às fontes dirty de cada execução e não aprovam automaticamente a revisão final T07.

## Plano histórico de referência (superado)

## API local

`api/src/handlers/commands.ts`, `handlers/sync.ts`, `ledger/in-memory-ledger.ts` e `router.ts` são os pontos existentes. Reutilizar validadores de domínio/envelope e RBAC. Verificar contra grants ativos do servidor: usuário, tenant, fazenda, retiro, produto, dispositivo, perfil e capability. Não aceitar escopo indicado pelo módulo como autoridade.

O ACK atual é plano (`status: acked`, `new_version`); a LocalDataAPI espera `CommandApiResponse` com `COMMITTED`/`aggregate_version`. Implementar adaptação explícita e testes de compatibilidade. `/api/v1/sync` atual é stub sem autorização, cursor numérico e deltas vazios; substituir por pull autorizado com cursor opaco, sem anunciar o stub como funcional.

Ledger precisa vincular IDs/idempotência ao escopo e à representação imutável do comando. Retry idêntico retorna o ACK original; mesma chave com conteúdo diferente rejeita sem mutação. Preservar fronteira transacional entre domínio, versão, registro do comando e ACK. Dados laboratoriais de seed e versões base devem ser coerentes com o ledger.

Anexos remotos são PROPOSTOS, ainda sem endpoint. Definir/upload/download autenticados com hash SHA-256, MIME, tamanho, identidade e ACL; ACK só após dependências persistidas. Nenhum cliente SQL/Supabase/PostgREST direto nem banco remoto neste escopo.

## Shell e armazenamento

Adicionar adapter HTTP de sessão e scheduler no shell, fora dos perfis. Módulos continuam sem token ou ACK/pull destrutivo via RPC. Vincular execuções à geração de sessão/contexto e checar novamente antes de cada efeito após await; logout/context switch cancela trabalho e nunca sincroniza outra conta.

Leader por partição, concorrência limitada, backoff/jitter, triggers de abertura/foreground/recuperação/período. 401/403 suspendem execução e preservam comandos. Tentativas não alteram o envelope imutável. Nenhuma UI de conectividade, fila ou sucesso de sync.

Antes de conectar o scheduler, corrigir `applyCommandResponse`: ACK precisa corresponder ao comando pendente e agregado/versão esperados antes de retirar a outbox. `commitPull` ainda sobrescreve snapshots; ele não pode ignorar `moduleStateRevision`, projeções otimistas ou comandos pendentes. Os stores hidratam snapshots de estado completo, portanto deltas de entidade exigem projeção explícita compatível com as regras existentes. Não inventar reducers de domínio ausentes.

## Provas necessárias

- Resposta perdida/retry com mesma chave não duplica; chave alterada e IDs cruzados não concedem ACK.
- Negativos de usuário/tenant/fazenda/retiro/dispositivo/perfil/capability falham sem efeitos.
- Cursor e projeções commitam juntos; abort/quota/contexto encerrado mantêm dados e cursor anteriores.
- Pull concorrente com gravação local preserva a alteração confirmada ou registra conflito durável.
- Anexos incorretos/incompletos não recebem ACK; retries mantêm o mesmo vínculo.
- Dois navegadores/abas e troca de conta não sincronizam dados cruzados; UI segue sem estado de sync.

Token atual tem `access_token`, expiração finita e `refresh_token` vazio; renovação ainda exige nova autenticação. Não supor refresh funcional ou revogação instantânea offline.
