# ADR-0005 — Ports/Adapters e extensibilidade

**Status:** Aceito  
**Data:** 2026-10-01

## Contexto
O projeto deve permitir integrações e capacidades futuras sem acoplar o domínio a fornecedores específicos.

## Decisão
Adotar **ports/adapters** nas fronteiras de infraestrutura, integrações e capacidades nativas.

Portas previstas, quando aplicáveis:
- IdentityVerifierPort
- TenantContextPort
- AuthorizationPort
- AuditLogPort
- Persistence/Repositories
- FileStoragePort
- EventPublisherPort
- JobQueuePort
- NotificationPort
- TelemetryPort
- LocalDatabase
- SecureStorage
- LocationProvider
- QrScanner
- CameraProvider
- ConnectivityProvider
- NativeBridge
- SyncTransport

## Consequências
- Domínio não deve importar SDK de provider.
- Integrações futuras entram por adapters.
- Auth, storage, realtime e observabilidade devem permanecer substituíveis.
- Preparar pontos de extensão não significa implementar infraestrutura sem caso real.

## Não decidido aqui
- Providers finais.
