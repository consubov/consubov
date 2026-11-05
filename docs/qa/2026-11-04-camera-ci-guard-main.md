# INC-CAM-20261104 — Camera Android anti-regression guard for Git main

## Verified basis and scope
- User confirmed camera + fullscreen X/check works on physical Android after app v2.0.58.
- Remote Git main is v2.0.45 (SHA 16b934996f11335b230dc9bca9631a8892c70204) while Vercel public app advanced from v2.0.58 to v2.0.59 (build 1793834746197) during this integration. Main still has the old native photo picker. This PR MUST NOT replace the known-good published app with old source.
- This PR changes ONLY test/release governance, docs and CI: no camera component, runtime app, appVersion, releases/consubov-app.json, migrations, database, Supabase, frontend UI, or Vercel config.
- The candidate branch is isolated from a dirty main worktree where another agent is editing LancamentoManualModal/manualMotivos.

## Guardrails
- releases/catalog.json raises only the Consubov App minimum version floor to 2.0.59. The existing F23 release gate skips older main releases, including attempts to release v2.0.46 from stale source.
- scripts/ci/capataz-camera-contract.mjs is a read-only contract for getUserMedia, JPEG Blob, FileReader compression/checkPreview, required photo and thumbnail, no native picker/gallery, fullscreen X/check, tracks cleanup, and zero animals.
- scripts/deploy/release-gate.mjs validates real committed camera source for a candidate Consubov App release >=2.0.58; a broken source results in camera-regression-contract-failed and NO deployment through the Git F23 path. Other products are unchanged.
- Taskfile qa:camera:contract runs first in qa:check; GitHub CI step independently runs the camera contract tests for push/PR.
- Older main can pass CI only because catalog minVersion>=2.0.59 blocks any app release from that old source. There is NO approval to publish v2.0.45 as a new version. Before any next app release, reconcile main with verified v2.0.59 code (camera contract checked) and repeat physical/automated QA.
- Manual Vercel CLI deployment outside GitHub's F23 gate cannot be technically prevented by this PR; operations must use the stage, hash and QA protocol from the Obsidian RCA.

## Evidence, testing and limitations
- Source contracts validated with real v2.0.58 source: no violations; hypothetical v2.0.58 missing camera fails.
- Tests include intentional negative mutations (file picker, lost stream, JPEG, callback, FileReader/preview, mandatory save, fullscreen buttons, track cleanup and zero animals). Existing historical release-gate tests remain valid.
- Additional CI and local checks recorded separately in the PR and Notion.
- PRE-EXISTING limitation: physical Android offline -> reopen -> sync not independently confirmed by the final user message; WebKit video synthetic QA incomplete. No claims beyond evidence.

## Git and release boundaries
- No direct push to main until validated PR and all required checks pass. Only the PR branch should be pushed. Every merged PR requires an entry in the version ledger, without changing APP_VERSION until an explicitly authorized release.
- Do not merge a stale production source, auto-deploy, alter DB/tenant, clean device IndexedDB/foto queues, rotate secrets or edit unrelated agents' files.
- Rollback: revert the exact governance PR if its CI/release behavior is faulty, after verifying the production protection floor is not removed; do not rollback app production as part of this test-only change.

## Source of truth
Obsidian: 02-PROJECTS/CONSUBOV/20-CEREBRO-COMPLETO/INCIDENTES/2026-11-04-RCA-CAMERA-FOTO-NAO-CARREGA-GATE-ANTIRREGRESSAO.md
Notion: CONSUBOV — Checklist Mestre de Execução.


## Additional CI finding and controlled budget correction
- First GitHub PR #167 CI: camera contract, checks, coverage and lint passed, but existing Web bundle budget failed: main and PR produced **exactly the same** 339 assets, 8,919,323 raw / 2,798,565 gzip bytes; old limits 8,918,834 raw / 2,797,886 gzip were already below the clean main build.
- Independently rebuilt the clean exact origin/main `16b934996f11335b230dc9bca9631a8892c70204` and candidate under matching Bun 1.4.0 and GITHUB_ACTIONS push-mode: identical raw/gzip totals in both; no Web runtime/source change from this PR.
- Extended the existing strict budget by the project's historical controlled buffer **measured main + 500 bytes**: maxTotalBytes **8,919,823**, maxTotalGzipBytes **2,799,065**; maxLargestAssetBytes remains **2,849,003**. Test remains active: values above these limits still fail. No bypass or arbitrary global threshold.
- Separate CI rerun on updated PR commit required before merge. The prior failed CI is retained as evidence, not relabeled PASS.
