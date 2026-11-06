import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertOnlyNextPlatformChanges, canonicalRepository, captureGitBaseline, captureSourceManifest, createOwnedQaDirectory, nextPlatformDir, worktreeDir } from '../harness/workspace-baseline';
import { createProductionHandler } from './serve-production-t03';

if (!process.argv.includes('--execute-frozen')) {
  console.info('Freeze the six explicitly allowed test/runner edits, then bun run qa/scripts/recheck-f23-final-fixtures.ts --execute-frozen');
  process.exit(0);
}
const root = nextPlatformDir, hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const previousPath = resolve(root, '.qa/runs/f23-final-WqkvBC/result.json');
const previous = JSON.parse(readFileSync(previousPath, 'utf8'));
const resumeFlag = process.argv.indexOf('--resume-recheck');
if (resumeFlag !== -1 && (!process.argv[resumeFlag + 1] || process.argv[resumeFlag + 1]!.startsWith('--'))) throw new Error('--resume-recheck requires a receipt path');
const resumePath = resumeFlag === -1 ? null : resolve(root, process.argv[resumeFlag + 1]!);
const rpcReuseFlag = process.argv.indexOf('--reuse-rpc-recheck');
if (rpcReuseFlag !== -1 && (!process.argv[rpcReuseFlag + 1] || process.argv[rpcReuseFlag + 1]!.startsWith('--'))) throw new Error('--reuse-rpc-recheck requires a receipt path');
const rpcReusePath = rpcReuseFlag === -1 ? null : resolve(root, process.argv[rpcReuseFlag + 1]!);
if (rpcReusePath && !resumePath) throw new Error('RPC reuse requires the established unit resume receipt');
if (rpcReusePath && rpcReusePath !== resolve(root, '.qa/runs/f23-fixture-recheck-P7RUTp/result.json')) throw new Error('Only the established P7RUTp RPC receipt is accepted');
if (resumePath && resumePath !== resolve(root, '.qa/runs/f23-fixture-recheck-KGlkwh/result.json')) throw new Error('Only the established KGlkwh unit receipt is accepted');
const allowedChanges = new Set(['qa/suites/q7-sw-module-provisioning.test.ts', 'packages/auth-client/test/anti-first-match.test.ts', 'qa/scripts/t03-shared-device-e2e.mjs', 'qa/scripts/t03-rpc-stale-recovery-e2e.mjs', 'qa/scripts/run-f23-final-local.ts', 'qa/scripts/recheck-f23-final-fixtures.ts']);
const run = createOwnedQaDirectory('f23-fixture-recheck', 'runs');
const logPath = resolve(run.path, 'output.log'); writeFileSync(logPath, '', { flag: 'wx' });
const log = (message: string) => { console.info(message); appendFileSync(logPath, message + '\n'); };
const canonical = canonicalRepository(), initialGit = captureGitBaseline(worktreeDir), canonicalBefore = captureGitBaseline(canonical), sourceBefore = captureSourceManifest();
const startedAt = new Date().toISOString(), jobs: any[] = [];
const artifactRoot = resolve(previous.artifactRoot), shellRoot = resolve(artifactRoot, 'shell'), moduleRoot = resolve(artifactRoot, 'modules');
let failure: string | null = null, validatedChangedPaths: string[] = [], artifactProof: unknown = null, t06Proof: unknown = null, supplementProof: unknown = null, resumeProof: unknown = null, rpcReuseProof: unknown = null;
function inventory(directory: string, prefix = ''): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (['node_modules', 'dist', 'dist-candidate', 'dist-lab', '.qa', '.git'].includes(entry.name)) continue;
    const full = resolve(directory, entry.name), name = prefix + entry.name;
    assert(!entry.isSymbolicLink() && !lstatSync(full).isSymbolicLink(), 'Inventory refuses linked descendants');
    if (entry.isDirectory()) Object.assign(files, inventory(full, name + '/'));
    else files[name] = hash(readFileSync(full));
  }
  return files;
}
function differences(a: Record<string, string>, b: Record<string, string>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter(path => a[path] !== b[path]);
}
function receipts(directory = resolve(root, '.qa/runs')): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    assert(!entry.isSymbolicLink(), 'Receipt symlink refused');
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? receipts(path) : entry.name.endsWith('.json') ? [path] : [];
  });
}
function validateArtifacts() {
  const path = resolve(root, '.qa/runs/f23-final-WqkvBC/artifact-inventory.json'), recorded = JSON.parse(readFileSync(path, 'utf8'));
  const actual = { shell: inventory(shellRoot), modules: inventory(moduleRoot), admin: inventory(resolve(artifactRoot, 'admin-candidate')) };
  assert.deepEqual(actual, recorded, 'Retained production artifacts differ from exact recorded six-target inventory');
  const scanPath = resolve(root, '.qa/runs/f23-final-WqkvBC/secret-scan.json'), scan = JSON.parse(readFileSync(scanPath, 'utf8'));
  assert.equal(scan.status, 'PASS'); assert.equal(scan.positiveControl, true);
  const targets: Record<string, string> = { shell: shellRoot, 'admin-candidate': resolve(artifactRoot, 'admin-candidate'), 'admin-lab-control': resolve(artifactRoot, 'admin-lab-control') };
  for (const id of ['capataz', 'gerente', 'escritorio', 'fabrica']) targets[id] = resolve(moduleRoot, id);
  for (const [target, directory] of Object.entries(targets)) {
    const saved = scan.inventories[target]; assert(Array.isArray(saved) && saved.length, 'Missing exact emitted secret-scan inventory');
    const expected = Object.fromEntries(saved.map((file: any) => [file.path, file.sha256]));
    assert.deepEqual(inventory(directory), expected, `Secret-scanned output bytes changed: ${target}`);
    for (const file of saved) assert.equal(readFileSync(resolve(directory, file.path)).length, file.bytes);
  }
  return { artifactRoot, inventoryPath: path, inventorySha256: hash(readFileSync(path)), scanPath, scanSha256: hash(readFileSync(scanPath)), verifiedTargets: Object.keys(targets), fullArtifactRootSha256: hash(JSON.stringify(inventory(artifactRoot))) };
}
function validateT06() {
  const oldJob = previous.jobs.find((job: any) => job.id === 't06-scoped-reuse');
  assert.equal(oldJob?.status, 'PASS_REUSED_EXACT_SCOPE');
  const path = oldJob.evidencePath, receipt = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(hash(readFileSync(path)), oldJob.receiptSha256, 'Original T06 receipt bytes changed');
  assert.equal(receipt.status, 'PASS_LOCAL_CONTROLS_ONLY'); assert.equal(receipt.sourceUnchanged, true);
  assert.deepEqual(receipt.initialSources, receipt.finalSources);
  const current: Record<string, unknown> = {}, mismatches: string[] = [];
  for (const [target, recorded] of Object.entries(receipt.finalSources)) {
    current[target] = typeof recorded === 'string' ? hash(readFileSync(resolve(root, target))) : inventory(resolve(root, target));
    if (typeof recorded === 'string') { if (current[target] !== recorded) mismatches.push(target); }
    else mismatches.push(...differences(recorded as Record<string, string>, current[target] as Record<string, string>).map(path => `${target}/${path}`));
  }
  const allowed = 'packages/auth-client/test/anti-first-match.test.ts';
  assert(mismatches.every(path => path === allowed), `T06 runtime/own harness invalidated: ${mismatches.join(', ')}`);
  return { path, sha256: hash(readFileSync(path)), fullRecordedScope: receipt.finalSources, fullCurrentScope: current, mismatches,
    exactIrrelevantTestExclusion: allowed, exclusionReason: 'Standalone selector unit fixture only; T06 browser runner and every runtime/compiler/config/lock byte remain unchanged, retained six-target emitted files independently verified.', runtimeAndOwnHarnessUnchanged: true, status: 'PASS_REUSED_UNCHANGED_RUNTIME_AND_T06_HARNESS' };
}
function validateSupplement() {
  const path = resolve(root, '.qa/runs/t07-visible-contrast-5TsDwe/result.json'), receipt = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(receipt.sourceUnchanged, true); assert.equal(receipt.artifactsUnchanged, true);
  assert.deepEqual(receipt.before.source, receipt.after.source);
  assert.deepEqual(receipt.before.source, previous.sourceAfter);
  assert.deepEqual(receipt.before.artifacts, receipt.after.artifacts);
  assert.deepEqual(inventory(artifactRoot), receipt.before.artifacts);
  assert.equal(receipt.cases.length, 2);
  assert(receipt.cases.every((item: any) => item.status === 'PASS' && item.axe?.violations?.length === 0 && item.axe?.incomplete?.length === 0));
  return { path, sha256: hash(readFileSync(path)), status: 'PASS_REUSED_EXACT_RUNTIME_ARTIFACT_SCOPE', caseCount: 2, scope: receipt.scope, sourceManifestSha256: receipt.before.source.sha256 };
}
async function command(id: string, args: string[], env: Record<string, string> = {}, expected = /\b[1-9]\d* pass\b/) {
  const directory = resolve(run.path, id); mkdirSync(directory);
  const before = new Set(receipts()), started = Date.now();
  const job: any = { id, status: 'FAIL', command: process.execPath, args, cwd: root, processOnlyConfig: env, outputLog: resolve(directory, 'output.log'), exitCode: null };
  jobs.push(job); log(`[RUN] ${id}`);
  try {
    const child = Bun.spawn([process.execPath, ...args], { cwd: root, env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' });
    const timer = setTimeout(() => { job.timedOut = true; child.kill(); }, 1_200_000);
    let stdout = '', stderr = '';
    try { [stdout, stderr, job.exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]); }
    finally { clearTimeout(timer); }
    writeFileSync(job.outputLog, `STDOUT\n${stdout}\nSTDERR\n${stderr}`);
    job.coverageObserved = expected.test(stdout + stderr); job.outputSha256 = hash(readFileSync(job.outputLog));
    job.evidencePaths = receipts().filter(path => !before.has(path) && !path.startsWith(run.path));
    const values = job.evidencePaths.map((path: string) => JSON.parse(readFileSync(path, 'utf8')));
    const receiptValid = id === 'q8-final' ? values.some((value: any) => value.localGateVerdict === 'PASS' && value.sourceUnchanged === true)
      : id.startsWith('t03-') ? values.some((value: any) => !value.error && value.results?.length === 2) : true;
    job.status = job.exitCode === 0 && !job.timedOut && job.coverageObserved && receiptValid ? 'PASS' : 'FAIL';
  } catch (error) { job.error = String(error); if (!job.outputSha256) writeFileSync(job.outputLog, job.error); }
  job.durationMs = Date.now() - started; writeFileSync(resolve(directory, 'result.json'), JSON.stringify(job, null, 2));
  log(`[${job.status}] ${id} exit=${job.exitCode} (${job.durationMs}ms)`);
}
async function served(id: string, script: string, expected: RegExp) {
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: createProductionHandler({ shellRoot, moduleRoot }) });
  try { await command(id, ['run', script], { T03_PORT: String(server.port), T03_BROWSER: '', T03_PROFILE: '' }, expected); }
  finally { server.stop(true); }
}
const reused: any[] = [];
const rerunIds = new Set(['q8-final', 'native-runtime', 'worker-native', 't03-shared-two', 't03-rpc-two']);
const freshIds = rpcReusePath ? new Set(['t03-shared-two']) : resumePath ? new Set(['t03-shared-two', 't03-rpc-two']) : rerunIds;
function validateResume() {
  assert(resumePath);
  const receipt = JSON.parse(readFileSync(resumePath, 'utf8'));
  for (const flag of ['sourceUnchanged', 'canonicalPreserved', 'refsAndStashesPreserved', 'frozenArtifactsUnchanged']) assert.equal(receipt[flag], true, `Resume receipt lacked integrity: ${flag}`);
  assert.equal(receipt.previousReceiptSha256, hash(readFileSync(previousPath)), 'Resume receipt is not bound to exact original matrix');
  assert.equal(receipt.initialCommit, receipt.finalCommit); assert.equal(receipt.finalCommit, initialGit.head);
  assert.deepEqual(receipt.sourceBefore, receipt.sourceAfter);
  const changed = differences(receipt.sourceAfter.files, sourceBefore.files);
  const allowed = ['qa/scripts/t03-shared-device-e2e.mjs', 'qa/scripts/t03-rpc-stale-recovery-e2e.mjs', 'qa/scripts/recheck-f23-final-fixtures.ts'];
  assert(changed.every(path => allowed.includes(path)), `Resume unit/runtime scope changed: ${changed.filter(path => !allowed.includes(path)).join(', ')}`);
  const unitIds = ['q8-final', 'native-runtime', 'worker-native'];
  for (const id of unitIds) {
    const matches = receipt.jobs.filter((job: any) => job.id === id); assert.equal(matches.length, 1);
    const job = matches[0]; assert.equal(job.status, 'PASS'); assert.equal(job.exitCode, 0); assert.equal(job.coverageObserved, true);
    assert.equal(hash(readFileSync(job.outputLog)), job.outputSha256, `Successful resumed unit output bytes changed: ${id}`);
    if (id === 'q8-final') assert(job.evidencePaths.some((path: string) => { const result = JSON.parse(readFileSync(path, 'utf8')); return result.localGateVerdict === 'PASS' && result.sourceUnchanged === true && result.sourceAfter?.sha256 === receipt.sourceAfter.sha256; }), 'Q8 current frozen unit receipt missing');
    reused.push({ ...job, status: 'PASS_REUSED_UNCHANGED_UNIT_RUNTIME_SCOPE', previousStatus: job.status, previousReceipt: resumePath, previousReceiptSha256: hash(readFileSync(resumePath)), scopeProof: 'All unit test, runtime, compiler, configuration, lock, helper and documentation bytes unchanged. Only the two uninvoked E2E scripts and this orchestration script may differ. This is reuse, not a fresh Q8/unit execution claim.' });
  }
  for (const id of freshIds) assert.equal(receipt.jobs.find((job: any) => job.id === id)?.status, 'FAIL', 'Resume must rerun both failed E2E jobs');
  return { path: resumePath, sha256: hash(readFileSync(resumePath)), allowedChangedPaths: allowed, validatedChangedPaths: changed, reusedUnitGateIds: unitIds, freshGateIds: [...freshIds], sourceAfterSha256: receipt.sourceAfter.sha256 };
}
function validateRpcReuse() {
  assert(rpcReusePath && resumePath);
  const receipt = JSON.parse(readFileSync(rpcReusePath, 'utf8'));
  for (const flag of ['sourceUnchanged', 'canonicalPreserved', 'refsAndStashesPreserved', 'frozenArtifactsUnchanged']) assert.equal(receipt[flag], true, `RPC receipt lacked integrity: ${flag}`);
  assert.equal(receipt.previousReceiptSha256, hash(readFileSync(previousPath)), 'RPC receipt original matrix binding changed');
  assert.equal(resolve(receipt.resumeProof.path), resumePath);
  assert.equal(receipt.resumeProof.sha256, hash(readFileSync(resumePath)), 'RPC receipt unit-resume binding changed');
  assert.equal(receipt.initialCommit, receipt.finalCommit); assert.equal(receipt.finalCommit, initialGit.head);
  assert.deepEqual(receipt.sourceBefore, receipt.sourceAfter);
  const changed = differences(receipt.sourceAfter.files, sourceBefore.files);
  const allowed = ['qa/scripts/t03-shared-device-e2e.mjs', 'qa/scripts/recheck-f23-final-fixtures.ts'];
  assert(changed.every(path => allowed.includes(path)), `RPC runtime/own harness invalidated: ${changed.filter(path => !allowed.includes(path)).join(', ')}`);
  const matches = receipt.jobs.filter((job: any) => job.id === 't03-rpc-two'); assert.equal(matches.length, 1);
  const job = matches[0]; assert.equal(job.status, 'PASS'); assert.equal(job.exitCode, 0); assert.equal(job.coverageObserved, true);
  assert.deepEqual(job.args, ['run', 'qa/scripts/t03-rpc-stale-recovery-e2e.mjs']);
  assert.equal(hash(readFileSync(job.outputLog)), job.outputSha256, 'Passing RPC stdout/stderr bytes changed');
  const evidence: any[] = [];
  for (const path of job.evidencePaths) {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const engines = raw.results?.map((item: any) => item.browser).sort();
    if (!raw.error && JSON.stringify(engines) === JSON.stringify(['chromium', 'webkit']) && raw.results.every((item: any) => item.passed === true && item.opaqueIframeRpc === true && item.durableColdOfflineReopen === true && item.outboxCount === 2)) {
      const origin = new URL(raw.origin); assert.equal(origin.hostname, '127.0.0.1'); assert.notEqual(origin.port, '5187');
      evidence.push({ path, sha256: hash(readFileSync(path)), engines, results: raw.results });
    }
  }
  assert.equal(evidence.length, 1, 'Exactly one real two-engine passing RPC receipt is required');
  reused.push({ ...job, status: 'PASS_REUSED_UNCHANGED_RPC_SCOPE', previousStatus: job.status, previousReceipt: rpcReusePath, previousReceiptSha256: hash(readFileSync(rpcReusePath)), scopeProof: 'RPC runner and all runtime/unit/compiler/config/lock/helper/doc source bytes unchanged since the actual two-engine P7RUTp PASS; only Shared runner and this orchestrator differ.', verifiedEvidence: evidence });
  return { path: rpcReusePath, sha256: hash(readFileSync(rpcReusePath)), originalReceiptSha256: receipt.previousReceiptSha256, unitResumeSha256: receipt.resumeProof.sha256, allowedChangedPaths: allowed, validatedChangedPaths: changed, evidence };
}
try {
  log(`Fixture-only recheck ${run.path}; HEAD=${initialGit.head}; dirty=${initialGit.dirty}; source=${sourceBefore.sha256}`);
  assertOnlyNextPlatformChanges(initialGit);
  for (const flag of ['sourceUnchanged', 'canonicalPreserved', 'refsAndStashesPreserved', 'frozenArtifactsUnchanged']) assert.equal(previous[flag], true, `Previous run lacked integrity: ${flag}`);
  assert.equal(previous.accessibilityVerdict, 'PASS_SCOPED_AUTOMATED');
  assert.equal(previous.initialCommit, previous.finalCommit); assert.equal(previous.finalCommit, initialGit.head);
  assert.equal(previous.canonicalAfter.refsSha256, canonicalBefore.refsSha256); assert.equal(previous.canonicalAfter.stashSha256, canonicalBefore.stashSha256);
  validatedChangedPaths = differences(previous.sourceAfter.files, sourceBefore.files);
  assert(validatedChangedPaths.every(path => allowedChanges.has(path)), `Non-fixture source change invalidates reuse: ${validatedChangedPaths.filter(path => !allowedChanges.has(path)).join(', ')}`);
  artifactProof = validateArtifacts(); t06Proof = validateT06(); supplementProof = validateSupplement();
  for (const job of previous.jobs) {
    if (rerunIds.has(job.id)) { assert.equal(job.status, 'FAIL', `Rerun list expected failed prior job: ${job.id}`); continue; }
    assert(['PASS', 'PASS_REUSED_EXACT_SCOPE'].includes(job.status), `Cannot reuse failed/not-run job: ${job.id}`);
    if (job.outputLog && job.outputSha256) assert.equal(hash(readFileSync(job.outputLog)), job.outputSha256, `Prior successful output log changed: ${job.id}`);
    reused.push({ ...job, status: 'PASS_REUSED_VERIFIED_UNCHANGED_SCOPE', previousStatus: job.status, previousReceipt: previousPath, previousReceiptSha256: hash(readFileSync(previousPath)), scopeProof: job.id === 't06-scoped-reuse' ? 'Full scope mismatch only declared exact irrelevant selector unit test; own harness/runtime/artifacts unchanged' : 'Every runtime and this job own harness source byte unchanged; exact original emitted artifacts reverified' });
  }
  if (resumePath) resumeProof = validateResume();
  if (rpcReusePath) rpcReuseProof = validateRpcReuse();
  log(`[PASS] reuse preconditions; changed paths=${validatedChangedPaths.join(', ')}`);
  if (!resumePath) {
    await command('q8-final', ['run', 'qa/scripts/run-q8-gate.ts'], {}, /Local checks=PASS/);
    const native = previous.jobs.find((job: any) => job.id === 'native-runtime');
    assert(Array.isArray(native?.args)); await command('native-runtime', native.args);
    await command('worker-native', ['test', 'packages/module-release/test/worker-generations.test.ts', '--timeout', '90000'], {}, /\b16 pass\b/);
  }
  await served('t03-shared-two', 'qa/scripts/t03-shared-device-e2e.mjs', /verified: 2 browsers/);
  if (!rpcReusePath) await served('t03-rpc-two', 'qa/scripts/t03-rpc-stale-recovery-e2e.mjs', /2\/2 PASS/);
} catch (error) { failure = String(error); log(`[FAIL] ${failure}`); }
finally {
  const finalGit = captureGitBaseline(worktreeDir), canonicalAfter = captureGitBaseline(canonical), sourceAfter = captureSourceManifest();
  const sourceUnchanged = sourceBefore.sha256 === sourceAfter.sha256 && initialGit.head === finalGit.head;
  const canonicalPreserved = JSON.stringify(canonicalBefore) === JSON.stringify(canonicalAfter);
  const refsAndStashesPreserved = initialGit.refsSha256 === finalGit.refsSha256 && initialGit.stashSha256 === finalGit.stashSha256;
  let frozenArtifactsUnchanged = false;
  try { frozenArtifactsUnchanged = artifactProof !== null && JSON.stringify(validateArtifacts()) === JSON.stringify(artifactProof); }
  catch (error) { failure ??= String(error); }
  const allIds = [...reused, ...jobs].map(job => job.id), originalIds = previous.jobs.map((job: any) => job.id).sort();
  const completeUniqueJobSet = new Set(allIds).size === allIds.length && JSON.stringify([...allIds].sort()) === JSON.stringify(originalIds);
  const actualFreshGateIds = jobs.map(job => job.id).sort();
  const pass = !failure && sourceUnchanged && canonicalPreserved && refsAndStashesPreserved && frozenArtifactsUnchanged && freshIds.size === jobs.length && JSON.stringify(actualFreshGateIds) === JSON.stringify([...freshIds].sort()) && jobs.every(job => job.status === 'PASS') && completeUniqueJobSet;
  const report = { startedAt, finishedAt: new Date().toISOString(), initialCommit: initialGit.head, finalCommit: finalGit.head, dirty: initialGit.dirty, finalDirty: finalGit.dirty,
    sourceBefore, sourceAfter, sourceUnchanged, initialGit, finalGit, canonicalBefore, canonicalAfter, canonicalPreserved, refsAndStashesPreserved, frozenArtifactsUnchanged,
    previousReceipt: previousPath, previousReceiptSha256: hash(readFileSync(previousPath)), allowedChangedPaths: [...allowedChanges], validatedChangedPaths, artifactProof, t06Proof, supplementProof,
    resumeProof, rpcReuseProof, reused, jobs, actualFreshGateIds, reusedGateCount: reused.length, freshGateCount: jobs.length, completeUniqueJobSet, failure, accessibilityVerdict: previous.accessibilityVerdict, hardware: 'NAO_EXECUTADO', independentQA: 'NAO_EXECUTADO', localGateVerdict: pass ? 'PASS_LOCAL_CURRENT_WITH_REUSED_UNCHANGED_SCOPE' : 'FAIL', production: 'NO_GO', productionApproval: false,
    interpretation: `Prior failed receipts are preserved. Only successful unchanged runtime/harness/artifact scopes are reused; ${freshIds.size} gates re-executed on the current frozen source. Resumed Q8/unit gates are explicitly reused, not newly executed. Physical hardware and independent acceptance remain pending.` };
  writeFileSync(resolve(run.path, 'result.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  log(`Local=${report.localGateVerdict}; production=NO_GO; receipt=${resolve(run.path, 'result.json')}`); process.exitCode = pass ? 0 : 1;
}
