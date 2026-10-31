# F23 — Release isolation by product (first stage)

Status: candidate, not deployed. Date: 2026-10-31. Scope: four existing Vercel projects, source `consubov/consubov`.

## Context

CONSUBOV and Relatto currently compile from one `apps/web` workspace. The four Vercel projects listen to the same Git repository and `main`. The latest merge of PR #131 triggered production builds of both brands. Moreover, CONSUBOV App currently ignores *every* `main` build to avoid INC-012 downgrade from 2.0.0 to legacy 1.155.0.

## Controlled release gate

A release marker `releases/<project>.json` exists for each project: `consubov-app`, `consubov-site`, `relatto-app`, `relatto-site`. Initial marker revision `0` is **only a baseline**, not a published release or SemVer. Sites never receive SemVer. `relatto-app` does **not** have a verified independent SemVer yet.

`node scripts/deploy/release-gate.mjs <project>` decides whether to build for the Vercel Ignored Build Step (exit **0 = skip**, **1 = build**). Run it with the correct relative path from the Vercel Root Directory. On production/main, a release is eligible **only** when that project's revision is incremented exactly by 1 compared to the last successful deployment SHA when reachable, or `HEAD^` as a local fallback. Missing/unverifiable baselines, malformed manifests, revision jumps or unknown deployment context fail **closed** (skip). On preview branches, the test build remains allowed. **A release revision is not a replacement for release approval or QA.** A batch push with unavailable previous SHA may require a controlled manual release; never disable the guard by accident.

For `consubov-app`, the code's literal `APP_VERSION` must match the candidate `appVersion` in the release marker, increase monotonically, and never be lower than 2.0.0. This explicitly preserves the INC-012 anti-downgrade invariant. A release to production still requires CI/QA, authorization, preview, exact SHA, successful deployment and alias verification, including offline/PWA tests. A version reserved in Obsidian is **not** a version installed on a device.

## Constraints and transition

1. The first merge containing the four revision-zero markers must **not trigger a production rollout**. Test the guard in isolation; preserve current Vercel settings until a verified, rollback-ready configuration change is authorized.
2. Because all four products currently share `apps/web`, the release gate isolates **deployment decisions**, not the compiled code. Relatto may still contain unused Consubov routes in a later build. The remaining F23 work is to split product entrypoints/workspaces, source ownership and shared dependencies, followed by Root Directory and Vercel's affected-project skipping per product.
3. No changes to `APP_VERSION`, Service Workers, manifests, IndexedDB, Supabase/RLS, APIs, secrets, existing deployment aliases, domains or production builds are part of this first stage.
4. For a deliberate release, change only the target product marker after product-specific QA and authorization. Shared code changes require an explicit consumer impact matrix and independent approvals for each affected application. Do not infer authorization from a Git merge alone.

## Verification / rollback

Local test: `node --test scripts/tests/release-gate.test.mjs`. CI workflow: `.github/workflows/f23-release-isolation.yml`. Confirm positive (requested app releases), negative (other products skipped) and downgrade/invalid-history cases. Once the Vercel settings are changed under separate authorization, log old and new `commandForIgnoringBuildStep`, use preview and verify outcome. To revert the guard, restore the prior project setting and observe the deployment behavior; never reset PWA storage to roll back a deploy.
