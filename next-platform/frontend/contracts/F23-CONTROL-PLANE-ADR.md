# F23 Control Plane Contracts — ADR 001

Status: proposed for the local laboratory. No remote endpoint is declared available by this document.

## Identity and entitlement

- A provisioned account has exactly one operational profile. `userId` is the canonical account identifier returned by the authenticated grant; tenant, farm and retreat scope come from that grant, never from a module's self-asserted role.
- The registry resolves a module only after authentication. Catalog metadata alone never downloads an artifact.
- Multiple accounts may be provisioned on one device; session, database namespace, encryption key and outbox remain account scoped.

## Shell to module

- Protocol v1 request: `{ protocolVersion, moduleId, nonce, requestId, kind: 'request', method, payload }`. Context and capabilities are held by the shell after bootstrap; requests cannot supply either. Replies include the same version/module/nonce/request identifiers and exactly one of `result` or a typed `error`.
- The host validates the method-specific schema, authorized module, negotiated capability, bound context, nonce and request ID before dispatch. Unknown versions/methods and malformed messages fail closed. The channel limits total structured-clone payload/result size to 40 MiB; mutation attachments are bounded to four Blobs of at most 20 MiB each within that total. The client limits concurrent requests and applies timeouts. ACK/pull application remains a trusted shell operation, absent from module RPC.
- Module entrypoints are immutable browser artifacts resolved from an authenticated local registry manifest. The shell source and production build do not import profile source packages.
- A new module artifact must complete integrity and compatibility checks before activation. Keep the prior valid generation until smoke validation; activate and roll back by module generation only.

## Module to local data

- `LocalDataAPI` is asynchronous and requires an authorization context on every operation. `userId` is the account partition identity; the partition also includes product, tenant, farm, retreat, profile and module.
- `commitMutation` writes the snapshot, command/outbox entry, attachment references and Blob values in one IndexedDB readwrite transaction. It resolves only after `transaction.oncomplete`; quota, schema, request and abort failures reject without reporting success. Attachment writes occur only as part of that mutation; reads are separate.
- The implementation owns IndexedDB names, object-store schema and migration. Feature modules cannot call `indexedDB.open`, access another module's stores, or use localStorage/Map as operational persistence.
- Network requests never run inside an IndexedDB transaction. Pull deltas and the opaque cursor commit together; failed commits do not advance the cursor.

## Device to laboratory API

- Remote-facing modules use REST/JSON DTOs through a typed adapter. Existing endpoints must be confirmed in source before being described as implemented. Proposed endpoints stay labelled `PROPOSED`.
- The local mock derives identity and grants from synthetic server-side fixtures; it validates account, tenant, farm/retreat, profile, capability, schema, payload size and idempotency. Client-supplied scope is never authoritative.
- Sync uses immutable command IDs/idempotency keys, stable ACKs, opaque server cursors, tombstones and domain-specific conflicts. Data and cursor commit together locally after validation.
- PostgreSQL, Supabase Auth/RLS, Cloudflare, Vercel and production are out of scope. The lab uses synthetic fixtures and a localhost API only.

## Offline authorization and updates

- First account/module provision requires the local API online and completes only after every required module asset and authorized seed record is durable.
- Offline login uses a device-bound credential verifier and expiring authorization record. No plaintext password, perpetual JWT or invented revocation window. Expiry fails closed; policy duration remains an explicit decision to resolve before representing it as accepted.
- No product UI may expose online/offline/sync state. Functional save, authorization and conflict errors remain visible.
- Updating one module cannot change the shell, another module's artifacts/cache/database or ADM. Shell upgrades require N/N-1 compatibility negotiation and preserve the last working shell and all local data.

## Evidence still required

Local evidence (2026-11-05, uncommitted F23 tree based on `25a4d8ad`):

- `bun apps/fazenda/shell/scripts/check-shell-independence.ts`: two in-memory production builds, with a Capataz-source override on the second build, produced identical SHA-256 hashes for all emitted shell artifacts. Both build graphs loaded zero private profile sources. This does not mutate live artifacts used by concurrent browser QA.
- `bun packages/local-data/test/run-portable-module.ts`: independent Rust/Wasm + vanilla JavaScript fixture completed v1 hello/init/ready and scoped `getSchemaVersion` RPC against real IndexedDB in Chromium and WebKit. It uses the public envelope validators; it does not test every method or registry integration.

These checks do not approve T01–T07 as a whole.

Real Chromium and WebKit tests must prove per-account download/cache selection, IDB durability, account isolation, sync retry/cursor behavior, independent module release, N-1 rollback and shell incompatibility fallback. These are acceptance gates, not assumed outcomes of this ADR.
