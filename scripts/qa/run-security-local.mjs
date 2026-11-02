/** Offline, selected-source security evidence. Never expose scanner/parser raw output. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { classifyScannerEvidence } from './classify-security-signals.mjs';
import { privateSourceParts, privateSourceExtensions, privateSourceBasenames, privateSourceRootFiles, isPrivateSource } from './source-state.mjs';

const ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const expected = { eslint: '9.32.0', 'typescript-eslint': '8.38.0', 'eslint-plugin-security': '4.2.0' };
// Pinned SHA-256 of the verified Gitleaks 8.30.1 binaries. Linux x64 was
// extracted from the official archive with SHA-256
// 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb.
const scannerHashes = Object.freeze({
  win32: '17157e2ee8b76fc8b1d8bee607a250e34b8a8023c8bc81822d4b5ee4d78fcb7c',
  linux: '88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509',
});
const rules = ['detect-eval-with-expression', 'detect-non-literal-fs-filename', 'detect-possible-timing-attacks'];
const roots = new Set(['apps', 'scripts', 'docs', 'instructions', 'supabase', 'releases', '.github', '.vscode', '.devcontainer', '.superpowers', 'src', 'public', 'packages', 'qa']);
const text = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.toml', '.tmpl', '.sh', '.ps1', '.sql', '.css', '.scss', '.html', '.svg', '.txt', '.xml', '.lock', '.gitkeep']);
const privateParts = new Set(privateSourceParts);
const privateExtensions = new Set(privateSourceExtensions);
const digest = data => createHash('sha256').update(data).digest('hex');
const fail = reason => { const error = new Error(reason); error.reason = reason; throw error; };
function git(root, args, input) {
  return execFileSync('git', args, { cwd: root, input, encoding: 'utf8', timeout: 30_000, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] });
}
export function classifySource(name) {
  if (!name || path.isAbsolute(name) || /[\x00-\x1f\\]/.test(name)) return 'unknown';
  const parts = name.split('/');
  if (parts.some(part => part === '..' || part === '')) return 'unknown';
  if (isPrivateSource(name)) return 'excluded';
  const basename = parts.at(-1);
  if (parts.length === 1 && ['.gitignore', '.gitattributes', '.gitleaksignore', 'delta-pwa.txt', 'run_qa.sh'].includes(basename)) return 'selected';
  if (parts.length === 1 && (['package.json', 'turbo.json', 'bun.lock', 'Taskfile.yml', 'index.html', 'package-lock.json', 'playwright.config.ts', 'tailwind.config.ts', 'tsconfig.app.json', 'tsconfig.json', 'vite.config.ts', 'vitest.config.ts', 'components.json', 'eslint.config.js', 'playwright-fixture.ts', 'postcss.config.js', 'tsconfig.node.json'].includes(basename) || path.extname(basename) === '.md')) return 'selected';
  if (['apps/web/src/test/pages/PastoDetailPage.test.tsx`', 'qa/setup-and-test.bat'].includes(name)) return 'selected';
  if (parts.length > 1 && text.has(path.extname(basename).toLowerCase()) && roots.has(parts[0])) return 'selected';
  return 'unknown';
}
function safeFile(root, name) {
  let current = root;
  for (const part of name.split('/')) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) fail('source-link-denied');
  }
  if (!fs.lstatSync(current).isFile()) fail('source-entry-denied');
  return current;
}
export function selectedSource(root) {
  const index = git(root, ['ls-files', '--stage', '-z']).split('\0').filter(Boolean);
  const tracked = new Set(index.map(entry => entry.slice(entry.indexOf('\t') + 1)));
  const names = [...new Set([...tracked, ...git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)])].sort();
  const files = [], excluded = [], absent = [];
  for (const name of names) {
    const classification = classifySource(name);
    if (classification === 'excluded') { excluded.push(name); continue; }
    if (classification !== 'selected') fail('unknown-source-classification');
    let file;
    try { file = safeFile(root, name); }
    catch (error) {
      // lstat checks every existing ancestor first; a dangling link is never deletion.
      if (error.code === 'ENOENT' && tracked.has(name)) { absent.push(name); continue; }
      throw error;
    }
    files.push({ path: name, tracked: tracked.has(name), hash: digest(fs.readFileSync(file)) });
  }
  const commit = git(root, ['rev-parse', '--verify', 'HEAD']).trim();
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const status = git(root, ['status', '--porcelain', '-z']);
  const fingerprint = digest(JSON.stringify({ commit, branch, index, files, excluded, absent }));
  return { commit, branch, workingTreeDirty: Boolean(status), fingerprint, files, exclusions: { count: excluded.length, paths: excluded }, absentCurrentCount: absent.length };
}
export function availableHistory(root) {
  if (git(root, ['rev-parse', '--is-shallow-repository']).trim() !== 'false') fail('shallow-history');
  const config = git(root, ['config', '--local', '--list', '--name-only']);
  if (/^remote\..*\.promisor$|^extensions\.partialclone$/mi.test(config)) fail('partial-history');
  const raw = git(root, ['rev-list', '--objects', '--all', '--reflog', '--missing=print']);
  const entries = raw.split('\n').filter(Boolean);
  if (entries.some(line => line.startsWith('?') || !/^[a-f0-9]{40}(?: |$)/i.test(line))) fail('missing-history-object');
  const ids = entries.map(line => line.slice(0, 40));
  const types = git(root, ['cat-file', '--batch-check=%(objecttype)'], ids.join('\n') + '\n').trim().split('\n');
  if (types.length !== ids.length || types.some(type => !['blob', 'tree', 'commit', 'tag'].includes(type))) fail('missing-history-object');
  const excluded = new Set();
  entries.forEach((entry, index) => {
    if (types[index] !== 'blob') return;
    const name = entry.slice(41);
    const classification = classifySource(name);
    if (classification === 'unknown') fail('unknown-history-classification');
    if (classification === 'excluded') excluded.add(name);
  });
  const selectedPaths = new Set();
  // Name-only NUL output includes every historical pathname, even shared blob contents.
  for (const entry of git(root, ['log', '--all', '--reflog', '--full-history', '--format=', '--name-only', '-z', '--no-renames']).split('\0')) {
    const name = entry.replace(/^\n+/, '');
    if (!name) continue;
    const classification = classifySource(name);
    if (classification === 'unknown') fail('unknown-history-classification');
    if (classification === 'selected') selectedPaths.add(name); else excluded.add(name);
  }
  const commits = git(root, ['rev-list', '--all', '--reflog']).trim().split('\n').filter(Boolean).sort();
  const refs = git(root, ['for-each-ref', '--format=%(objectname) %(refname)']);
  const reflog = git(root, ['reflog', 'show', '--all', '--format=%H']);
  return { count: commits.length, objectCount: ids.length, selectedPaths: [...selectedPaths].sort(), fingerprint: digest(JSON.stringify({ commits, ids: [...ids].sort(), refs, reflog })), exclusions: { count: excluded.size, paths: [...excluded].sort() }, scope: 'locally reachable refs and reflogs; selected content only; excludes expired/dangling/unknown remote history' };
}
function group(findings) {
  const grouped = new Map();
  for (const finding of findings) {
    if (!finding || Object.keys(finding).some(key => !['category', 'path'].includes(key)) || typeof finding.category !== 'string' || !/^[\w@/.-]{1,160}$/.test(finding.category) || classifySource(finding.path) !== 'selected') fail('invalid-metadata-report');
    const key = JSON.stringify(finding);
    const old = grouped.get(key);
    if (old) old.count++; else grouped.set(key, { ...finding, count: 1 });
  }
  return [...grouped.values()].sort((a, b) => a.path.localeCompare(b.path) || a.category.localeCompare(b.category));
}
export function scannerMetadata(filename, exitCode, prefix = '', allowedPaths = new Set()) {
  const parsed = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (!Array.isArray(parsed)) fail('invalid-metadata-report');
  const normalized = parsed.map(item => {
    const locationKeys = ['startLine', 'endLine', 'startColumn', 'endColumn', 'commit'];
    if (!item || Object.keys(item).some(key => !['category', 'path', ...locationKeys].includes(key))) fail('invalid-metadata-report');
    const hasLocation = locationKeys.some(key => Object.hasOwn(item, key));
    if (hasLocation && (!locationKeys.every(key => Object.hasOwn(item, key)) || !locationKeys.slice(0, 4).every(key => Number.isSafeInteger(item[key]) && item[key] >= 1) || typeof item.commit !== 'string' || (item.commit && !/^[a-f0-9]{40}$/i.test(item.commit)))) fail('invalid-metadata-report');
    let name = item.path;
    if (typeof name !== 'string') fail('invalid-metadata-report');
    name = name.replaceAll('\\', '/');
    const normalizedPrefix = prefix.replaceAll('\\', '/');
    if (normalizedPrefix && name.toLowerCase().startsWith((normalizedPrefix + '/').toLowerCase())) name = name.slice(normalizedPrefix.length + 1);
    if (!allowedPaths.has(name)) fail('invalid-metadata-report');
    return { category: item.category, path: name, ...(hasLocation ? Object.fromEntries(locationKeys.map(key => [key, item[key]])) : {}) };
  });
  const findings = group(normalized.map(item => ({ category: item.category, path: item.path })));
  if (![0, 1].includes(exitCode) || (exitCode === 1 && !findings.length)) fail('scanner-execution-failed');
  return { status: findings.length ? 'FAIL' : 'PASS', exitCode, count: findings.reduce((sum, item) => sum + item.count, 0), findings, signals: normalized.filter(item => Object.hasOwn(item, 'startLine')) };
}
export function invokeScanner(executable, args, cwd, timeoutMs = 330_000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 330_000) fail('invalid-scanner-timeout');
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GITLEAKS_')) delete env[key];
  const result = spawnSync(executable, args, { cwd, env, stdio: 'ignore', timeout: timeoutMs });
  if (result.error || result.signal || result.status === null) fail('scanner-execution-failed');
  return result.status;
}
function verifiedScanner(root) {
  if (process.arch !== 'x64' || !Object.hasOwn(scannerHashes, process.platform)) fail('scanner-provenance-unavailable-for-os');
  const name = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks';
  const relative = '.qa/tools/gitleaks-8.30.1/' + name;
  const executable = path.join(root, relative);
  if (!fs.existsSync(executable)) fail('scanner-missing');
  const pinnedHash = scannerHashes[process.platform];
  if (digest(fs.readFileSync(safeFile(root, relative))) !== pinnedHash) fail('scanner-digest-mismatch');
  const version = execFileSync(executable, ['version'], { encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (version !== '8.30.1') fail('scanner-version-mismatch');
  return { executable, version, sha256: pinnedHash };
}
const safeReasons = new Set('not-executed source-link-denied source-entry-denied unknown-source-classification unknown-history-classification shallow-history partial-history missing-history-object invalid-metadata-report scanner-execution-failed scanner-provenance-unavailable-for-os scanner-missing scanner-digest-mismatch scanner-version-mismatch locked-eslint-tool-missing-or-mismatched sast-empty-source sast-unexpected-ignored-source sast-timeout sast-tool-or-config-failed sast-incomplete source-changed-during-projection private-projection-cleanup-failed evidence-link-denied invalid-scanner-timeout'.split(' '));
const safeCodes = new Set(['ENOENT', 'EACCES', 'EPERM', 'MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'ESLINT_INVALID_OPTIONS']);
function stageError(error) { return { status: 'ERROR', exitCode: 1, count: 0, findings: [], reason: safeReasons.has(error.reason) ? error.reason : safeCodes.has(error.code) ? error.code : 'security-stage-failed' }; }
async function lintStage({ root, projection, stage, names }) {
  const cwd = path.join(projection, 'apps', stage);
  const requireWorkspace = createRequire(path.join(root, 'apps', stage, 'package.json'));
  for (const [name, version] of Object.entries(expected)) {
    const installed = JSON.parse(fs.readFileSync(requireWorkspace.resolve(name + '/package.json'), 'utf8'));
    if (installed.version !== version) fail('locked-eslint-tool-missing-or-mismatched');
  }
  const { ESLint } = requireWorkspace('eslint');
  const options = { cwd, allowInlineConfig: false };
  if (stage === 'api') options.overrideConfigFile = path.join(root, 'apps/api/eslint.config.js');
  else {
    const tseslint = requireWorkspace('typescript-eslint');
    const security = requireWorkspace('eslint-plugin-security');
    options.overrideConfigFile = true;
    options.overrideConfig = [{ files: ['src/**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser }, plugins: { security }, rules: Object.fromEntries(rules.map(rule => ['security/' + rule, 'error'])) }];
  }
  const selected = names.filter(name => stage === 'api'
    ? name.startsWith('apps/api/') && /\.[cm]?[jt]sx?$/.test(name)
    : name.startsWith('apps/web/src/') && /\.tsx?$/.test(name) && !name.startsWith('apps/web/src/test/') && !/\.test\.tsx?$/.test(name));
  const production = selected.filter(name => name.startsWith(`apps/${stage}/src/`)
    && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)
    && !/(?:^|\/)(?:__tests__|tests?|fixtures)\//.test(name));
  if (production.length === 0) fail('sast-empty-source');
  const eslint = new ESLint(options), findings = [];
  for (const name of selected) {
    const file = path.join(projection, name);
    if (await eslint.isPathIgnored(file)) fail('sast-unexpected-ignored-source');
  }
  for (const result of await eslint.lintFiles(selected.map(name => path.join(projection, name)))) {
    const name = path.relative(projection, result.filePath).replaceAll('\\', '/');
    for (const message of result.messages) findings.push({ category: message.ruleId || 'parser-error', path: name });
  }
  const aggregated = group(findings);
  return { status: aggregated.length ? 'FAIL' : 'PASS', exitCode: aggregated.length ? 1 : 0, count: findings.length, scannedFiles: selected.length, productionFiles: production.length, findings: aggregated, tools: expected };
}
function boundedLint(options) {
  return new Promise(resolve => {
    const worker = new Worker(new URL(import.meta.url), { workerData: options, stdout: true, stderr: true });
    worker.stdout.resume(); worker.stderr.resume();
    let finished = false;
    const done = result => { if (finished) return; finished = true; clearTimeout(timer); resolve(result); };
    const timer = setTimeout(() => { worker.terminate(); done(stageError({ reason: 'sast-timeout' })); }, 60_000);
    worker.on('message', done);
    worker.on('error', () => done(stageError({ reason: 'sast-tool-or-config-failed' })));
    worker.on('exit', () => done(stageError({ reason: 'sast-incomplete' })));
  });
}
function scannerStage(root, projection, directory, mode, scanner, allowedPaths) {
  const report = path.join(directory, mode + '-metadata.json');
  const ignore = path.join(directory, 'empty-ignore'); fs.writeFileSync(ignore, '');
  const args = [mode === 'source' ? 'dir' : 'git', mode === 'source' ? projection : root,
    '--no-banner', '--no-color', '--redact=100', '--log-level=error', '--timeout=300', '--exit-code=1',
    '--config', path.join(root, 'scripts/qa/gitleaks-local.toml'), '--gitleaks-ignore-path', ignore,
    '--ignore-gitleaks-allow', '--report-format', 'template', '--report-template', path.join(root, 'scripts/qa/gitleaks-metadata.tmpl'), '--report-path', report];
  if (mode === 'history') {
    // Fixed pathspecs are parsed by Gitleaks, never by a shell or from caller input.
    // Gitleaks splits log-opts itself; literal quote characters would suppress patches.
    const excludes = [...privateParts, ...privateSourceBasenames].filter(name => name !== '.git')
      .flatMap(name => [`:(icase,glob,exclude)**/${name}`, `:(icase,glob,exclude)**/${name}/**`]);
    for (const name of privateSourceRootFiles) excludes.push(`:(icase,glob,exclude)${name}`, `:(icase,glob,exclude)${name}/**`);
    excludes.push(':(icase,glob,exclude)**/.env*', ':(icase,glob,exclude)**/.env*/**');
    for (const ext of privateExtensions) excludes.push(`:(icase,glob,exclude)**/*${ext}`);
    excludes.push(':(icase,glob,exclude)**/*credential*', ':(icase,glob,exclude)**/*private*key*', ':(icase,glob,exclude)**/*session*material*');
    args.push('--log-opts', '--all --reflog --full-history --root --diff-merges=first-parent --no-ext-diff --no-textconv -- . ' + excludes.join(' '));
  }
  const exitCode = invokeScanner(scanner.executable, args, root);
  const evidence = scannerMetadata(report, exitCode, mode === 'source' ? projection : '', allowedPaths);
  return classifyScannerEvidence(root, evidence, { mode, projection });
}
export async function runSecurity(root) {
  const directory = path.join(root, '.qa/security', new Date().toISOString().replaceAll(/[-:.]/g, '') + '-' + process.pid);
  for (const owned of [path.join(root, '.qa'), path.join(root, '.qa/security')]) {
    if (!fs.existsSync(owned)) fs.mkdirSync(owned);
    const stat = fs.lstatSync(owned);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('evidence-link-denied');
  }
  fs.mkdirSync(directory);
  const projection = path.join(directory, 'source');
  const stages = Object.fromEntries(['api', 'web', 'source', 'history'].map(name => [name, stageError({ reason: 'not-executed' })]));
  let initial, history, final, finalHistory, scanner;
  try {
    initial = selectedSource(root); history = availableHistory(root);
    fs.mkdirSync(projection);
    for (const item of initial.files) {
      const bytes = fs.readFileSync(safeFile(root, item.path));
      if (digest(bytes) !== item.hash) fail('source-changed-during-projection');
      const target = path.join(projection, item.path);
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
    }
    for (const name of ['api', 'web']) stages[name] = await boundedLint({ root, projection, stage: name, names: initial.files.map(item => item.path) });
    try { scanner = verifiedScanner(root); }
    catch (error) { stages.source = stageError(error); stages.history = stageError(error); }
    if (scanner) for (const mode of ['source', 'history']) {
      try { stages[mode] = scannerStage(root, projection, directory, mode, scanner, new Set(mode === 'source' ? initial.files.map(item => item.path) : history.selectedPaths)); }
      catch (error) { stages[mode] = stageError(error); }
    }
    final = selectedSource(root); finalHistory = availableHistory(root);
  } catch (error) {
    for (const name of Object.keys(stages)) if (stages[name].reason === 'not-executed') stages[name] = stageError(error);
  } finally {
    // Only the owned input projection is removed; evidence and original sources stay intact.
    try { fs.rmSync(projection, { recursive: true, force: true }); } catch { stages.source = stageError({ reason: 'private-projection-cleanup-failed' }); }
  }
  const selectedSourceUnchanged = Boolean(initial && final && initial.fingerprint === final.fingerprint);
  const historyUnchanged = Boolean(history && finalHistory && history.fingerprint === finalHistory.fingerprint);
  const result = {
    kind: 'local-selected-source-security', status: selectedSourceUnchanged && historyUnchanged && Object.values(stages).every(stage => stage.status === 'PASS') ? 'PASS' : 'FAIL',
    commit: initial?.commit ?? null, finalCommit: final?.commit ?? null, workingTreeDirty: initial?.workingTreeDirty ?? true, finalWorkingTreeDirty: final?.workingTreeDirty ?? true,
    selectedSourceUnchanged, selectedSourceFingerprint: initial?.fingerprint ?? null, finalSelectedSourceFingerprint: final?.fingerprint ?? null,
    historyUnchanged, history: history ?? null, finalHistoryFingerprint: finalHistory?.fingerprint ?? null,
    source: initial ? { count: initial.files.length, trackedCount: initial.files.filter(item => item.tracked).length, untrackedCount: initial.files.filter(item => !item.tracked).length, exclusions: initial.exclusions, absentCurrentCount: initial.absentCurrentCount } : null,
    scanner: scanner ? { version: scanner.version, sha256: scanner.sha256 } : null,
    policyHash: fs.existsSync(path.join(root, 'scripts/qa/gitleaks-local.toml')) ? digest(fs.readFileSync(path.join(root, 'scripts/qa/gitleaks-local.toml'))) : null,
    templateHash: fs.existsSync(path.join(root, 'scripts/qa/gitleaks-metadata.tmpl')) ? digest(fs.readFileSync(path.join(root, 'scripts/qa/gitleaks-metadata.tmpl'))) : null,
    scope: 'selected safe current code/config/docs, including nonignored untracked implementation; selected locally reachable history. Denied private/env/key/data/deps/build/cache content not certified. No provider verification or whole-repository security claim.', stages,
  };
  const report = path.join(directory, 'security-result.json');
  fs.writeFileSync(report + '.tmp', JSON.stringify(result, null, 2) + '\n'); fs.renameSync(report + '.tmp', report);
  return { result, report };
}
if (!isMainThread) {
  try { parentPort.postMessage(await lintStage(workerData)); }
  catch (error) { parentPort.postMessage(stageError(error)); }
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) { console.error('[security] Unsupported arguments'); process.exitCode = 2; }
  else {
    try {
      const { result, report } = await runSecurity(ownRoot);
      for (const [stage, evidence] of Object.entries(result.stages)) console.log('[security]', stage, evidence.status, 'count=' + evidence.count, evidence.reason || '');
      console.log('SECURITY_REPORT=' + report); process.exitCode = result.status === 'PASS' ? 0 : 1;
    } catch { console.error('[security] Complete metadata evidence unavailable'); process.exitCode = 1; }
  }
}
