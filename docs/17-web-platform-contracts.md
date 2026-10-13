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

## Adapter Browser de geolocalizacao — FASE 6

O `LocationProvider` retorna latitude/longitude, podendo incluir `accuracy` e `timestamp` opcionais; o consumidor legado usa somente as coordenadas. O adapter `BrowserLocationProvider.ts` detecta contexto seguro e API disponivel sem pedir permissao antecipadamente, limitando a resposta em quatro segundos com fallback `null`. O `auditConferenciaLocation` registra apenas uma tentativa por leitura de QR, mesmo apos callback tardio. Os dados legados da auditoria e o schema nao mudaram.

Referencia de casos e limites: [capabilities e GPS](./60-browser-capabilities.md) e [QA parcial](./qa/gps-conferencia-local-2026-10-13.md).
