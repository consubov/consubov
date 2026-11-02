# PR #76 — CI build provenance, F12-L34 (2026-11-02)

**Scope:** fix PR CI bundle-size instability without raising budget limits, changing offline UX, touching remote Supabase, or deploying. Source checkout: PR #76 HEAD `75c862c3` against `main=0de72602`.

## Failure mechanism and minimal change

The GitHub Actions `pull_request` checkout uses a synthetic merge commit as `HEAD`; its timestamp can change when the workflow is rerun. Previously `apps/web/vite.config.ts` injected `git log -1 --format=%ct HEAD` into emitted application/Service Worker build metadata under `GITHUB_ACTIONS=true`, changing compressed assets for the same reviewed PR commit. A previous GitHub CI run failed `Web bundle regression budget`; the exact failing step was confirmed via the Actions API.

CI PR builds now read `pull_request.head.sha` from the native `GITHUB_EVENT_PATH` and use that commit's timestamp. Invalid or missing PR event data fails closed. Push CI still uses the checked-out HEAD. Outside GitHub Actions, the production PWA build-version policy remains `Date.now()`. No budget limit, minifier, caching or release marker was changed.

## Acceptance and QA

- `node --test scripts/tests/ci-build-timestamp.test.mjs`: PR head source, push HEAD, bad SHA and missing event file; 4/4 PASS in VS Code/VPS.
- `GITHUB_ACTIONS=true GITHUB_EVENT_NAME=pull_request GITHUB_EVENT_PATH=<synthetic-only-event-fixture> bun run check`: local PASS (Web 337 tests PASS; rest of check as logged). Source event refers to known PR SHA; no remote credentials or JWT used.
- Bundle for source SHA `75c862c3`: 338 assets, raw 8,754,451 <= 8,755,066; gzip 2,755,255 <= 2,755,282 (27-byte margin); largest 2,092,192 <= 2,849,003. This does NOT establish a PASS on the next GitHub SHA. Preserve budget unchanged.
- `bun audit --audit-level=high`: EXIT 0, no HIGH vulnerabilities in the reviewed dependency set. `lint:changed`: EXIT 0; pre-existing warning debt remains.
- An earlier experiment replacing additional repeated class strings increased gzip to 2,755,515; it was reverted before this candidate. Do not count it as an optimization.

## Remaining release gates

- GitHub Actions must pass on the **final** PR head after branch update.
- Q4: real equivalent local backend schema/RLS/JWT A/B and offline replay, ACL and RPC review remain NOT proven; prior PostgreSQL 17 synthetic RED/GREEN tests were scoped only to candidate predicates.
- Q5: independent security review/owner F12/L32 signoff absent. PR remains DRAFT / MERGE NO-GO; no remote migration or deploy.

**Rollback:** revert only the build provenance change and CI test gate; do not disable RLS or loosen the bundle budget. Version counter increments solely after an approved merge.
