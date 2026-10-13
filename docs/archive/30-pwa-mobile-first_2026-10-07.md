# FASE 6 — PWA mobile-first para iOS e Android

> **Decisão vigente — 2026-10-07:** o CONSUBOV passa a priorizar uma **PWA instalável, mobile-first e com experiência de app nativo** em iOS e Android. Empacotamento WebNative/Capacitor fica **adiado até depois da produção**, quando a Web/PWA estiver 100% funcional e estabilizada.

## Objetivo

Entregar uma única aplicação React/Vite instalável na tela inicial, executando em modo standalone, com aparência/comportamento de aplicativo e acesso ao máximo de capacidades do dispositivo permitido pelas Web APIs de cada plataforma.

A meta de UX é que o usuário comum **não perceba diferença operacional relevante** entre a PWA instalada e um app nativo nos fluxos suportados pelo navegador/SO.

## Princípios

- PWA é o caminho mobile ativo.
- iOS e Android devem ser tratados como plataformas de primeira classe.
- Nenhuma funcionalidade crítica pode depender de API não suportada sem fallback explícito.
- Toda capacidade do dispositivo deve passar por capability detection, permissão contextual e degradação segura.
- O domínio permanece independente da plataforma.
- O backend continua sendo a autoridade de autorização, tenancy, consistência e auditoria.
- Offline-first permanece requisito central.
- Empacotamento nativo/WebNative não faz parte do trabalho ativo antes da produção.

## PWA shell e experiência nativa

Planejar e validar:

- Web App Manifest completo;
- `display: standalone` e comportamento sem chrome de navegador;
- ícones 192/512 e `maskable`;
- splash/launch experience coerente com a identidade visual;
- `theme_color`, `background_color`, safe areas e viewport para notch/dynamic island;
- atalhos do app quando suportados;
- deep links / URL handling dentro dos limites da plataforma;
- instalação orientada no Android e iOS;
- política de atualização que nunca interrompa operação em andamento;
- service worker e app shell offline;
- feedback claro de online/offline/sincronização;
- responsividade mobile como requisito de produto, não adaptação posterior.

## Camada de capacidades do dispositivo

Manter/expandir contratos de plataforma para permitir, quando suportado pelo browser/SO e pelo caso de uso:

- GPS/geolocalização, precisão e timestamp;
- câmera para foto e vídeo;
- microfone e gravação de áudio;
- captura de mídia e anexos;
- QR Code e barcode pela câmera;
- arquivos: seleção, captura, upload, download e compartilhamento;
- Web Share / Share Target;
- notificações push;
- badges do app quando suportados;
- clipboard;
- vibração/haptics quando suportado;
- screen wake lock;
- orientação de tela/fullscreen;
- status de conectividade;
- sensores de movimento/orientação quando disponíveis;
- WebRTC para voz/vídeo e futuras conversas em tempo real;
- Media Session para fluxos de áudio;
- seleção de contatos quando suportada e explicitamente autorizada;
- Bluetooth, NFC e USB apenas como capacidades opcionais, detectadas em runtime e sem dependência funcional crítica enquanto o suporte entre iOS/Android não for comprovado.

Capacidades sem suporte equivalente entre plataformas devem usar adapter/capability flag e fallback de UX. Nunca prometer suporte universal sem evidência em dispositivos-alvo.

## Persistência local PWA

- `LocalDatabase` permanece como contrato independente de tecnologia.
- **IndexedDB** é o baseline de persistência local para a PWA.
- OPFS/File System Access pode ser usado apenas como otimização/capacidade adicional quando compatível, nunca como requisito universal.
- SQLite fica adiado para eventual empacotamento nativo pós-produção.
- Dados locais devem ser mínimos, tenant-scoped/user-scoped, versionados e compatíveis com sync/retry/conflitos.

## Segurança e permissões

- pedir permissão somente no contexto de uso;
- explicar finalidade antes de solicitar câmera/GPS/microfone/notificações;
- tratar negação sem quebrar o restante da aplicação;
- não armazenar segredos administrativos no cliente;
- não registrar tokens, mídia sensível ou PII desnecessária em logs;
- limpar dados de sessão/local conforme regras de logout, troca de usuário e tenant;
- capability detection não substitui autorização backend.

## Validação iOS e Android

Antes do gate PWA MOBILE READY, testar em dispositivos reais e versões oficialmente suportadas:

- instalação na home screen;
- abertura standalone;
- login/logout e redirects;
- retomada após background;
- atualização de versão sem interromper trabalho;
- GPS;
- câmera/foto/vídeo;
- microfone/gravação;
- QR/barcode;
- arquivos/compartilhamento;
- notificações quando suportadas;
- IndexedDB e upgrade de schema local;
- operação offline/reconexão;
- permissões negadas/revogadas;
- safe areas, teclado, rotação e diferentes tamanhos de tela.

## Empacotamento futuro

Capacitor/WebNative/wrapper fica **congelado/adiado**. Só reavaliar quando:

1. a aplicação Web/PWA estiver em produção;
2. os fluxos críticos estiverem 100% funcionais e homologados;
3. offline/sync estiver estabilizado;
4. existir motivo comprovado para loja ou capability gap que a PWA não cubra adequadamente.

Código experimental já criado em `apps/mobile/` não define a arquitetura vigente e não deve receber expansão funcional nesta etapa.
