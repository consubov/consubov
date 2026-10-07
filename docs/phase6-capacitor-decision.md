# FASE 6: Decisão de Tecnologia de Empacotamento

## Contexto

A FASE 5 (Web Ready) está em vias de conclusão. A FASE 6 requer empacotamento mobile da aplicação Web existente sem duplicar lógica de domínio.

## Requisitos da FASE 6

Conforme [CONSUBOV_CHECKLIST_MESTRE.md](../CONSUBOV_CHECKLIST_MESTRE.md) seção 6.1:

1. **Plataformas**: Android + iOS
2. **WebView/Runtime**: Sistema nativo otimizado
3. **Bridge nativa**: Comunicação Web ↔ Native via contratos já definidos
4. **Recursos nativos obrigatórios**:
   - SQLite (persistência offline)
   - Câmera (captura de fotos)
   - GPS (latitude/longitude/accuracy)
   - QR Scanner (decodificação local)
   - Secure Storage (tokens/credenciais)
   - File System (arquivos locais)
5. **Comportamento**:
   - Background/resume sem perda de estado
   - Atualização via OTA (over-the-air)
   - Operação offline-first
6. **Licença e sustentabilidade**: Projeto ativo, licença compatível com uso comercial

## Opções Avaliadas

### Opção 1: Capacitor (Ionic)

**Prós**:
- ✅ WebView nativo (WKWebView iOS, Android WebView)
- ✅ Bridge JavaScript ↔ Native bem estabelecida
- ✅ Plugins oficiais para todos os recursos obrigatórios:
  - `@capacitor/camera`
  - `@capacitor/geolocation`
  - `@capacitor-community/barcode-scanner` ou `@capacitor/barcode-scanner`
  - `@capacitor/filesystem`
  - `@capacitor-community/sqlite` ou `@capacitor/preferences`
  - `@capacitor/secure-storage-plugin`
- ✅ Hot reload via Capacitor Live Updates
- ✅ MIT License
- ✅ Mantido ativamente pela Ionic (empresa estabelecida)
- ✅ Documentação extensa e comunidade grande
- ✅ TypeScript first-class support
- ✅ Integração direta com Vite/React

**Contras**:
- ⚠️ Bundle size pode ser maior que Tauri
- ⚠️ Performance WebView (não nativo puro)

**Effort**: Baixo a Médio (3-5 dias para setup + testes básicos)

### Opção 2: Tauri Mobile (beta)

**Prós**:
- ✅ Rust backend (performance superior)
- ✅ Bundle size menor
- ✅ MIT/Apache 2.0 dual license
- ✅ Mantido ativamente

**Contras**:
- ❌ **Mobile ainda em beta** (v2.0 mobile support experimental)
- ❌ Ecossistema de plugins menor
- ❌ SQLite requer implementação custom
- ❌ QR/Camera/GPS exigem plugins Rust custom ou dependências third-party
- ❌ Curva de aprendizado Rust para manutenção
- ❌ Menos documentação mobile-specific
- ⚠️ Risco de breaking changes (beta)

**Effort**: Alto (2-3 semanas para setup + plugins custom)

### Opção 3: React Native (rewrite)

**Contras**:
- ❌ Requer reescrever toda UI (viola requisito de reutilizar Web)
- ❌ Duplicaria lógica de domínio
- ❌ Fora do escopo da FASE 6

**Descartada.**

## Decisão: Capacitor

**Recomendação**: **Capacitor** é a escolha mais adequada para a FASE 6.

### Justificativa

1. **Maturidade**: Capacitor mobile é production-ready, enquanto Tauri mobile ainda é beta
2. **Ecossistema**: Plugins oficiais cobrem 100% dos requisitos sem custom code
3. **Time-to-market**: Setup em dias vs. semanas
4. **Risco**: Baixo vs. Alto (breaking changes em beta)
5. **Comunidade**: Documentação extensa e suporte ativo
6. **Alinhamento com stack**: TypeScript/JavaScript (não requer Rust)

### Trade-offs Aceitos

- Bundle size ligeiramente maior (aceitável para dispositivos modernos)
- Performance WebView vs. nativo puro (suficiente para caso de uso offline-first com UI React já otimizada)

## Próximos Passos (Implementação FASE 6)

1. **Setup Capacitor** (6.2):
   - `npm install @capacitor/cli @capacitor/core`
   - `npx cap init` com identidade `br.com.consubov.app`
   - Adicionar plataformas: `npx cap add android` e `npx cap add ios`

2. **Implementar Native Bridges** (6.2-6.3):
   - Criar `apps/mobile/` workspace reutilizando `apps/web/dist`
   - Implementar adapters nativos para cada contrato:
     - `LocationProvider` → `@capacitor/geolocation`
     - `QrScanner` → `@capacitor-community/barcode-scanner`
     - `CameraProvider` → `@capacitor/camera`
     - `LocalDatabase` → `@capacitor-community/sqlite`
     - `SecureStorage` → `@capacitor/preferences` (encrypted mode)
     - `FilePicker` / `FileCapture` → `@capacitor/filesystem`

3. **Permissões** (6.3):
   - Configurar `AndroidManifest.xml` e `Info.plist`
   - Mensagens de permissão claras (português)
   - Graceful degradation quando negado

4. **Testes** (6.7 Gate APP SHELL READY):
   - App instala em Android/iOS
   - Login/redirects funcionam
   - Cada bridge funciona isoladamente
   - SQLite inicializa
   - Estado preservado após background/resume

## Referências

- Capacitor Docs: https://capacitorjs.com/docs
- Capacitor Plugins: https://capacitorjs.com/docs/plugins
- Capacitor SQLite Community: https://github.com/capacitor-community/sqlite
- [Platform Contracts](../apps/web/src/platform/contracts/index.ts)
- [CONSUBOV_CHECKLIST_MESTRE.md](../CONSUBOV_CHECKLIST_MESTRE.md) FASE 6 (linhas 823-893)
