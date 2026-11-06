# F23 — arquitetura executável do laboratório

Este documento descreve `next-platform/**`. O legado, a instalação dos funcionários e serviços remotos não são alterados. O laboratório tem API Bun com estado em memória de processo; não representa PostgreSQL persistente nem autorização de produção.

## Aplicativo Fazendas

O shell autentica, seleciona o vínculo autorizado e provisiona exclusivamente o perfil da conta. Cada um dos quatro perfis possui artefato IIFE, manifesto e release imutável próprios. O build do shell não importa telas ou regras privadas dos perfis. Dois usuários do mesmo dispositivo podem provisionar perfis diferentes, com bancos e autorização segregados.

O módulo executa em iframe com origem opaca. O shell verifica manifesto e todos os bytes do cache fixado antes de construir o documento com CSP. `MessageChannel` vincula módulo, nonce, contexto e capabilities. O módulo não recebe token da API nem poderes de ACK/pull. Os contratos públicos v1 estão em `packages/contracts/public/v1/`; uma fixture JS/Rust-Wasm independente percorre os oito RPCs usando o mesmo `ModuleFrame`.

O IndexedDB é privado por produto, módulo, usuário, tenant, fazenda e retiro. Snapshot, comando imutável e anexos são gravados na mesma transação e só confirmados em `oncomplete`. CAS de revisão do estado completo recusa atualização obsoleta; falha de quota não confirma salvamento. Comandos/anexos são preservados ao sair, trocar versão ou receber conflito.

O primeiro provisionamento exige API local, pacote completo e seed autorizado. Depois, a credencial local cifrada permite login da mesma conta naquele dispositivo até sua validade laboratorial de 24 horas. PBKDF2, AES-GCM e chave de dispositivo não exportável protegem a credencial; não tornam XSS, acesso ao perfil do navegador ou dados operacionais em repouso invioláveis. A política temporal não foi aprovada para produção. Outra conta nunca provisionada não ganha acesso durante ausência de comunicação.

O shell envia comandos por API com liderança entre abas, singleflight, backoff/jitter e retries imutáveis. Anexos são enviados antes do comando. ACK precisa identificar o comando/agregado/versão pendentes. Pull autorizado, cursor e anexos são persistidos juntos e aguardam a ausência de comandos locais pendentes. 401/403 suspendem a sessão sem apagar trabalho. A UI apresenta resultado funcional de salvamento/erro, sem indicar rede, fila ou envio. O servidor valida grants e DTOs novamente; nenhum cliente acessa banco central diretamente.

## Release e recuperação

Seletores `modules/<perfil>/current/module.json` apontam para `releases/<geração>/module.json`. A geração identifica bytes imutáveis; manifesto declara protocolo/API/schema local/capabilities. Cache completo precede a execução; sinal de saúde após hidratação promove o candidato. Falhas de integridade, compatibilidade, download ou runtime preservam/restauram versão saudável. Runtime/handshake reincidentes ficam em quarentena limitada, sem impedir reparo de bytes corrompidos por novo download.

Formulários, câmera, leitura/pesagem, transações e todo o ciclo HTTP/persistência retêm locks. O host exige uma prova atual do módulo e uma lease limitada antes de trocar o documento. O módulo antigo é removido enquanto seus inputs estão congelados. Clientes sem bridge compatível bloqueiam ativação enquanto abertos.

Um documento v1 antigo já instalado e verificado como saudável pode confirmar sua execução com o handshake `ready` original. Essa adaptação não promove candidatos nem presume quiescência. Um candidato novo precisa informar saúde; ausência de hello/ready continua sujeita a timeout. O ensaio específico mantém o módulo antigo além de 15 segundos, faz RPC e reabre sem comunicação para evitar regressão de disponibilidade N/N-1.

O shell tem releases completos e ponteiro ativo independentes do ciclo automático do navegador. Instalar ou ativar automaticamente um worker após fechar todas as janelas não constitui consentimento para mudar o shell. A ação explícita verifica identidade, integridade, compatibilidade, prazo e janela única; ACK tardio não recarrega trabalho novo. Web Locks nativos serializam mutações de ponteiros entre gerações de worker, por perfil no caso de módulos. A chamada `skipWaiting` começa na fronteira validada, e sua promise é aguardada após liberar o lock; aceite final verifica a geração realmente promovida.

Sem Web Locks de worker, nova instalação/atualização falha fechada. Caches completos, inclusive versões ainda usadas por janelas antigas, são conservados. Não há coleta destrutiva automática; crescimento e quota exigem política futura segura. Persistência solicitada ao navegador não impede toda evicção ou perda de dados do perfil do navegador.

Para recuperação, use o rollback versionado do gerenciador: nunca apague IndexedDB, anexos, filas ou shell instalado. O rollback de runtime fica pendente enquanto há trabalho crítico. Se nenhum pacote íntegro existir, falhe fechado com erro funcional. Uma migração incompatível exige novo contrato/adapter e testes; não force atualização coletiva nem downgrade do banco.

## ADM separado

`apps/admin-global` tem origem, manifest, ícones, build, worker e caches próprios. O build padrão usa apenas `src/secure/**` e React: autenticação pela API, seleção explícita de vínculo administrativo e consulta de auditoria autorizada. Não atribui papéis super/support/financial por inferência, não gera JWT e não simula MFA. Token, credencial transitória e dados consultados ficam em memória; reabertura exige autenticação pela API. 401/403, falha de consulta ou expiração retiram o acesso e os dados visíveis.

`--mode lab` é uma bancada explícita, com origem/output/identidade distintos, que preserva a aplicação antiga de simulação. Seus bytes não integram o candidato padrão. Não há contrato novo de CRUD privilegiado, licença real ou administração offline. O worker ADM guarda somente estáticos verificados, nunca login, token ou resposta de auditoria. Assets ativos conhecidos ausentes/corrompidos falham com 503; recuperação automática da corrupção de um pacote ADM já ativo ainda não foi implementada. Falha no download de um candidato mantém o pacote anterior completo.

## Verificação e limites

Os testes de navegador usam Chromium/WebKit reais com fixtures sintéticas, em origens próprias. Viewport mobile/tablet não equivale a instalação física. Relatórios locais registram HEAD, dirty, arquivos inclusive untracked, hashes e escopo estável; o SHA base sozinho não identifica alterações não commitadas. `qa:q8` mede unitários/estática; sua saída não aprova browser, aparelho, QA independente ou produção. A matriz final tem orquestrador próprio e o recibo final deve identificar seus comandos e exclusões.

A auditoria automatizada usa Axe instalado localmente no shell e no documento opaco, conservando a CSP. Achados reais deram origem a correções de contraste de texto das abas, associação/identidade de campos repetidos, hierarquia de títulos, landmarks, zoom e foco de tabelas roláveis. A nova execução deve validar essas correções; teclado básico e medições de tempo/bytes não equivalem a certificação de leitor de tela, hardware ou SLA.

Persistência central, renovação de autorização, política de segurança de produção, resolução de conflito por substituição/arquivamento de comandos e funcionalidades não existentes permanecem contratos futuros. O inventário de paridade distingue registro local, consulta central e simulação. Relatório financeiro é solicitação registrada; não há geração central de PDF implementada. QR e integração de balança/câmera física requerem ensaios específicos. Entrega ao responsável por QA independente não constitui homologação.
