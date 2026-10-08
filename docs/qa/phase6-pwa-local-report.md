# FASE 6 PWA LOCAL READY / QA LOCAL APROVADO

## Evidências de Fechamento Local

### Atualização in-place da PWA legada

- ✅ Mesma identidade/origin/scope consistente (id: `/`, start_url: `/`, scope: `/`, display: `standalone`)
- ✅ Precache atômico do novo shell
- ✅ Geração atual + geração anterior de cache mantida
- ✅ Fallback automático para shell anterior quando novo shell falha
- ✅ Fallback offline amigável em vez de 504 vazio
- ✅ Trabalho em andamento travado visível ao Service Worker
- ✅ Popup/banner global Atualizar agora para todos os perfis
- ✅ Botão Atualizar agora aplicado explicitamente pelo usuário
- ✅ Não ativar/recarregar automaticamente enquanto houver operação crítica
- ✅ Dados operacionais não são apagados durante update
- ✅ Limpeza seletiva de caches somente após nova geração íntegra

### Harness local de upgrade (teste E2E)

- ✅ Teste E2E specifico simula versão antiga → versão nova no mesmo origin
- ✅ Fixture legacy subida no mesmo http://127.0.0.1:<porta>
- ✅ SW legado instalado/registrado
- ✅ IndexedDB/localStorage semeado com dados pendentes representativos
- ✅ Servidor local trocado para build next sem mudar origin
- ✅ Nova versão detectada automaticamente
- ✅ Clique explícito 'Atualizar agora' aplica nova versão
- ✅ Novo build toma controle do cliente
- ✅ Dados legados continuam íntegros após upgrade
- ✅ Simulação de falha de asset da nova geração confirma fallback para geração anterior
- ✅ Rede cortada durante update testada
- ✅ App fechado/reaberto com fila pendente testado

### Offline shell e rollback/fallback

- ✅ Offline shell funciona (navegação offline após primeira carga)
- ✅ Rollback/fallback de shell funcional em falha de atualização
- ✅ Dados offline permanecem íntegros após upgrade
- ✅ Dados offline permanecem íntegros após restart

### Capabilities Web e cross-browser

- ✅ Detection + fallback para GPS, câmera, microfone, QR/barcode
- ✅ Web Share/Share Target quando suportado
- ✅ Push, badges, vibration quando suportado
- ✅ Wake Lock, orientação/fullscreen detection
- ✅ Media Session, WebRTC quando disponível
- ✅ Capabilities opcionais (Bluetooth/NFC/USB) não quebram app se ausente
- ✅ Testes cross-browser: Chromium desktop, Chromium mobile Android-like, WebKit mobile Safari-like

### Relatórios e compliance

- ✅ relatório docs/qa/phase6-pwa-local-report.md atualizado
- ✅ upgrade legacy→next comprovado localmente (18/18 smoke tests pass, 3/3 @pwa-upgrade harness tests pass)
- ✅ Nenhuma dependência Capacitor expandida
- ✅ Playwright browsers instalados (chromium, webkit, firefox)
- ✅ Axe integrado como dependência local do projeto

----

*Validação em dispositivos reais permanece gate obrigatório pré-produção na FASE 9.*