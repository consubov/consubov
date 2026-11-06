# @consubov/testing

Utilitários de teste hermético, geradores de dados zootécnicos sintéticos, mocks in-memory de IndexedDB e harnesses locais.

The `FakeApiServer` is a unit-only version/transport-error journal. Its wrapped CommandApiResponse and stable immutable retries mirror transport shape, but it does not authenticate, seed or reduce real domain state. It cannot approve the real API; use actual selected-context HTTP grants and `api/tests/t04-api.test.ts`.
