# CONSUBOV — Instruções-Mestre do Projeto

> **Uso:** este arquivo deve ser usado como instrução principal do Projeto CONSUBOV no ChatGPT e como referência operacional para conversas técnicas, de produto, arquitetura, implementação, migração, qualidade e evolução da plataforma.
>
> **Versão:** 1.2  
> **Atualização:** 2026-10-07  
> **Status:** arquitetura revisada para direção **PWA mobile-first**; empacotamento WebNative/wrapper foi adiado para pós-produção. Pontos não confirmados permanecem marcados como `[PENDENTE]`.

---

## 0. Regra de leitura deste documento

Use estes marcadores:

- `[DECIDIDO]` — tratar como regra vigente do projeto.
- `[BASELINE]` — arquitetura/caminho preferencial já planejado; confirmar no repositório antes de alterar código existente.
- `[PENDENTE]` — ainda precisa de validação/decisão; não inventar.
- `[FORA DO ESCOPO]` — não incluir automaticamente no produto atual.
- `[SUPOSIÇÃO]` — hipótese temporária, mínima e reversível, usada apenas para avançar quando faltar informação.

Quando houver conflito:

1. pedido explícito mais recente do usuário;
2. decisão registrada mais recente do projeto;
3. segurança, integridade de dados e isolamento de tenant;
4. requisitos e critérios de aceite aprovados;
5. comportamento comprovado no repositório;
6. este documento;
7. preferências genéricas.

Nunca substituir uma decisão específica do projeto por uma preferência genérica de arquitetura.

---

# 1. Identidade do projeto

## 1.1 Missão

`[DECIDIDO]`

Reconstruir e evoluir o **CONSUBOV** como um produto **SaaS próprio, multitenant, auditável, escalável e offline-first**, removendo a dependência estrutural do MVP baseado em Lovable/Supabase e trazendo o núcleo tecnológico para uma arquitetura controlada pela Consubov.

O produto é voltado à gestão pecuária e deve preservar os domínios essenciais já identificados:

- estrutura de fazendas;
- nutrição e salga;
- estoque e transferências;
- visitas técnicas;
- fábrica de ração;
- pecuarista;
- pesagens;
- indicadores e relatórios;
- QR Code, GPS, fotos e operação de campo.

O projeto não é apenas uma reescrita visual do MVP.

A reconstrução deve resolver, de forma estrutural:

- multitenancy;
- autorização;
- auditoria;
- operação sem internet;
- sincronização;
- idempotência;
- conflitos;
- migração;
- rastreabilidade;
- observabilidade;
- continuidade operacional;
- preparação para crescimento comercial.

---

# 2. Objetivo central do produto

## 2.1 Resultado esperado

`[DECIDIDO]`

A plataforma deverá funcionar como um SaaS de gestão pecuária com quatro superfícies principais:

| Canal | Perfis principais | Finalidade |
|---|---|---|
| Backoffice SaaS | Administrador da plataforma | tenants, planos/status, usuários, cadastros globais, suporte, auditoria e visão consolidada |
| Portal web | Consultor, gerente, escritório, pecuarista | configuração, cadastros autorizados, análise, relatórios e operações conectadas |
| Aplicativo de campo | Capataz, pesador, operador, equipe de campo | operação offline, QR, GPS, fotos, pesagens e sincronização |
| Área pública | Visitantes e leads | landing, campanhas, autenticação e fluxos públicos autorizados |

## 2.2 Princípio de produto

O produto deve continuar funcionando em ambiente rural com conectividade ruim ou inexistente.

**Offline não é fallback. Offline é requisito arquitetural central.**

Qualquer funcionalidade de campo deve ser analisada sob quatro estados:

1. online;
2. offline;
3. reconectando;
4. sincronizando/recuperando falhas.

Se uma solução só funciona corretamente com internet constante, ela não atende o núcleo do projeto.

---

# 3. Princípios inegociáveis

## 3.1 SaaS multitenant

`[DECIDIDO]`

Toda informação operacional deve estar associada ao tenant correto.

O contexto de tenant deve existir em:

- consultas;
- comandos;
- arquivos;
- jobs;
- filas;
- cache;
- eventos;
- notificações;
- canais realtime;
- relatórios;
- auditoria;
- sincronização;
- storage.

Nunca confiar apenas em filtro de frontend.

A autorização e o isolamento devem ser garantidos no backend.

## 3.2 API como autoridade de domínio

`[DECIDIDO]`

As regras críticas devem ficar centralizadas no backend/API.

O cliente mobile pode:

- validar UX;
- trabalhar com projeções locais;
- registrar comandos offline;
- antecipar validações simples.

Mas o backend continua sendo a autoridade para:

- autorização;
- regras de negócio;
- consistência;
- saldo;
- versionamento;
- conflitos;
- reconciliação;
- auditoria.

## 3.3 Offline-first

`[DECIDIDO]`

O aplicativo de campo deve operar com:

- banco local;
- projeções de leitura;
- fila local de comandos;
- anexos pendentes;
- protocolo explícito de sincronização;
- retomada após falha;
- status visível de pendências;
- logs correlacionáveis.

## 3.4 Idempotência

`[DECIDIDO]`

Reenvio de uma operação nunca pode gerar duplicidade em:

- lançamentos;
- transferências;
- pesagens;
- baixas de estoque;
- movimentos;
- comandos de campo.

Toda operação suscetível a retry precisa de identidade estável.

## 3.5 Conflitos por domínio

`[DECIDIDO]`

Não usar genericamente **last-write-wins**.

Especialmente em:

- estoque;
- transferências;
- pesagens;
- operações financeiras futuras;
- reprodução, caso seja incluída futuramente;
- qualquer fluxo que altere saldo ou histórico crítico.

A política deve ser definida por agregado/entidade.

Possibilidades permitidas, quando explicitamente aprovadas:

- bloqueio por versão;
- merge determinístico;
- comando rejeitado e refeito;
- última versão aceita em entidades de baixo risco;
- revisão humana.

## 3.6 Auditabilidade

`[DECIDIDO]`

Ações sensíveis devem permitir responder:

- quem fez;
- em qual tenant;
- em qual fazenda/estrutura;
- quando;
- de qual dispositivo/origem;
- qual era a versão conhecida;
- qual comando foi executado;
- qual foi o resultado;
- se houve retry;
- se houve conflito;
- qual alteração foi persistida.

## 3.7 Segurança por padrão

`[DECIDIDO]`

Segredos ficam somente no servidor.

Arquivos privados devem usar URLs temporárias/assinadas.

Dados locais no dispositivo devem ser os mínimos necessários para operação.

Deve existir estratégia para:

- revogar sessão;
- invalidar acesso;
- limpar dados locais quando aplicável;
- proteger credenciais;
- impedir vazamento horizontal entre tenants.

## 3.8 Extensibilidade controlada

`[DECIDIDO]`

O CONSUBOV deve ser preparado para integrações, canais e recursos que ainda não foram especificados sem antecipar implementações hipotéticas.

A regra é:

- domínio independente de fornecedor;
- integrações externas atrás de ports/adapters;
- UI Web independente de provider de banco/auth/storage;
- recursos nativos atrás de interfaces;
- contratos versionados;
- eventos e webhooks previstos sem exigir broker complexo;
- dados e serviços acessíveis futuramente por API pública controlada;
- evitar lock-in;
- evitar plugin system, microserviços ou abstrações genéricas sem caso real.

Preparar pontos de extensão não significa implementar integrações sem necessidade.

## 3.9 Contrato de API e OpenAPI

`[DECIDIDO]`

A API deve ser tratada como contrato do produto.

Requisitos:

- versionamento sob `/api/v1`;
- OpenAPI/Swagger atualizado junto com endpoints;
- schemas de request/response;
- erros padronizados;
- auth, tenant e scopes documentados;
- idempotência documentada quando aplicável;
- exemplos quando agregarem valor;
- validação automatizada do contrato no CI;
- preparação para geração futura de clientes/SDKs tipados.

A API deve prever três superfícies lógicas, sem exigir aplicações separadas:

```text
/api/v1/...              produto Web/App
/api/v1/sync/...         sincronização
/api/public/v1/...       integrações/empresas no futuro
```

A API pública não deve ser publicada antes de existir necessidade real, política de acesso e modelo de consumidor definidos.

## 3.10 Sequência de entrega e gates remotos

`[DECIDIDO]`

A ordem vigente do projeto é:

```text
Web → PWA iOS/Android → Offline PWA → infraestrutura remota/staging → produção → empacotamento nativo opcional pós-produção
```

Offline influencia contratos e modelo de dados desde agora; o motor completo será consolidado sobre a PWA antes de qualquer empacotamento nativo.

A nova arquitetura **não deve ser conectada agora ao Supabase/PostgreSQL remoto nem ao Vercel**.

Até o gate próprio:

- não executar migrations remotas;
- não alterar schema remoto;
- não configurar deploy de produção;
- não rotacionar secrets por iniciativa automática;
- não criar dependência nova da Web com Supabase.

O legado pode continuar operando durante a transição quando necessário para preservar comportamento existente.

---

# 4. Arquitetura de referência

> Esta seção representa a decisão arquitetural vigente. Baselines anteriores em Laravel/Filament/Livewire/React Native foram superados pelas decisões explícitas de 2026-10-01.

## 4.1 Backend/API

`[DECIDIDO]`

Stack principal:

- **Bun**;
- **TypeScript**;
- arquitetura de **monólito modular**;
- API como autoridade de domínio;
- OpenAPI/Swagger como contrato HTTP;
- módulos organizados por responsabilidade/domínio;
- ports/adapters nas fronteiras de infraestrutura e integração.

Responsabilidades da API:

- domínio;
- autenticação e autorização;
- tenancy;
- auditoria;
- validação;
- idempotência;
- conflitos;
- relatórios;
- integrações;
- contratos de sync;
- arquivos;
- jobs/eventos quando necessários;
- API pública futura.

Não criar lógica crítica duplicada entre Web, App e backend.

Não dividir em microserviços sem necessidade comprovada.

## 4.2 Banco e persistência

`[DECIDIDO]`

Direção principal: **PostgreSQL** para persistência transacional do backend.

Responsabilidades:

- dados transacionais;
- tenant isolation;
- integridade;
- constraints;
- índices;
- auditoria;
- versionamento quando aplicável;
- consultas operacionais;
- base de relatórios operacionais.

A nova arquitetura deve depender de ports/repositories, não de SDK específico do fornecedor.

`[DECIDIDO]`

Nesta etapa:

- não conectar a nova API ao Supabase/PostgreSQL remoto;
- não executar migration remota;
- não alterar schema remoto;
- usar adapters locais/fakes/fixtures ou ambiente local controlado quando necessário para desenvolvimento/testes.

O Supabase legado pode permanecer em uso durante a transição para preservar o sistema atual.

A função final do Supabase no ambiente remoto deve ser confirmada no gate de infraestrutura/migração.

## 4.3 Backoffice SaaS

`[DECIDIDO]`

O backoffice permanece na aplicação **React/Vite** atual e deve ser evoluído de forma incremental.

Responsabilidades:

- tenants;
- planos/status;
- usuários;
- cadastros globais;
- configurações;
- suporte;
- auditoria;
- operação administrativa da plataforma.

O backoffice global deve permanecer separado dos ambientes dos clientes por autorização e tenancy server-side.

Não introduzir Filament/Livewire como nova direção arquitetural.

## 4.4 Portal web

`[DECIDIDO]`

Stack:

- **React**;
- **Vite**;
- TypeScript;
- UI e fluxos atuais preservados/evoluídos incrementalmente.

Direção:

```text
React/Vite → API Bun/TypeScript → Application/Domain → Persistence/Adapters
```

A Web não deve conhecer detalhes de banco, provider de auth ou storage.

Durante a migração:

- preservar fluxos existentes;
- mover acesso a dados gradualmente para repositories/API;
- evitar big-bang rewrite;
- não criar novos acessos diretos ao Supabase em funcionalidades migradas.

## 4.5 Aplicativo de campo — PWA mobile-first

`[DECIDIDO]`

O caminho mobile vigente é **PWA instalável sobre a Web React/Vite atual**, com foco em iOS e Android, experiência standalone e uso do máximo de capacidades do dispositivo permitido pelas Web APIs.

A meta de UX é que, nos fluxos suportados pela plataforma, o usuário comum não perceba diferença operacional relevante para um app nativo.

A arquitetura Web deve expor interfaces/capabilities para:

- `LocalDatabase`;
- `SecureStorage`/sessão local compatível com Web;
- `LocationProvider`;
- `QrScanner`/barcode scanner;
- `CameraProvider` para foto/vídeo;
- `Microphone/MediaCapture` para áudio e futuras conversas;
- `ConnectivityProvider`;
- `FileCapture/FilePicker`;
- `ShareProvider`/Share Target quando suportado;
- `NotificationProvider`/push quando suportado;
- `DeviceCapabilityProvider` para capability detection;
- `SyncTransport`;
- WebRTC/Media Session quando houver caso de uso aprovado.

`[DECIDIDO]`

Para persistência local da PWA, o baseline é **IndexedDB** atrás de `LocalDatabase`. OPFS/File System Access pode ser usado apenas como otimização quando suportado. **SQLite fica adiado para eventual empacotamento nativo pós-produção.**

A PWA deve ser preparada para usar, quando suportado e autorizado:

- GPS/geolocalização;
- câmera, foto e vídeo;
- microfone e gravação de áudio;
- QR Code e barcode local;
- arquivos e fotos;
- compartilhamento/recebimento de conteúdo;
- notificações push e badges;
- clipboard;
- vibração/haptics quando disponível;
- wake lock;
- orientação/fullscreen;
- conectividade;
- sensores de movimento/orientação quando disponíveis;
- WebRTC para voz/vídeo e futuras conversas;
- Media Session;
- contatos, Bluetooth, NFC e USB somente quando a plataforma suportar e existir caso real aprovado.

`[DECIDIDO]`

Toda capacidade deve usar **capability detection**, permissão contextual e degradação segura. Nenhum fluxo crítico pode depender de uma API sem suporte comprovado nos dispositivos-alvo.

`[DECIDIDO]`

Empacotamento WebNative/Capacitor/wrapper está **adiado**. Só reavaliar depois que a Web/PWA estiver em produção, 100% funcional nos fluxos críticos e com offline/sync estabilizado. O código experimental existente em `apps/mobile/` não define a arquitetura vigente e não deve receber expansão funcional agora.

`[PENDENTE]`

Formalizar a matriz de compatibilidade por versões oficiais de iOS/Safari e Android/Chrome para cada capability antes do gate PWA Mobile Ready.

## 4.6 Realtime

`[DECIDIDO]`

Realtime deve ser tratado como capacidade substituível atrás de adapter.

Uso esperado:

- avisos;
- filas;
- transferências;
- atualizações conectadas;
- notificações.

Realtime nunca deve ser requisito para integridade de uma operação de campo.

A fonte de verdade permanece no backend/sync.

Não escolher provider definitivo antes de necessidade comprovada.

## 4.7 Arquivos

`[DECIDIDO]`

Storage deve ficar atrás de `FileStoragePort` ou abstração equivalente.

Direção preferida: provider compatível com S3 quando houver infraestrutura remota.

Usar para:

- fotos;
- mapas;
- comprovantes;
- PDFs;
- anexos.

Requisitos:

- URLs temporárias/assinadas;
- autorização por tenant;
- limites;
- compressão de imagens;
- upload retomável ou reexecutável;
- associação do arquivo somente após confirmação do upload;
- estratégia de substituição do provider.

Não conectar storage remoto novo antes do gate de infraestrutura.

## 4.8 Integrações, eventos e webhooks

`[DECIDIDO]`

Integrações futuras devem entrar por adapters, sem contaminar o domínio.

Prever:

- integrações inbound;
- integrações outbound;
- providers externos;
- webhooks;
- eventos internos;
- consumidores de API;
- autenticação e scopes por integração;
- rate limit/quota;
- auditoria;
- retry e idempotência;
- estratégia de substituição.

Eventos devem ser versionados quando atravessarem fronteiras relevantes.

Não introduzir broker dedicado, plugin system ou infraestrutura complexa sem caso real.
# 5. Modelo de tenancy

## 5.1 Tenant

`[DECIDIDO]`

O tenant representa a organização/empresa contratante.

Um tenant pode possuir:

- múltiplas fazendas;
- retiros;
- pastos;
- currais;
- fábricas;
- equipes;
- usuários;
- operadores;
- configurações próprias.

Não assumir que `tenant == fazenda`.

## 5.2 Usuários

Usuários podem estar vinculados a um ou mais tenants, conforme regra aprovada.

Cada vínculo precisa possuir:

- papel;
- permissões;
- escopo;
- status.

## 5.3 RBAC

`[DECIDIDO]`

O sistema precisa de matriz RBAC explícita.

Deve cobrir, entre outros:

- usuários;
- fazendas;
- retiros;
- pastos;
- cadastros;
- operações;
- relatórios;
- estoque;
- visitas;
- fábrica;
- pesagens;
- administração.

`[PENDENTE]`

Formalizar a matriz completa e as alçadas de:

- autocadastro de fazenda;
- autocadastro/criação de capataz;
- criação de usuários;
- alterações estruturais;
- aprovação de operações.

Nenhuma conversa futura deve inventar permissões ainda não definidas.

---

# 6. Perfis funcionais

Perfis já identificados:

- administrador da plataforma;
- consultor;
- gerente;
- escritório;
- pecuarista;
- capataz;
- pesador;
- operador;
- equipe de campo;
- visitante;
- lead.

Antes de implementar um fluxo, definir:

- ator;
- tenant;
- escopo;
- permissão;
- comportamento online;
- comportamento offline;
- dados visíveis;
- dados editáveis;
- regra de auditoria.

---

# 7. Estrutura de domínio

## 7.1 Plataforma SaaS

Abrange:

- tenant;
- plano/status;
- onboarding;
- usuários;
- convites;
- autenticação;
- recuperação de senha;
- papéis;
- permissões;
- configurações;
- suporte;
- notificações.

## 7.2 Estrutura pecuária

Abrange:

- fazenda;
- retiro;
- pasto;
- curral;
- ciclo;
- criação em lote;
- mapas;
- polígonos;
- linhas;
- elementos;
- QR Code.

Hierarquia de referência:

`tenant -> fazenda -> retiro -> pasto`

Não assumir que toda entidade pertence diretamente ao tenant quando existe uma hierarquia operacional mais específica.

## 7.3 QR Code e jornada de campo

Requisitos:

- QR único por pasto;
- emissão;
- ativação;
- conferência;
- leitura sequencial;
- registro da ordem das leituras;
- usuário;
- data;
- geolocalização quando autorizada;
- consumo exibido no contexto do pasto;
- relatório dos locais visitados.

QR Code deve resolver identidade do recurso, não autorização.

A autorização continua sendo validada pelo backend/contexto local permitido.

## 7.4 Nutrição e salga

Abrange:

- produtos;
- categorias;
- dietas;
- parâmetros zootécnicos;
- lançamentos de salga;
- solicitações;
- aprovação;
- consumo esperado;
- consumo real;
- classificação alto/adequado/baixo.

`[PENDENTE]`

As fórmulas e limites precisam ser validados com especialistas do cliente e casos de referência.

Nunca inventar fórmula zootécnica.

## 7.5 Estoque

Abrange:

- entradas;
- saídas;
- transferências;
- movimentações;
- baixas;
- estoque insuficiente;
- rastreabilidade;
- recebimentos;
- destinos.

Estoque é domínio crítico.

Obrigatório considerar:

- concorrência;
- transação;
- idempotência;
- versão;
- histórico;
- reconciliação;
- conflito.

Saldo não deve depender apenas de estado calculado no cliente mobile.

## 7.6 Animais e ocupação

Abrange:

- ocupação;
- movimentação de animais;
- mortalidade;
- abate;
- categorias;
- lotes;
- animais.

Toda alteração que afete histórico deve ser rastreável.

## 7.7 Visitas técnicas

Tipos identificados:

- visita de pasto;
- curral/confinamento;
- fábrica.

Abrange:

- escores;
- indicadores;
- fotos;
- tópicos;
- assinaturas;
- Penn State;
- despesas;
- comprovantes;
- revisão;
- finalização;
- PDF;
- logos;
- histórico.

Uma visita finalizada deve preservar histórico.

Alteração posterior precisa seguir regra explícita de revisão/versionamento.

## 7.8 Fábrica de ração

Abrange:

- matérias-primas;
- entradas;
- estoque;
- fórmulas;
- ingredientes;
- rendimento;
- produto acabado;
- batidas de produção;
- baixas automáticas;
- ajustes;
- transferências;
- recebimentos;
- destinos;
- operadores.

Batidas e baixas automáticas exigem transação e idempotência.

## 7.9 Pecuarista e pesagem

Abrange:

- fazendas;
- lotes;
- categorias;
- animais;
- histórico de pesos;
- pesagem individual;
- pesagem de lote;
- pesagem de compra;
- apartação;
- busca por brinco;
- clientes do pesador;
- execução;
- leituras de balança;
- resumo;
- exportação.

Pesagem deve preservar histórico.

`[PENDENTE]`

Qualquer integração com balança precisa ser validada por:

- fabricante;
- modelo;
- protocolo;
- interface;
- formato de dados;
- conectividade;
- limitações do dispositivo.

Não prometer integração genérica com “qualquer balança”.

## 7.10 Inteligência e relatórios

Abrange:

- dashboards;
- indicadores consolidados;
- gráficos de consumo;
- relatórios de salga;
- visitas;
- despesas;
- pastos percorridos;
- inteligência operacional;
- exportações.

Gráficos devem ser derivados de regras aprovadas.

Não mascarar dados divergentes para “fazer o dashboard bater”.

## 7.11 Conteúdo e comunicação

Abrange:

- landing;
- parceiros;
- leads;
- campanhas mapeadas;
- push;
- comunicação realtime conforme perfil.

`[PENDENTE]`

Fluxos de campanha ainda não analisados não devem ser implementados por inferência.

---

# 8. Motor offline e sincronização

## 8.1 Objetivo

O sync é parte do domínio do produto, não uma utilidade auxiliar.

Deve suportar:

- longos períodos sem rede;
- reconexão instável;
- retry;
- duplicidade de envio;
- concorrência;
- anexos;
- erro parcial;
- retomada;
- conflito;
- auditoria.

## 8.2 Carga inicial

Requisitos:

- baixar somente dados autorizados;
- limitar ao necessário para o perfil/operação;
- paginação;
- versão;
- progresso;
- possibilidade de retomar.

Não baixar o banco inteiro do tenant para todo dispositivo.

## 8.3 Leitura offline

O dispositivo deve manter projeções locais suficientes para o trabalho de campo.

Essas projeções não substituem o backend como fonte de verdade.

## 8.4 Escrita offline

Toda escrita offline deve gerar um comando persistido localmente.

Semântica mínima recomendada para cada comando:

```text
command_id
tenant_id
user_id
device_id
command_type
aggregate_type
aggregate_id
payload
base_version
occurred_at_local
created_at_local
idempotency_key
correlation_id
attachment_refs[]
status
attempt_count
last_error
```

O schema exato pode mudar.

As garantias semânticas acima não devem ser removidas sem decisão explícita.

## 8.5 Push

O cliente envia comandos pendentes.

O backend:

1. autentica;
2. resolve tenant;
3. verifica autorização;
4. verifica idempotência;
5. valida versão/regra de conflito;
6. executa regra de negócio;
7. persiste transação;
8. registra auditoria;
9. retorna confirmação estável.

## 8.6 Pull

O cliente recebe alterações autorizadas desde um cursor/checkpoint conhecido.

Evitar sincronização baseada apenas em “data da última atualização” sem semântica de cursor/versão confiável.

## 8.7 Confirmação

Um comando somente sai da fila local quando houver confirmação inequívoca do servidor.

Timeout não significa falha definitiva.

Após timeout, o cliente deve poder reenviar usando a mesma identidade/idempotency key.
## 8.8 Anexos

Fluxo preferencial:

1. criar comando;
2. registrar anexo local;
3. colocar upload em fila;
4. comprimir quando aplicável;
5. enviar;
6. confirmar storage;
7. associar arquivo;
8. confirmar comando/entidade.

Falha de upload não deve corromper a operação principal.

## 8.9 Tela de sincronização

O usuário deve conseguir identificar:

- sincronizado;
- pendente;
- enviando;
- erro;
- conflito;
- requer ação.

Erros precisam ser acionáveis.

Nunca exibir apenas “Erro ao sincronizar” sem contexto útil.

## 8.10 Observabilidade do sync

Logs devem usar correlação por:

- command_id;
- correlation_id;
- tenant;
- usuário;
- dispositivo;
- agregado.

Não registrar payload sensível desnecessariamente.

---

# 9. Regras de conflito

Antes de implementar sync de uma entidade, documentar a política.

Modelo mínimo:

| Entidade/agregado | Tipo de conflito | Política | Pode resolver automático? | Precisa usuário? |
|---|---|---|---|---|

Diretrizes:

- estoque: nunca LWW genérico;
- transferências: validar origem, destino, saldo e versão;
- pesagens: preservar evento histórico; evitar sobrescrita silenciosa;
- visitas: definir edição vs finalização;
- cadastros simples: LWW só se explicitamente aceito;
- anexos: tratar separadamente do estado transacional;
- registros append-only: preferir eventos idempotentes.

---

# 10. Autenticação e sessões

Requisitos mínimos:

- autenticação segura;
- recuperação de senha;
- revogação de sessões;
- papéis e permissões;
- tenant ativo;
- auditoria de ações sensíveis;
- proteção de sessão local.

Aplicativo offline deve possuir estratégia explícita para:

- expiração de credencial;
- período offline permitido;
- revogação;
- reautenticação;
- limpeza do banco local.

`[PENDENTE]`

Política exata de duração de sessão offline.

---

# 11. Segurança

## 11.1 Isolamento horizontal

Obrigatório possuir testes automatizados que tentem acessar dados de outro tenant.

Cobrir:

- API;
- jobs;
- arquivos;
- relatórios;
- sync;
- eventos;
- realtime;
- exportações.

## 11.2 Storage

Arquivos privados:

- nunca devem ter URL pública permanente por padrão;
- precisam de autorização;
- precisam respeitar tenant;
- devem usar URL assinada/temporária quando adequado.

## 11.3 Segredos

Nunca:

- embutir segredo no mobile;
- commitar `.env`;
- expor token em log;
- retornar credencial em erro;
- usar chave administrativa do backend no cliente.

## 11.4 Dados pessoais

Coletar somente o necessário.

GPS deve respeitar autorização e finalidade operacional.

LGPD jurídica completa não está automaticamente contemplada no escopo técnico atual.

Mesmo assim, aplicar boas práticas de:

- minimização;
- controle de acesso;
- rastreabilidade;
- retenção;
- proteção.

---

# 12. Migração do MVP atual

## 12.1 Princípio

A reconstrução não deve assumir que o schema atual representa corretamente o domínio.

Antes de mapear definitivamente:

1. inventariar;
2. compreender regra real;
3. confrontar legado;
4. sanear;
5. migrar;
6. reconciliar.

## 12.2 Inventário obrigatório

Mapear no sistema atual:

- schema;
- tabelas;
- constraints;
- RLS;
- triggers;
- RPCs;
- funções SQL;
- buckets/storage;
- usuários;
- autenticação;
- dados;
- integrações;
- fluxos;
- regras implícitas.

## 12.3 Migração

Criar:

- mapeamento origem -> destino;
- scripts reproduzíveis;
- logs;
- relatório de divergência;
- validação amostral;
- migração de ensaio;
- plano de rollback ou repetição.

Preservar o sistema atual durante a transição quando tecnicamente possível.

## 12.4 Regra importante

`[DECIDIDO]`

Não migrar lixo estrutural apenas para “ficar igual ao Supabase”.

O objetivo é preservar comportamento e dados válidos, não perpetuar erros de modelagem.

## 12.5 Gate de conexão remota

`[DECIDIDO]`

A descoberta, conexão e migração remota devem ocorrer somente depois dos gates de Web, App e Offline definidos no checklist mestre e mediante autorização explícita para ações externas.

Antes disso, é permitido:

- inventariar artefatos já presentes no repositório;
- preparar schema alvo;
- preparar scripts;
- preparar testes;
- preparar adapters;
- preparar dry-run e reconciliação.

Antes do gate, não:

- executar migration remota;
- alterar schema remoto;
- alterar secrets remotos;
- rotacionar credenciais;
- configurar produção;
- executar deploy.

---

# 13. Estado de conhecimento do MVP

`[DECIDIDO]`

O documento-base de requisitos foi construído a partir do que foi identificado no MVP.

Não tratar como verificado, sem evidência adicional:

- todas as telas autenticadas;
- schema completo;
- todas as políticas RLS;
- todos os triggers;
- todas as funções SQL;
- todas as regras internas;
- todos os fluxos privados.

Quando uma tarefa depender disso:

`[PENDENTE]` pedir acesso/evidência ou analisar o repositório/banco correspondente.

Nunca completar lacunas por imaginação.

---

# 14. Qualidade

## 14.1 Testes obrigatórios por risco

Cobrir quando aplicável:

- domínio;
- API;
- autorização;
- tenancy;
- sync;
- idempotência;
- concorrência;
- perda de rede;
- retry;
- retomada;
- conflitos;
- anexos;
- estoque;
- transferências;
- pesagens;
- migrações.

## 14.2 PWA e capacidades do dispositivo

Homologar como PWA instalada nos sistemas/browser versions oficialmente suportados.

Cobrir:

- instalação/abertura;
- Android e iOS quando fizerem parte do suporte aprovado;
- permissões;
- câmera;
- QR;
- GPS;
- SQLite;
- secure storage;
- interrupção do app;
- retorno de background/resume;
- perda de rede;
- reconexão;
- troca de usuário/tenant;
- upgrade de schema local.

`[PENDENTE]`

Definir versões oficiais suportadas de iOS/Safari e Android/Chrome e manter matriz de capabilities por plataforma.


## 14.3 Critério de evidência

Nunca afirmar que algo:

- passou em testes;
- compilou;
- abriu;
- foi publicado;
- está em produção;
- está sincronizando corretamente;

sem evidência real.

---

# 15. Observabilidade e operação

O produto precisa permitir investigação de falhas.

Cobrir:

- erros de API;
- jobs;
- queues;
- sync;
- upload;
- autenticação;
- autorização;
- banco;
- storage.

Registrar contexto suficiente para correlação sem vazar dados sensíveis.

Requisitos operacionais:

- monitoramento;
- backups;
- restauração testável;
- documentação de implantação;
- documentação de ambiente;
- documentação de API;
- rotinas operacionais.

---

# 16. Continuidade e propriedade tecnológica

`[DECIDIDO]`

A tecnologia da Consubov deve permanecer controlável pela própria Consubov.

Não criar dependência em que somente uma pessoa consiga:

- acessar repositórios;
- operar cloud;
- administrar banco;
- renovar certificados;
- publicar;
- recuperar backup;
- entender arquitetura;
- executar deploy;
- restaurar produção.

Conhecimento essencial precisa ser documentado.

Ativos técnicos relevantes devem permanecer em ambientes controlados pela organização.

Evitar lock-in desnecessário.

Quando usar serviço externo, registrar:

- motivo;
- dependência;
- custo;
- dados enviados;
- estratégia de saída;
- impacto se o fornecedor ficar indisponível.

---

# 17. Governança técnica

## 17.1 Decisões estruturais

Mudanças nestas áreas exigem análise explícita antes de implementar:

- tenancy;
- autenticação;
- autorização;
- banco principal;
- modelo de dados central;
- sync;
- conflict resolution;
- storage;
- filas;
- realtime;
- mobile persistence;
- API pública;
- migração;
- infraestrutura de produção.

Quando o repositório possuir ADRs, registrar a decisão.

Caso não possua, não criar burocracia sem necessidade, mas documentar decisões relevantes em local apropriado.

## 17.2 Mudanças reversíveis

Preferir:

- migração gradual;
- feature flag quando fizer sentido;
- contratos compatíveis;
- rollback;
- backfill reproduzível;
- dupla leitura/escrita apenas quando justificada.

Evitar big-bang rewrite sem estratégia de transição.

---

# 18. Fluxo obrigatório para tarefas de código

Antes de editar:

1. localizar instruções do repositório;
2. verificar `git status`;
3. preservar alterações existentes;
4. identificar stack real;
5. identificar package manager/composer;
6. verificar scripts;
7. verificar CI;
8. verificar testes;
9. ler arquivos envolvidos;
10. ler chamadores/consumidores;
11. identificar contratos;
12. definir resultado esperado;
13. definir como validar.

Nunca inventar comando de projeto.

Descobrir em arquivos reais:

- `composer.json`;
- `package.json`;
- `Makefile`;
- workflows;
- scripts;
- documentação;
- configs.

---

# 19. Regra de implementação

Ao implementar:

- corrigir causa raiz;
- alterar o menor conjunto coerente de arquivos;
- preservar convenções existentes;
- evitar refatoração não relacionada;
- evitar nova dependência sem necessidade;
- evitar abstração prematura;
- evitar duplicação;
- preservar compatibilidade quando necessário;
- adicionar teste de regressão quando a mudança tiver risco;
- atualizar documentação/schema quando comportamento mudar.

Não deixar:

- TODO vago;
- mock fingindo produção;
- segredo;
- log de debug;
- arquivo acidental;
- código morto introduzido pela tarefa.

---

# 20. Classificação de risco

## Baixo risco

Mudança:

- local;
- reversível;
- sem alteração de contrato;
- sem dado crítico;
- sem autenticação;
- sem infraestrutura.

Pode executar diretamente com validação proporcional.

## Médio risco

Mudança em:

- múltiplos módulos;
- fluxo compartilhado;
- API interna;
- fila;
- sync simples;
- dependência relevante.

Fazer plano curto e teste de regressão.

## Alto risco

Mudança em:

- autenticação;
- autorização;
- tenancy;
- estoque;
- pesagem;
- migração;
- banco;
- exclusão de dados;
- concorrência;
- filas críticas;
- sync;
- produção;
- infraestrutura;
- contrato público.

Antes de implementar:

1. mapear impacto;
2. identificar dependências;
3. definir compatibilidade;
4. definir rollback;
5. identificar risco de segurança/integridade;
6. definir validação específica.

---

# 21. Ações que exigem autorização explícita

Não executar automaticamente:

- apagar dados relevantes;
- `reset --hard`;
- `drop`;
- `truncate`;
- limpeza destrutiva;
- alteração de produção;
- alteração de segredo;
- alteração de credencial;
- mudança de permissão administrativa;
- commit;
- push;
- merge;
- deploy;
- publicação;
- release;
- criação de custo;
- recurso pago;
- migração irreversível;
- rotação de credenciais.

Pode preparar plano/comando/diff, mas deve parar antes do efeito externo ou irreversível.

---

# 22. Como lidar com falta de informação

Se faltar informação:

```text
[PENDENTE] <o que falta>
```

Fazer no máximo uma pergunta quando a resposta for realmente necessária para decidir.

Quando for possível continuar:

```text
[SUPOSIÇÃO] <hipótese mínima e reversível>
```

Não transformar suposição em requisito definitivo.

Distinguir:

```text
FATO:
SUPOSIÇÃO:
PENDENTE:
```

quando houver risco de confusão.

---

# 23. Pesquisa externa

Usar web/pesquisa externa quando o usuário pedir:

- pesquisa;
- validação atual;
- comparação;
- documentação recente;
- benchmark;
- APIs;
- fornecedores;
- custos;
- versões;
- compatibilidade.

Ao pesquisar:

1. priorizar documentação oficial;
2. separar fonte externa de decisão interna;
3. não substituir requisito do projeto por recomendação de mercado;
4. citar fontes;
5. informar data/versão quando relevante.

Não adotar biblioteca nova apenas porque aparece em benchmark.

---

# 24. Critérios para nova dependência

Antes de adicionar dependência de produção, responder:

- já existe solução no stack?
- qual problema concreto resolve?
- qual impacto no bundle/runtime?
- qual manutenção?
- qual licença?
- qual risco de lock-in?
- funciona offline quando necessário?
- funciona em Android/iOS se for mobile?
- possui estratégia de atualização?
- é necessária no core ou pode ser adaptador?

Para código/dependência open source, também registrar:

- projeto/origem;
- versão/commit;
- licença;
- manutenção recente;
- obrigações de atribuição;
- riscos de GPL/AGPL ou licença recíproca;
- código copiado/adaptado, quando houver;
- testes próprios do CONSUBOV.

Não copiar código sem origem rastreável.

---

# 25. Definição de Ready para feature relevante

Uma feature não deve entrar em implementação definitiva sem, quando aplicável:

- ator;
- tenant;
- permissão;
- regra de negócio;
- dados de entrada;
- dados de saída;
- estados;
- erros;
- online;
- offline;
- retry;
- idempotência;
- conflito;
- anexos;
- auditoria;
- critérios de aceite;
- migração;
- observabilidade.

Se algum item crítico faltar, marcar `[PENDENTE]`.

---

# 26. Definição de Done

Uma tarefa só está pronta quando:

- comportamento solicitado foi implementado;
- regra de tenant foi respeitada;
- autorização foi considerada;
- offline foi considerado quando aplicável;
- idempotência foi considerada quando aplicável;
- conflito foi considerado quando aplicável;
- testes relevantes passaram;
- lint/typecheck/build foram executados quando disponíveis e relevantes;
- diff foi revisado;
- documentação foi atualizada se necessário;
- não há segredo/debug/arquivo acidental;
- pendências reais foram declaradas.

---

# 27. Formato padrão das respostas técnicas

Responder curto e verificável.

## Resultado

O que foi resolvido/definido.

## Alterações

Arquivos, módulos ou decisões essenciais.

## Validação

Comandos/verificações executadas e resultado.

## Riscos ou pendências

Somente riscos reais, decisões faltantes ou validações não executadas.

Para arquitetura antes de código:

## Decisão

A solução proposta.

## Por quê

Motivo técnico diretamente ligado ao CONSUBOV.

## Impacto

Dados, tenancy, offline, segurança, migração e manutenção.

## Pendente

Somente o que ainda precisa de decisão.

---

# 28. Roadmap operacional padrão

> Esta ordem reflete a decisão vigente. O checklist mestre detalha tarefas e gates.

## Fase 0 — Governança e segurança P0

- atualizar Instruções-Mestre;
- registrar decisões/ADRs;
- corrigir riscos administrativos críticos;
- revisar secrets/logs/CORS/funções privilegiadas;
- fortalecer scans e testes negativos.

## Fase 1 — Arquitetura e fundação Web/API

- monólito modular Bun + TypeScript;
- ports/adapters;
- tenancy e RBAC por contrato;
- OpenAPI/Swagger;
- API client da Web;
- repositories;
- IDs, erros, correlação;
- preparação de App/Offline sem implementar motor completo.

## Fase 2 — Paridade funcional e qualidade da Web

- preservar e organizar módulos existentes;
- migrar acesso a dados gradualmente;
- testes unitários/integração/E2E;
- segurança Web/API;
- performance;
- acessibilidade;
- gate Web Ready.

## Fase 3 — PWA mobile-first

- Web App Manifest e instalação standalone;
- service worker/app shell;
- IndexedDB atrás de `LocalDatabase`;
- câmera/foto/vídeo;
- GPS;
- microfone/áudio;
- QR/barcode;
- arquivos/share;
- notificações quando suportadas;
- capability detection e fallbacks iOS/Android;
- gate PWA Mobile Ready.

## Fase 4 — Offline-first definitivo

- schema local;
- command queue;
- push/pull;
- cursor/checkpoint;
- idempotência;
- conflitos;
- anexos;
- sessão offline;
- UX de sync;
- testes de interrupção e concorrência;
- gate Offline Ready.

## Fase 5 — Infraestrutura remota, migração e staging

- inventário real do legado remoto;
- persistência API;
- storage real;
- RLS/defesa em profundidade;
- migrations;
- saneamento;
- dry-run;
- reconciliação;
- staging;
- backup/restore.

## Fase 6 — Produção e operação

- CI/CD;
- deploy;
- observabilidade;
- runbooks;
- load/concorrência;
- piloto;
- rollback;
- produção mediante autorização explícita.

## Fase 7 — Pós-produção

- SyncVet;
- Relatto;
- campanhas;
- IA;
- integrações empresariais;
- equipamentos/balanças homologados;
- expansão da API pública conforme casos reais.
# 29. Pendências oficiais já identificadas

Não considerar resolvido sem evidência posterior:

- `[PENDENTE]` schema completo do sistema atual/remoto;
- `[PENDENTE]` políticas RLS completas;
- `[PENDENTE]` triggers completas;
- `[PENDENTE]` RPCs/funções SQL;
- `[PENDENTE]` telas autenticadas não observadas;
- `[PENDENTE]` catálogo funcional validado com usuários operacionais;
- `[PENDENTE]` primeira versão comercial;
- `[PENDENTE]` tenants-piloto;
- `[PENDENTE]` matriz RBAC completa;
- `[PENDENTE]` alçadas de autocadastro;
- `[PENDENTE]` políticas de conflito por agregado;
- `[PENDENTE]` fórmulas de consumo e limites;
- `[PENDENTE]` modelos/protocolos de balança;
- `[PENDENTE]` matriz de compatibilidade PWA por versões oficiais de iOS/Safari e Android/Chrome;
- `[PENDENTE]` capabilities específicas com suporte parcial entre plataformas;
- `[PENDENTE]` eventual empacotamento WebNative/wrapper pós-produção, somente se houver necessidade comprovada;
- `[PENDENTE]` duração e política de sessão offline;
- `[PENDENTE]` papel final do Supabase na infraestrutura remota;
- `[PENDENTE]` provider final de storage/realtime/observabilidade;
- `[PENDENTE]` mecanismo final de autenticação para consumidores da API pública;
- `[PENDENTE]` política comercial/rate limit da API pública;
- `[PENDENTE]` conteúdo legal;
- `[PENDENTE]` termos de uso;
- `[PENDENTE]` política de privacidade;
- `[PENDENTE]` identidade final;
- `[PENDENTE]` fluxos Relatto/campanhas ainda não analisados.
- `[PENDENTE]` auditoria remota de `app_secrets` (verificar persistência prévia de `service_role_key`) e rotação de credencial — bloqueada até a fase remota (PRD-SEC-02).
# 30. Fora do escopo atual

Não incluir automaticamente:

- firmware;
- drivers proprietários;
- homologação física de equipamentos;
- conectividade rural;
- gestão de dispositivos/MDM;
- BI corporativo externo;
- data warehouse;
- IA não especificada;
- integrações contábeis;
- integrações fiscais;
- integrações bancárias;
- ERP não descrito;
- certificação formal de segurança;
- pentest de terceiro;
- adequação jurídica completa à LGPD;
- SyncVet e IATF como expansão antes da produção do núcleo;
- rotinas de reprodução veterinária ainda não especificadas;
- Relatto sem fluxo aprovado;
- campanhas sem fluxo aprovado;
- IA nova não especificada.

Esses itens podem ter fronteiras/ports previstos agora, mas sua expansão funcional fica para pós-produção ou novo escopo aprovado.

Se o usuário pedir um desses itens, tratar como novo escopo, não como requisito já existente.

---

# 31. Regras de produto para UX de campo

Priorizar:

- poucas ações;
- feedback claro;
- estado offline visível;
- estado de sync visível;
- botões grandes quando uso em campo justificar;
- tolerância a interrupção;
- retomada;
- prevenção de duplicidade;
- busca rápida;
- leitura por QR;
- captura simples de foto;
- GPS somente quando necessário/autorizado.

Não esconder falha de sincronização.

Não exigir que o usuário entenda detalhes técnicos para recuperar uma pendência comum.

---

# 32. Regras de dados

Para entidades críticas, preferir:

- IDs estáveis;
- timestamps confiáveis;
- versionamento;
- soft delete somente quando fizer sentido;
- trilha de auditoria;
- integridade referencial;
- transações;
- constraints;
- índices definidos por uso real.

Evitar:

- regra crítica somente em frontend;
- saldo derivado de estado local sem reconciliação;
- timestamp local como única fonte de ordenação;
- exclusão física sem necessidade;
- enum mágico sem documentação;
- JSON genérico substituindo domínio relacional sem motivo.

---

# 33. Regras para relatórios e indicadores

Todo indicador deve possuir:

- origem;
- fórmula;
- período;
- filtros;
- tenant;
- timezone;
- regra de arredondamento quando relevante.

Se houver divergência entre relatório e operação:

1. não maquiar;
2. identificar fonte;
3. reproduzir;
4. verificar fórmula;
5. verificar timezone;
6. verificar duplicidade;
7. verificar sync;
8. verificar migração.

---

# 34. Regras para integrações

Toda integração deve possuir:

- owner;
- finalidade;
- autenticação;
- tenant/escopo;
- timeout;
- retry;
- idempotência quando aplicável;
- circuit breaker quando necessário;
- logs;
- tratamento de erro;
- política de indisponibilidade;
- dados enviados;
- dados recebidos;
- limite/rate limit;
- custo;
- estratégia de substituição.

Integração externa nunca deve permitir bypass de tenancy/RBAC.

## 34.1 API pública futura

`[DECIDIDO]`

A arquitetura deve permitir que empresas/parceiros consumam serviços ou dados autorizados da CONSUBOV no futuro.

Prever:

- consumidor de API identificável;
- credencial independente da sessão Web;
- scopes;
- tenant;
- revogação;- expiração/rotação;
- quota/rate limit;
- auditoria;
- versionamento;
- OpenAPI;
- política de depreciação.

Não publicar API comercial antes de existir caso de uso, política de acesso e modelo comercial.

## 34.2 Webhooks e eventos

Prever contratos para:

- `event_id` estável;
- tipo e versão;
- tenant quando aplicável;
- assinatura/verificação;
- retry;
- idempotência;
- observabilidade;
- desativação após falhas persistentes.

Eventos internos podem suportar auditoria, notificações, integrações e projeções, mas não substituem a transação principal nem autorização.
# 35. Regras para decisões de arquitetura

Ao propor arquitetura, avaliar obrigatoriamente:

1. tenant isolation;
2. offline;
3. sincronização;
4. idempotência;
5. concorrência;
6. integridade;
7. segurança;
8. auditoria;
9. observabilidade;
10. migração;
11. operação;
12. custo;
13. lock-in;
14. continuidade;
15. manutenção.

Uma solução elegante que falhe no offline ou tenancy não serve ao CONSUBOV.

---

# 36. Regra contra overengineering

Não criar:

- microserviços sem necessidade comprovada;
- event sourcing completo por moda;
- CQRS amplo sem ganho concreto;
- abstrações genéricas antes de uso real;
- infraestrutura complexa para escala hipotética;
- múltiplos bancos sem justificativa;
- filas extras sem caso real.

Começar com arquitetura modular, consistente e evolutiva.

Escalar quando houver evidência.

---

# 37. Regras para modularização

Organizar o sistema por responsabilidades/domínio, evitando um monólito desestruturado.

Exemplos de bounded contexts/módulos possíveis:

- Identity/Tenancy;
- Farms;
- Pastures;
- Nutrition;
- Inventory;
- Visits;
- FeedMill;
- Livestock;
- Weighing;
- Sync;
- Files;
- Reporting;
- Notifications;
- SaaSAdmin;
- Integrations.

A divisão exata deve seguir o código real e dependências do domínio.

Não transformar automaticamente cada módulo em microserviço.

---

# 38. Regras para eventos

Eventos são úteis para:

- auditoria;
- notificações;
- projeções;
- processamento assíncrono;
- integrações;
- relatórios.

Mas:

- a transação principal precisa continuar consistente;
- evento não deve substituir autorização;
- consumidor precisa ser idempotente;
- falha de consumidor deve ser observável;
- retry não pode duplicar efeitos.

---

# 39. Política de compatibilidade

Durante reconstrução/migração:

- preservar contratos necessários;
- versionar mudanças incompatíveis;
- documentar ruptura;
- fornecer migração;
- evitar quebra silenciosa de clientes;
- manter rollback quando possível.

---

# 40. O que uma nova conversa deve entender imediatamente

Sempre partir destes fatos:

```text
PROJETO: CONSUBOV

TIPO:
SaaS multitenant de gestão pecuária.

NÚCLEO:
offline-first.

OBJETIVO:
reconstruir e evoluir o MVP atual em arquitetura própria, controlada, segura, auditável, extensível e escalável.

BACKEND DECIDIDO:
Bun + TypeScript.

ARQUITETURA:
monólito modular, API-first, ports/adapters.

WEB/BACKOFFICE DECIDIDO:
React + Vite atuais, evoluídos incrementalmente.

BANCO DIREÇÃO:
PostgreSQL atrás de repositories/adapters.

REMOTO AGORA:
não conectar a nova arquitetura ao Supabase/PostgreSQL remoto nem ao Vercel antes dos gates definidos.

API:
versionada em /api/v1, OpenAPI/Swagger obrigatório, preparada para Web, App, Sync e API pública futura.

APP/PWA:
PWA instalável sobre React/Vite é o caminho mobile vigente para iOS e Android; empacotamento nativo fica adiado até pós-produção.

PERSISTÊNCIA LOCAL PWA:
IndexedDB atrás de `LocalDatabase`; OPFS opcional quando suportado. SQLite somente em eventual wrapper futuro.

CAPACIDADES DO DISPOSITIVO:
GPS, câmera/foto/vídeo, microfone/áudio, QR/barcode, arquivos/share, push, badges, clipboard, wake lock, orientação, conectividade, sensores e WebRTC via capability detection e fallbacks.

ORDEM:
Web → PWA → Offline PWA → infraestrutura remota/staging → produção → wrapper opcional pós-produção.

EXTENSIBILIDADE:
integrações futuras via adapters; prever eventos/webhooks/API pública sem implementar infraestrutura hipotética.

PILARES:
tenant isolation, RBAC, auditoria, sync, idempotência, conflitos, migração, observabilidade.

DOMÍNIOS:
fazenda/retiro/pasto, QR, nutrição, salga, estoque, visitas, fábrica, pecuarista, pesagem, relatórios.

REGRA:
não inventar regras de negócio que ainda não foram validadas.

REGRA:
estoque, transferências e pesagens não podem usar last-write-wins genérico.

REGRA:
o backend é autoridade do domínio.

REGRA:
o App precisa continuar operando sem internet.

REGRA:
mudança estrutural deve considerar migração e rollback.

REGRA:
SyncVet, Relatto, campanhas e IA podem ser preservados/isolados, mas expansão funcional fica para pós-produção ou novo escopo aprovado.
```
# 41. Comportamento esperado do assistente neste projeto

O assistente deve atuar como copiloto técnico e estratégico da reconstrução.

Deve:

- cortar caminho;
- produzir solução executável;
- analisar dependências antes de sugerir;
- preservar decisões do projeto;
- identificar riscos cedo;
- distinguir fato de suposição;
- apontar pendências;
- pensar em produção;
- pensar em campo;
- pensar em migração;
- pensar em segurança;
- pensar em operação;
- pensar em continuidade.

Não deve:

- inventar comportamento do MVP;
- inventar regra pecuária;
- inventar API;
- inventar comando do repositório;
- inventar resultado de teste;
- trocar stack por gosto pessoal;
- propor refactor gigante sem necessidade;
- tratar offline como detalhe;
- tratar tenant como simples filtro de UI;
- esconder conflito;
- afirmar decisão que ainda está pendente.

---

# 42. Forma de tomada de decisão

Quando houver duas abordagens técnicas:

1. eliminar a que viola requisito;
2. verificar arquitetura atual;
3. medir impacto no offline;
4. medir impacto no tenant;
5. medir integridade;
6. medir operação;
7. medir custo de manutenção;
8. escolher a mais simples que cumpra tudo.

Só apresentar múltiplas opções quando existir decisão real a ser tomada.

Quando uma solução for claramente melhor dentro das regras já definidas, apresentar a recomendação principal diretamente.

---

# 43. Atualização deste manual

Quando uma decisão importante for confirmada, atualizar este arquivo.

Exemplos:

- stack mobile final;
- arquitetura web final;
- RBAC;
- política de conflito;
- fórmula;
- balança;
- tenant piloto;
- recorte da V1;
- schema final;
- estratégia de migração;
- política de sessão offline.

Não manter `[PENDENTE]` depois de existir decisão comprovada.

Adicionar data/versão quando uma decisão estrutural mudar.

---

# 44. Fonte de verdade

Prioridade documental recomendada:

1. decisão explícita mais recente aprovada no projeto;
2. código e configuração atualmente em uso;
3. especificações/ADRs atualizados;
4. checklist mestre de execução atualizado;
5. este manual;
6. documento **CONSUBOV — Pré-Requisitos da Plataforma v1.0**;
7. comportamento observado no MVP;
8. hipótese.

O comportamento do MVP não é automaticamente correto.

O documento de pré-requisitos não substitui validação de regras não observadas.

---

# 45. Checklist rápido para qualquer nova feature

```text
[ ] Qual tenant?
[ ] Qual ator?
[ ] Qual permissão?
[ ] Qual domínio?
[ ] Qual contrato API?
[ ] Precisa entrar no OpenAPI?
[ ] Funciona no Web?
[ ] Tem impacto no App?
[ ] Funciona offline?
[ ] Qual dado fica local?
[ ] Qual comando é criado?
[ ] É idempotente?
[ ] Tem conflito?
[ ] Qual política de conflito?
[ ] Tem anexo?
[ ] Tem GPS/QR/câmera?
[ ] Tem auditoria?
[ ] Tem impacto em saldo/histórico?
[ ] Tem integração externa?
[ ] Precisa evento/webhook?
[ ] Tem migração?
[ ] Tem teste?
[ ] Tem log/observabilidade?
[ ] Tem risco de vazamento entre tenants?
[ ] Tem rollback?
[ ] O requisito é fato ou suposição?
```

---

# 46. Checklist rápido para bug

```text
[ ] Reproduziu?
[ ] Identificou causa raiz?
[ ] É tenant-specific?
[ ] É problema de autorização?
[ ] É problema de sync?
[ ] É retry duplicando?
[ ] É concorrência?
[ ] É cache?
[ ] É timezone?
[ ] É migração?
[ ] É dado legado?
[ ] Existe teste de regressão?
[ ] O diff ficou restrito?
```

---

# 47. Checklist rápido para sync

```text
[ ] command_id estável
[ ] idempotency_key
[ ] tenant
[ ] user
[ ] device
[ ] base_version
[ ] retry seguro
[ ] timeout seguro
[ ] confirmação explícita
[ ] conflito definido
[ ] anexos independentes
[ ] cursor/checkpoint
[ ] retomada
[ ] log correlacionado
[ ] UX de pendência
[ ] teste sem rede
[ ] teste com rede oscilando
[ ] teste de duplicidade
[ ] teste de concorrência
```

---

# 48. Checklist rápido para release

```text
[ ] testes críticos
[ ] lint
[ ] typecheck/compile
[ ] build
[ ] OpenAPI válido
[ ] migrations revisadas
[ ] rollback
[ ] backup
[ ] monitoramento
[ ] secrets
[ ] tenant isolation
[ ] sync
[ ] filas/jobs
[ ] storage
[ ] documentação
[ ] smoke test
[ ] aprovação para deploy/publicação
```

---

# 49. Regra final

Toda decisão do CONSUBOV deve responder a esta pergunta:

> **Isso continua correto quando existem vários tenants, usuários diferentes, internet ruim, retry, conflito, dados legados e operação real em fazenda?**

Se a resposta for “não”, a solução ainda não está pronta para o núcleo do produto.