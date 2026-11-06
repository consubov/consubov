# Laboratory domain projection 0.1.0

Pure projections extracted from the four existing operational stores. This package
does not create a database, session, timer, browser channel, network request or store
instance. It adds no cross-profile business propagation.

The API imports the root entrypoint. `applyModuleCommand(moduleId, state, command)`
validates the existing canonical domain schema and applies the existing mutation to
a clone. Authorization, command-envelope validation, idempotency, aggregate OCC,
attachment verification and atomic persistence remain the API caller's duties.
Unsupported commands and aliases throw `DomainProjectionError`; they never receive
a fake projection. The report request operation still only records its command;
it does not generate a report file.

Browser stores import only their profile subpath. These entrypoints receive the
same typed local inputs as before and share the mutations with the API, while
avoiding imports of other profiles or the monolithic server validation registry.
Each module keeps its existing local transaction, full-state revision CAS,
rollback and fail-closed hydration handling.

The reducer returns the raw state, accepting an existing Escritório wrapper as
input. `toModuleSnapshot(state, moduleId)` produces the wire data, including the
Escritório `{schema, revision, state}` wrapper, an empty outbox and photo metadata
without binary bytes. Photo downloads must commit before a snapshot referencing
them is exposed to Capataz hydration. Local runtime handles and device state are
not authoritative server data.

`getProjectionVersion(state, moduleId, aggregateId)` follows existing ID-based
versions: Capataz defaults to 1, other profiles to 0. The same Capataz pasture ID
shares a version across `cocho` and `pasto` commands. Every accepted mutation
increments `localRevision`; the API must serialize module-state publication and
keep its module revision coherent with the projection. Record IDs that were
formerly generated from the local clock now derive from the immutable command ID,
so client and server create identical reading/count/partition identities.

Unsupported existing allowlist entries without matching mutations include
`pesagem_animal`, Capataz `movimentacao_lote`, Gerente `criar_lote`,
`registrar_batida`, `dar_baixa_ingrediente`, `fabrica.ingrediente.dar_baixa` and
the global administration commands. Their schemas/permissions alone do not supply
missing domain behavior. `SUPPORTED_COMMANDS` is the executable projection list.

Run `bun test packages/domain-projection/test` from the laboratory root. The tests
compare all 21 existing local mutation entrypoints with the API projection,
including refresh hydration, generated IDs, metadata and negative cases. Their
in-memory port is a domain test adapter, not evidence of browser durability.
