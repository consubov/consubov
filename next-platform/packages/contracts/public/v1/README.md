# Public transport v1 — F23 local laboratory

These files are consumable without TypeScript, React or the repository SDK. They describe the current local laboratory, not a production API.

| Artifact | Scope |
|---|---|
| `module-protocol.schema.json` | Draft 2020-12 JSON-compatible projection of the implemented browser message protocol |
| `atomic-command.schema.json` | Shared command envelope input shape, before domain validation and authorization |
| `openapi.json` | OpenAPI 3.1 description of the HTTP routes actually implemented in `api/src` |

The `https://contracts.consubov.invalid/f23/v1/` identifiers are stable offline schema IDs, not hosted services. Resolve these IDs to the adjacent files in your validator; no network fetch is needed. Keep these files together for relative references. Protocol breaking changes require a new protocol version and directory; this does not imply that protocol N-1 adapters or release compatibility gates have already been implemented.

## Browser handshake and local data

Any language/framework must produce browser-executable code and use browser messaging bindings. Current modules run in sandboxed iframes with opaque origin. The shell checks the expected frame `event.source`, opaque origin, registry module/profile and nonce before transferring a dedicated `MessagePort`.

1. Module sends `module:hello` with `protocolVersion: 1`, `moduleId`, `profileId`, UUID `nonce` and artifact SemVer `version`.
2. Shell sends `shell:init` with the same identity, authorized `context`, granted `capabilities`, language and a transferred port. Only the shell supplies context; a schema alone cannot establish that the sender is trusted.
3. Module sends `module:ready` on that port, with the same module/profile/nonce and protocol version.
4. Requests and responses use that port. Shell may also send `shell:language-changed` and optional protocol-v1 `shell:data-changed` there. The latter is a notification to reread durable state; it carries no authority or synchronization UI state.

Release health and activation are separate from the v1 data handshake. Newly staged candidates must send a valid `module:healthy` with the bound module/profile/nonce and exact artifact version after successful initialization before the shell can promote their durable pointer; `module:ready` alone never promotes a candidate. The installed-legacy adapter accepts the validated handshake of a previously verified healthy v1 generation that predates `module:healthy`, without rewriting or promoting its pointer. This compatibility exception applies only to a descriptor marked both `legacy: true` and `health: healthy`, never to a newly downloaded legacy candidate. Missing `module:hello` or `module:ready` still fails the legacy handshake deadline. An absent legacy quiescence bridge leaves activation blocked while that document is open; data handshake readiness does not establish that user work is quiet.

An actual request (there is no `version`, `profileId`, `context` or caller `capability` field in an RPC envelope):

```json
{
  "kind": "request",
  "protocolVersion": 1,
  "moduleId": "capataz",
  "nonce": "3411c95a-3a23-4a26-a243-1d77129ecc01",
  "requestId": "184bd706-f81e-4119-893e-a34560a74486",
  "method": "readSnapshot",
  "payload": { "aggregateType": "pasto", "aggregateId": "pasture-a" }
}
```

Responses have `kind: "response"`, the same protocol/module/nonce/requestId and either `ok: true, result: ...` or `ok: false, error: {code, message}`. The current response validator checks the envelope and size, not method-specific result shape; clients must correlate results with their pending method. Reject responses with a different module/nonce or unknown requestId. Default SDK timeout is 15 seconds and max in-flight requests is 32; shell tracks up to 4096 request IDs per generation and ignores duplicates. Reopening changes nonce; asynchronous results from an old generation are discarded.

| Method | Payload | Result | Required capability |
|---|---|---|---|
| `readSnapshot` | `{aggregateType, aggregateId}` | `Snapshot` or null | `local-data.read` |
| `listSnapshots` | `{aggregateType?}` | array of snapshots | `local-data.read` |
| `commitMutation` | `{command, snapshot, attachments, expectedModuleRevision?}` | `{commandId, committed: true}` after IndexedDB commit | `local-data.write` |
| `readAttachment` | `{attachmentId}` | `{ref, blob}` or null | `local-data.read` |
| `listPendingCommands` | `{limit}` (1–500) | array of `{command, attachmentRefs}` | `local-data.read` |
| `getCursor` | `{}` | opaque string or null | `local-data.read` |
| `getSchemaVersion` | `{}` | number | `local-data.read` |

`Snapshot` is `{aggregateType, aggregateId, version, data, modifiedAt}`. Context consists of account, module/profile, tenant, farm, nullable retreat, device and product `consubov`. Module and profile must match, including the nested init context. Caller-supplied context/capabilities on RPC are rejected. `sync.pull`/`sync.push` are declared capabilities, but there are no module RPC methods with those names. Shell-owned `applyCommandResponse` and `commitPull` methods from LocalDataAPI are intentionally not exposed to modules.

## Structured clone and validation limits

Messages use native structured clone, not JSON text. For attachment mutations `attachments` has at most four `{ref, blob}` values; `blob` MUST be an actual browser `Blob`. The reference requires UUID attachment ID, positive size up to 20 MiB, 64 hexadecimal SHA-256 characters, MIME type and local blob reference. Reading an attachment also returns a native Blob. A Rust/Wasm or other implementation needs a browser Blob binding. The HTTP attachment route uploads raw binary bytes independently of browser RPC; no base64 JSON wrapper is used. The `x-structured-clone-type` annotation does not make a plain JSON object a valid Blob; only the runtime can enforce this requirement.

Requests and successful responses have a runtime 40 MiB budget calculated from UTF-8 JSON of metadata (Blobs replaced by size/type descriptors) plus all referenced Blob bytes. Cyclic values are rejected; repeated noncyclic references are permitted. Standard JSON Schema cannot enforce native Blob identity, that byte calculation, source/port/nonce binding, authorization, transaction completion, or equality of blob/hash/reference content. Those remain runtime checks. Public schemas cover JSON-compatible metadata; they do not specify arbitrary JavaScript values. Send trimmed scoped IDs: the runtime trims before applying length constraints, while standard JSON Schema does not transform input. Date-time checks require a format-aware validator.

The command envelope mirrors Zod input acceptance: extra fields are accepted then stripped, and omitted nullable metadata/default arrays are filled by runtime parsing. The RPC envelope/payload objects are strict. Envelope validity does not validate command-specific domain payload, prove ownership or grant authorization. The HTTP handler checks current server-issued grants, exact account/device/product/tenant/farm/retreat/profile identity, sync.push capability, RBAC, schema and the implemented domain projection.

## Implemented HTTP laboratory

Exact routes are implemented and exercised in `api/tests/t04-api.test.ts`. Login is synthetic and two-step: only successful selected-context login registers an exact session/device grant and returns current authorized `initial_data`. Subsequent commands, pull, image upload/download and audit consult the current server registry and active membership/capabilities; a signed token alone is insufficient. Offline revocation remains bounded by the previously documented device authorization lifetime; server revocation is checked when connected.

`POST /api/v1/commands` returns the existing `CommandApiResponse` wrapper with `COMMITTED`/`aggregate_version`. The ledger stages the existing pure domain projection, version, immutable command, ACK and ordered full-module event before one synchronous commit. Exact retry returns the original ACK unchanged. Reusing command ID or idempotency key with altered content returns409. Retries must preserve the immutable envelope, including attempt metadata. Unsupported aliases without actual reducers return typed422; no invented stock or financial rules are applied.

`GET /api/v1/sync` requires tenant/farm/profile query values equal to the authorized context. Cursors are opaque, bound to account/device/session/server lifetime; invalid/cross-context cursors return400 `INVALID_CURSOR`. The client may retry from null without deleting data. Incremental pull coalesces changes into the latest complete `module-state/bootstrap` snapshots with a monotonically increasing server module revision; deltas are not raw command payloads. This avoids replaying older full states after a newer login seed; the local full-state handler returns at most one delta and `has_more: false`. `data.baseVersions` is authoritative. Local CAS revision is separate and client pending writes defer full-state application and cursor advancement. No generic last-write-wins merge is provided. Initial login state uses the current server projection, including a nonzero snapshot version after earlier accepted commands.

`PUT /api/v1/attachments/{attachment_id}` accepts raw image/jpeg, image/png or image/webp bytes, max20MiB, with `X-Attachment-Size`, `X-Attachment-Sha256` and `X-Attachment-Local-Ref`. It verifies size, hash, MIME and magic signature and rechecks grants after streaming/hash awaits. This is not a full image decoder/content scanner. Exact retries succeed; changed immutable ID metadata fails. `GET` enforces account/module/product/tenant/farm/retreat ACL and returns raw bytes and integrity headers. The optional `attachment_refs` in pull and `initial_data` contains only photos present in the returned full projections. Clients fetch and verify those bytes before atomically persisting state, blobs and cursor. Commands cannot ACK absent or mismatched dependencies.

All grants, projections, command journals, idempotency records, cursors and binary attachments are process-memory laboratory data. Restart loses them and requires new online authorization; this is **not durable server idempotency**. Production authentication, persistent central adapter, real remote endpoints and transactional database storage remain **PROPOSED**. There is no direct SQL/Supabase/PostgREST client. Wildcard CORS and the shared synthetic signing key are laboratory limits, not a production security boundary. No refresh-token service is implemented.

## Independent validation

Run from `next-platform`:

```powershell
bun test qa/suites/q1-public-transport.test.ts --timeout 30000
```

The test requires Python 3 with `jsonschema` (validated locally with 4.26.0). It uses a separate Draft 2020-12 validator with format checking, an offline reference registry and positive/negative fixtures compared to actual Zod acceptance. It also checks enum parity and validates real router responses plus the ledger's real ACK shape. It adds no application runtime dependencies. This focused gate does not replace OpenAPI tooling interoperability checks, browser binary tests, authorization review or independent QA of a final clean SHA.
