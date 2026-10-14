const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const qaDir = path.resolve(__dirname, '../qa');
const bash = process.platform === 'win32'
  ? ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find(fs.existsSync)
  : 'bash';
assert.ok(bash, 'Installed Git Bash is required for recorder integration tests');
const timeout = 20_000;
function run(file, args, options = {}) {
  return spawnSync(file, args, { encoding: 'utf8', timeout, ...options });
}
function fixture(t, prepare = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa record espaço-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts', 'qa'), { recursive: true });
  for (const name of ['record.sh', 'source-state.mjs']) {
    const from = path.join(qaDir, name);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(root, 'scripts', 'qa', name));
  }
  fs.writeFileSync(path.join(root, '.gitignore'), '.qa/\n.env*\n');
  fs.writeFileSync(path.join(root, 'input.txt'), 'baseline\n');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  git('config', 'user.name', 'Local QA Fixture');
  git('config', 'user.email', 'qa@example.invalid');
  git('add', '.');
  git('commit', '-qm', 'Fixture baseline');
  const commit = git('rev-parse', 'HEAD').trim();
  prepare({ root, git });
  function record(code = '', options = {}) {
    const env = { ...process.env, ...options.env };
    const args = ['scripts/qa/record.sh', 'integrity', ...(options.args || [process.execPath, '-e', code])];
    const result = run(bash, options.prefix ? ['-c', options.prefix, 'fixture', ...args] : args, { cwd: root, env });
    const runs = path.join(root, '.qa', 'runs');
    const dirs = fs.existsSync(runs) ? fs.readdirSync(runs) : [];
    assert.ok(dirs.length <= 1, 'Fixture unexpectedly produced multiple records');
    const dir = dirs.length ? path.join(runs, dirs[0]) : null;
    const filename = dir && path.join(dir, 'result.json');
    const report = filename && fs.existsSync(filename) && fs.statSync(filename).isFile()
      ? JSON.parse(fs.readFileSync(filename, 'utf8')) : null;
    const log = dir && fs.existsSync(path.join(dir, 'output.log')) ? fs.readFileSync(path.join(dir, 'output.log'), 'utf8') : '';
    return { result, report, log };
  }
  return { root, git, commit, record };
}
function stable(report, dirty) {
  assert.equal(report.status, 'PASS');
  assert.equal(report.sourceUnchanged, true);
  assert.equal(report.workingTreeDirty, dirty);
  assert.equal(report.finalWorkingTreeDirty, dirty);
  assert.match(report.sourceFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(report.finalSourceFingerprint, report.sourceFingerprint);
  assert.equal(report.finalCommit, report.commit);
  assert.equal(report.commandExitCode, 0);
  assert.equal(report.loggerExitCode, 0);
}
function drift(result, report) {
  assert.notEqual(result.status, 0, 'Source drift falsely passed');
  assert.equal(report.status, 'FAIL');
  assert.equal(report.sourceUnchanged, false);
  assert.notEqual(report.finalSourceFingerprint, report.sourceFingerprint);
  assert.equal(report.commandExitCode, 0);
}

test('recorder approves stable clean sources with both pipeline exits and final SHA', t => {
  const f = fixture(t);
  const { result, report, log } = f.record('console.log("stdout-marker"); console.error("stderr-marker");');
  assert.equal(result.status, 0, result.stderr);
  stable(report, false);
  assert.equal(report.commit, f.commit);
  assert.match(log, /stdout-marker/);
  assert.match(log, /stderr-marker/);
});
test('stable dirty source remains honestly dirty', t => {
  const f = fixture(t, ({ root }) => fs.writeFileSync(path.join(root, 'input.txt'), 'candidate\n'));
  const { result, report } = f.record();
  assert.equal(result.status, 0, result.stderr);
  stable(report, true);
});
test('tracked working content changed during child fails', t => {
  const { result, report } = fixture(t).record('require("fs").writeFileSync("input.txt", "changed\\n");');
  drift(result, report);
  assert.equal(report.workingTreeDirty, false);
  assert.equal(report.finalWorkingTreeDirty, true);
});
test('same dirty status does not hide tracked content mutation', t => {
  const f = fixture(t, ({ root }) => fs.writeFileSync(path.join(root, 'input.txt'), 'candidate\n'));
  const { result, report } = f.record('require("fs").writeFileSync("input.txt", "different candidate\\n");');
  drift(result, report);
  assert.equal(report.workingTreeDirty, true);
  assert.equal(report.finalWorkingTreeDirty, true);
});
test('new untracked source cannot pass as unchanged', t => {
  const { result, report } = fixture(t).record('require("fs").writeFileSync("new source.txt", "new\\n");');
  drift(result, report);
});
test('preexisting untracked content mutation is detected', t => {
  const f = fixture(t, ({ root }) => fs.writeFileSync(path.join(root, 'untracked.txt'), 'before\n'));
  const { result, report } = f.record('require("fs").writeFileSync("untracked.txt", "after\\n");');
  drift(result, report);
  assert.equal(report.workingTreeDirty, true);
});
test('index-only mutation is detected even when working content and status stay identical', t => {
  const f = fixture(t, ({ root, git }) => {
    fs.writeFileSync(path.join(root, 'input.txt'), 'staged-one\n');
    git('add', 'input.txt');
    fs.writeFileSync(path.join(root, 'input.txt'), 'baseline\n');
  });
  const before = f.git('status', '--porcelain');
  const { result, report } = f.record(`
    const fs = require('fs'); const { execFileSync } = require('child_process');
    fs.writeFileSync('input.txt', 'staged-two\\n');
    execFileSync('git', ['add', 'input.txt'], { timeout: 20_000 });
    fs.writeFileSync('input.txt', 'baseline\\n');
  `);
  assert.equal(f.git('status', '--porcelain'), before);
  assert.equal(f.git('diff', 'HEAD', '--', 'input.txt'), '');
  drift(result, report);
});
test('HEAD advance is never attributed to the initial revision', t => {
  const f = fixture(t);
  const { result, report } = f.record(`require('child_process').execFileSync('git', ['commit', '--allow-empty', '-qm', 'New HEAD'], { timeout: 20_000 });`);
  drift(result, report);
  assert.equal(report.commit, f.commit);
  assert.notEqual(report.finalCommit, f.commit);
});
test('ignored QA log and env-file writes do not change source state', t => {
  const { result, report } = fixture(t).record(`const fs = require('fs'); fs.writeFileSync('.qa/ignored.log', 'log'); fs.writeFileSync('.env.fixture', 'inert fixture only');`);
  assert.equal(result.status, 0, result.stderr);
  stable(report, false);
});
test('binary and Unicode untracked files have stable snapshots and detect binary drift', t => {
  const f = fixture(t, ({ root }) => fs.writeFileSync(path.join(root, 'espaço 日本.bin'), Buffer.from([0, 255, 13, 10])));
  const { result, report } = f.record('require("fs").writeFileSync("espaço 日本.bin", Buffer.from([0,255,13,11]));');
  drift(result, report);
});
test('child exit 37 is preserved with stdout and stderr despite simultaneous drift', t => {
  const { result, report, log } = fixture(t).record(`console.log('out-37'); console.error('err-37'); require('fs').writeFileSync('input.txt', 'changed'); process.exit(37);`);
  assert.equal(result.status, 37, result.stderr);
  assert.equal(report.exitCode, 37);
  assert.equal(report.commandExitCode, 37);
  assert.equal(report.status, 'FAIL');
  assert.match(log, /out-37/);
  assert.match(log, /err-37/);
});
test('unavailable child command fails and records its exit code', t => {
  const { result, report } = fixture(t).record('', { args: ['qa-fixture-command-does-not-exist'] });
  assert.equal(result.status, 127, result.stderr);
  assert.equal(report.commandExitCode, 127);
  assert.equal(report.status, 'FAIL');
});
test('final Git state capture failure cannot produce PASS', t => {
  const { result, report } = fixture(t).record(`const { execFileSync } = require('child_process'); const fs = require('fs'); const ref = execFileSync('git', ['symbolic-ref', 'HEAD'], { encoding: 'utf8', timeout: 20_000 }).trim(); fs.unlinkSync('.git/' + ref);`);
  assert.notEqual(result.status, 0);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.sourceUnchanged, false);
  assert.equal(report.finalSourceFingerprint, null);
});
test('initial unavailable Git revision fails closed even if the child succeeds', t => {
  const f = fixture(t, ({ root, git }) => fs.unlinkSync(path.join(root, '.git', git('symbolic-ref', 'HEAD').trim())));
  const { result, report } = f.record();
  assert.notEqual(result.status, 0);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.sourceUnchanged, false);
  assert.equal(report.sourceFingerprint, null);
});
test('tee failure with successful child fails with explicit logger metadata', t => {
  const f = fixture(t);
  const tee = run(bash, ['-c', 'command -v tee']).stdout.trim();
  assert.ok(tee);
  const bin = path.join(f.root, '.qa', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'tee'), '#!/usr/bin/env bash\n"$QA_FIXTURE_TEE" "$@"\nif [[ "$1" == "-a" ]]; then exit 29; fi\n', { mode: 0o755 });
  const env = { QA_FIXTURE_TEE: tee, QA_FIXTURE_BIN: bin };
  // Prepend inside Bash, where the Unix shim is executed; Windows PATH handling differs.
  const prefix = process.platform === 'win32'
    ? 'PATH="$(cygpath -u "$QA_FIXTURE_BIN"):$PATH"; export PATH; exec bash "$@"'
    : 'PATH="$QA_FIXTURE_BIN:$PATH"; export PATH; exec bash "$@"';
  const { result, report, log } = f.record('console.log("logger-marker");', { env, prefix });
  assert.notEqual(result.status, 0, 'Failed tee falsely passed');
  assert.equal(report.status, 'FAIL');
  assert.equal(report.commandExitCode, 0);
  assert.equal(report.loggerExitCode, 29);
  assert.match(log, /logger-marker/);
});
test('failed evidence write cannot return PASS', t => {
  const { result, report } = fixture(t).record(`const fs = require('fs'); const path = require('path'); const run = fs.readdirSync('.qa/runs')[0]; fs.mkdirSync(path.join('.qa/runs', run, 'result.json'));`);
  assert.notEqual(result.status, 0);
  assert.equal(report, null);
});
test('interrupted execution never leaves a PASS record', t => {
  const { result, report } = fixture(t).record('', { args: [bash, '-c', 'kill -TERM "$PPID"; exit 130'] });
  assert.notEqual(result.status, 0);
  assert.notEqual(report?.status, 'PASS');
});

// Stable binary sources exercise path encoding without relying only on mutation detection.
test('binary and Unicode source names remain stable when only ignored evidence is written', t => {
  const f = fixture(t, ({ root }) => fs.writeFileSync(path.join(root, 'espaço 日本.bin'), Buffer.from([0,255,10,13])));
  const { result, report } = f.record();
  assert.equal(result.status, 0, result.stderr);
  stable(report, true);
});

test('untracked directory links hash their metadata without following target content', t => {
  const f = fixture(t, ({ root }) => {
    const target = path.join(root, '.qa', 'link-target');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'outside.txt'), 'target-before\n');
    fs.symlinkSync(target, path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  });
  const { result, report } = f.record(`require('fs').writeFileSync('.qa/link-target/outside.txt', 'target-after');`);
  assert.equal(result.status, 0, result.stderr);
  stable(report, true);
});

test('untracked directory link target change is source drift even with identical listed files', t => {
  const f = fixture(t, ({ root }) => {
    for (const target of ['one', 'two']) {
      fs.mkdirSync(path.join(root, '.qa', target), { recursive: true });
      fs.writeFileSync(path.join(root, '.qa', target, 'outside.txt'), 'inert\n');
    }
    fs.symlinkSync(path.join(root, '.qa', 'one'), path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  });
  const before = f.git('status', '--porcelain');
  const { result, report } = f.record(`const fs = require('fs'); const path = require('path'); fs.unlinkSync('alias'); fs.symlinkSync(path.resolve('.qa/two'), 'alias', process.platform === 'win32' ? 'junction' : 'dir');`);
  assert.equal(f.git('status', '--porcelain'), before);
  assert.match(report.sourceFingerprint, /^[a-f0-9]{64}$/);
  assert.match(report.finalSourceFingerprint, /^[a-f0-9]{64}$/);
  drift(result, report);
});

test('unavailable final evidence helper never masks child exit 37', t => {
  const { result, report, log } = fixture(t).record(`console.log('evidence-unavailable'); require('fs').unlinkSync('scripts/qa/source-state.mjs'); process.exit(37);`);
  assert.equal(result.status, 37, result.stderr);
  assert.equal(report, null);
  assert.match(log, /evidence-unavailable/);
});

function denyPrivateReads(f, filename, denyBinaryDiff) {
  const bootstrap = path.join(f.root, '.qa/privacy-preload.cjs'), marker = path.join(f.root, '.qa/private-read-attempt');
  fs.mkdirSync(path.dirname(bootstrap), { recursive: true });
  fs.writeFileSync(bootstrap, `
    const fs = require('node:fs'), cp = require('node:child_process'), path = require('node:path');
    const read = fs.readFileSync, git = cp.execFileSync;
    fs.readFileSync = function(file, ...args) {
      if (path.resolve(String(file)) === process.env.QA_PRIVATE_FIXTURE_FILE) {
        fs.appendFileSync(process.env.QA_PRIVATE_FIXTURE_MARKER, 'private-read-attempt\\n');
        throw new Error('Private fixture read denied');
      }
      return read.call(this, file, ...args);
    };
    cp.execFileSync = function(file, args, options) {
      if (process.env.QA_PRIVATE_FIXTURE_DENY_DIFF === '1' && file === 'git' && args.includes('--binary')) {
        fs.appendFileSync(process.env.QA_PRIVATE_FIXTURE_MARKER, 'private-binary-diff-attempt\\n');
        throw new Error('Private fixture diff denied');
      }
      return git.call(this, file, args, options);
    };
    require('node:module').syncBuiltinESMExports();
  `);
  return { marker, env: { NODE_OPTIONS: '--require ' + JSON.stringify(bootstrap), QA_PRIVATE_FIXTURE_FILE: path.join(f.root, filename), QA_PRIVATE_FIXTURE_MARKER: marker, QA_PRIVATE_FIXTURE_DENY_DIFF: denyBinaryDiff ? '1' : '0' } };
}
test('whole recorder fails closed before reading nonignored untracked private env bytes', t => {
  const f = fixture(t, ({ root }) => { fs.writeFileSync(path.join(root, '.gitignore'), '.qa/\n'); fs.writeFileSync(path.join(root, '.env.private'), 'inert private byte sentinel'); });
  const sentinel = denyPrivateReads(f, '.env.private', false);
  const { result, report } = f.record('', { env: sentinel.env });
  assert.equal(fs.existsSync(sentinel.marker), false, 'Whole-wrapper fingerprint attempted a private byte read');
  assert.notEqual(result.status, 0);
  assert.equal(report.commit, f.commit); assert.equal(report.finalCommit, f.commit);
  assert.equal(report.sourceFingerprint, null); assert.equal(report.sourceUnchanged, false);
  assert.equal(report.sourceCaptureReason, 'private-source-not-witnessed');
  assert.equal(report.workingTreeDirty, true); assert.equal(report.commandExitCode, 0); assert.equal(report.loggerExitCode, 0);
});
test('modified tracked private template fails before any binary diff containing private bytes', t => {
  const f = fixture(t, ({ root, git }) => { fs.writeFileSync(path.join(root, '.env.example'), 'inert template\n'); git('add', '-f', '.env.example'); git('commit', '-qm', 'Tracked inert template'); fs.writeFileSync(path.join(root, '.env.example'), 'modified inert template\n'); });
  const commit = f.git('rev-parse', 'HEAD').trim(), sentinel = denyPrivateReads(f, '.env.example', true);
  const { result, report } = f.record('', { env: sentinel.env });
  assert.equal(fs.existsSync(sentinel.marker), false, 'Whole-wrapper fingerprint requested a private binary diff');
  assert.notEqual(result.status, 0);
  assert.equal(report.commit, commit); assert.equal(report.finalCommit, commit);
  assert.equal(report.sourceFingerprint, null); assert.equal(report.sourceCaptureReason, 'private-source-not-witnessed');
});
test('unchanged tracked private template does not blanket-block a clean source witness', t => {
  const f = fixture(t, ({ root, git }) => { fs.writeFileSync(path.join(root, '.env.example'), 'inert template\n'); git('add', '-f', '.env.example'); git('commit', '-qm', 'Tracked inert template'); });
  const sentinel = denyPrivateReads(f, '.env.example', false), { result, report } = f.record('', { env: sentinel.env });
  assert.equal(fs.existsSync(sentinel.marker), false); assert.equal(result.status, 0); stable(report, false);
});

test('whole recorder denies changed tracked junction before binary diff can reach target bytes', t => {
  const f = fixture(t, ({ root, git }) => {
    const directory = path.join(root, 'source-dir'), target = path.join(root, '.qa/private-target');
    fs.mkdirSync(directory); fs.writeFileSync(path.join(directory, 'child.mjs'), 'export const safe = 1;\n');
    git('add', 'source-dir/child.mjs'); git('commit', '-qm', 'Tracked source descendant');
    fs.rmSync(directory, { recursive: true });
    fs.mkdirSync(target, { recursive: true }); fs.writeFileSync(path.join(target, 'child.mjs'), 'inert private target bytes');
    fs.symlinkSync(target, directory, process.platform === 'win32' ? 'junction' : 'dir');
  });
  const sentinel = denyPrivateReads(f, '.qa/private-target/child.mjs', true), commit = f.git('rev-parse', 'HEAD').trim();
  const { result, report } = f.record('', { env: sentinel.env });
  assert.equal(fs.existsSync(sentinel.marker), false, 'Tracked junction reached byte-bearing Git diff before metadata guard');
  assert.notEqual(result.status, 0); assert.equal(report.commit, commit); assert.equal(report.finalCommit, commit);
  assert.equal(report.sourceFingerprint, null); assert.equal(report.sourceCaptureReason, 'source-link-not-witnessed');
});
test('whole recorder keeps genuine tracked deletion capturable without confusing it with a link', t => {
  const { result, report } = fixture(t).record('require("fs").unlinkSync("input.txt");');
  assert.notEqual(result.status, 0); assert.equal(report.sourceUnchanged, false);
  assert.match(report.sourceFingerprint, /^[a-f0-9]{64}$/); assert.match(report.finalSourceFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(report.sourceCaptureReason, null); assert.equal(report.finalSourceCaptureReason, null);
});
