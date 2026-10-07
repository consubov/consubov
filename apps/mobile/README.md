# CONSUBOV Mobile App

Aplicativo mobile em Capacitor para a plataforma CONSUBOV.

## Visão Geral

Este workspace contém o pacote mobile que consome o mesmo código React da Web (`apps/web`). A diferença está na camada de plataforma:

- **Web**: usa adapters Web para Database, Camera, GPS, etc.
- **Mobile**: usa adapters nativos Capacitor para os mesmos contratos

## Estrutura

```
apps/mobile/
├── src/
│   ├── index.ts              # Bootstrap do app mobile
│   └── adapters/             # Adapters nativos Capacitor
│       ├── index.ts          # Exporta createPlatformAdapters()
│       ├── CapacitorLocationProvider.ts     # GPS/Geolocalização
│       ├── CapacitorQrScanner.ts            # Scanner de códigos QR
│       ├── CapacitorCameraProvider.ts       # Captura de fotos
│       ├── CapacitorLocalDatabase.ts        # SQLite local
│       ├── CapacitorSecureStorage.ts        # Storage criptografado
│       ├── CapacitorConnectivityProvider.ts # Status de rede
│       └── CapacitorNativeBridge.ts         # Bridge para funcionalidades nativas
└── capacitor.config.ts       # Configuração Capacitor
```

## Desenvolvimento

### Requisitos

- Node.js 18+
- Bun (gerenciador de pacotes)
- Capacitor CLI

### Scripts

```bash
# Instalar dependências
bun install

# Verificar tipos
bun run typecheck

# Build do web app (pré-requisito)
cd ../web && bun run build

# Sync Capacitor (atualiza plataformas nativas)
cd .. && bun sync

# Abrir Android
bun open:android

# Abrir iOS
bun open:ios
```

## Contratos de Plataforma

Os adapters nativos implementam os mesmos contratos definidos em:
- `apps/web/src/platform/contracts/index.ts`

Isso permite que a mesma UI React funcione em Web e Mobile sem modificações no código de domínio.

## Plugins Capacitor

| Recurso | Plugin | Status |
|---------|--------|--------|
| Camera | @capacitor/camera | ✅ Implementado |
| Geolocation | @capacitor/geolocation | ✅ Implementado |
| QR Scanner | @capacitor-community/barcode-scanner | ✅ Implementado |
| SQLite | @capacitor-community/sqlite | ✅ Implementado |
| Secure Storage | @capacitor/preferences | ✅ Implementado |
| Network | @capacitor/network | ✅ Implementado |
| Filesystem | @capacitor/filesystem | 🔄 Planejado |
| App | @capacitor/app | ✅ Implementado (background/resume) |

## FASE 6 Progresso

- [x] Capacitor setup e configuração
- [x] Identidade do app configurada (`br.com.consubov.app`)
- [x] LocationProvider adapter
- [x] QrScanner adapter
- [x] CameraProvider adapter
- [x] LocalDatabase adapter (SQLite)
- [x] SecureStorage adapter
- [x] ConnectivityProvider adapter
- [x] NativeBridge adapter

## Próximos Passos

Ver [docs/phase6-capacitor-decision.md](../docs/phase6-capacitor-decision.md) para detalhes completos da implementação.