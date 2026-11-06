import { createHash } from 'node:crypto';
import { appendFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { assertOnlyNextPlatformChanges, canonicalRepository, captureGitBaseline, captureSourceManifest, createOwnedQaDirectory, nextPlatformDir, worktreeDir } from '../harness/workspace-baseline';
import { createProductionHandler } from './serve-production-t03';

// Execution is deliberately explicit: the parent must freeze every source first.
if (!process.argv.includes('--execute-frozen')) {
  console.info('Review this orchestrator, freeze all source/doc edits, then run: bun run qa/scripts/run-f23-final-local.ts --execute-frozen');
  process.exit(0);
}
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const root = nextPlatformDir;
const canonical = canonicalRepository();
const initialGit = captureGitBaseline(worktreeDir);
assertOnlyNextPlatformChanges(initialGit);
const canonicalBefore = captureGitBaseline(canonical);
const sourceBefore = captureSourceManifest();
const run = createOwnedQaDirectory('f23-final', 'runs');
const artifacts = createOwnedQaDirectory('f23-final-artifacts');
const shellRoot = resolve(artifacts.path, 'shell');
const moduleRoot = resolve(artifacts.path, 'modules');
const adminRoot = resolve(artifacts.path, 'admin-candidate');
const labRoot = resolve(artifacts.path, 'admin-lab-control');
const outputLog = resolve(run.path, 'output.log');
writeFileSync(outputLog, '', { flag: 'wx' });
const jobs: any[] = [];
const startedAt = new Date().toISOString();
function log(message: string) { console.info(message); appendFileSync(outputLog, message + '\n'); }
function inventory(directory: string, prefix = ''): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (['node_modules', 'dist', 'dist-candidate', 'dist-lab', '.qa', '.git'].includes(entry.name)) continue;
    const full = resolve(directory, entry.name), name = prefix + entry.name;
    if (entry.isSymbolicLink() || lstatSync(full).isSymbolicLink()) throw new Error(`Inventory refuses link: ${name}`);
    if (entry.isDirectory()) Object.assign(files, inventory(full, name + '/'));
    else files[name] = digest(readFileSync(full));
  }
  return files;
}
function receiptPaths(directory = resolve(root, '.qa/runs')): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Receipt directory contains link');
    if (entry.isDirectory()) result.push(...receiptPaths(full));
    else if (entry.name.endsWith('.json')) result.push(full);
  }
  return result;
}
async function command(id: string, args: string[], options: { cwd?: string; env?: Record<string, string>; expected?: RegExp } = {}) {
  const jobDir = resolve(run.path, id); mkdirSync(jobDir);
  const before = new Set(receiptPaths());
  const started = Date.now();
  log(`[RUN] ${id}`);
  const job: any = { id, command: process.execPath, args, cwd: options.cwd ?? root, startedAt: new Date(started).toISOString(), outputLog: resolve(jobDir, 'output.log'), status: 'FAIL', exitCode: null };
  jobs.push(job);
  try {
    // Async process and concurrent pipe draining keep the in-process HTTP server responsive.
    const child = Bun.spawn([process.execPath, ...args], { cwd: job.cwd, env: { ...process.env, ...options.env }, stdout: 'pipe', stderr: 'pipe' });
    const timer = setTimeout(() => { job.timedOut = true; child.kill(); }, 1_200_000);
    let stdout = '', stderr = '';
    try { [stdout, stderr, job.exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]); }
    finally { clearTimeout(timer); }
    writeFileSync(job.outputLog, `STDOUT\n${stdout}\nSTDERR\n${stderr}`, { flag: 'wx' });
    job.outputSha256 = digest(readFileSync(job.outputLog));
    job.coverageObserved = options.expected ? options.expected.test(stdout + stderr) : true;
    job.status = job.exitCode === 0 && !job.timedOut && job.coverageObserved ? 'PASS' : 'FAIL';
    job.evidencePaths = receiptPaths().filter(path => !before.has(path) && !path.startsWith(run.path));
    const receipts = job.evidencePaths.map((path: string) => ({ path, value: JSON.parse(readFileSync(path, 'utf8')) }));
    if (id === 't05-app-two' && !receipts.some(({ value }: any) => value.pass === true && value.sourceUnchanged === true && value.results?.length === 2 && value.results.every((item: any) => item.pass === true))) job.status = 'FAIL';
    if (id === 'worker-browsers' && !receipts.some(({ value }: any) => value.sha === initialGit.head && value.results?.length === 2 && value.results.every((item: any) => !item.error && item.passed?.length === 20))) job.status = 'FAIL';
    if (id === 'q8-final' && !receipts.some(({ value }: any) => value.localGateVerdict === 'PASS' && value.sourceUnchanged === true)) job.status = 'FAIL';
    if (id === 'legacy-health' && !receipts.some(({ value }: any) => value.status === 'PASS' && value.results?.length === 10 && value.results.every((item: any) => item.status === 'PASS'))) job.status = 'FAIL';
    if (id === 't07-devices-24') {
      const audit = receipts.find(({ value }: any) => Array.isArray(value.cases))?.value;
      const functional = audit?.sourceUnchanged === true && audit.cases.length === 24 && audit.cases.every((item: any) => item.execution === 'PASS' && item.errors?.status === 'PASS' && item.authentication?.status === 'PASS' && item.keyboard?.shell?.status === 'PASS' && item.keyboard?.module?.status === 'PASS');
      const axe = (audit?.cases ?? []).flatMap((item: any) => [...Object.values(item.axe ?? {}), ...(item.tabs ?? []).map((tab: any) => tab.axe).filter(Boolean)]) as any[];
      const expectedAxeCount = (audit?.cases ?? []).reduce((count: number, item: any) => count + 2 + (item.tabs?.length ?? 0), 0);
      const serious = axe.some(item => item.violations?.some((violation: any) => ['serious', 'critical'].includes(violation.impact)));
      const domFindings = (audit?.cases ?? []).flatMap((item: any) => [item.shell, item.module, ...(item.tabs ?? []).map((tab: any) => tab.audit)].filter(Boolean).flatMap((dom: any) => ['horizontalOverflow', 'accessibleNames', 'imageAlt', 'iframeTitles', 'duplicateIds'].filter(key => dom[key]?.status === 'FAIL').map(key => ({ engine: item.engine, device: item.device.name, profile: item.profile, criterion: key }))));
      job.expectedAxeCount = expectedAxeCount;
      job.observedAxeCount = axe.length;
      job.accessibilityVerdict = axe.some(item => item.status === 'FAIL') || domFindings.length ? 'FAIL' : !expectedAxeCount || axe.length !== expectedAxeCount || axe.some(item => item.status !== 'PASS') ? 'NAO_EXECUTADO' : 'PASS_SCOPED_AUTOMATED';
      job.domFindings = domFindings;
      job.touchGeometry = 'Raw 24px/44px observations only; spacing exceptions and physical device accessibility unverified';
      job.functionalControlsPass = functional;
      job.seriousAxeViolations = serious;
      if (!functional || serious || job.accessibilityVerdict === 'FAIL') job.status = 'FAIL';
    }
    if (id === 'portable') {
      const portable = resolve(root, '.qa/portable-contract-result.json');
      const value = JSON.parse(readFileSync(portable, 'utf8'));
      const copy = resolve(jobDir, 'portable-contract-result.json');
      writeFileSync(copy, JSON.stringify(value, null, 2));
      job.evidencePaths.push(copy);
      if (value.status !== 'PASS' || value.results?.length !== 4) job.status = 'FAIL';
    }
  } catch (error) { job.error = String(error); if (!job.outputSha256) writeFileSync(job.outputLog, job.error); }
  job.durationMs = Date.now() - started;
  writeFileSync(resolve(jobDir, 'result.json'), JSON.stringify(job, null, 2));
  log(`[${job.status}] ${id} exit=${job.exitCode} (${job.durationMs}ms)`);
  return job.status === 'PASS';
}
async function served(id: string, script: string, expected: RegExp) {
  // Each call constructs a new router AND a new ledger; no shared browser origin or live QA server.
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: createProductionHandler({ shellRoot, moduleRoot }) });
  try {
    return await command(id, ['run', script], { env: { T03_PORT: String(server.port), T04_PORT: String(server.port), T03_BROWSER: '', T03_PROFILE: '', T07_ORIGIN: `http://127.0.0.1:${server.port}`, T07_SHELL_ROOT: shellRoot, T07_MODULE_ROOT: moduleRoot }, expected });
  } finally { server.stop(true); }
}
function reuseT06() {
  const path = resolve(root, process.env.CONSUBOV_T06_RECEIPT ?? '.qa/runs/t06-admin-2026-11-06T00-35-04.848Z-19864/result.json');
  const result: any = { id: 't06-scoped-reuse', evidencePath: path, status: 'INVALIDATED', productionApproval: false };
  jobs.push(result);
  try {
    const receipt = JSON.parse(readFileSync(path, 'utf8'));
    const current: Record<string, unknown> = {};
    for (const target of ['apps/admin-global', 'apps/fazenda/shell', 'apps/fazenda/capataz', 'apps/fazenda/gerente', 'apps/fazenda/escritorio', 'apps/fazenda/fabrica', 'packages', 'api']) current[target] = inventory(resolve(root, target));
    for (const target of ['qa/scripts/t06-admin-pwa-e2e.ts', 'qa/scripts/persistent-profile-path.mjs', 'qa/scripts/serve-production-t03.ts']) current[target] = digest(readFileSync(resolve(root, target)));
    result.receiptSha256 = digest(readFileSync(path));
    result.currentScope = current;
    result.scopeMatches = JSON.stringify(current) === JSON.stringify(receipt.initialSources) && JSON.stringify(current) === JSON.stringify(receipt.finalSources);
    if (receipt.status === 'PASS_LOCAL_CONTROLS_ONLY' && receipt.sourceUnchanged === true && result.scopeMatches) result.status = 'PASS_REUSED_EXACT_SCOPE';
    else result.reason = 'Prior receipt failed or complete recorded T06 source inventory differs; no acceptance/re-run inferred.';
  } catch (error) { result.reason = String(error); }
  log(`[${result.status}] t06-scoped-reuse`);
}
async function adminBuild(mode: 'candidate' | 'lab', outDir: string) {
  const graphPath = resolve(artifacts.path, `admin-${mode}-graph.json`);
  const code = `import { build } from 'vite'; import { writeFileSync } from 'node:fs'; const graph=[]; await build({mode:${JSON.stringify(mode)},build:{outDir:${JSON.stringify(outDir)},emptyOutDir:false},plugins:[{name:'f23-record-actual-graph',generateBundle(_options,bundle){for(const chunk of Object.values(bundle))if(chunk.type==='chunk')graph.push(...Object.keys(chunk.modules));}}]});writeFileSync(${JSON.stringify(graphPath)},JSON.stringify([...new Set(graph)].sort()));`;
  return command(`build-admin-${mode}`, ['-e', code], { cwd: resolve(root, 'apps/admin-global'), env: { CONSUBOV_ADM_ORIGIN: 'http://127.0.0.1:5174', CONSUBOV_ADM_VERSION: 'f23-final-local' } });
}
function scanArtifacts() {
  const authFixture = readFileSync(resolve(root, 'packages/auth-client/src/fixtures/synthetic-users.ts'), 'utf8');
  const jwtFixture = readFileSync(resolve(root, 'packages/auth-client/src/jwt/synthetic-jwt.ts'), 'utf8');
  const adminFixture = readFileSync(resolve(root, 'apps/admin-global/src/store/adminStore.ts'), 'utf8');
  const password = /LAB_DEFAULT_PASSWORD\s*=\s*'([^']+)'/.exec(authFixture)?.[1];
  const signingSecret = /SYNTHETIC_JWT_SECRET_LAB\s*=\s*'([^']+)'/.exec(jwtFixture)?.[1];
  if (!password || !signingSecret) throw new Error('Exact synthetic secret marker extraction failed');
  const emails = [...new Set([...[...authFixture.matchAll(/email:\s*'([^']+)'/g)].map(match => match[1]!), ...[...adminFixture.matchAll(/email:\s*'([^']+\.lab@[^']+)'/g)].map(match => match[1]!)])];
  const markers = [{ id: 'synthetic-password', value: password }, { id: 'synthetic-signing-secret', value: signingSecret }, ...emails.map((value, index) => ({ id: `fixture-email-${index + 1}`, value }))];
  const admMarkers = ['LAB_MFA_CODE', 'SYNTHETIC_ADMIN_USERS', 'SYNTHETIC_JWT_SECRET_LAB', 'super_admin', 'support_admin', 'financial_admin'].map((value, index) => ({ id: `adm-legacy-${index + 1}`, value }));
  const targets = [{ id: 'shell', path: shellRoot }, ...['capataz', 'gerente', 'escritorio', 'fabrica'].map(id => ({ id, path: resolve(moduleRoot, id) })), { id: 'admin-candidate', path: adminRoot }, { id: 'admin-lab-control', path: labRoot }];
  const findings: any[] = [], inventories: Record<string, unknown> = {};
  for (const target of targets) {
    const files = inventory(target.path);
    if (!Object.keys(files).length) throw new Error(`Empty emitted target: ${target.id}`);
    inventories[target.id] = Object.entries(files).map(([path, sha256]) => {
      const bytes = readFileSync(resolve(target.path, path));
      for (const marker of [...markers, ...(target.id.startsWith('admin-') ? admMarkers : [])]) {
        const needle = Buffer.from(marker.value); let count = 0, offset = 0;
        while ((offset = bytes.indexOf(needle, offset)) !== -1) { count++; offset += needle.length; }
        if (count) findings.push({ target: target.id, path, markerId: marker.id, count });
      }
      return { path, sha256, bytes: bytes.length, sourceMap: path.endsWith('.map') };
    });
  }
  const graphPattern = /(?:\/auth\/|\/store\/adminStore|\/App\.tsx|packages\/auth-client|packages\/contracts\/src\/index)/;
  const graph = (mode: string) => (JSON.parse(readFileSync(resolve(artifacts.path, `admin-${mode}-graph.json`), 'utf8')) as string[]).filter(path => graphPattern.test(path.replaceAll('\\', '/'))).map(path => path.replace(root, '<workspace>'));
  const candidateForbiddenGraph = graph('candidate'), labForbiddenGraph = graph('lab');
  const positiveControl = findings.some(item => item.target === 'admin-lab-control' && ['synthetic-password', 'synthetic-signing-secret'].includes(item.markerId)) && labForbiddenGraph.length > 0;
  const pass = findings.every(item => item.target === 'admin-lab-control') && candidateForbiddenGraph.length === 0 && positiveControl;
  const receipt = { id: 'six-target-secret-scan', status: pass ? 'PASS' : 'FAIL', policy: 'Exact fixture values and symbols; no generic domain/MFA/password pattern. Every emitted file including maps/JSON/HTML/immutable snapshots scanned by bytes.', inventories, findings, candidateForbiddenGraph, labForbiddenGraph, positiveControl, excludedTarget: { id: 'admin-lab-control', reason: 'Explicit mode lab; positive control only; never publishable' } };
  writeFileSync(resolve(run.path, 'secret-scan.json'), JSON.stringify(receipt, null, 2));
  jobs.push({ id: receipt.id, status: receipt.status, evidencePath: resolve(run.path, 'secret-scan.json') });
  log(`[${receipt.status}] six-target-secret-scan`);
  if (!pass) throw new Error('Emitted artifact secret scan or ADM graph/control failed; stop before broad tests.');
}
let failure: string | null = null;
let frozenArtifactsBefore: unknown = null, frozenArtifactsAfter: unknown = null;
try {
  log(`F23 final local matrix ${run.path}; HEAD=${initialGit.head}; dirty=${initialGit.dirty}; source=${sourceBefore.sha256}`);
  const modulesBuilt = await command('build-four-modules', ['run', 'apps/fazenda/shell/scripts/build-module-artifacts.ts'], { env: { CONSUBOV_MODULE_OUTPUT_ROOT: moduleRoot } });
  const shellBuilt = await command('build-shell', ['run', 'vite', 'build', '--outDir', shellRoot], { cwd: resolve(root, 'apps/fazenda/shell') });
  const adminBuilt = await adminBuild('candidate', adminRoot);
  const labBuilt = await adminBuild('lab', labRoot);
  if (!modulesBuilt || !shellBuilt || !adminBuilt || !labBuilt) throw new Error('Frozen production artifact build failed; browser matrix cannot proceed.');
  scanArtifacts();
  frozenArtifactsBefore = { shell: inventory(shellRoot), modules: inventory(moduleRoot), admin: inventory(adminRoot) };
  writeFileSync(resolve(run.path, 'artifact-inventory.json'), JSON.stringify(frozenArtifactsBefore, null, 2));
  if (!await served('t07-devices-24', 'qa/scripts/t07-device-audit.ts', /./)) throw new Error('Early devices audit failed actual functional/error/keyboard or observed accessibility controls; stop broad matrix pending correction.');
  await command('q8-final', ['run', 'qa/scripts/run-q8-gate.ts'], { expected: /Local checks=PASS/ });
  await command('native-runtime', ['test', 'packages/domain-projection/test', 'apps/admin-global/src/secure/admin-service.test.ts', 'packages/auth-client/test/anti-first-match.test.ts', 'packages/auth-client/test/jwt-engine.test.ts', 'packages/auth-client/test/local-auth-service.test.ts', 'packages/auth-client/test/provisioned-auth-service.test.ts', 'packages/auth-client/test/session-manager.test.ts', 'apps/fazenda/shell/src/auth', 'apps/fazenda/shell/src/pwa/QuiescentLocalData.test.ts', 'apps/fazenda/shell/src/pwa/activationBarrier.test.ts', 'apps/fazenda/shell/src/sync', '--timeout', '90000'], { expected: /\b[1-9]\d* pass\b/ });
  for (const [id, flag] of [['indexeddb', ''], ['stores-views', '--stores'], ['auth-storage', '--auth']]) await command(id!, ['run', 'packages/local-data/test/run-in-browsers.ts', ...(flag ? [flag] : [])], { expected: /passed, 0 failed/ });
  await command('worker-native', ['test', 'packages/module-release/test/worker-generations.test.ts', '--timeout', '90000'], { expected: /\b16 pass\b/ });
  await command('worker-browsers', ['run', 'packages/module-release/test/run-worker-generations-in-browsers.ts'], { env: { SOURCE_SHA: initialGit.head, SOURCE_MANIFEST_SHA256: sourceBefore.sha256 }, expected: /checks passed/ });
  await command('portable', ['run', 'packages/local-data/test/run-portable-module.ts'], { expected: /checks PASS/ });
  await command('legacy-health', ['run', 'packages/local-data/test/run-legacy-module-health.ts'], { env: { LEGACY_HEALTH_ONLY_INSTALLED: '0' }, expected: /Evidence:/ });
  await served('t03-cold-eight', 'qa/scripts/t03-cold-offline-e2e.mjs', /verified: 8 cases/);
  await served('t03-shared-two', 'qa/scripts/t03-shared-device-e2e.mjs', /verified: 2 browsers/);
  await served('t03-rpc-two', 'qa/scripts/t03-rpc-stale-recovery-e2e.mjs', /2\/2 PASS/);
  await served('t04-photo-sync-two', 'qa/scripts/t04-silent-sync-e2e.mjs', /2\/2 PASS/);
  // This existing test intentionally builds and updates its own isolated releases.
  await command('t05-app-two', ['run', 'qa/scripts/t05-app-integration.ts']);
  reuseT06();
  frozenArtifactsAfter = { shell: inventory(shellRoot), modules: inventory(moduleRoot), admin: inventory(adminRoot) };
} catch (error) { failure = String(error); log(`[ERROR] ${failure}`); }
finally {
  if (frozenArtifactsBefore !== null) frozenArtifactsAfter = { shell: inventory(shellRoot), modules: inventory(moduleRoot), admin: inventory(adminRoot) };
  const finalGit = captureGitBaseline(worktreeDir), canonicalAfter = captureGitBaseline(canonical), sourceAfter = captureSourceManifest();
  const sourceUnchanged = initialGit.head === finalGit.head && sourceBefore.sha256 === sourceAfter.sha256;
  const canonicalPreserved = JSON.stringify(canonicalBefore) === JSON.stringify(canonicalAfter);
  const refsAndStashesPreserved = initialGit.refsSha256 === finalGit.refsSha256 && initialGit.stashSha256 === finalGit.stashSha256;
  const frozenArtifactsUnchanged = frozenArtifactsBefore !== null && frozenArtifactsAfter !== null && JSON.stringify(frozenArtifactsBefore) === JSON.stringify(frozenArtifactsAfter);
  const requiredIds = ['build-four-modules', 'build-shell', 'build-admin-candidate', 'build-admin-lab', 'six-target-secret-scan', 'q8-final', 'native-runtime', 'indexeddb', 'stores-views', 'auth-storage', 'worker-native', 'worker-browsers', 'portable', 'legacy-health', 't03-cold-eight', 't03-shared-two', 't03-rpc-two', 't04-photo-sync-two', 't05-app-two', 't07-devices-24', 't06-scoped-reuse'];
  const accessibilityVerdict = jobs.find(job => job.id === 't07-devices-24')?.accessibilityVerdict ?? 'NAO_EXECUTADO';
  const localPass = !failure && sourceUnchanged && canonicalPreserved && refsAndStashesPreserved && frozenArtifactsUnchanged && accessibilityVerdict !== 'FAIL' && requiredIds.every(id => jobs.some(job => job.id === id && ['PASS', 'PASS_REUSED_EXACT_SCOPE'].includes(job.status)));
  const report = { runId: relative(resolve(root, '.qa/runs'), run.path), startedAt, finishedAt: new Date().toISOString(), initialCommit: initialGit.head, finalCommit: finalGit.head,
    dirty: initialGit.dirty, finalDirty: finalGit.dirty, sourceRevision: 'Actual dirty/untracked source bytes, not acceptance of HEAD alone', sourceUnchanged,
    sourceBefore, sourceAfter, initialGit, finalGit, canonicalBefore, canonicalAfter, canonicalPreserved, refsAndStashesPreserved,
    frozenArtifactsUnchanged, artifactRoot: artifacts.path, exclusions: sourceBefore.exclusions, jobs, failure,
    accessibilityVerdict, hardware: 'NAO_EXECUTADO', independentQA: 'NAO_EXECUTADO', localGateVerdict: localPass ? 'PASS' : 'FAIL', overallVerdict: 'HOMOLOGACAO_REAL_PENDENTE', productionApproval: false, production: 'NO_GO' };
  writeFileSync(resolve(run.path, 'result.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  log(`Local=${report.localGateVerdict}; overall=${report.overallVerdict}; production=NO_GO; receipt=${resolve(run.path, 'result.json')}`);
  // Preserve owned artifacts as inspectable evidence; no output/source cleanup mutation.
  process.exitCode = localPass ? 0 : 1;
}
