# Web Platform Contracts

These contracts isolate business modules from browser-specific APIs and native wrappers.

## Contracts

- **LocalDatabase**: Key-value store for local persistence.
- **SecureStorage**: Secret storage (non-logging).
- **LocationProvider**: Device position.
- **QrScanner**: QR code content.
- **CameraProvider**: Image capture.
- **ConnectivityProvider**: Network status.
- **FilePicker/FileCapture**: File selection and capture.
- **NativeBridge**: Bridge for wrapper-specific calls.
- **SyncTransport**: Transport for incremental sync.

## Implementation

Interfaces are located in `apps/web/src/platform/contracts/index.ts`.
Adapters should be provided at the composition root.


## RealtimeProvider

`RealtimeProvider` é uma fronteira substituível de leitura/invalidação. Eventos realtime nunca autorizam nem finalizam escrita crítica. Quando um evento indicar mudança, o estado autoritativo deve ser relido via repository/API.

Isso preserva o realtime legado sem transformá-lo em fonte de integridade.
